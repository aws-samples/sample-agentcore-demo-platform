/**
 * AgentCore Runtime Entry Point
 *
 * Implements the AgentCore HTTP protocol contract:
 *   POST /invocations  — run agent, return SSE stream
 *   GET  /ping         — health check
 *
 * Data flow:
 *   1. Backend prepares full workspace locally and uploads to S3
 *   2. Backend invokes AgentCore with S3 bucket/prefix in payload
 *   3. Container downloads entire workspace from S3 → /workspace/
 *   4. Runs Claude Agent SDK with cwd=/workspace
 *   5. SDK hooks (PostToolUse + Stop) sync /workspace changes back to S3
 *
 * Note: file-watcher.ts has been replaced by Claude Code SDK hooks
 * registered in agent-runner.ts. The hooks provide more precise,
 * event-driven S3 sync (per-file on Write/Edit, full sync on Stop).
 */

import http from 'http';
import { S3Client } from '@aws-sdk/client-s3';
import { runAgent } from './agent-runner.js';
import { restoreWorkspaceFromS3 } from './workspace-sync.js';
import type { AgentPayload, AgentEvent } from './types.js';

const PORT = Number(process.env.PORT ?? 8080);

// S3 client for workspace sync.
// IMPORTANT: The workspace S3 bucket is in us-east-1, but the container's
// AWS_REGION env var is set to us-west-2 (for Bedrock). We must explicitly
// use us-east-1 for S3. The container's AWS_ACCESS_KEY_ID/SECRET are for
// Bedrock (cross-account); S3 uses the same creds since the execution role
// has S3 permissions and the Bedrock creds also belong to the same account.
const S3_REGION = process.env.WORKSPACE_S3_REGION ?? 'us-east-1';
const s3 = new S3Client({ region: S3_REGION });

// ---------------------------------------------------------------------------
// /invocations
// ---------------------------------------------------------------------------

async function handleInvocations(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);

  let payload: AgentPayload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    return;
  }

  const bucket = payload.workspace_s3_bucket;
  const prefix = payload.workspace_s3_prefix;

  // --- Restore full workspace from S3 → /workspace/ ---
  if (bucket && prefix) {
    try {
      const count = await restoreWorkspaceFromS3(s3, bucket, prefix);
      console.log(`[index] Restored ${count} files from s3://${bucket}/${prefix}`);
    } catch (err) {
      console.error('[index] Workspace restore failed:', err);
    }
  }

  // --- SSE streaming response ---
  // S3 sync is now handled by SDK hooks in agent-runner.ts:
  //   PostToolUse (Write|Edit) → incremental file sync
  //   Stop → full workspace sync (safety net)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    for await (const event of runAgent(payload)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err) {
    const errorEvent: AgentEvent = {
      type: 'error',
      code: 'AGENT_EXECUTION_ERROR',
      message: err instanceof Error ? err.message : String(err),
    };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
  }

  res.end();
}

// ---------------------------------------------------------------------------
// /ping
// ---------------------------------------------------------------------------

function handlePing(res: http.ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'Healthy',
    time_of_last_update: Math.floor(Date.now() / 1000),
  }));
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/invocations') {
      await handleInvocations(req, res);
    } else if (req.method === 'GET' && req.url === '/ping') {
      handlePing(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (err) {
    console.error('[index] Unhandled error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[agentcore-runner] Listening on 0.0.0.0:${PORT}`);
});

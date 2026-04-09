/**
 * Checkpoint Routes
 *
 * API endpoints for resolving workflow checkpoints (human approval,
 * webhook callbacks, etc.) and listing pending checkpoints.
 */

import { FastifyInstance } from 'fastify';
import { checkpointService } from '../services/checkpoint.service.js';
import { workflowExecutorV2 } from '../services/workflow-executor-v2.js';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../config/database.js';

function formatSSEEvent(payload: { event?: string; data: string }): string {
  let result = '';
  if (payload.event) result += `event: ${payload.event}\n`;
  result += `data: ${payload.data}\n\n`;
  return result;
}

export async function checkpointRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/workflows/executions/:executionId/checkpoints/:checkpointId/resolve
   * Resolve a checkpoint (approve, reject, submit form data, etc.)
   * Triggers workflow resume via SSE.
   */
  fastify.post<{
    Params: { executionId: string; checkpointId: string };
    Body: {
      status: 'resolved' | 'cancelled';
      result?: Record<string, unknown>;
      reason?: string;
      scopeId: string;
    };
  }>(
    '/executions/:executionId/checkpoints/:checkpointId/resolve',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { executionId, checkpointId } = request.params;
      const { status, result, reason, scopeId } = request.body;

      // Resolve the checkpoint
      try {
        await checkpointService.resolve(checkpointId, {
          status,
          result,
          reason,
          resolvedBy: request.user!.id,
          resolvedBySource: 'user',
        });
      } catch (err) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : 'Failed to resolve checkpoint',
        });
      }

      // If cancelled, just return — workflow stays failed
      if (status === 'cancelled') {
        return reply.status(200).send({ message: 'Checkpoint cancelled. Workflow will not resume.' });
      }

      // Resume workflow via SSE
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
      });

      let clientDisconnected = false;
      reply.raw.on('close', () => { clientDisconnected = true; });

      const heartbeat = setInterval(() => {
        if (!clientDisconnected) {
          try { reply.raw.write(formatSSEEvent({ data: JSON.stringify({ type: 'heartbeat' }) })); }
          catch { /* disconnected */ }
        }
      }, 15_000);

      try {
        const generator = workflowExecutorV2.resume(executionId, checkpointId, scopeId);

        for await (const event of generator) {
          if (clientDisconnected) break;
          reply.raw.write(formatSSEEvent({ data: JSON.stringify(event) }));
        }
      } catch (error) {
        if (!clientDisconnected) {
          reply.raw.write(formatSSEEvent({
            data: JSON.stringify({
              type: 'error',
              message: error instanceof Error ? error.message : 'Resume failed',
            }),
          }));
        }
      } finally {
        clearInterval(heartbeat);
        if (!clientDisconnected) {
          try {
            reply.raw.write(formatSSEEvent({ data: '[DONE]' }));
            reply.raw.end();
          } catch { /* disconnected */ }
        }
      }
    }
  );

  /**
   * GET /api/workflows/executions/:executionId
   * Get execution status including checkpoint info.
   */
  fastify.get<{ Params: { executionId: string } }>(
    '/executions/:executionId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { executionId } = request.params;

      const execution = await prisma.workflow_executions.findUnique({
        where: { id: executionId },
        include: { node_executions: { orderBy: { created_at: 'asc' } } },
      });

      if (!execution) {
        return reply.status(404).send({ error: 'Execution not found' });
      }

      // Load active checkpoint if paused
      let checkpoint = null;
      if (execution.status === 'paused') {
        checkpoint = await checkpointService.getActiveForExecution(executionId);
      }

      return reply.status(200).send({
        id: execution.id,
        workflowId: execution.workflow_id,
        status: execution.status,
        title: execution.title,
        currentSegment: execution.current_segment,
        pausedAtNode: execution.paused_at_node,
        segmentPlan: execution.segment_plan,
        checkpoint: checkpoint ? {
          id: checkpoint.id,
          type: checkpoint.checkpointType,
          status: checkpoint.status,
          nodeId: checkpoint.nodeId,
          nodeTitle: checkpoint.nodeTitle,
          config: checkpoint.config,
          inputContext: checkpoint.inputContext,
          createdAt: checkpoint.createdAt,
          expiresAt: checkpoint.expiresAt,
        } : null,
        completedNodes: execution.node_executions
          .filter((n: { status: string }) => n.status === 'completed')
          .map((n: { node_id: string; node_data: unknown; status: string; completed_at: Date | null }) => ({
            nodeId: n.node_id,
            title: (n.node_data as Record<string, unknown>)?.title,
            status: n.status,
            completedAt: n.completed_at,
          })),
        error: execution.error_message,
        startedAt: execution.started_at,
        completedAt: execution.completed_at,
      });
    }
  );

  /**
   * GET /api/workflows/checkpoints/pending
   * List all pending checkpoints for the organization.
   */
  fastify.get(
    '/checkpoints/pending',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const checkpoints = await checkpointService.listPending(request.user!.orgId);

      return reply.status(200).send({
        data: checkpoints.map(c => ({
          id: c.id,
          executionId: c.executionId,
          nodeId: c.nodeId,
          nodeTitle: c.nodeTitle,
          checkpointType: c.checkpointType,
          status: c.status,
          config: c.config,
          inputContext: c.inputContext,
          createdAt: c.createdAt,
          expiresAt: c.expiresAt,
        })),
      });
    }
  );
}

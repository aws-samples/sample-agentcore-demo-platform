/**
 * Gmail Connector Lambda — AgentCore Gateway Target
 *
 * 提供 Gmail 邮件操作的 MCP 工具，通过 AgentCore Gateway 路由。
 * 凭证由 AgentCore Identity Token Vault 管理，Lambda 通过
 * @requires_access_token 或 Gateway Outbound Auth 获取 OAuth token。
 *
 * 工具列表:
 *   - gmail_search        搜索邮件
 *   - gmail_read          读取邮件详情
 *   - gmail_send          发送邮件
 *   - gmail_reply         回复邮件
 *   - gmail_list_labels   列出标签
 *   - gmail_modify_labels 修改邮件标签（归档、标星等）
 */

import type { Context } from 'aws-lambda';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body?: string;
  labels: string[];
}

interface ToolEvent {
  [key: string]: unknown;
  // Gateway 通过 clientContext 传入的连接器配置
  _connector_config?: {
    user_email?: string;
  };
}

// ---------------------------------------------------------------------------
// Gmail API helpers
// ---------------------------------------------------------------------------

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

async function gmailFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<any> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail API ${res.status}: ${err}`);
  }

  return res.json();
}

/** 解析 MIME 邮件头 */
function getHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

/** 解码 base64url 编码的邮件正文 */
function decodeBody(encoded: string): string {
  return Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

/** 从 message payload 中提取纯文本正文 */
function extractBody(payload: any): string {
  // 简单消息
  if (payload.body?.data) {
    return decodeBody(payload.body.data);
  }
  // multipart 消息：优先 text/plain，其次 text/html
  if (payload.parts) {
    const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) return decodeBody(textPart.body.data);

    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      const html = decodeBody(htmlPart.body.data);
      // 简单去标签，保留可读文本
      return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    // 递归查找嵌套 multipart
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }
  return '';
}

/** 将 Gmail API message 转为简洁结构 */
function parseMessage(msg: any, includeBody = false): GmailMessage {
  const headers = msg.payload?.headers ?? [];
  const result: GmailMessage = {
    id: msg.id,
    threadId: msg.threadId,
    subject: getHeader(headers, 'Subject'),
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    date: getHeader(headers, 'Date'),
    snippet: msg.snippet ?? '',
    labels: msg.labelIds ?? [],
  };
  if (includeBody) {
    result.body = extractBody(msg.payload);
  }
  return result;
}

/** 构建 RFC 2822 格式的邮件 */
function buildRawEmail(to: string, subject: string, body: string, from?: string, inReplyTo?: string, references?: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
  ];
  if (from) lines.unshift(`From: ${from}`);
  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`);
    lines.push(`References: ${references ?? inReplyTo}`);
  }
  lines.push('', body);

  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

/** 搜索邮件 */
async function toolSearch(token: string, event: ToolEvent): Promise<any> {
  const query = (event.query as string) ?? '';
  const maxResults = Math.min((event.max_results as number) ?? 10, 50);

  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });

  const list = await gmailFetch(`/users/me/messages?${params}`, token);
  if (!list.messages?.length) {
    return { messages: [], total: 0 };
  }

  // 批量获取邮件元数据（不含正文，节省 token）
  const messages = await Promise.all(
    list.messages.map((m: any) =>
      gmailFetch(`/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`, token)
    ),
  );

  return {
    messages: messages.map((m: any) => parseMessage(m, false)),
    total: list.resultSizeEstimate ?? messages.length,
  };
}

/** 读取邮件详情（含正文） */
async function toolRead(token: string, event: ToolEvent): Promise<any> {
  const messageId = event.message_id as string;
  if (!messageId) throw new Error('message_id is required');

  const msg = await gmailFetch(`/users/me/messages/${messageId}?format=full`, token);
  return parseMessage(msg, true);
}

/** 发送邮件 */
async function toolSend(token: string, event: ToolEvent): Promise<any> {
  const to = event.to as string;
  const subject = event.subject as string;
  const body = event.body as string;

  if (!to || !subject || !body) {
    throw new Error('to, subject, and body are required');
  }

  const raw = buildRawEmail(to, subject, body);
  const result = await gmailFetch('/users/me/messages/send', token, {
    method: 'POST',
    body: JSON.stringify({ raw }),
  });

  return { success: true, message_id: result.id, thread_id: result.threadId };
}

/** 回复邮件 */
async function toolReply(token: string, event: ToolEvent): Promise<any> {
  const messageId = event.message_id as string;
  const body = event.body as string;

  if (!messageId || !body) {
    throw new Error('message_id and body are required');
  }

  // 获取原始邮件以提取回复所需的头信息
  const original = await gmailFetch(`/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Message-ID&metadataHeaders=References`, token);
  const headers = original.payload?.headers ?? [];

  const originalFrom = getHeader(headers, 'From');
  const originalSubject = getHeader(headers, 'Subject');
  const originalMessageId = getHeader(headers, 'Message-ID');
  const originalReferences = getHeader(headers, 'References');

  const replySubject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`;
  const raw = buildRawEmail(originalFrom, replySubject, body, undefined, originalMessageId, originalReferences);

  const result = await gmailFetch('/users/me/messages/send', token, {
    method: 'POST',
    body: JSON.stringify({ raw, threadId: original.threadId }),
  });

  return { success: true, message_id: result.id, thread_id: result.threadId };
}

/** 列出标签 */
async function toolListLabels(token: string): Promise<any> {
  const result = await gmailFetch('/users/me/labels', token);
  return {
    labels: (result.labels ?? []).map((l: any) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      messages_total: l.messagesTotal,
      messages_unread: l.messagesUnread,
    })),
  };
}

/** 修改邮件标签（归档、标星、标记已读等） */
async function toolModifyLabels(token: string, event: ToolEvent): Promise<any> {
  const messageId = event.message_id as string;
  const addLabels = (event.add_labels as string[]) ?? [];
  const removeLabels = (event.remove_labels as string[]) ?? [];

  if (!messageId) throw new Error('message_id is required');
  if (!addLabels.length && !removeLabels.length) {
    throw new Error('At least one of add_labels or remove_labels is required');
  }

  await gmailFetch(`/users/me/messages/${messageId}/modify`, token, {
    method: 'POST',
    body: JSON.stringify({
      addLabelIds: addLabels,
      removeLabelIds: removeLabels,
    }),
  });

  return { success: true, message_id: messageId, added: addLabels, removed: removeLabels };
}

// ---------------------------------------------------------------------------
// Lambda handler — Gateway 入口
// ---------------------------------------------------------------------------

export async function handler(event: ToolEvent, context: Context): Promise<any> {
  // 1. 从 Gateway clientContext 获取工具名
  const rawToolName = (context as any).clientContext?.custom?.bedrockAgentCoreToolName ?? '';
  const toolName = rawToolName.includes('___') ? rawToolName.split('___').pop()! : rawToolName;

  // 2. 获取 OAuth access token
  //    方式 A: Gateway Outbound Auth 自动注入到 event 中
  //    方式 B: 环境变量（fallback，用于本地测试）
  const token = (event as any)._access_token
    ?? process.env.GMAIL_ACCESS_TOKEN
    ?? '';

  if (!token) {
    return { error: 'No access token available. Configure Gateway Outbound Auth or set GMAIL_ACCESS_TOKEN.' };
  }

  // 3. 路由到对应工具
  try {
    switch (toolName) {
      case 'gmail_search':
        return await toolSearch(token, event);
      case 'gmail_read':
        return await toolRead(token, event);
      case 'gmail_send':
        return await toolSend(token, event);
      case 'gmail_reply':
        return await toolReply(token, event);
      case 'gmail_list_labels':
        return await toolListLabels(token);
      case 'gmail_modify_labels':
        return await toolModifyLabels(token, event);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
      tool: toolName,
    };
  }
}

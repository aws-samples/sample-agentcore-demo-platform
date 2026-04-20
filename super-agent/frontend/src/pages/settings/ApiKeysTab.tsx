/**
 * API Keys tab — manage API keys for workflow execution and LLM proxy access.
 */

import { useState } from 'react';
import {
  Plus, Trash2, Copy, Check, Key, Loader2, AlertCircle, X, Shield, Clock, Code,
} from 'lucide-react';
import { useApiKeys } from '@/services/useApiKeys';
import { useTranslation } from '@/i18n';
import type { ApiKey } from '@/services/useApiKeys';

interface Props {
  isAdmin: boolean;
}

const SCOPE_KEYS: { id: string; labelKey: string }[] = [
  { id: 'workflow:execute', labelKey: 'apiKeys.scopeWorkflowExecute' },
  { id: 'workflow:read', labelKey: 'apiKeys.scopeWorkflowRead' },
  { id: 'workflow:write', labelKey: 'apiKeys.scopeWorkflowWrite' },
  { id: 'model:invoke', labelKey: 'apiKeys.scopeModelInvoke' },
];

// Scope descriptions for the code example panel (not localized — code examples stay in English)
const SCOPE_EXAMPLES: Record<string, { title: string; description: string; code: string }> = {
  'model:invoke': {
    title: 'LLM Proxy (OpenAI-compatible)',
    description: 'Use your API key as a drop-in replacement for OpenAI SDK. Supports Claude, Kimi K2.5, GLM 4.7, DeepSeek, Nova and more.',
    code: `# OpenAI SDK (Chat Completions)
from openai import OpenAI

client = OpenAI(
    base_url="{BASE_URL}/v1",
    api_key="{API_KEY}"
)

response = client.chat.completions.create(
    model="claude-sonnet-4-5",  # or kimi-k2.5, glm-4.7, deepseek-v3.2, nova-pro ...
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=200
)
print(response.choices[0].message.content)`,
  },
  'model:invoke:messages': {
    title: 'Anthropic Messages API',
    description: 'Use the Anthropic SDK / Messages protocol directly. Works with Claude Code and OpenCode.',
    code: `# Anthropic SDK (Messages API)
import anthropic

client = anthropic.Anthropic(
    base_url="{BASE_URL}",
    api_key="{API_KEY}"
)

message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=200,
    messages=[{"role": "user", "content": "Hello!"}]
)
print(message.content[0].text)`,
  },
  'model:invoke:curl': {
    title: 'cURL',
    description: 'Direct HTTP call — works with any language or tool.',
    code: `curl -X POST {BASE_URL}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {API_KEY}" \\
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 200
  }'`,
  },
  'workflow:execute': {
    title: 'Execute Workflow',
    description: 'Trigger a workflow execution via API and poll for results.',
    code: `curl -X POST {BASE_URL}/v1/openapi/workflow/{WORKFLOW_ID}/run \\
  -H "Authorization: Bearer {API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"variables": {"input": "value"}}'`,
  },
};

export function ApiKeysTab({ isAdmin }: Props) {
  const { apiKeys, isLoading, error, createApiKey, revokeApiKey, deleteApiKey, clearError } = useApiKeys();
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedExample, setCopiedExample] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState(['workflow:execute']);
  const [rateLimit, setRateLimit] = useState(60);
  const [expiresIn, setExpiresIn] = useState('never');

  const toggleScope = (s: string) =>
    setScopes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    let expiresAt: string | undefined;
    if (expiresIn !== 'never') {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(expiresIn));
      expiresAt = d.toISOString();
    }
    const result = await createApiKey({ name: name.trim(), scopes, rateLimitPerMinute: rateLimit, expiresAt });
    setIsCreating(false);
    if (result) {
      setNewKeySecret(result.apiKey);
      setShowForm(false);
      setName(''); setScopes(['workflow:execute']); setRateLimit(60); setExpiresIn('never');
    }
  };

  const handleCopy = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyExample = async (code: string, scopeId: string) => {
    const baseUrl = window.location.origin;
    const filled = code
      .replace(/{BASE_URL}/g, baseUrl)
      .replace(/{API_KEY}/g, newKeySecret ?? 'sk_your_api_key_here')
      .replace(/{WORKFLOW_ID}/g, 'your-workflow-id');
    await navigator.clipboard.writeText(filled);
    setCopiedExample(scopeId);
    setTimeout(() => setCopiedExample(null), 2000);
  };

  const handleRevoke = async (k: ApiKey) => {
    if (confirm(t('apiKeys.confirmRevoke').replace('{name}', k.name))) await revokeApiKey(k.id);
  };

  const handleDelete = async (k: ApiKey) => {
    if (confirm(t('apiKeys.confirmDelete').replace('{name}', k.name))) await deleteApiKey(k.id);
  };

  const formatLastUsed = (d: string | null) => {
    if (!d) return t('apiKeys.neverUsed');
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return t('apiKeys.justNow');
    if (diff < 3600000) return t('apiKeys.mAgo').replace('{n}', String(Math.round(diff / 60000)));
    if (diff < 86400000) return t('apiKeys.hAgo').replace('{n}', String(Math.round(diff / 3600000)));
    return new Date(d).toLocaleDateString();
  };

  // Determine which scopes the newly created key has (for showing relevant examples)
  const newKeyScopes = newKeySecret
    ? apiKeys.find((k) => k.keyPrefix === newKeySecret?.slice(0, 12))?.scopes ?? scopes
    : [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* New key revealed + code examples */}
      {newKeySecret && (
        <div className="space-y-4">
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <p className="text-sm font-medium text-green-400 mb-1">{t('apiKeys.created')}</p>
            <p className="text-xs text-gray-400 mb-3">{t('apiKeys.copyHint')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-gray-900 rounded text-xs text-gray-300 break-all font-mono">{newKeySecret}</code>
              <button onClick={() => handleCopy(newKeySecret)} className="p-2 hover:bg-gray-700 rounded">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
            <button onClick={() => setNewKeySecret(null)} className="mt-3 text-xs text-green-400 hover:text-green-300">
              {t('apiKeys.keySaved')}
            </button>
          </div>

          {/* Code examples based on scopes */}
          {Object.entries(SCOPE_EXAMPLES)
            .filter(([scopeId]) => {
              const baseScope = scopeId.split(':').slice(0, 2).join(':');
              return newKeyScopes.includes(baseScope) || scopes.includes(baseScope);
            })
            .map(([scopeId, example]) => (
              <div key={scopeId} className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-white">{example.title}</span>
                  </div>
                  <button
                    onClick={() => handleCopyExample(example.code, scopeId)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                  >
                    {copiedExample === scopeId ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {copiedExample === scopeId ? t('apiKeys.copied') : t('apiKeys.copy')}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-3">{example.description}</p>
                <pre className="p-3 bg-gray-900 rounded-lg text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap">
                  {example.code
                    .replace(/{BASE_URL}/g, window.location.origin)
                    .replace(/{API_KEY}/g, newKeySecret)
                    .replace(/{WORKFLOW_ID}/g, '<workflow-id>')}
                </pre>
              </div>
            ))}
        </div>
      )}

      {/* Create form */}
      {isAdmin && showForm && (
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl space-y-4">
          <h3 className="text-sm font-medium text-white">{t('apiKeys.newApiKey')}</h3>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('apiKeys.keyName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('apiKeys.keyNamePlaceholder')}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-2">{t('apiKeys.scopes')}</label>
            <div className="space-y-2">
              {SCOPE_KEYS.map((s) => (
                <label key={s.id} className="flex items-center gap-3 p-2 bg-gray-900 rounded cursor-pointer hover:bg-gray-800">
                  <input type="checkbox" checked={scopes.includes(s.id)} onChange={() => toggleScope(s.id)} />
                  <span className="text-sm text-white">{t(s.labelKey)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('apiKeys.rateLimit')}</label>
              <input
                type="number"
                value={rateLimit}
                onChange={(e) => setRateLimit(parseInt(e.target.value) || 60)}
                min={1} max={1000}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('apiKeys.expires')}</label>
              <select
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none"
              >
                <option value="never">{t('apiKeys.expiresNever')}</option>
                <option value="30">{t('apiKeys.expires30')}</option>
                <option value="90">{t('apiKeys.expires90')}</option>
                <option value="365">{t('apiKeys.expires1y')}</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">{t('common.cancel')}</button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm"
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common.create')}
            </button>
          </div>
        </div>
      )}

      {isAdmin && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          {t('apiKeys.createApiKey')}
        </button>
      )}

      {/* Available Models */}
      {apiKeys.some((k) => (k.scopes as string[]).includes('model:invoke')) && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-white select-none">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M6 4l8 6-8 6V4z" /></svg>
            {t('apiKeys.availableModels')}
          </summary>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'Anthropic', caps: '🖼️ 🔧 💭' },
              { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', caps: '🖼️ 🔧 💭' },
              { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'Anthropic', caps: '🖼️ 🔧 💭' },
              { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'Anthropic', caps: '🖼️ 🔧' },
              { id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'Moonshot AI', caps: '🖼️ 🔧' },
              { id: 'glm-4.7', name: 'GLM 4.7', provider: 'Zhipu AI', caps: '🔧' },
              { id: 'glm-4.7-flash', name: 'GLM 4.7 Flash', provider: 'Zhipu AI', caps: '🔧' },
              { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek', caps: '🔧' },
              { id: 'nova-pro', name: 'Nova Pro', provider: 'Amazon', caps: '🖼️ 🔧' },
              { id: 'nova-lite', name: 'Nova Lite', provider: 'Amazon', caps: '🖼️ 🔧' },
            ].map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2 bg-gray-800/40 border border-gray-700/50 rounded-lg">
                <div>
                  <span className="text-xs font-medium text-white">{m.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{m.provider}</span>
                </div>
                <div className="flex items-center gap-1">
                  <code className="text-[10px] text-gray-500 font-mono">{m.id}</code>
                  <span className="text-xs ml-1" title="🖼️=Vision 🔧=Tools 💭=Thinking">{m.caps}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-gray-600">🖼️ Vision &nbsp; 🔧 Tool Calling &nbsp; 💭 Extended Thinking</p>
        </details>
      )}

      {/* Keys list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-blue-400 animate-spin" /></div>
      ) : apiKeys.length === 0 && !newKeySecret ? (
        <div className="text-center py-12 text-gray-500">
          <Key className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-sm">{t('apiKeys.noKeys')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((k) => {
            const isActive = k.isActive !== false;
            const isExpired = k.expiresAt ? new Date(k.expiresAt) < new Date() : false;

            return (
              <div
                key={k.id}
                className={`p-4 rounded-xl border ${
                  !isActive ? 'border-red-500/20 bg-red-500/5'
                  : isExpired ? 'border-yellow-500/20 bg-yellow-500/5'
                  : 'border-gray-700 bg-gray-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{k.name}</span>
                  <div className="flex items-center gap-1">
                    {isActive && !isExpired && isAdmin && (
                      <button onClick={() => handleRevoke(k)} className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10 rounded">
                        <Shield className="w-4 h-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => handleDelete(k)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <code className="text-xs text-gray-400 bg-gray-900 px-2 py-1 rounded font-mono">{k.keyPrefix}...</code>
                  {!isActive ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">{t('apiKeys.statusRevoked')}</span>
                  ) : isExpired ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">{t('apiKeys.statusExpired')}</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">{t('apiKeys.statusActive')}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {k.scopes.map((s) => (
                    <span key={s} className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded">{s}</span>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatLastUsed(k.lastUsedAt)}</span>
                  <span>{k.rateLimitPerMinute}/min</span>
                  {k.expiresAt && (
                    <span className={isExpired ? 'text-red-400' : ''}>
                      {t('apiKeys.expires')} {new Date(k.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

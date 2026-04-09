/**
 * API Keys tab — wraps the existing ApiKeysPanel inline (no slide-over).
 */

import { useState } from 'react';
import {
  Plus, Trash2, Copy, Check, Key, Loader2, AlertCircle, X, Shield, Clock,
} from 'lucide-react';
import { useApiKeys } from '@/services/useApiKeys';
import type { ApiKey } from '@/services/useApiKeys';

interface Props {
  isAdmin: boolean;
}

const AVAILABLE_SCOPES = [
  { id: 'workflow:execute', label: 'Execute Workflows' },
  { id: 'workflow:read', label: 'Read Workflows' },
  { id: 'workflow:write', label: 'Write Workflows' },
];

export function ApiKeysTab({ isAdmin }: Props) {
  const { apiKeys, isLoading, error, createApiKey, revokeApiKey, deleteApiKey, clearError } = useApiKeys();
  const [showForm, setShowForm] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  const handleRevoke = async (k: ApiKey) => {
    if (confirm(`Revoke "${k.name}"? This will immediately disable the key.`)) await revokeApiKey(k.id);
  };

  const handleDelete = async (k: ApiKey) => {
    if (confirm(`Permanently delete "${k.name}"?`)) await deleteApiKey(k.id);
  };

  const formatLastUsed = (d: string | null) => {
    if (!d) return 'Never used';
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
    return new Date(d).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* New key revealed */}
      {newKeySecret && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <p className="text-sm font-medium text-green-400 mb-1">API Key Created</p>
          <p className="text-xs text-gray-400 mb-3">Copy it now — it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-gray-900 rounded text-xs text-gray-300 break-all font-mono">{newKeySecret}</code>
            <button onClick={() => handleCopy(newKeySecret)} className="p-2 hover:bg-gray-700 rounded">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
          <button onClick={() => setNewKeySecret(null)} className="mt-3 text-xs text-green-400 hover:text-green-300">
            I've saved the key
          </button>
        </div>
      )}

      {/* Create form */}
      {isAdmin && showForm && (
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl space-y-4">
          <h3 className="text-sm font-medium text-white">New API Key</h3>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production Key"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-2">Scopes</label>
            <div className="space-y-2">
              {AVAILABLE_SCOPES.map((s) => (
                <label key={s.id} className="flex items-center gap-3 p-2 bg-gray-900 rounded cursor-pointer hover:bg-gray-800">
                  <input type="checkbox" checked={scopes.includes(s.id)} onChange={() => toggleScope(s.id)} />
                  <span className="text-sm text-white">{s.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rate limit / min</label>
              <input
                type="number"
                value={rateLimit}
                onChange={(e) => setRateLimit(parseInt(e.target.value) || 60)}
                min={1} max={1000}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Expires</label>
              <select
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none"
              >
                <option value="never">Never</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm"
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
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
          Create API Key
        </button>
      )}

      {/* Keys list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-blue-400 animate-spin" /></div>
      ) : apiKeys.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Key className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-sm">No API keys yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((k) => (
            <div
              key={k.id}
              className={`p-4 rounded-xl border ${k.isActive ? 'border-gray-700 bg-gray-800/40' : 'border-red-500/20 bg-red-500/5'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{k.name}</span>
                <div className="flex items-center gap-1">
                  {k.isActive && isAdmin && (
                    <button onClick={() => handleRevoke(k)} className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10 rounded" title="Revoke">
                      <Shield className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => handleDelete(k)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <code className="text-xs text-gray-400 bg-gray-900 px-2 py-1 rounded font-mono">{k.keyPrefix}...</code>
                <span className={`text-xs px-2 py-0.5 rounded ${k.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {k.isActive ? 'Active' : 'Revoked'}
                </span>
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
                  <span className={new Date(k.expiresAt) < new Date() ? 'text-red-400' : ''}>
                    Expires {new Date(k.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

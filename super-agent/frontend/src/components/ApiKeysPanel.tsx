/**
 * ApiKeysPanel - Manage API keys for the organization
 */

import { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Copy, 
  Check,
  Key,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  Clock,
} from 'lucide-react';
import { useApiKeys } from '@/services/useApiKeys';
import type { ApiKey } from '@/services/useApiKeys';
import { useTranslation } from '@/i18n';

interface ApiKeysPanelProps {
  onClose: () => void;
}

export function ApiKeysPanel({ onClose }: ApiKeysPanelProps) {
  const {
    apiKeys,
    isLoading,
    error,
    createApiKey,
    revokeApiKey,
    deleteApiKey,
    clearError,
  } = useApiKeys();
  const { t } = useTranslation();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newScopes, setNewScopes] = useState<string[]>(['workflow:execute']);
  const [newRateLimit, setNewRateLimit] = useState(60);
  const [newExpiresIn, setNewExpiresIn] = useState<string>('never');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    
    setIsCreating(true);
    
    let expiresAt: string | undefined;
    if (newExpiresIn !== 'never') {
      const days = parseInt(newExpiresIn);
      const date = new Date();
      date.setDate(date.getDate() + days);
      expiresAt = date.toISOString();
    }

    const result = await createApiKey({
      name: newName.trim(),
      scopes: newScopes,
      rateLimitPerMinute: newRateLimit,
      expiresAt,
    });
    
    setIsCreating(false);
    
    if (result) {
      setNewKeySecret(result.apiKey);
      setShowCreateForm(false);
      setNewName('');
      setNewScopes(['workflow:execute']);
      setNewRateLimit(60);
      setNewExpiresIn('never');
    }
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (apiKey: ApiKey) => {
    if (confirm(t('apiKeys.confirmRevoke').replace('{name}', apiKey.name))) {
      await revokeApiKey(apiKey.id);
    }
  };

  const handleDelete = async (apiKey: ApiKey) => {
    if (confirm(t('apiKeys.confirmDelete').replace('{name}', apiKey.name))) {
      await deleteApiKey(apiKey.id);
    }
  };

  const toggleScope = (scope: string) => {
    setNewScopes(prev => 
      prev.includes(scope) 
        ? prev.filter(s => s !== scope)
        : [...prev, scope]
    );
  };

  const formatLastUsed = (lastUsedAt: string | null) => {
    if (!lastUsedAt) return t('apiKeys.neverUsed');
    const date = new Date(lastUsedAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return t('apiKeys.justNow');
    if (diff < 3600000) return t('apiKeys.minutesAgo').replace('{n}', String(Math.round(diff / 60000)));
    if (diff < 86400000) return t('apiKeys.hoursAgo').replace('{n}', String(Math.round(diff / 3600000)));
    return date.toLocaleDateString();
  };

  const AVAILABLE_SCOPES = [
    { id: 'workflow:execute', label: t('apiKeys.scopeWorkflowExecute'), description: t('apiKeys.scopeExecuteDesc') },
    { id: 'workflow:read', label: t('apiKeys.scopeWorkflowRead'), description: t('apiKeys.scopeReadDesc') },
    { id: 'workflow:write', label: t('apiKeys.scopeWorkflowWrite'), description: t('apiKeys.scopeWriteDesc') },
  ];

  return (
    <div className="w-[480px] border-l border-gray-800 bg-gray-900/95 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-medium text-white">{t('settings.tab.apiKeys')}</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* New Key Secret Modal */}
      {newKeySecret && (
        <div className="mx-4 mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-400 mb-2 font-medium">
            {t('apiKeys.createdSuccess')}
          </p>
          <p className="text-xs text-gray-400 mb-2">
            {t('apiKeys.copyNow')}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-gray-800 rounded text-xs text-gray-300 break-all font-mono">
              {newKeySecret}
            </code>
            <button
              onClick={() => handleCopyKey(newKeySecret)}
              className="p-2 hover:bg-gray-700 rounded"
            >
              {copiedId === newKeySecret ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
          <button
            onClick={() => setNewKeySecret(null)}
            className="mt-3 text-xs text-green-400 hover:text-green-300"
          >
            {t('apiKeys.copiedKey')}
          </button>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="mx-4 mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h4 className="text-sm font-medium text-white mb-3">{t('apiKeys.createApiKey')}</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('apiKeys.keyName')}</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('apiKeys.keyNamePlaceholder')}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-2">{t('apiKeys.scopes')}</label>
              <div className="space-y-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <label
                    key={scope.id}
                    className="flex items-start gap-3 p-2 bg-gray-900 rounded cursor-pointer hover:bg-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={newScopes.includes(scope.id)}
                      onChange={() => toggleScope(scope.id)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm text-white">{scope.label}</div>
                      <div className="text-xs text-gray-500">{scope.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('apiKeys.rateLimitPerMin')}</label>
                <input
                  type="number"
                  value={newRateLimit}
                  onChange={(e) => setNewRateLimit(parseInt(e.target.value) || 60)}
                  min={1}
                  max={1000}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('apiKeys.expiresIn')}</label>
                <select
                  value={newExpiresIn}
                  onChange={(e) => setNewExpiresIn(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:border-blue-500 outline-none"
                >
                  <option value="never">{t('apiKeys.expiresNever')}</option>
                  <option value="30">{t('apiKeys.expires30')}</option>
                  <option value="90">{t('apiKeys.expires90')}</option>
                  <option value="180">{t('apiKeys.expires180')}</option>
                  <option value="365">{t('apiKeys.expires1y')}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating || !newName.trim()}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-sm flex items-center justify-center gap-2"
              >
                {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('apiKeys.createKey')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : apiKeys.length === 0 && !showCreateForm ? (
          <div className="text-center py-8">
            <Key className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-2">{t('apiKeys.noKeys')}</p>
            <p className="text-xs text-gray-600 mb-4">
              {t('apiKeys.emptyHint')}
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              {t('apiKeys.createApiKey')}
            </button>
          </div>
        ) : (
          <>
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className={`p-4 rounded-lg border ${
                  apiKey.isActive
                    ? 'border-gray-700 bg-gray-800/50'
                    : 'border-red-500/30 bg-red-500/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">
                    {apiKey.name}
                  </span>
                  <div className="flex items-center gap-1">
                    {apiKey.isActive ? (
                      <button
                        onClick={() => handleRevoke(apiKey)}
                        className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-yellow-400"
                        title="Revoke"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                    ) : null}
                    <button
                      onClick={() => handleDelete(apiKey)}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Key Prefix */}
                <div className="flex items-center gap-2 mb-3">
                  <code className="text-xs text-gray-400 bg-gray-900 px-2 py-1 rounded font-mono">
                    {apiKey.keyPrefix}...
                  </code>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    apiKey.isActive 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {apiKey.isActive ? t('apiKeys.statusActive') : t('apiKeys.statusRevoked')}
                  </span>
                </div>

                {/* Scopes */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {apiKey.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded"
                    >
                      {scope}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatLastUsed(apiKey.lastUsedAt)}
                  </span>
                  <span>{apiKey.rateLimitPerMinute}/min</span>
                  {apiKey.expiresAt && (
                    <span className={
                      new Date(apiKey.expiresAt) < new Date() 
                        ? 'text-red-400' 
                        : ''
                    }>
                      {t('apiKeys.expires')} {new Date(apiKey.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full px-4 py-2 border border-dashed border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300 rounded-lg text-sm flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('apiKeys.createApiKey')}
              </button>
            )}
          </>
        )}
      </div>

      {/* Usage Info */}
      <div className="p-4 border-t border-gray-800 bg-gray-800/30">
        <h4 className="text-xs font-medium text-gray-400 mb-2">{t('apiKeys.apiUsage')}</h4>
        <code className="block text-xs text-gray-500 bg-gray-900 p-2 rounded">
          curl -X POST \<br />
          &nbsp;&nbsp;-H "X-API-Key: your_key" \<br />
          &nbsp;&nbsp;{import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'}/v1/openapi/workflow/:id/run
        </code>
      </div>
    </div>
  );
}

export default ApiKeysPanel;

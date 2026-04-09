/**
 * IMChannelsPanel
 *
 * Admin panel for managing IM channel bindings on a business scope.
 * Allows connecting Slack, Discord, and generic webhook channels
 * so external users can chat with the scope's agents via IM.
 */

import { useState } from 'react'
import { Plus, Trash2, Loader2, ToggleLeft, ToggleRight, MessageSquare, Hash, Globe, Copy, CheckCircle2 } from 'lucide-react'
import { useIMChannels } from '@/services/useIMChannels'
import type { CreateIMChannelRequest } from '@/services/useIMChannels'

const CHANNEL_TYPES = [
  { value: 'slack', label: 'Slack', icon: '💬', description: 'Connect a Slack channel via Events API' },
  { value: 'discord', label: 'Discord', icon: '🎮', description: 'Connect via Discord Gateway (WebSocket)' },
  { value: 'telegram', label: 'Telegram', icon: '✈️', description: 'Connect a Telegram group via Bot API' },
  { value: 'feishu', label: 'Feishu', icon: '🪶', description: 'Connect via Feishu WSClient (WebSocket)' },
  { value: 'dingtalk', label: 'DingTalk', icon: '🔔', description: 'Connect via DingTalk Stream (WebSocket)' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '📱', description: 'Connect via Meta Cloud API' },
  { value: 'webhook', label: 'Generic Webhook', icon: '🔗', description: 'Any platform via HTTP webhook' },
] as const

interface IMChannelsPanelProps {
  scopeId: string
  scopeName?: string
}

export function IMChannelsPanel({ scopeId, scopeName }: IMChannelsPanelProps) {
  const { bindings, isLoading, error, create, update, remove, clearError } = useIMChannels(scopeId)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<CreateIMChannelRequest>({
    channel_type: 'slack',
    channel_id: '',
    channel_name: '',
    bot_token: '',
    webhook_url: '',
    config: {},
  })
  const [isSaving, setIsSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!formData.channel_id) return
    setIsSaving(true)
    const result = await create(formData)
    setIsSaving(false)
    if (result) {
      setShowForm(false)
      setFormData({ channel_type: 'slack', channel_id: '', channel_name: '', bot_token: '', webhook_url: '', config: {} })
    }
  }

  const handleToggle = async (bindingId: string, currentEnabled: boolean) => {
    await update(bindingId, { is_enabled: !currentEnabled })
  }

  const handleDelete = async (bindingId: string) => {
    if (!confirm('Remove this IM channel binding?')) return
    await remove(bindingId)
  }

  const copyWebhookUrl = (bindingId: string) => {
    const url = `${window.location.origin.replace(/:\d+$/, ':3000')}/api/im/webhook/${bindingId}`
    navigator.clipboard.writeText(url)
    setCopiedId(bindingId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const channelTypeInfo = (type: string) => CHANNEL_TYPES.find(t => t.value === type)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            IM Channels
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Connect messaging platforms so users can chat with {scopeName || 'this scope'} via Slack, Discord, etc.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Channel
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center justify-between">
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-300 text-xs">Dismiss</button>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {CHANNEL_TYPES.map(ct => (
              <button
                key={ct.value}
                onClick={() => setFormData(prev => ({ ...prev, channel_type: ct.value }))}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  formData.channel_type === ct.value
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <span className="text-lg">{ct.icon}</span>
                <div className="text-sm font-medium text-white mt-1">{ct.label}</div>
                <div className="text-xs text-gray-400">{ct.description}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {formData.channel_type === 'slack' ? 'Slack Channel ID' :
                 formData.channel_type === 'discord' ? 'Discord Channel ID' :
                 formData.channel_type === 'telegram' ? 'Telegram Chat ID' :
                 formData.channel_type === 'feishu' ? 'Feishu Chat ID' :
                 formData.channel_type === 'dingtalk' ? 'DingTalk Conversation ID' :
                 formData.channel_type === 'whatsapp' ? 'Phone Number ID' : 'Channel Identifier'}
              </label>
              <input
                type="text"
                value={formData.channel_id}
                onChange={e => setFormData(prev => ({ ...prev, channel_id: e.target.value }))}
                placeholder={formData.channel_type === 'slack' ? 'C0123456789' :
                             formData.channel_type === 'telegram' ? '-1001234567890' : 'channel-id'}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Display Name (optional)</label>
              <input
                type="text"
                value={formData.channel_name || ''}
                onChange={e => setFormData(prev => ({ ...prev, channel_name: e.target.value }))}
                placeholder="#general"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {formData.channel_type !== 'webhook' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {formData.channel_type === 'feishu' ? 'App Secret' :
                 formData.channel_type === 'dingtalk' ? 'Client Secret (App Secret)' :
                 formData.channel_type === 'whatsapp' ? 'Access Token' : 'Bot Token'}
              </label>
              <input
                type="password"
                value={formData.bot_token || ''}
                onChange={e => setFormData(prev => ({ ...prev, bot_token: e.target.value }))}
                placeholder={formData.channel_type === 'slack' ? 'xoxb-...' :
                             formData.channel_type === 'telegram' ? '123456:ABC-DEF...' :
                             formData.channel_type === 'feishu' ? 'App Secret from Feishu console' :
                             formData.channel_type === 'dingtalk' ? 'App Secret from DingTalk console' :
                             formData.channel_type === 'whatsapp' ? 'Meta permanent access token' : 'Bot token'}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {/* Platform-specific config fields */}
          {formData.channel_type === 'feishu' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">App ID</label>
                <input
                  type="text"
                  value={(formData.config as Record<string, string>)?.app_id || ''}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, app_id: e.target.value },
                  }))}
                  placeholder="cli_a1234567890b"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Verification Token (optional)</label>
                <input
                  type="password"
                  value={(formData.config as Record<string, string>)?.verification_token || ''}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, verification_token: e.target.value },
                  }))}
                  placeholder="Event verification token"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {formData.channel_type === 'slack' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Signing Secret (optional, for request verification)</label>
              <input
                type="password"
                value={(formData.config as Record<string, string>)?.signing_secret || ''}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  config: { ...prev.config, signing_secret: e.target.value },
                }))}
                placeholder="Slack app signing secret"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {formData.channel_type === 'discord' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Public Key (for interaction verification)</label>
              <input
                type="text"
                value={(formData.config as Record<string, string>)?.public_key || ''}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  config: { ...prev.config, public_key: e.target.value },
                }))}
                placeholder="Discord application public key"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {formData.channel_type === 'telegram' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Webhook Secret Token (optional)</label>
              <input
                type="password"
                value={(formData.config as Record<string, string>)?.secret_token || ''}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  config: { ...prev.config, secret_token: e.target.value },
                }))}
                placeholder="Secret token for webhook verification"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {formData.channel_type === 'dingtalk' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Client ID (App Key)</label>
                <input
                  type="text"
                  value={(formData.config as Record<string, string>)?.client_id || ''}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, client_id: e.target.value },
                  }))}
                  placeholder="dingxxxxxxxx"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Signing Secret (optional)</label>
                <input
                  type="password"
                  value={(formData.config as Record<string, string>)?.signing_secret || ''}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, signing_secret: e.target.value },
                  }))}
                  placeholder="For legacy webhook verification"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {formData.channel_type === 'whatsapp' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone Number ID</label>
                <input
                  type="text"
                  value={(formData.config as Record<string, string>)?.phone_number_id || ''}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    channel_id: e.target.value,
                    config: { ...prev.config, phone_number_id: e.target.value },
                  }))}
                  placeholder="1234567890"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Verify Token (for webhook setup)</label>
                <input
                  type="text"
                  value={(formData.config as Record<string, string>)?.verify_token || ''}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, verify_token: e.target.value },
                  }))}
                  placeholder="my-verify-token-123"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">App Secret (for signature verification)</label>
                <input
                  type="password"
                  value={(formData.config as Record<string, string>)?.app_secret || ''}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, app_secret: e.target.value },
                  }))}
                  placeholder="Meta App Secret"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!formData.channel_id || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Connect Channel
            </button>
          </div>
        </div>
      )}

      {/* Bindings List */}
      {bindings.length === 0 && !showForm ? (
        <div className="text-center py-12 text-gray-500">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No IM channels connected yet.</p>
          <p className="text-xs mt-1">Add a channel to let users chat with this scope from Slack, Discord, or other platforms.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bindings.map(binding => {
            const info = channelTypeInfo(binding.channel_type)
            return (
              <div
                key={binding.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  binding.is_enabled
                    ? 'bg-gray-800/30 border-gray-700'
                    : 'bg-gray-900/50 border-gray-800 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{info?.icon || '📡'}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {binding.channel_name || binding.channel_id}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                        {info?.label || binding.channel_type}
                      </span>
                      {!binding.is_enabled && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Hash className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-500 font-mono">{binding.channel_id}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Webhook URL copy button (for webhook type or as generic endpoint) */}
                  {binding.channel_type === 'webhook' && (
                    <button
                      onClick={() => copyWebhookUrl(binding.id)}
                      className="p-1.5 text-gray-400 hover:text-white transition-colors"
                      title="Copy webhook URL"
                    >
                      {copiedId === binding.id ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {/* Toggle enabled/disabled */}
                  <button
                    onClick={() => handleToggle(binding.id, binding.is_enabled)}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title={binding.is_enabled ? 'Disable' : 'Enable'}
                  >
                    {binding.is_enabled ? (
                      <ToggleRight className="w-5 h-5 text-green-400" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(binding.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Setup Instructions */}
      {bindings.length > 0 && (
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-400">
            <strong className="text-gray-300">Slack:</strong> Set Event Subscriptions URL to{' '}
            <code className="text-blue-400 bg-gray-900 px-1 rounded">{window.location.origin.replace(/:\d+$/, ':3001')}/api/im/slack/events</code>
            {' '}and subscribe to <code className="text-blue-400 bg-gray-900 px-1 rounded">message.channels</code>.
          </p>
          <p className="text-xs text-gray-400">
            <strong className="text-gray-300">Telegram:</strong> Use the "Register Webhook" button, or call{' '}
            <code className="text-blue-400 bg-gray-900 px-1 rounded">setWebhook</code> with URL{' '}
            <code className="text-blue-400 bg-gray-900 px-1 rounded">{window.location.origin.replace(/:\d+$/, ':3001')}/api/im/telegram/webhook</code>
          </p>
          <p className="text-xs text-gray-400">
            <strong className="text-gray-300">Discord:</strong> Connects automatically via Gateway WebSocket. Just provide the Bot Token.
          </p>
          <p className="text-xs text-gray-400">
            <strong className="text-gray-300">Feishu:</strong> Connects automatically via WSClient. Provide App ID + App Secret.
          </p>
          <p className="text-xs text-gray-400">
            <strong className="text-gray-300">DingTalk:</strong> Connects automatically via Stream mode. Provide Client ID + Client Secret.
          </p>
          <p className="text-xs text-gray-400">
            <strong className="text-gray-300">WhatsApp:</strong> Set webhook URL in Meta Developer Console to{' '}
            <code className="text-blue-400 bg-gray-900 px-1 rounded">{window.location.origin.replace(/:\d+$/, ':3001')}/api/im/whatsapp/webhook</code>
            {' '}and subscribe to <code className="text-blue-400 bg-gray-900 px-1 rounded">messages</code>.
          </p>
        </div>
      )}
    </div>
  )
}

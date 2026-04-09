import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Loader2, Save, AlertCircle, Trash2, Wifi, WifiOff, Terminal, Globe } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useMCP } from '@/services'
import { useToast, FormField, FormErrorSummary, useFormValidation, ValidationRules, LoadingSpinner, MCPCatalogPanel } from '@/components'
import type { MCPServer, MCPServerConfig } from '@/types'
import type { McpServerEntry } from '@/data/mcp-servers'

type ServerType = 'stdio' | 'sse' | 'http'

interface EnvEntry {
  key: string
  value: string
}

interface FormState {
  name: string
  description: string
  serverType: ServerType
  // stdio fields
  command: string
  args: string
  // sse/http fields
  url: string
  // env vars (for stdio)
  envEntries: EnvEntry[]
  // legacy
  hostAddress: string
  oauth: {
    clientId: string
    clientSecret: string
    tokenUrl: string
    scope: string
  }
  headers: string
}

const DEFAULT_FORM: FormState = {
  name: '',
  description: '',
  serverType: 'stdio',
  command: '',
  args: '',
  url: '',
  envEntries: [],
  hostAddress: '',
  oauth: { clientId: '', clientSecret: '', tokenUrl: '', scope: '' },
  headers: '{}',
}

export function MCPConfigurator() {
  const { t } = useTranslation()
  const { servers, isLoading, error, getServers, createServer, updateServer, deleteServer, testConnection } = useMCP()
  const { success, error: showError } = useToast()
  const validation = useFormValidation()

  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState<string | null>(null)
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM })

  useEffect(() => { getServers() }, [getServers])

  const validateForm = (): boolean => {
    validation.clearAllErrors()
    let isValid = true

    isValid = validation.validateField('name', form.name, [
      ValidationRules.required('Server name is required')
    ]) && isValid

    if (form.serverType === 'stdio') {
      isValid = validation.validateField('command', form.command, [
        ValidationRules.required('Command is required')
      ]) && isValid
    } else {
      isValid = validation.validateField('url', form.url, [
        ValidationRules.required('URL is required'),
        ValidationRules.url('Please enter a valid URL')
      ]) && isValid
    }

    if (form.oauth.tokenUrl) {
      isValid = validation.validateField('oauth.tokenUrl', form.oauth.tokenUrl, [
        ValidationRules.url('Please enter a valid token URL')
      ]) && isValid
    }

    if (form.headers.trim()) {
      isValid = validation.validateField('headers', form.headers, [
        ValidationRules.custom(
          (value) => { try { JSON.parse(value); return true } catch { return false } },
          'Invalid JSON format'
        )
      ]) && isValid
    }

    return isValid
  }

  const resetForm = () => {
    setForm({ ...DEFAULT_FORM })
    validation.clearAllErrors()
    setSelectedServerId(null)
  }

  /** Populate form from an existing server's config */
  const handleSelectServer = (server: MCPServer) => {
    setSelectedServerId(server.id)

    let serverType: ServerType = 'sse'
    let command = ''
    let args = ''
    let url = ''
    let envEntries: EnvEntry[] = []

    if (server.config) {
      serverType = server.config.type || 'stdio'
      if (serverType === 'stdio') {
        command = server.config.command || ''
        args = (server.config.args || []).join(' ')
        if (server.config.env) {
          envEntries = Object.entries(server.config.env).map(([key, value]) => ({ key, value }))
        }
      } else {
        url = server.config.url || server.hostAddress || ''
      }
    } else {
      // Legacy: infer from hostAddress
      const addr = server.hostAddress || ''
      if (addr.startsWith('http://') || addr.startsWith('https://')) {
        serverType = 'sse'
        url = addr
      } else if (addr) {
        serverType = 'stdio'
        const parts = addr.split(/\s+/)
        command = parts[0] || ''
        args = parts.slice(1).join(' ')
      }
    }

    setForm({
      name: server.name,
      description: server.description,
      serverType,
      command,
      args,
      url,
      envEntries,
      hostAddress: server.hostAddress,
      oauth: {
        clientId: server.oauth?.clientId || '',
        clientSecret: server.oauth?.clientSecret || '',
        tokenUrl: server.oauth?.tokenUrl || '',
        scope: server.oauth?.scope || '',
      },
      headers: server.headers ? JSON.stringify(server.headers, null, 2) : '{}',
    })
    setIsFormOpen(true)
    validation.clearAllErrors()
  }

  const handleNewServer = () => { resetForm(); setIsFormOpen(true) }

  /** Set of server names already in the org list (for catalog "Installed" badges) */
  const installedNames = useMemo(
    () => new Set(servers.map(s => s.name)),
    [servers],
  )

  /** Install a server from the catalog: create a record, refresh list, then open it for editing */
  const handleCatalogInstall = useCallback(async (entry: McpServerEntry) => {
    try {
      const config: MCPServerConfig = entry.config
        ? { type: entry.config.type as MCPServerConfig['type'], command: entry.config.command, args: entry.config.args }
        : { type: 'sse', url: '' }

      const hostAddress = entry.config
        ? [entry.config.command, ...entry.config.args].join(' ')
        : ''

      const created = await createServer({
        name: entry.name,
        description: entry.description,
        hostAddress,
        config,
        oauth: { clientId: '', clientSecret: '', tokenUrl: '', scope: '' },
        headers: {},
        status: 'active',
      })
      success(`${entry.name} installed`)
      // Refresh list and auto-select the new server for editing
      await getServers()
      handleSelectServer(created)
      setIsCatalogOpen(false)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to install server')
    }
  }, [createServer, getServers, success, showError])

  /** Build structured config and hostAddress from form state */
  const buildConfigAndAddress = (): { config: MCPServerConfig; hostAddress: string } => {
    if (form.serverType === 'stdio') {
      const argsArray = form.args.trim() ? form.args.trim().split(/\s+/) : []
      const env: Record<string, string> = {}
      for (const entry of form.envEntries) {
        if (entry.key.trim()) env[entry.key.trim()] = entry.value
      }
      const config: MCPServerConfig = {
        type: 'stdio',
        command: form.command.trim(),
        args: argsArray.length > 0 ? argsArray : undefined,
        env: Object.keys(env).length > 0 ? env : undefined,
      }
      // hostAddress as a human-readable fallback
      const hostAddress = [form.command.trim(), ...argsArray].join(' ')
      return { config, hostAddress }
    } else {
      const config: MCPServerConfig = { type: form.serverType, url: form.url.trim() }
      return { config, hostAddress: form.url.trim() }
    }
  }

  const handleSave = async () => {
    if (!validateForm()) { showError('Please fix validation errors'); return }
    setIsSaving(true)
    try {
      const headersObj = form.headers.trim() ? JSON.parse(form.headers) : {}
      const { config, hostAddress } = buildConfigAndAddress()

      const serverData = {
        name: form.name,
        description: form.description,
        hostAddress,
        config,
        oauth: {
          clientId: form.oauth.clientId,
          clientSecret: form.oauth.clientSecret,
          tokenUrl: form.oauth.tokenUrl,
          scope: form.oauth.scope,
        },
        headers: headersObj,
        status: 'active' as const,
      }

      if (selectedServerId) {
        await updateServer(selectedServerId, serverData)
        success('Server updated successfully')
      } else {
        await createServer(serverData)
        success('Server created successfully')
      }
      setIsFormOpen(false)
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save server'
      showError(message)
    } finally { setIsSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this server?')) return
    try {
      await deleteServer(id)
      success('Server deleted successfully')
      if (selectedServerId === id) { setIsFormOpen(false); resetForm() }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete server')
    }
  }

  const handleTestConnection = async (id: string) => {
    setIsTestingConnection(id)
    try {
      const result = await testConnection(id)
      if (result.success) success(`Connection successful${result.latency ? ` (${result.latency}ms)` : ''}`)
      else showError(result.message)
    } catch { showError('Failed to test connection') }
    finally { setIsTestingConnection(null) }
  }

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('oauth.')) {
      const oauthField = field.split('.')[1]
      setForm(prev => ({ ...prev, oauth: { ...prev.oauth, [oauthField]: value } }))
    } else {
      setForm(prev => ({ ...prev, [field]: value }))
    }
    validation.clearError(field)
  }

  const addEnvEntry = () => setForm(prev => ({ ...prev, envEntries: [...prev.envEntries, { key: '', value: '' }] }))
  const removeEnvEntry = (index: number) => setForm(prev => ({ ...prev, envEntries: prev.envEntries.filter((_, i) => i !== index) }))
  const updateEnvEntry = (index: number, field: 'key' | 'value', value: string) => {
    setForm(prev => ({
      ...prev,
      envEntries: prev.envEntries.map((e, i) => i === index ? { ...e, [field]: value } : e),
    }))
  }

  /** Helper to display server type badge in the list */
  const getServerTypeLabel = (server: MCPServer): string => {
    if (server.config?.type) return server.config.type.toUpperCase()
    const addr = server.hostAddress || ''
    return (addr.startsWith('http://') || addr.startsWith('https://')) ? 'SSE' : 'STDIO'
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{t('mcpConfig.title')}</h1>
            <p className="text-sm text-gray-400">{t('mcpConfig.subtitle')}</p>
          </div>
          <button
            onClick={() => setIsCatalogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('mcpConfig.addServer')}</span>
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl">
        {error && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-700 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Server List */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-white">{t('mcpConfig.servers')}</h2>
              </div>
              <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 flex items-center justify-center"><LoadingSpinner size="sm" /></div>
                ) : servers.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm">{t('mcpConfig.noServers')}</div>
                ) : (
                  servers.map(server => (
                    <button
                      key={server.id}
                      onClick={() => handleSelectServer(server)}
                      className={`w-full text-left p-4 transition-colors ${
                        selectedServerId === server.id
                          ? 'bg-blue-600/20 border-l-2 border-blue-500'
                          : 'hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{server.name}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 font-mono">
                              {getServerTypeLabel(server)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {server.config?.type === 'stdio'
                              ? `${server.config.command || ''} ${(server.config.args || []).join(' ')}`.trim()
                              : server.hostAddress}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {server.status === 'active' ? (
                            <Wifi className="w-4 h-4 text-green-400" />
                          ) : (
                            <WifiOff className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Form */}
          {isFormOpen && (
            <div className="lg:col-span-2">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-white mb-6">
                  {selectedServerId ? t('mcpConfig.editServer') : t('mcpConfig.newServer')}
                </h2>

                <FormErrorSummary errors={validation.errors} className="mb-6" />

                <div className="space-y-6">
                  {/* Name */}
                  <FormField label={t('mcpConfig.name')} error={validation.errors.name} required>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                      placeholder="e.g., rolex"
                    />
                  </FormField>

                  {/* Description */}
                  <FormField label={t('mcpConfig.description')}>
                    <textarea
                      value={form.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors resize-none"
                      placeholder="Describe what this MCP server does..."
                    />
                  </FormField>

                  {/* Server Type Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Server Type</label>
                    <div className="flex gap-2">
                      {([
                        { type: 'stdio' as ServerType, icon: Terminal, label: 'stdio (command)' },
                        { type: 'sse' as ServerType, icon: Globe, label: 'SSE / HTTP (URL)' },
                      ]).map(({ type, icon: Icon, label }) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, serverType: type }))}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                            form.serverType === type || (type === 'sse' && form.serverType === 'http')
                              ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                              : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Conditional fields based on server type */}
                  {form.serverType === 'stdio' ? (
                    <>
                      {/* Command */}
                      <FormField label="Command" error={validation.errors.command} required>
                        <input
                          type="text"
                          value={form.command}
                          onChange={(e) => handleInputChange('command', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors font-mono text-sm"
                          placeholder="e.g., npx"
                        />
                      </FormField>

                      {/* Args */}
                      <FormField label="Arguments" info="Space-separated arguments passed to the command">
                        <input
                          type="text"
                          value={form.args}
                          onChange={(e) => handleInputChange('args', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors font-mono text-sm"
                          placeholder="e.g., -y @rolexjs/mcp-server"
                        />
                      </FormField>

                      {/* Environment Variables */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-300">Environment Variables</label>
                          <button
                            type="button"
                            onClick={addEnvEntry}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            + Add variable
                          </button>
                        </div>
                        {form.envEntries.length === 0 ? (
                          <p className="text-xs text-gray-500">No environment variables configured</p>
                        ) : (
                          <div className="space-y-2">
                            {form.envEntries.map((entry, index) => (
                              <div key={index} className="flex gap-2 items-center">
                                <input
                                  type="text"
                                  value={entry.key}
                                  onChange={(e) => updateEnvEntry(index, 'key', e.target.value)}
                                  className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-xs focus:border-blue-500 outline-none"
                                  placeholder="KEY"
                                />
                                <span className="text-gray-500">=</span>
                                <input
                                  type="text"
                                  value={entry.value}
                                  onChange={(e) => updateEnvEntry(index, 'value', e.target.value)}
                                  className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-xs focus:border-blue-500 outline-none"
                                  placeholder="value"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeEnvEntry(index)}
                                  className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* SSE / HTTP URL */
                    <FormField label="Server URL" error={validation.errors.url} required>
                      <input
                        type="text"
                        value={form.url}
                        onChange={(e) => handleInputChange('url', e.target.value)}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                        placeholder="e.g., https://api.example.com/mcp"
                      />
                    </FormField>
                  )}

                  {/* OAuth Configuration */}
                  <div className="border-t border-gray-700 pt-6">
                    <h3 className="text-sm font-semibold text-white mb-4">{t('mcpConfig.oauthConfig')}</h3>
                    <div className="space-y-4">
                      <FormField label={t('mcpConfig.clientId')}>
                        <input type="text" value={form.oauth.clientId} onChange={(e) => handleInputChange('oauth.clientId', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                          placeholder="Your OAuth client ID" />
                      </FormField>
                      <FormField label={t('mcpConfig.clientSecret')}>
                        <input type="password" value={form.oauth.clientSecret} onChange={(e) => handleInputChange('oauth.clientSecret', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                          placeholder="Your OAuth client secret" />
                      </FormField>
                      <FormField label={t('mcpConfig.tokenUrl')} error={validation.errors['oauth.tokenUrl']}>
                        <input type="text" value={form.oauth.tokenUrl} onChange={(e) => handleInputChange('oauth.tokenUrl', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                          placeholder="e.g., https://oauth.example.com/token" />
                      </FormField>
                      <FormField label={t('mcpConfig.scope')}>
                        <input type="text" value={form.oauth.scope} onChange={(e) => handleInputChange('oauth.scope', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                          placeholder="e.g., read:user,repo" />
                      </FormField>
                    </div>
                  </div>

                  {/* Headers */}
                  <div className="border-t border-gray-700 pt-6">
                    <FormField label={t('mcpConfig.headers')} error={validation.errors.headers} info="JSON format for custom request headers">
                      <textarea
                        value={form.headers}
                        onChange={(e) => handleInputChange('headers', e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors resize-none font-mono text-xs"
                        placeholder='{"X-Custom-Header": "value"}'
                      />
                    </FormField>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-6 border-t border-gray-700">
                    <button onClick={handleSave} disabled={isSaving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed rounded-lg text-white transition-colors">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>{t('common.save')}</span>
                    </button>
                    {selectedServerId && (
                      <>
                        <button onClick={() => handleTestConnection(selectedServerId)} disabled={isTestingConnection === selectedServerId}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed rounded-lg text-white transition-colors">
                          {isTestingConnection === selectedServerId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                          <span>{t('mcpConfig.testConnection')}</span>
                        </button>
                        <button onClick={() => handleDelete(selectedServerId)}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button onClick={() => { setIsFormOpen(false); resetForm() }}
                      className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors">
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Catalog slide-out panel */}
      <MCPCatalogPanel
        open={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        installedNames={installedNames}
        onInstall={handleCatalogInstall}
      />
    </div>
  )
}

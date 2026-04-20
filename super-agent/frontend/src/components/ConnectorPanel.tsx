/**
 * ConnectorPanel
 *
 * Slide-out panel for managing Data Connectors within a business scope.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  X, Loader2, Plus, AlertCircle, Search, Plug, Trash2,
  CheckCircle2, XCircle, RefreshCw, Shield, Database, Cloud, Globe,
} from 'lucide-react'
import { connectorService } from '@/services/connectorService'
import { useScopeConnectors } from '@/hooks/useConnectors'
import { useTranslation } from '@/i18n/useTranslation'

// ---------------------------------------------------------------------------
// Connector template catalog
// ---------------------------------------------------------------------------

interface ConfigField {
  key: string
  label_en: string
  label_cn: string
  placeholder?: string
  type?: 'text' | 'password' | 'textarea' | 'number'
  required?: boolean
}

interface ConnectorTemplate {
  id: string
  name: string
  icon: string
  category: 'saas' | 'database' | 'aws_service' | 'internal_api'
  auth_type: string
  description_en: string
  description_cn: string
  /** Extra config fields shown in Step 1 (non-credential settings) */
  configFields?: ConfigField[]
  /** Credential fields shown in Step 2 */
  credentialFields: ConfigField[]
}

const TEMPLATES: ConnectorTemplate[] = [
  {
    id: 'gmail', name: 'Gmail', icon: '📧', category: 'saas', auth_type: 'oauth2',
    description_en: 'Email search, read, send, reply',
    description_cn: '邮件搜索、读取、发送、回复',
    credentialFields: [], // OAuth — just a button, no manual fields
  },
  {
    id: 'salesforce', name: 'Salesforce', icon: '☁️', category: 'saas', auth_type: 'oauth2',
    description_en: 'CRM data query & management',
    description_cn: 'CRM 数据查询与管理',
    configFields: [
      { key: 'instance_url', label_en: 'Instance URL', label_cn: '实例 URL', placeholder: 'https://myorg.salesforce.com', required: true },
      { key: 'api_version', label_en: 'API Version', label_cn: 'API 版本', placeholder: 'v59.0' },
    ],
    credentialFields: [], // OAuth — just a button
  },
  {
    id: 'google-maps', name: 'Google Maps', icon: '🗺️', category: 'saas', auth_type: 'api_key',
    description_en: 'Geolocation & routing services',
    description_cn: '地理位置与路线服务',
    credentialFields: [
      { key: 'api_key', label_en: 'API Key', label_cn: 'API Key', placeholder: 'AIza...', type: 'password', required: true },
    ],
  },
  {
    id: 'bigquery', name: 'BigQuery', icon: '🔍', category: 'database', auth_type: 'service_account',
    description_en: 'Big data analytics queries',
    description_cn: '大数据分析查询',
    configFields: [
      { key: 'project_id', label_en: 'Project ID', label_cn: 'Project ID', placeholder: 'my-gcp-project', required: true },
      { key: 'dataset', label_en: 'Default Dataset', label_cn: '默认 Dataset', placeholder: 'analytics' },
    ],
    credentialFields: [
      { key: 'service_account_json', label_en: 'Service Account JSON', label_cn: 'Service Account JSON', type: 'textarea', required: true,
        placeholder: '{"type":"service_account","project_id":"...","private_key":"..."}' },
    ],
  },
  {
    id: 'redshift', name: 'Redshift', icon: '🏢', category: 'database', auth_type: 'connection_string',
    description_en: 'Data warehouse queries',
    description_cn: '数据仓库查询',
    configFields: [
      { key: 'schema', label_en: 'Schema', label_cn: 'Schema', placeholder: 'public' },
    ],
    credentialFields: [
      { key: 'host', label_en: 'Host', label_cn: 'Host', placeholder: 'my-cluster.xxx.us-east-1.redshift.amazonaws.com', required: true },
      { key: 'port', label_en: 'Port', label_cn: 'Port', placeholder: '5439', type: 'number' },
      { key: 'database', label_en: 'Database', label_cn: 'Database', placeholder: 'dev', required: true },
      { key: 'username', label_en: 'Username', label_cn: 'Username', required: true },
      { key: 'password', label_en: 'Password', label_cn: 'Password', type: 'password', required: true },
    ],
  },
  {
    id: 'sagemaker', name: 'SageMaker', icon: '🧠', category: 'aws_service', auth_type: 'iam_role',
    description_en: 'ML model inference',
    description_cn: 'ML 模型推理',
    configFields: [
      { key: 'region', label_en: 'AWS Region', label_cn: 'AWS Region', placeholder: 'us-east-1', required: true },
      { key: 'endpoint_name', label_en: 'Endpoint Name', label_cn: 'Endpoint Name', placeholder: 'my-model-endpoint' },
    ],
    credentialFields: [
      { key: 'role_arn', label_en: 'IAM Role ARN', label_cn: 'IAM Role ARN', placeholder: 'arn:aws:iam::123456789012:role/SageMakerRole', required: true },
    ],
  },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ConnectorPanelProps {
  open: boolean
  onClose: () => void
  scopeId: string | null
}

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  switch (status) {
    case 'connected':
      return <span className="flex items-center gap-1 text-[10px] text-green-400"><CheckCircle2 className="w-3 h-3" />{t('connector.status.connected')}</span>
    case 'error':
      return <span className="flex items-center gap-1 text-[10px] text-red-400"><XCircle className="w-3 h-3" />{t('connector.status.error')}</span>
    case 'disabled':
      return <span className="flex items-center gap-1 text-[10px] text-gray-500"><XCircle className="w-3 h-3" />{t('connector.status.disabled')}</span>
    default:
      return <span className="flex items-center gap-1 text-[10px] text-yellow-400"><RefreshCw className="w-3 h-3" />{t('connector.status.pending')}</span>
  }
}

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case 'saas': return <Cloud className="w-4 h-4 text-blue-400" />
    case 'database': return <Database className="w-4 h-4 text-emerald-400" />
    case 'aws_service': return <Shield className="w-4 h-4 text-orange-400" />
    default: return <Globe className="w-4 h-4 text-gray-400" />
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ConnectorPanel({ open, onClose, scopeId }: ConnectorPanelProps) {
  const { t, language } = useTranslation()
  const { bindings, loading, error: loadError, reload } = useScopeConnectors(scopeId)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ConnectorTemplate | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardName, setWizardName] = useState('')
  const [wizardConfig, setWizardConfig] = useState<Record<string, string>>({})
  const [wizardCredData, setWizardCredData] = useState<Record<string, string>>({})
  const [wizardSaving, setWizardSaving] = useState(false)
  const [wizardTestResult, setWizardTestResult] = useState<{ success: boolean; message?: string } | null>(null)
  const [oauthCredentialId, setOauthCredentialId] = useState<string | null>(null)
  const [oauthAuthorizing, setOauthAuthorizing] = useState(false)
  const [oauthConfigured, setOauthConfigured] = useState<boolean | null>(null) // null = loading
  const [oauthClientId, setOauthClientId] = useState('')
  const [oauthClientSecret, setOauthClientSecret] = useState('')
  const [oauthSavingConfig, setOauthSavingConfig] = useState(false)

  useEffect(() => {
    if (open) { void reload(); setSearchQuery(''); setError(null) }
  }, [open, reload])

  // Check OAuth provider config when entering Step 2
  useEffect(() => {
    if (wizardStep === 2 && selectedTemplate?.auth_type === 'oauth2') {
      const providerMap: Record<string, string> = { gmail: 'google', salesforce: 'salesforce' }
      const provider = providerMap[selectedTemplate.id]
      if (provider) {
        setOauthConfigured(null)
        connectorService.getOAuthProviderConfig(provider)
          .then(res => setOauthConfigured(res.configured))
          .catch(() => setOauthConfigured(false))
      }
    }
  }, [wizardStep, selectedTemplate])

  const handleRemove = useCallback(async (connectorId: string) => {
    if (!scopeId) return
    setRemovingId(connectorId)
    try {
      await connectorService.unbindFromScope(scopeId, connectorId)
      await reload()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to remove') }
    finally { setRemovingId(null) }
  }, [scopeId, reload])

  const handleTest = useCallback(async (connectorId: string) => {
    setTestingId(connectorId)
    try {
      const result = await connectorService.testConnector(connectorId)
      if (!result.success) setError(result.message ?? 'Test failed')
      await reload()
    } catch (e) { setError(e instanceof Error ? e.message : 'Test failed') }
    finally { setTestingId(null) }
  }, [reload])

  const startWizard = (tmpl: ConnectorTemplate) => {
    setSelectedTemplate(tmpl)
    setWizardStep(1)
    setWizardName(tmpl.name)
    setWizardConfig({})
    setWizardCredData({})
    setWizardTestResult(null)
    setOauthCredentialId(null)
    setOauthAuthorizing(false)
    setShowWizard(true)
  }

  // ── OAuth popup flow ──
  const handleSaveOAuthConfig = useCallback(async () => {
    if (!selectedTemplate) return
    const providerMap: Record<string, string> = { gmail: 'google', salesforce: 'salesforce' }
    const provider = providerMap[selectedTemplate.id]
    if (!provider) return
    setOauthSavingConfig(true)
    try {
      await connectorService.saveOAuthProviderConfig(provider, oauthClientId, oauthClientSecret)
      setOauthConfigured(true)
      setOauthClientId('')
      setOauthClientSecret('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save config') }
    finally { setOauthSavingConfig(false) }
  }, [selectedTemplate, oauthClientId, oauthClientSecret])

  const handleOAuthAuthorize = useCallback(async () => {
    if (!selectedTemplate) return
    setOauthAuthorizing(true)
    setError(null)

    // Map template to OAuth provider
    const providerMap: Record<string, string> = { gmail: 'google', salesforce: 'salesforce' }
    const provider = providerMap[selectedTemplate.id]
    if (!provider) { setError('No OAuth provider for this connector'); setOauthAuthorizing(false); return }

    try {
      const { authorize_url } = await connectorService.getOAuthAuthorizeUrl(provider)

      // Open popup
      const width = 500, height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      const popup = window.open(
        authorize_url,
        'oauth-popup',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
      )

      // Listen for the callback message from the popup
      const onMessage = (event: MessageEvent) => {
        if (event.data?.type !== 'oauth-callback') return
        window.removeEventListener('message', onMessage)
        setOauthAuthorizing(false)

        const { success, error: oauthError, credentialId } = event.data.payload
        if (success && credentialId) {
          setOauthCredentialId(credentialId)
        } else {
          setError(oauthError ?? 'OAuth authorization failed')
        }
      }
      window.addEventListener('message', onMessage)

      // Fallback: if popup is closed without completing
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          // Give a moment for the message to arrive
          setTimeout(() => {
            setOauthAuthorizing(false)
          }, 500)
        }
      }, 500)

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start OAuth')
      setOauthAuthorizing(false)
    }
  }, [selectedTemplate])

  const handleWizardSave = useCallback(async () => {
    if (!scopeId || !selectedTemplate) return
    setWizardSaving(true)
    setError(null)
    try {
      let credentialId: string

      if (selectedTemplate.auth_type === 'oauth2') {
        // OAuth flow: credential was already created by the callback
        if (!oauthCredentialId) { setError('Please authorize first'); setWizardSaving(false); return }
        credentialId = oauthCredentialId
      } else {
        // Non-OAuth: create credential from form data
        const cred = await connectorService.createCredential({
          name: wizardName + '-credential',
          auth_type: selectedTemplate.auth_type,
          credential_data: wizardCredData,
        })
        credentialId = cred.id
      }

      const connector = await connectorService.createConnector({
        name: wizardName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
        display_name: wizardName,
        connector_type: selectedTemplate.category,
        credential_id: credentialId,
        config: wizardConfig,
        template_id: selectedTemplate.id,
      })
      await connectorService.bindToScope(scopeId, connector.id)
      const testResult = await connectorService.testConnector(connector.id)
      setWizardTestResult(testResult)
      setWizardStep(3)
      await reload()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to create connector') }
    finally { setWizardSaving(false) }
  }, [scopeId, selectedTemplate, wizardName, wizardConfig, wizardCredData, oauthCredentialId, reload])

  const filteredTemplates = searchQuery.trim()
    ? TEMPLATES.filter(tmpl =>
        tmpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tmpl.description_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tmpl.description_cn.toLowerCase().includes(searchQuery.toLowerCase()))
    : TEMPLATES

  const installedIds = new Set(bindings.map(b => b.connector.template_id).filter(Boolean))

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[460px] max-w-full h-full bg-gray-900 border-l border-gray-800 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Plug className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-semibold text-white">{t('connector.title')}</span>
            <span className="text-xs text-gray-500">({bindings.length})</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error */}
        {(error || loadError) && (
          <div className="mx-3 mt-2 px-3 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 truncate">{error || loadError}</span>
            <button onClick={() => setError(null)}><X className="w-3 h-3" /></button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">

          {/* ── Wizard ── */}
          {showWizard && selectedTemplate && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-white">
                  {t('connector.connect')} {selectedTemplate.name}
                  <span className="text-xs text-gray-500 ml-2">Step {wizardStep}/3</span>
                </span>
                <button onClick={() => setShowWizard(false)} className="text-xs text-gray-400 hover:text-white">{t('connector.wizard.cancel')}</button>
              </div>

              {wizardStep === 1 && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">{t('connector.wizard.name')}</label>
                    <input value={wizardName} onChange={e => setWizardName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  {(selectedTemplate.configFields ?? []).map(field => (
                    <div key={field.key}>
                      <label className="text-xs text-gray-400 block mb-1">{language === 'cn' ? field.label_cn : field.label_en}</label>
                      <input placeholder={field.placeholder} value={wizardConfig[field.key] ?? ''}
                        onChange={e => setWizardConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
                    </div>
                  ))}
                  <button onClick={() => setWizardStep(2)} disabled={!wizardName.trim()}
                    className="w-full py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50">
                    {t('connector.wizard.next')}
                  </button>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-3">
                  <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-gray-300">{t('connector.wizard.securityNote')}</span>
                    </div>
                    <p className="text-[10px] text-gray-500">{t('connector.wizard.securityDetail')}</p>
                  </div>

                  {/* OAuth connectors */}
                  {selectedTemplate.auth_type === 'oauth2' && (
                    oauthCredentialId ? (
                      <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        <span className="text-sm text-green-400">{t('connector.wizard.success')}</span>
                      </div>
                    ) : oauthConfigured === null ? (
                      <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 text-gray-500 animate-spin" /></div>
                    ) : oauthConfigured ? (
                      <button onClick={handleOAuthAuthorize} disabled={oauthAuthorizing}
                        className="w-full py-3 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                        {oauthAuthorizing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {oauthAuthorizing ? 'Authorizing...' : `🔗 ${t('connector.wizard.authorize')} ${selectedTemplate.name}`}
                      </button>
                    ) : (
                      /* OAuth not configured — show setup form */
                      <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg border border-yellow-500/30">
                        <div className="flex items-center gap-2 text-yellow-400 text-xs">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>OAuth not configured yet</span>
                        </div>
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          {selectedTemplate.id === 'gmail'
                            ? 'Go to Google Cloud Console → APIs & Services → Credentials → Create OAuth Client ID (Web application). Add redirect URI: '
                            : 'Go to Salesforce Setup → App Manager → New Connected App. Set callback URL: '}
                          <code className="text-cyan-400 bg-gray-900 px-1 rounded text-[9px]">
                            {window.location.origin}/api/data-connectors/oauth/{selectedTemplate.id === 'gmail' ? 'google' : 'salesforce'}/callback
                          </code>
                        </p>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Client ID</label>
                          <input value={oauthClientId} onChange={e => setOauthClientId(e.target.value)}
                            placeholder={selectedTemplate.id === 'gmail' ? '123456789-xxx.apps.googleusercontent.com' : '3MVG9...'}
                            className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 font-mono" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Client Secret</label>
                          <input type="password" value={oauthClientSecret} onChange={e => setOauthClientSecret(e.target.value)}
                            placeholder="GOCSPX-..."
                            className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 font-mono" />
                        </div>
                        <button onClick={handleSaveOAuthConfig} disabled={oauthSavingConfig || !oauthClientId.trim() || !oauthClientSecret.trim()}
                          className="w-full py-2 text-sm bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                          {oauthSavingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                          {oauthSavingConfig ? 'Saving...' : 'Save & Continue'}
                        </button>
                      </div>
                    )
                  )}

                  {/* Non-OAuth: render credential fields dynamically */}
                  {selectedTemplate.credentialFields.map(field => (
                    <div key={field.key}>
                      <label className="text-xs text-gray-400 block mb-1">{language === 'cn' ? field.label_cn : field.label_en}</label>
                      {field.type === 'textarea' ? (
                        <textarea rows={4} placeholder={field.placeholder} value={wizardCredData[field.key] ?? ''}
                          onChange={e => setWizardCredData(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-mono" />
                      ) : (
                        <input type={field.type ?? 'text'} placeholder={field.placeholder} value={wizardCredData[field.key] ?? ''}
                          onChange={e => setWizardCredData(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
                      )}
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <button onClick={() => setWizardStep(1)} className="flex-1 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors">
                      ← {t('connector.wizard.prev')}
                    </button>
                    <button onClick={handleWizardSave}
                      disabled={wizardSaving || (selectedTemplate.auth_type === 'oauth2' ? !oauthCredentialId : selectedTemplate.credentialFields.filter(f => f.required).some(f => !wizardCredData[f.key]?.trim()))}
                      className="flex-1 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                      {wizardSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {wizardSaving ? t('connector.wizard.creating') : t('connector.wizard.createAndTest')}
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && wizardTestResult && (
                <div className="space-y-3">
                  <div className={`p-4 rounded-lg border ${wizardTestResult.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    {wizardTestResult.success
                      ? <div className="flex items-center gap-2 text-green-400"><CheckCircle2 className="w-5 h-5" /><span className="text-sm">{t('connector.wizard.success')}</span></div>
                      : <div className="flex items-center gap-2 text-red-400"><XCircle className="w-5 h-5" /><span className="text-sm">{wizardTestResult.message ?? t('connector.status.error')}</span></div>
                    }
                  </div>
                  <button onClick={() => { setShowWizard(false); setSelectedTemplate(null) }}
                    className="w-full py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors">
                    {t('connector.wizard.done')} ✓
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Installed connectors ── */}
          {!showWizard && (
            <>
              <div className="px-4 py-3">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{t('connector.connected')}</span>

                {loading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-gray-500 animate-spin" /></div>
                ) : bindings.length === 0 ? (
                  <div className="text-center py-6">
                    <Plug className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">{t('connector.noConnectors')}</p>
                    <p className="text-xs text-gray-600 mt-1">{t('connector.noConnectorsHint')}</p>
                  </div>
                ) : (
                  <div className="space-y-2 mt-3">
                    {bindings.map(b => (
                      <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-800/50 rounded-lg border border-gray-700/50 group">
                        <CategoryIcon category={b.connector.connector_type} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{b.connector.display_name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 flex-shrink-0">
                              <Shield className="w-2.5 h-2.5 inline mr-0.5" />Gateway
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <StatusBadge status={b.connector.status} t={t} />
                            {b.connector.usage_count > 0 && (
                              <span className="text-[10px] text-gray-600">{b.connector.usage_count} {t('connector.uses')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleTest(b.connector.id)} disabled={testingId === b.connector.id}
                            className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-cyan-400 transition-colors" title="Test">
                            {testingId === b.connector.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => handleRemove(b.connector.id)} disabled={removingId === b.connector.id}
                            className="p-1.5 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors" title="Remove">
                            {removingId === b.connector.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Catalog ── */}
              <div className="px-4 py-3 border-t border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{t('connector.catalog')}</span>
                  <span className="text-[10px] text-gray-600">{filteredTemplates.length} {t('connector.items')}</span>
                </div>

                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('connector.search')}
                    className="w-full pl-8 pr-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors" />
                </div>

                <div className="space-y-2">
                  {filteredTemplates.map(tmpl => (
                    <div key={tmpl.id} className="flex items-start gap-3 px-3 py-2.5 bg-gray-800/30 rounded-lg border border-gray-700/30">
                      <span className="text-lg mt-0.5">{tmpl.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{tmpl.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400/70">
                            {tmpl.auth_type === 'oauth2' ? 'OAuth' : tmpl.auth_type === 'api_key' ? 'API Key' : tmpl.auth_type === 'iam_role' ? 'IAM' : tmpl.auth_type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{language === 'cn' ? tmpl.description_cn : tmpl.description_en}</p>
                      </div>
                      {installedIds.has(tmpl.id) ? (
                        <span className="text-xs text-green-400 px-2 py-1 bg-green-500/10 rounded flex-shrink-0">{t('connector.alreadyConnected')}</span>
                      ) : (
                        <button onClick={() => startWizard(tmpl)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded transition-colors flex-shrink-0">
                          <Plus className="w-3 h-3" /> {t('connector.connect')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-600">{t('connector.footer')}</p>
        </div>
      </div>
    </div>
  )
}

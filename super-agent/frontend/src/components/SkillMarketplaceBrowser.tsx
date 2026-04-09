import { useState, useCallback } from 'react'
import { Search, Download, ExternalLink, Package, Loader2, FileText, ChevronLeft, Tag } from 'lucide-react'
import { restClient } from '@/services/api/restClient'

interface MarketplaceSkill {
  owner: string
  name: string
  installRef: string
  url: string
  description: string | null
}

interface SkillDetail {
  name: string
  owner: string
  installRef: string
  url: string
  description: string | null
  skillMdContent: string | null
  contentFileName: string | null
  repoUrl: string
}

interface InstallResult {
  skillId: string
  name: string
  displayName: string
  assignedToAgent: boolean
}

type View = 'search' | 'detail'

export function SkillMarketplaceBrowser() {
  const [view, setView] = useState<View>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MarketplaceSkill[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isInstalling, setIsInstalling] = useState<string | null>(null)
  const [installSuccess, setInstallSuccess] = useState<InstallResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setIsSearching(true)
    setError(null)
    setResults([])
    try {
      const res = await restClient.get<{ data: MarketplaceSkill[] }>(
        `/api/skills/marketplace/search?q=${encodeURIComponent(query.trim())}`
      )
      setResults(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }, [query])

  const handleViewDetail = useCallback(async (skill: MarketplaceSkill) => {
    setIsLoadingDetail(true)
    setError(null)
    try {
      const res = await restClient.get<{ data: SkillDetail }>(
        `/api/skills/marketplace/detail?ref=${encodeURIComponent(skill.installRef)}`
      )
      setSelectedSkill(res.data)
      setView('detail')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skill details')
    } finally {
      setIsLoadingDetail(false)
    }
  }, [])

  const handleInstall = useCallback(async (installRef: string) => {
    setIsInstalling(installRef)
    setError(null)
    setInstallSuccess(null)
    try {
      const res = await restClient.post<{ data: InstallResult }>(
        '/api/skills/marketplace/install',
        { installRef }
      )
      setInstallSuccess(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed')
    } finally {
      setIsInstalling(null)
    }
  }, [])

  const handleBack = () => {
    setView('search')
    setSelectedSkill(null)
    setInstallSuccess(null)
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {view === 'detail' && (
            <button onClick={handleBack} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
          )}
          <Package className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Skill Marketplace</h1>
            <p className="text-sm text-gray-500">Browse and install skills from skills.sh</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Install success */}
        {installSuccess && (
          <div className="mb-4 px-4 py-3 bg-green-500/20 border border-green-500/50 rounded-lg text-sm text-green-400">
            Installed "{installSuccess.displayName}" (ID: {installSuccess.skillId})
          </div>
        )}

        {view === 'search' ? (
          <>
            {/* Search bar */}
            <div className="flex gap-2 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search skills (e.g. code review, testing, deployment)"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white
                             placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching || !query.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500
                           rounded-lg text-white font-medium transition-colors flex items-center gap-2"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>

            {/* Results */}
            {isSearching ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                <span className="ml-3 text-gray-400">Searching marketplace...</span>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-3">
                {results.map((skill) => (
                  <div
                    key={skill.installRef}
                    className="p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">{skill.name}</span>
                          <span className="text-xs text-gray-500 font-mono">{skill.owner}</span>
                        </div>
                        {skill.description && (
                          <p className="text-sm text-gray-400 mb-2 line-clamp-2">{skill.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="font-mono">{skill.installRef}</span>
                          <a href={skill.url} target="_blank" rel="noopener noreferrer"
                             className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                            <ExternalLink className="w-3 h-3" /> skills.sh
                          </a>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleViewDetail(skill)}
                          disabled={isLoadingDetail}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700
                                     rounded-lg text-sm text-gray-300 transition-colors flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" /> Details
                        </button>
                        <button
                          onClick={() => handleInstall(skill.installRef)}
                          disabled={isInstalling === skill.installRef}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
                                     rounded-lg text-sm text-white transition-colors flex items-center gap-1.5"
                        >
                          {isInstalling === skill.installRef
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Download className="w-3.5 h-3.5" />}
                          Install
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : query && !isSearching ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No skills found for "{query}"</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Search the skills.sh marketplace</p>
                <p className="text-sm mt-1">Find community skills for code review, testing, deployment, and more</p>
              </div>
            )}
          </>
        ) : selectedSkill ? (
          /* Detail view */
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedSkill.name}</h2>
                <p className="text-sm text-gray-500 font-mono">{selectedSkill.owner}</p>
              </div>
              <div className="flex gap-2">
                <a href={selectedSkill.repoUrl} target="_blank" rel="noopener noreferrer"
                   className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700
                              rounded-lg text-sm text-gray-300 transition-colors flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" /> GitHub
                </a>
                <button
                  onClick={() => handleInstall(selectedSkill.installRef)}
                  disabled={!!isInstalling}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
                             rounded-lg text-sm text-white font-medium transition-colors flex items-center gap-1.5"
                >
                  {isInstalling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Install Skill
                </button>
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-mono text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                {selectedSkill.installRef}
              </span>
            </div>

            {/* SKILL.md content */}
            {selectedSkill.skillMdContent ? (
              <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-800 bg-gray-800/50">
                  <span className="text-sm text-gray-400 font-mono">{selectedSkill.contentFileName || 'SKILL.md'}</span>
                </div>
                <pre className="p-4 text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-[60vh]">
                  {selectedSkill.skillMdContent}
                </pre>
              </div>
            ) : (
              <div className="p-6 bg-gray-900 border border-gray-800 rounded-lg text-center text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No documentation found in repository</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

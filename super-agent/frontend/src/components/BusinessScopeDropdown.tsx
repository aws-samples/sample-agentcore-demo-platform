import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Briefcase } from 'lucide-react'
import { useTranslation } from '@/i18n'

export interface ScopeItem {
  id: string
  name: string
  icon?: string | null
  color?: string | null
  description?: string | null
}

interface BusinessScopeDropdownProps {
  scopes: ScopeItem[]
  activeScopeId: string | null
  onScopeChange: (scopeId: string) => void
  /** Placeholder text when nothing is selected */
  placeholder?: string
  /** Optional className for the trigger button */
  className?: string
}

export function BusinessScopeDropdown({
  scopes,
  activeScopeId,
  onScopeChange,
  placeholder = 'Select scope',
  className,
}: BusinessScopeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  const selectedScope = scopes.find(s => s.id === activeScopeId)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const lowerSearch = search.toLowerCase()
  const filteredScopes = search
    ? scopes.filter(
        s =>
          s.name.toLowerCase().includes(lowerSearch) ||
          (s.description || '').toLowerCase().includes(lowerSearch),
      )
    : scopes

  const handleSelect = (scopeId: string) => {
    onScopeChange(scopeId)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={
          className ??
          'flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors text-sm min-w-[200px]'
        }
      >
        {selectedScope?.icon ? (
          <span className="text-base">{selectedScope.icon}</span>
        ) : (
          <Briefcase className="w-4 h-4 text-gray-400" />
        )}
        <span className="text-white font-medium truncate max-w-[200px]">
          {selectedScope ? selectedScope.name : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-30 overflow-hidden">
          {/* Search (only show when there are enough items) */}
          {scopes.length > 5 && (
            <div className="p-2 border-b border-gray-700">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('scopeDropdown.searchPlaceholder')}
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {filteredScopes.length > 0 ? (
              filteredScopes.map(scope => (
                <button
                  key={scope.id}
                  onClick={() => handleSelect(scope.id)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors ${
                    scope.id === activeScopeId ? 'bg-blue-600/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                      style={{ backgroundColor: scope.color || '#4B5563' }}
                    >
                      {scope.icon || scope.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium truncate ${
                          scope.id === activeScopeId ? 'text-blue-400' : 'text-white'
                        }`}
                      >
                        {scope.name}
                      </div>
                      {scope.description && (
                        <div className="text-xs text-gray-400 truncate">{scope.description}</div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">{t('scopeDropdown.noResults')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

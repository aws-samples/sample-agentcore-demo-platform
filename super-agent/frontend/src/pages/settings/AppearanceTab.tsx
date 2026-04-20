import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type Theme } from '@/services/ThemeContext'
import { useTranslation } from '@/i18n'

const OPTIONS: { id: Theme; icon: React.ReactNode; labelKey: string; descKey: string }[] = [
  { id: 'light', icon: <Sun className="w-5 h-5" />, labelKey: 'appearance.light', descKey: 'appearance.lightDesc' },
  { id: 'dark', icon: <Moon className="w-5 h-5" />, labelKey: 'appearance.dark', descKey: 'appearance.darkDesc' },
  { id: 'system', icon: <Monitor className="w-5 h-5" />, labelKey: 'appearance.system', descKey: 'appearance.systemDesc' },
]

export function AppearanceTab() {
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-1">{t('appearance.title')}</h2>
      <p className="text-sm text-gray-400 mb-6">
        {t('appearance.subtitle')}
      </p>

      <div className="grid grid-cols-3 gap-4 max-w-lg">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setTheme(opt.id)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              theme === opt.id
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
            }`}
          >
            <div className={`${theme === opt.id ? 'text-blue-500' : 'text-gray-400'}`}>
              {opt.icon}
            </div>
            <span className={`text-sm font-medium ${theme === opt.id ? 'text-blue-400' : 'text-gray-300'}`}>
              {t(opt.labelKey)}
            </span>
            <span className="text-xs text-gray-500 text-center">
              {t(opt.descKey)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

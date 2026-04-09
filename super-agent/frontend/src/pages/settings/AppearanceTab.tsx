import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type Theme } from '@/services/ThemeContext'

const OPTIONS: { id: Theme; icon: React.ReactNode; label: string; desc: string }[] = [
  { id: 'light', icon: <Sun className="w-5 h-5" />, label: 'Light', desc: 'Always use light theme' },
  { id: 'dark', icon: <Moon className="w-5 h-5" />, label: 'Dark', desc: 'Always use dark theme' },
  { id: 'system', icon: <Monitor className="w-5 h-5" />, label: 'System', desc: 'Follow your OS setting' },
]

export function AppearanceTab() {
  const { theme, setTheme } = useTheme()

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-1">Appearance</h2>
      <p className="text-sm text-gray-400 mb-6">
        Choose how the platform looks to you.
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
              {opt.label}
            </span>
            <span className="text-xs text-gray-500 text-center">
              {opt.desc}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

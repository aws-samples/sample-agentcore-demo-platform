import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe,
  Server,
  Sparkles,
  Code,
  BookOpen,
  Settings,
  Users,
  LogOut,
  X,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useAuth } from '@/services/AuthContext'

interface AdminMenuProps {
  isOpen: boolean
  onClose: () => void
}

interface MenuItemConfig {
  id: string
  icon: React.ReactNode
  labelKey: string
  path?: string
  action?: () => void
  hidden?: boolean
}

export function AdminMenu({ isOpen, onClose }: AdminMenuProps) {
  const navigate = useNavigate()
  const { t, currentLanguage, setLanguage } = useTranslation()
  const { logout } = useAuth()
  const menuRef = useRef<HTMLDivElement>(null)

  const toggleLanguage = () => {
    setLanguage(currentLanguage === 'en' ? 'cn' : 'en')
  }

  const menuItems: MenuItemConfig[] = [
    {
      id: 'language',
      icon: <Globe className="w-4 h-4" />,
      labelKey: 'admin.languageSync',
      action: toggleLanguage,
    },
    {
      id: 'mcp',
      icon: <Server className="w-4 h-4" />,
      labelKey: 'admin.mcpConfig',
      path: '/config/mcp',
      hidden: true,
    },
    {
      id: 'skill',
      icon: <Sparkles className="w-4 h-4" />,
      labelKey: 'admin.skillConfig',
      path: '/config/skills',
      hidden: true,
    },
    {
      id: 'restApi',
      icon: <Code className="w-4 h-4" />,
      labelKey: 'admin.restApiConfig',
      path: '/config/rest-api',
      hidden: true,
    },
    {
      id: 'knowledge',
      icon: <BookOpen className="w-4 h-4" />,
      labelKey: 'admin.knowledgeBase',
      path: '/config/knowledge',
      hidden: true,
    },
    {
      id: 'framework',
      icon: <Settings className="w-4 h-4" />,
      labelKey: 'admin.frameworkSettings',
      path: '/config/framework',
      hidden: true,
    },
    {
      id: 'settings',
      icon: <Users className="w-4 h-4" />,
      labelKey: 'admin.settings',
      path: '/settings',
    },
    {
      id: 'logout',
      icon: <LogOut className="w-4 h-4" />,
      labelKey: 'admin.logout',
      action: () => {
        onClose()
        logout()
      },
    },
  ]

  const handleItemClick = (item: MenuItemConfig) => {
    if (item.action) {
      item.action()
    } else if (item.path) {
      navigate(item.path)
      onClose()
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={menuRef}
      className="fixed left-20 bottom-4 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <span className="text-sm font-medium text-white">Admin Settings</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Menu Items */}
      <div className="py-2">
        {menuItems.filter((item) => !item.hidden).map((item) => (
          <div key={item.id}>
            {item.id === 'logout' && <div className="border-t border-gray-700 my-1" />}
            <button
              onClick={() => handleItemClick(item)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                item.id === 'logout'
                  ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              aria-label={item.id === 'language' ? 'Language Sync' : undefined}
            >
              {item.icon}
              <span className="text-sm">{t(item.labelKey)}</span>
              {item.id === 'language' && (
                <span className="ml-auto text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">
                  {currentLanguage === 'en' ? 'EN' : '中文'}
                </span>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

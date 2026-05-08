import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { AdminMenu } from './AdminMenu'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)

  const toggleAdminMenu = () => {
    setIsAdminMenuOpen((prev) => !prev)
  }

  const closeAdminMenu = () => {
    setIsAdminMenuOpen(false)
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar Navigation */}
      <Sidebar 
        onAvatarClick={toggleAdminMenu}
        isAdminMenuOpen={isAdminMenuOpen}
      />

      {/* Admin Menu Popup - positioned relative to sidebar */}
      <AdminMenu isOpen={isAdminMenuOpen} onClose={closeAdminMenu} />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  )
}

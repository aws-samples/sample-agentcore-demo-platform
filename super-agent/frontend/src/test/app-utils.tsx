import React from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TranslationProvider } from '@/i18n'
import { ToastProvider, ErrorBoundary } from '@/components'

// Test wrapper that mimics the App structure but uses MemoryRouter
const AppTestWrapper: React.FC<{ children: React.ReactNode; initialEntries?: string[] }> = ({ 
  children, 
  initialEntries = ['/'] 
}) => {
  return (
    <ErrorBoundary>
      <MemoryRouter initialEntries={initialEntries}>
        <TranslationProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </TranslationProvider>
      </MemoryRouter>
    </ErrorBoundary>
  )
}

const renderApp = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { initialEntries?: string[] }
) => {
  const { initialEntries, ...renderOptions } = options || {}
  
  return render(ui, { 
    wrapper: ({ children }) => (
      <AppTestWrapper initialEntries={initialEntries}>
        {children}
      </AppTestWrapper>
    ), 
    ...renderOptions 
  })
}

export * from '@testing-library/react'
export { renderApp as render }
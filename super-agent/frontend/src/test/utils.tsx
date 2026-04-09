import React from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TranslationProvider } from '@/i18n'
import { ToastProvider } from '@/components'

// Custom render function that includes all necessary providers
const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <MemoryRouter>
      <TranslationProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </TranslationProvider>
    </MemoryRouter>
  )
}

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }
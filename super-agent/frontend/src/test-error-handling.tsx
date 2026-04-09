// Simple test file to verify error handling components work
import React from 'react'
import { ErrorBoundary, ToastProvider, useToast, LoadingSpinner, FormField, useFormValidation, ValidationRules } from './components'

// Test component that uses error handling features
function TestComponent() {
  const { success, error } = useToast()
  const validation = useFormValidation()
  const [name, setName] = React.useState('')

  const handleSubmit = () => {
    const isValid = validation.validateField('name', name, [
      ValidationRules.required('Name is required'),
      ValidationRules.minLength(2, 'Name must be at least 2 characters')
    ])

    if (isValid) {
      success('Form submitted successfully!')
    } else {
      error('Please fix the validation errors')
    }
  }

  return (
    <div className="p-6 bg-gray-900 min-h-screen">
      <h1 className="text-white text-xl mb-6">Error Handling Test</h1>
      
      <div className="space-y-4 max-w-md">
        <FormField
          label="Name"
          error={validation.errors.name}
          required
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
            placeholder="Enter your name"
          />
        </FormField>

        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Submit
        </button>

        <div className="mt-6">
          <LoadingSpinner size="md" text="Loading..." />
        </div>
      </div>
    </div>
  )
}

// Test app with error boundary and toast provider
function TestApp() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default TestApp
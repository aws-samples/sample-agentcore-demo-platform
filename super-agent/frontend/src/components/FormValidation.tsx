import React from 'react'
import { AlertCircle, CheckCircle, Info } from 'lucide-react'

// Error message component for individual form fields
interface FieldErrorProps {
  error?: string
  className?: string
}

export const FieldError: React.FC<FieldErrorProps> = ({ error, className = '' }) => {
  if (!error) return null

  return (
    <div className={`flex items-center mt-1 text-sm text-red-400 ${className}`}>
      <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
      <span>{error}</span>
    </div>
  )
}

// Success message component for form fields
interface FieldSuccessProps {
  message?: string
  className?: string
}

export const FieldSuccess: React.FC<FieldSuccessProps> = ({ message, className = '' }) => {
  if (!message) return null

  return (
    <div className={`flex items-center mt-1 text-sm text-green-400 ${className}`}>
      <CheckCircle className="h-4 w-4 mr-1 flex-shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// Info message component for form fields
interface FieldInfoProps {
  message?: string
  className?: string
}

export const FieldInfo: React.FC<FieldInfoProps> = ({ message, className = '' }) => {
  if (!message) return null

  return (
    <div className={`flex items-center mt-1 text-sm text-gray-400 ${className}`}>
      <Info className="h-4 w-4 mr-1 flex-shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// Form field wrapper with validation state
interface FormFieldProps {
  label: string
  error?: string
  success?: string
  info?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  success,
  info,
  required = false,
  children,
  className = ''
}) => {
  const hasError = !!error
  const hasSuccess = !!success && !error

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-gray-300">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      
      <div className={`
        ${hasError ? 'ring-1 ring-red-500' : ''}
        ${hasSuccess ? 'ring-1 ring-green-500' : ''}
        rounded-md
      `}>
        {children}
      </div>
      
      <FieldError error={error} />
      <FieldSuccess message={success} />
      <FieldInfo message={info} />
    </div>
  )
}

// Form summary showing all errors
interface FormErrorSummaryProps {
  errors: Record<string, string>
  className?: string
}

export const FormErrorSummary: React.FC<FormErrorSummaryProps> = ({ 
  errors, 
  className = '' 
}) => {
  const errorEntries = Object.entries(errors).filter(([_, error]) => error)
  
  if (errorEntries.length === 0) return null

  return (
    <div className={`bg-red-900/20 border border-red-500/30 rounded-lg p-4 ${className}`}>
      <div className="flex items-center mb-2">
        <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
        <h3 className="text-sm font-medium text-red-400">
          Please fix the following errors:
        </h3>
      </div>
      <ul className="space-y-1">
        {errorEntries.map(([field, error]) => (
          <li key={field} className="text-sm text-red-300">
            • {error}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Validation state hook for forms
export interface ValidationState {
  errors: Record<string, string>
  isValid: boolean
  setError: (field: string, error: string) => void
  clearError: (field: string) => void
  clearAllErrors: () => void
  validateField: (field: string, value: any, rules: ValidationRule[]) => boolean
}

export interface ValidationRule {
  type: 'required' | 'email' | 'url' | 'minLength' | 'maxLength' | 'pattern' | 'custom'
  message: string
  value?: any
  validator?: (value: any) => boolean
}

export const useFormValidation = (): ValidationState => {
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const setError = React.useCallback((field: string, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }))
  }, [])

  const clearError = React.useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }, [])

  const clearAllErrors = React.useCallback(() => {
    setErrors({})
  }, [])

  const validateField = React.useCallback((
    field: string, 
    value: any, 
    rules: ValidationRule[]
  ): boolean => {
    for (const rule of rules) {
      let isValid = true
      
      switch (rule.type) {
        case 'required':
          isValid = value !== null && value !== undefined && value !== ''
          break
        case 'email':
          isValid = !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
          break
        case 'url':
          isValid = !value || (() => {
            try {
              new URL(value)
              return true
            } catch {
              return false
            }
          })()
          break
        case 'minLength':
          isValid = !value || value.length >= rule.value
          break
        case 'maxLength':
          isValid = !value || value.length <= rule.value
          break
        case 'pattern':
          isValid = !value || rule.value.test(value)
          break
        case 'custom':
          isValid = !value || (rule.validator ? rule.validator(value) : true)
          break
      }
      
      if (!isValid) {
        setError(field, rule.message)
        return false
      }
    }
    
    clearError(field)
    return true
  }, [setError, clearError])

  const isValid = Object.keys(errors).length === 0

  return {
    errors,
    isValid,
    setError,
    clearError,
    clearAllErrors,
    validateField
  }
}

// Pre-built validation rules
export const ValidationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    type: 'required',
    message
  }),
  
  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    type: 'email',
    message
  }),
  
  url: (message = 'Please enter a valid URL'): ValidationRule => ({
    type: 'url',
    message
  }),
  
  minLength: (length: number, message?: string): ValidationRule => ({
    type: 'minLength',
    value: length,
    message: message || `Must be at least ${length} characters`
  }),
  
  maxLength: (length: number, message?: string): ValidationRule => ({
    type: 'maxLength',
    value: length,
    message: message || `Must be no more than ${length} characters`
  }),
  
  pattern: (regex: RegExp, message: string): ValidationRule => ({
    type: 'pattern',
    value: regex,
    message
  }),
  
  custom: (validator: (value: any) => boolean, message: string): ValidationRule => ({
    type: 'custom',
    validator,
    message
  })
}
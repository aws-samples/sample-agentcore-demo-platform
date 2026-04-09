import React from 'react'

interface LoadingSkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: boolean
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  className = '',
  width = '100%',
  height = '1rem',
  rounded = false
}) => {
  const widthClass = typeof width === 'string' ? width : `w-[${width}px]`
  const heightClass = typeof height === 'string' ? height : `h-[${height}px]`
  
  return (
    <div
      className={`
        bg-gray-700 animate-pulse
        ${rounded ? 'rounded-full' : 'rounded'}
        ${widthClass}
        ${heightClass}
        ${className}
      `}
    />
  )
}

// Pre-built skeleton components for common UI patterns

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center space-x-3 mb-3">
        <LoadingSkeleton width="40px" height="40px" rounded />
        <div className="flex-1 space-y-2">
          <LoadingSkeleton height="16px" width="60%" />
          <LoadingSkeleton height="12px" width="40%" />
        </div>
      </div>
      <LoadingSkeleton height="12px" width="100%" className="mb-2" />
      <LoadingSkeleton height="12px" width="80%" />
    </div>
  )
}

export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 4 
}) => {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <LoadingSkeleton key={i} height="16px" width="80%" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <LoadingSkeleton key={colIndex} height="14px" width="90%" />
          ))}
        </div>
      ))}
    </div>
  )
}

export const SkeletonList: React.FC<{ items?: number }> = ({ items = 5 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3">
          <LoadingSkeleton width="32px" height="32px" rounded />
          <div className="flex-1 space-y-2">
            <LoadingSkeleton height="14px" width="70%" />
            <LoadingSkeleton height="12px" width="50%" />
          </div>
          <LoadingSkeleton width="60px" height="20px" rounded />
        </div>
      ))}
    </div>
  )
}

export const SkeletonStats: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <LoadingSkeleton width="24px" height="24px" />
            <LoadingSkeleton width="60px" height="16px" />
          </div>
          <LoadingSkeleton height="32px" width="80px" className="mb-2" />
          <LoadingSkeleton height="14px" width="120px" />
        </div>
      ))}
    </div>
  )
}

export const SkeletonProfile: React.FC = () => {
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center space-x-4 mb-6">
        <LoadingSkeleton width="80px" height="80px" rounded />
        <div className="flex-1 space-y-3">
          <LoadingSkeleton height="24px" width="200px" />
          <LoadingSkeleton height="16px" width="150px" />
          <LoadingSkeleton width="80px" height="20px" rounded />
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <LoadingSkeleton height="16px" width="100px" className="mb-2" />
          <LoadingSkeleton height="14px" width="100%" />
          <LoadingSkeleton height="14px" width="80%" />
        </div>
        
        <div>
          <LoadingSkeleton height="16px" width="120px" className="mb-2" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center">
                <LoadingSkeleton height="24px" width="60px" className="mx-auto mb-1" />
                <LoadingSkeleton height="12px" width="80px" className="mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
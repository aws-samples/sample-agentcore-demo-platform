import type { Capability } from '@/types'
import { CapabilityCard } from './CapabilityCard'
import { useTranslation } from '@/i18n'

interface CapabilityGridProps {
  capabilities: Capability[]
  searchQuery: string
}

const categoryOrder = [
  'Video Intelligence',
  'Knowledge & Data',
  'Communication',
  'Infrastructure',
]

export function CapabilityGrid({ capabilities, searchQuery }: CapabilityGridProps) {
  const { t } = useTranslation()

  // Filter capabilities based on search query
  const filteredCapabilities = capabilities.filter((cap) => {
    const query = searchQuery.toLowerCase()
    return (
      cap.name.toLowerCase().includes(query) ||
      cap.description.toLowerCase().includes(query) ||
      cap.toolIdentifier.toLowerCase().includes(query)
    )
  })

  // Group capabilities by category
  const groupedByCategory = filteredCapabilities.reduce(
    (acc, cap) => {
      if (!acc[cap.category]) {
        acc[cap.category] = []
      }
      acc[cap.category].push(cap)
      return acc
    },
    {} as Record<string, Capability[]>
  )

  // Sort categories
  const sortedCategories = Object.keys(groupedByCategory).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  )

  if (filteredCapabilities.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-gray-400 text-lg">{t('common.search')}</p>
          <p className="text-gray-500 text-sm mt-2">
            {searchQuery ? 'No capabilities match your search' : 'No capabilities available'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {sortedCategories.map((category) => (
        <div key={category}>
          {/* Category Header */}
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">{category}</h2>
            <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded mt-2" />
          </div>

          {/* Capability Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedByCategory[category].map((capability) => (
              <CapabilityCard key={capability.id} capability={capability} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

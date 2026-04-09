import { describe, it, expect } from 'vitest'
import { capabilityService } from './capabilityService'

describe('capabilityService', () => {
  describe('getCapabilities', () => {
    it('should return all capabilities', async () => {
      const capabilities = await capabilityService.getCapabilities()

      expect(Array.isArray(capabilities)).toBe(true)
      expect(capabilities.length).toBeGreaterThan(0)
    })

    it('should return capabilities with required fields', async () => {
      const capabilities = await capabilityService.getCapabilities()

      capabilities.forEach((cap) => {
        expect(cap.id).toBeDefined()
        expect(cap.category).toBeDefined()
        expect(cap.name).toBeDefined()
        expect(cap.description).toBeDefined()
        expect(cap.toolIdentifier).toBeDefined()
        expect(cap.icon).toBeDefined()
        expect(cap.color).toBeDefined()
      })
    })

    it('should return capabilities with valid categories', async () => {
      const capabilities = await capabilityService.getCapabilities()
      const validCategories = [
        'Video Intelligence',
        'Knowledge & Data',
        'Communication',
        'Infrastructure',
      ]

      capabilities.forEach((cap) => {
        expect(validCategories).toContain(cap.category)
      })
    })

    it('should return capabilities with non-empty strings', async () => {
      const capabilities = await capabilityService.getCapabilities()

      capabilities.forEach((cap) => {
        expect(cap.id.length).toBeGreaterThan(0)
        expect(cap.name.length).toBeGreaterThan(0)
        expect(cap.description.length).toBeGreaterThan(0)
        expect(cap.toolIdentifier.length).toBeGreaterThan(0)
      })
    })

    it('should return consistent data on multiple calls', async () => {
      const capabilities1 = await capabilityService.getCapabilities()
      const capabilities2 = await capabilityService.getCapabilities()

      expect(capabilities1.length).toBe(capabilities2.length)
      expect(capabilities1[0].id).toBe(capabilities2[0].id)
    })
  })

  describe('searchCapabilities', () => {
    it('should find capabilities by name', async () => {
      const results = await capabilityService.searchCapabilities('Video')

      expect(results.length).toBeGreaterThan(0)
      expect(results.every((cap) => 
        cap.name.toLowerCase().includes('video') ||
        cap.description.toLowerCase().includes('video') ||
        cap.toolIdentifier.toLowerCase().includes('video')
      )).toBe(true)
    })

    it('should find capabilities by description', async () => {
      const results = await capabilityService.searchCapabilities('email')

      expect(results.length).toBeGreaterThan(0)
      expect(results.some((cap) => cap.description.toLowerCase().includes('email'))).toBe(true)
    })

    it('should find capabilities by tool identifier', async () => {
      const results = await capabilityService.searchCapabilities('video.analysis')

      expect(results.length).toBeGreaterThan(0)
      expect(results.some((cap) => cap.toolIdentifier.includes('video.analysis'))).toBe(true)
    })

    it('should be case-insensitive', async () => {
      const resultsLower = await capabilityService.searchCapabilities('video')
      const resultsUpper = await capabilityService.searchCapabilities('VIDEO')
      const resultsMixed = await capabilityService.searchCapabilities('ViDeO')

      expect(resultsLower.length).toBe(resultsUpper.length)
      expect(resultsLower.length).toBe(resultsMixed.length)
    })

    it('should return empty array for non-matching search', async () => {
      const results = await capabilityService.searchCapabilities('nonexistent_capability_xyz')

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    })

    it('should return all capabilities for empty search query', async () => {
      const allCapabilities = await capabilityService.getCapabilities()
      const searchResults = await capabilityService.searchCapabilities('')

      expect(searchResults.length).toBe(allCapabilities.length)
    })

    it('should find partial matches', async () => {
      const results = await capabilityService.searchCapabilities('ana')

      expect(results.length).toBeGreaterThan(0)
      // Should match "Video Analysis"
      expect(results.some((cap) => cap.name.includes('Analysis'))).toBe(true)
    })

    it('should search across multiple fields', async () => {
      const results = await capabilityService.searchCapabilities('v1')

      expect(results.length).toBeGreaterThan(0)
      // Should match capabilities with v1 in tool identifier
      expect(results.every((cap) => cap.toolIdentifier.includes('v1'))).toBe(true)
    })

    it('should maintain capability structure in search results', async () => {
      const results = await capabilityService.searchCapabilities('email')

      results.forEach((cap) => {
        expect(cap.id).toBeDefined()
        expect(cap.category).toBeDefined()
        expect(cap.name).toBeDefined()
        expect(cap.description).toBeDefined()
        expect(cap.toolIdentifier).toBeDefined()
        expect(cap.icon).toBeDefined()
        expect(cap.color).toBeDefined()
      })
    })
  })
})

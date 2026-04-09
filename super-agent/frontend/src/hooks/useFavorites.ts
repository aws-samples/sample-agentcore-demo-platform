import { useState, useCallback } from 'react'

const STORAGE_KEY = 'marketplace_favorites'

function loadFavorites(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...favs]))
}

export function useFavorites() {
  const [favorites, setFavorites] = useState(loadFavorites)

  const toggle = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveFavorites(next)
      return next
    })
  }, [])

  return { favorites, toggle }
}

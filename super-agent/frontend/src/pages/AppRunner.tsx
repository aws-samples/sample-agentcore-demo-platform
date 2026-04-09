import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Maximize2, Minimize2, ExternalLink, Star, Play, Clock, Tag, User, ChevronDown, Heart, Trash2 } from 'lucide-react'
import { restClient } from '@/services/api/restClient'
import { useFavorites } from '@/hooks/useFavorites'

// ============================================================================
// Types
// ============================================================================

interface PublishedApp {
  id: string
  name: string
  description: string | null
  icon: string
  category: string
  version: string
  status: string
  entry_point: string
  published_at: string
  metadata: Record<string, unknown>
  avg_rating?: number
  rating_count?: number
  launch_count?: number
  author_name?: string
  tags?: string[]
  _sample?: boolean
}

interface Review {
  id: string
  user_name: string
  rating: number
  comment: string
  created_at: string
}

interface VersionEntry {
  version: string
  changelog: string
  created_at: string
}

// ============================================================================
// Sample data (matches Marketplace samples)
// ============================================================================

const SAMPLE_APPS: Record<string, PublishedApp> = {
  'sample-expense-tracker': {
    id: 'sample-expense-tracker', name: 'Expense Tracker', icon: '📊', category: 'tool', version: '1.2.0', status: 'published', entry_point: 'index.html',
    description: 'Track team expenses with approval workflows, receipt uploads, and CSV export. Built with React + Tailwind. Supports multi-currency and integrates with accounting systems.',
    published_at: new Date(Date.now() - 2 * 86400000).toISOString(), metadata: {},
    avg_rating: 4.2, rating_count: 12, launch_count: 142, author_name: 'Alex V.', tags: ['expense', 'finance', 'approval'], _sample: true,
  },
  'sample-standup-timer': {
    id: 'sample-standup-timer', name: 'Standup Timer', icon: '⏱️', category: 'tool', version: '2.0.1', status: 'published', entry_point: 'index.html',
    description: 'Configurable per-person countdown timer for daily standups. Tracks speaking time and sends summary to Slack. Supports team rotation and auto-skip for absent members.',
    published_at: new Date(Date.now() - 5 * 86400000).toISOString(), metadata: {},
    avg_rating: 4.8, rating_count: 24, launch_count: 89, author_name: 'Sarah J.', tags: ['standup', 'timer', 'agile'], _sample: true,
  },
  'sample-snake-game': {
    id: 'sample-snake-game', name: 'Snake Game', icon: '🐍', category: 'game', version: '1.0.0', status: 'published', entry_point: 'index.html',
    description: 'Classic snake game with leaderboard. Built during a Friday hackathon. Features multiple difficulty levels and a global high score board.',
    published_at: new Date(Date.now() - 1 * 86400000).toISOString(), metadata: {},
    avg_rating: 3.8, rating_count: 31, launch_count: 203, author_name: 'Mike T.', tags: ['game', 'fun', 'hackathon'], _sample: true,
  },
  'sample-sales-dashboard': {
    id: 'sample-sales-dashboard', name: 'Sales Pipeline', icon: '💰', category: 'dashboard', version: '3.1.0', status: 'published', entry_point: 'index.html',
    description: 'Real-time sales pipeline dashboard with funnel visualization, deal tracking, and weekly forecast charts.',
    published_at: new Date(Date.now() - 10 * 86400000).toISOString(), metadata: {},
    avg_rating: 4.5, rating_count: 18, launch_count: 67, author_name: 'Lisa M.', tags: ['sales', 'pipeline', 'analytics'], _sample: true,
  },
  'sample-onboarding-form': {
    id: 'sample-onboarding-form', name: 'Employee Onboarding', icon: '📋', category: 'form', version: '1.1.0', status: 'published', entry_point: 'index.html',
    description: 'Multi-step onboarding form for new hires. Collects personal info, equipment preferences, and team assignments.',
    published_at: new Date(Date.now() - 7 * 86400000).toISOString(), metadata: {},
    avg_rating: 4.0, rating_count: 8, launch_count: 34, author_name: 'Jenny K.', tags: ['hr', 'onboarding', 'form'], _sample: true,
  },
  'sample-incident-tracker': {
    id: 'sample-incident-tracker', name: 'Incident Commander', icon: '🚨', category: 'tool', version: '2.3.0', status: 'published', entry_point: 'index.html',
    description: 'Track production incidents with severity levels, timeline, and post-mortem templates. Integrates with PagerDuty.',
    published_at: new Date(Date.now() - 14 * 86400000).toISOString(), metadata: {},
    avg_rating: 4.7, rating_count: 15, launch_count: 56, author_name: 'Marcus O.', tags: ['incident', 'ops', 'sre'], _sample: true,
  },
  'sample-retro-board': {
    id: 'sample-retro-board', name: 'Retro Board', icon: '🔄', category: 'tool', version: '1.0.2', status: 'published', entry_point: 'index.html',
    description: 'Collaborative retrospective board with columns for what went well, what to improve, and action items. Real-time sync.',
    published_at: new Date(Date.now() - 3 * 86400000).toISOString(), metadata: {},
    avg_rating: 4.4, rating_count: 20, launch_count: 112, author_name: 'David C.', tags: ['retro', 'agile', 'collaboration'], _sample: true,
  },
  'sample-inventory-tool': {
    id: 'sample-inventory-tool', name: 'Inventory Scanner', icon: '📦', category: 'utility', version: '1.4.0', status: 'published', entry_point: 'index.html',
    description: 'Barcode scanning inventory management tool. Track stock levels, set reorder alerts, and generate reports.',
    published_at: new Date(Date.now() - 20 * 86400000).toISOString(), metadata: {},
    avg_rating: 3.9, rating_count: 6, launch_count: 28, author_name: 'Elena R.', tags: ['inventory', 'warehouse', 'scanning'], _sample: true,
  },
}

const SAMPLE_REVIEWS: Record<string, Review[]> = {
  'sample-expense-tracker': [
    { id: 'r1', user_name: 'Sarah J.', rating: 5, comment: 'Super useful! Replaced our old spreadsheet workflow entirely.', created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'r2', user_name: 'Mike T.', rating: 3, comment: 'Needs dark mode and better mobile support.', created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 'r3', user_name: 'Lisa M.', rating: 5, comment: 'The CSV export saved me hours of manual work.', created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
  ],
  'sample-standup-timer': [
    { id: 'r4', user_name: 'Alex V.', rating: 5, comment: 'Our standups went from 30 min to 12 min. Game changer.', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'r5', user_name: 'David C.', rating: 5, comment: 'Love the Slack integration. Auto-posts the summary.', created_at: new Date(Date.now() - 4 * 86400000).toISOString() },
  ],
  'sample-snake-game': [
    { id: 'r6', user_name: 'Jenny K.', rating: 4, comment: 'Addictive! The leaderboard creates healthy competition.', created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'r7', user_name: 'Marcus O.', rating: 3, comment: 'Fun but needs more levels. Gets repetitive.', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  ],
}

const SAMPLE_VERSIONS: Record<string, VersionEntry[]> = {
  'sample-expense-tracker': [
    { version: '1.2.0', changelog: 'Added CSV export and multi-currency support', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
    { version: '1.1.0', changelog: 'Dark mode support and receipt image upload', created_at: new Date(Date.now() - 15 * 86400000).toISOString() },
    { version: '1.0.0', changelog: 'Initial release', created_at: new Date(Date.now() - 30 * 86400000).toISOString() },
  ],
  'sample-standup-timer': [
    { version: '2.0.1', changelog: 'Bug fix: timer not resetting between speakers', created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    { version: '2.0.0', changelog: 'Complete rewrite with Slack integration', created_at: new Date(Date.now() - 20 * 86400000).toISOString() },
    { version: '1.0.0', changelog: 'Initial release', created_at: new Date(Date.now() - 45 * 86400000).toISOString() },
  ],
}

// ============================================================================
// Sub-components
// ============================================================================

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-4 h-4' : 'w-3 h-3'
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${cls} ${i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} />
      ))}
    </div>
  )
}

function RatingBreakdown({ reviews }: { reviews: Review[] }) {
  const counts = [0, 0, 0, 0, 0]
  reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++ })
  const max = Math.max(...counts, 1)
  return (
    <div className="space-y-1">
      {[5, 4, 3, 2, 1].map(star => (
        <div key={star} className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 w-3">{star}</span>
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(counts[star - 1] / max) * 100}%` }} />
          </div>
          <span className="text-gray-600 w-4 text-right">{counts[star - 1]}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// AppRunner (Detail + Runner)
// ============================================================================

export function AppRunner() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { favorites, toggle: toggleFav } = useFavorites()
  const [app, setApp] = useState<PublishedApp | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const token = localStorage.getItem('local_auth_token') || localStorage.getItem('cognito_id_token')
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

  useEffect(() => {
    if (!id) return
    setLoading(true)

    // Check sample first
    const sample = SAMPLE_APPS[id]
    if (sample) {
      setApp(sample)
      setReviews(SAMPLE_REVIEWS[id] || [])
      setVersions(SAMPLE_VERSIONS[id] || [{ version: sample.version, changelog: 'Initial release', created_at: sample.published_at }])
      setLoading(false)
      return
    }

    // Fetch from API
    restClient.get<PublishedApp>(`/api/apps/${id}`)
      .then(data => {
        setApp(data)
        setReviews([])
        setVersions([{ version: data.version, changelog: 'Published', created_at: data.published_at }])
      })
      .catch(() => setApp(null))
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = useCallback(async () => {
    if (!app || app._sample) return
    setDeleting(true)
    try {
      await restClient.delete(`/api/apps/${app.id}`)
      navigate('/marketplace', { replace: true })
    } catch {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }, [app, navigate])

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-500">Loading app...</div>
  }

  if (!app) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-gray-400">App not found</p>
        <button onClick={() => navigate('/marketplace')} className="text-blue-400 text-sm hover:underline">Back to Marketplace</button>
      </div>
    )
  }

  const staticUrl = !app._sample
    ? `${baseUrl}/api/apps/${app.id}/static/${app.entry_point}?token=${encodeURIComponent(token || '')}`
    : null

  // Running mode — full iframe
  if (running) {
    return (
      <div className={`flex flex-col h-full ${fullscreen ? 'fixed inset-0 z-50 bg-gray-950' : ''}`}>
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-900/80 flex-shrink-0">
          <button onClick={() => setRunning(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-lg">{app.icon}</span>
          <h2 className="text-sm font-semibold text-white truncate flex-1">{app.name}</h2>
          <span className="text-[10px] text-gray-600">v{app.version}</span>
          {staticUrl && (
            <button onClick={() => window.open(staticUrl, '_blank')} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors" title="Open in new tab">
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setFullscreen(f => !f)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
        {app._sample ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-gray-950">
            <span className="text-6xl">{app.icon}</span>
            <p className="text-gray-400">This is a sample app — no live preview available</p>
            <p className="text-gray-600 text-sm">Publish a real app from the chat to see it running here</p>
          </div>
        ) : (
          <iframe src={staticUrl!} className="flex-1 w-full border-0 bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" title={app.name} />
        )}
      </div>
    )
  }

  // Detail page
  const daysAgo = Math.floor((Date.now() - new Date(app.published_at).getTime()) / 86400000)
  const publishedLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 flex-shrink-0">
        <button onClick={() => navigate('/marketplace')} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-gray-600 text-sm">Back to Marketplace</span>
      </div>

      <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-8">
        {/* Hero */}
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 bg-gray-800 border border-gray-700 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0">
            {app.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{app.name}</h1>
              {app._sample && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-600/20 text-yellow-500 font-medium">SAMPLE</span>}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-400 mb-3">
              {app.author_name && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {app.author_name}</span>}
              <span>v{app.version}</span>
              <span className="capitalize">{app.category}</span>
              <span>Published {publishedLabel}</span>
            </div>
            <div className="flex items-center gap-4 mb-4">
              {app.avg_rating && (
                <div className="flex items-center gap-2">
                  <StarRating rating={app.avg_rating} size="md" />
                  <span className="text-sm text-gray-400">{app.avg_rating.toFixed(1)} ({app.rating_count} ratings)</span>
                </div>
              )}
              {app.launch_count != null && (
                <span className="text-sm text-gray-500">{app.launch_count} runs</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRunning(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors"
              >
                <Play className="w-4 h-4 fill-white" />
                Run App
              </button>
              <button
                onClick={() => app && toggleFav(app.id)}
                className={`p-2.5 rounded-lg border transition-colors ${
                  app && favorites.has(app.id)
                    ? 'border-red-500/50 bg-red-500/10 text-red-400'
                    : 'border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-500/30'
                }`}
                title={app && favorites.has(app.id) ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart className={`w-5 h-5 ${app && favorites.has(app.id) ? 'fill-red-400' : ''}`} />
              </button>
              {!app._sample && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2.5 rounded-lg border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-colors"
                  title="Delete app"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Screenshot placeholder */}
        <div className="w-full h-48 bg-gray-800 border border-gray-700 rounded-xl flex items-center justify-center">
          <div className="text-center">
            <span className="text-5xl block mb-2">{app.icon}</span>
            <span className="text-gray-600 text-sm">Screenshot preview</span>
          </div>
        </div>

        {/* Description */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-2">About</h2>
          <p className="text-gray-400 text-sm leading-relaxed">{app.description}</p>
          {app.tags && app.tags.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <Tag className="w-3.5 h-3.5 text-gray-600" />
              {app.tags.map(tag => (
                <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400">#{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* Reviews */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Rating breakdown */}
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">Ratings</h2>
            {app.avg_rating ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-white">{app.avg_rating.toFixed(1)}</span>
                  <div>
                    <StarRating rating={app.avg_rating} size="md" />
                    <span className="text-xs text-gray-500">{app.rating_count} ratings</span>
                  </div>
                </div>
                <RatingBreakdown reviews={reviews} />
              </div>
            ) : (
              <p className="text-gray-600 text-sm">No ratings yet</p>
            )}
          </div>

          {/* Reviews list */}
          <div className="md:col-span-2">
            <h2 className="text-sm font-semibold text-white mb-3">Reviews</h2>
            {reviews.length === 0 ? (
              <p className="text-gray-600 text-sm">No reviews yet. Be the first to leave one!</p>
            ) : (
              <div className="space-y-3">
                {reviews.map(review => (
                  <div key={review.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <StarRating rating={review.rating} />
                      <span className="text-xs text-white font-medium">{review.user_name}</span>
                      <span className="text-[10px] text-gray-600">
                        {Math.floor((Date.now() - new Date(review.created_at).getTime()) / 86400000)}d ago
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Version history */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Version History</h2>
          <div className="space-y-2">
            {versions.map((v, i) => (
              <div key={v.version} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-purple-500' : 'bg-gray-600'}`} />
                  {i < versions.length - 1 && <div className="w-px h-6 bg-gray-700" />}
                </div>
                <div className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${i === 0 ? 'text-white' : 'text-gray-400'}`}>v{v.version}</span>
                    {i === 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400">LATEST</span>}
                    <span className="text-[10px] text-gray-600">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{v.changelog}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Delete App</h3>
                <p className="text-xs text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to permanently delete <span className="text-white">{app?.name}</span>? This will remove the app, all ratings, usage history, and version data.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * CommandCenter — Comic-book styled dashboard view.
 *
 * Inspired by virtual-worker-command-center:
 *   - Halftone dot background texture
 *   - Bold "hard shadow" comic panels
 *   - SVG comic avatars per agent
 *   - Green felt poker-style game tables with charts
 *   - Top HUD stat boxes with slight rotation
 *   - Bangers display font for headings
 *
 * Uses the same props interface as the classic dashboard view.
 */

import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Agent, SystemStats } from '@/types'
import type { BusinessScope } from '@/services/businessScopeService'
import {
  getAvatarDisplayUrl,
  shouldShowAvatarImage,
} from '@/utils/avatarUtils'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */
interface CommandCenterProps {
  stats: SystemStats
  businessScopes: BusinessScope[]
  agentsByScopeId: Record<string, Agent[]>
}

/* ------------------------------------------------------------------ */
/*  Comic avatar SVGs (inline, no external deps)                       */
/* ------------------------------------------------------------------ */
const svgProps = { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 100 100', className: 'w-full h-full' }

function AvatarMale() {
  return (
    <svg {...svgProps}>
      <rect width="100" height="100" fill="#3B82F6" />
      <path d="M0 0 L100 0 L100 100 L0 100 Z" fill="none" stroke="black" strokeWidth="4" />
      <path d="M30 40 Q50 90 70 40" fill="#FCA5A5" stroke="black" strokeWidth="3" />
      <path d="M30 40 L30 30 L70 30 L70 40" fill="#FCA5A5" stroke="black" strokeWidth="3" />
      <path d="M25 35 L30 15 L50 20 L70 10 L75 35" fill="#1F2937" stroke="black" strokeWidth="3" />
      <path d="M35 45 L65 45 L65 55 L35 55 Z" fill="black" />
      <path d="M40 45 L40 40 M60 45 L60 40" stroke="black" strokeWidth="2" />
      <path d="M50 70 L40 100 L60 100 Z" fill="black" />
    </svg>
  )
}

function AvatarFemale() {
  return (
    <svg {...svgProps}>
      <rect width="100" height="100" fill="#F472B6" />
      <path d="M0 0 L100 0 L100 100 L0 100 Z" fill="none" stroke="black" strokeWidth="4" />
      <path d="M20 30 Q10 80 30 100 L70 100 Q90 80 80 30" fill="#FACC15" stroke="black" strokeWidth="3" />
      <path d="M35 40 Q50 80 65 40" fill="#FDE047" stroke="black" strokeWidth="3" />
      <rect x="35" y="30" width="30" height="15" fill="#FDE047" />
      <path d="M30 30 L50 40 L70 30 L60 10 L40 10 Z" fill="#FACC15" stroke="black" strokeWidth="3" />
      <circle cx="43" cy="50" r="3" fill="black" />
      <circle cx="57" cy="50" r="3" fill="black" />
      <path d="M45 65 Q50 70 55 65" fill="none" stroke="black" strokeWidth="2" />
    </svg>
  )
}

function AvatarBot() {
  return (
    <svg {...svgProps}>
      <rect width="100" height="100" fill="#10B981" />
      <path d="M0 0 L100 0 L100 100 L0 100 Z" fill="none" stroke="black" strokeWidth="4" />
      <rect x="25" y="25" width="50" height="50" rx="5" fill="#E5E7EB" stroke="black" strokeWidth="3" />
      <rect x="30" y="35" width="40" height="15" fill="#111827" stroke="black" strokeWidth="2" />
      <circle cx="40" cy="42" r="3" fill="#EF4444" />
      <circle cx="60" cy="42" r="3" fill="#EF4444" />
      <path d="M35 60 H65 M35 65 H65 M35 70 H65" stroke="black" strokeWidth="2" />
      <path d="M50 25 L50 10" stroke="black" strokeWidth="3" />
      <circle cx="50" cy="8" r="4" fill="#FACC15" stroke="black" strokeWidth="2" />
    </svg>
  )
}

function AvatarMystery() {
  return (
    <svg {...svgProps}>
      <rect width="100" height="100" fill="#6366F1" />
      <path d="M0 0 L100 0 L100 100 L0 100 Z" fill="none" stroke="black" strokeWidth="4" />
      <path d="M20 100 L20 40 Q50 -10 80 40 L80 100" fill="#1F2937" stroke="black" strokeWidth="3" />
      <path d="M30 40 Q50 10 70 40 L70 80 Q50 100 30 80 Z" fill="black" />
      <path d="M40 50 L50 55 L40 55 Z" fill="white" />
      <path d="M60 50 L50 55 L60 55 Z" fill="white" />
    </svg>
  )
}

const AVATAR_TYPES = [AvatarMale, AvatarFemale, AvatarBot, AvatarMystery] as const

function getComicAvatar(index: number) {
  return AVATAR_TYPES[index % AVATAR_TYPES.length]
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */
const STATUS_MAP: Record<string, { label: string; bg: string; badge: string }> = {
  active:  { label: 'ACTIVE',  bg: 'bg-green-400',  badge: '!' },
  busy:    { label: 'BUSY',    bg: 'bg-yellow-400', badge: '?' },
  offline: { label: 'OFFLINE', bg: 'bg-gray-600',   badge: '✕' },
}

/* ------------------------------------------------------------------ */
/*  Top HUD stat boxes                                                 */
/* ------------------------------------------------------------------ */
function StatBox({ value, label, colorClass, rotate }: {
  value: string | number; label: string; colorClass: string; rotate: string
}) {
  return (
    <div className={`relative bg-white border-4 border-black px-5 py-2 transform ${rotate}
      hover:scale-105 transition-transform cursor-pointer`}
      style={{ boxShadow: '4px 4px 0px 0px #000' }}>
      <div className="text-3xl font-black" style={{
        color: 'white',
        textShadow: '2px 2px 0px #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
      }}>
        <span className={colorClass}>{value}</span>
      </div>
      <div className="absolute -bottom-3 -right-2 bg-black text-white text-[9px] font-bold px-2 py-0.5 transform -rotate-2">
        {label}
      </div>
    </div>
  )
}

function TopHUD({ stats }: { stats: SystemStats }) {
  return (
    <div className="w-full flex justify-center pt-6 pb-4 relative">
      <div className="absolute top-1/2 left-0 w-full h-1 bg-black -z-10" />
      <div className="flex items-center gap-6 flex-wrap justify-center">
        <StatBox value={stats.totalActiveAgents} label="AGENTS" colorClass="text-green-500" rotate="-rotate-2" />
        <StatBox value={stats.tasksAutomated.toLocaleString()} label="TASKS" colorClass="text-yellow-500" rotate="rotate-1" />

        <div className="border-4 border-yellow-400 p-3 mx-3 transform -translate-y-1"
          style={{ background: '#0a0a0a', boxShadow: '4px 4px 0px 0px #000' }}>
          <h1 className="text-xl font-black text-yellow-400 tracking-widest uppercase"
            style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
            COMMAND CENTER
          </h1>
        </div>

        <StatBox value={stats.activeTaskCount} label="ACTIVE" colorClass="text-blue-500" rotate="-rotate-1" />
        <StatBox value={`${stats.slaCompliance}%`} label="HEALTH" colorClass="text-red-500" rotate="rotate-2" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Agent avatar on the table                                          */
/* ------------------------------------------------------------------ */
function AgentAvatar({ agent, index, position }: {
  agent: Agent; index: number; position: string
}) {
  const nav = useNavigate()
  const [hovered, setHovered] = useState(false)
  const st = STATUS_MAP[agent.status] || STATUS_MAP.active
  const ComicSvg = getComicAvatar(index)
  const imgUrl = getAvatarDisplayUrl(agent.avatar)
  const showImg = shouldShowAvatarImage(agent.avatar)

  return (
    <div
      className={`absolute flex flex-col items-center w-28 transition-transform hover:scale-110 hover:z-50 z-30 cursor-pointer ${position}`}
      onClick={() => nav(`/agents?id=${agent.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover tooltip */}
      {hovered && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-[200] pointer-events-none">
          <div className="bg-black border-2 border-yellow-400 text-white text-[10px] px-2 py-1 whitespace-nowrap font-bold"
            style={{ boxShadow: '2px 2px 0 #000' }}>
            {agent.displayName} — {agent.role}
          </div>
        </div>
      )}

      {/* Avatar frame */}
      <div className="relative group/avatar">
        {/* Status ring — color-coded for all statuses */}
        <div className={`absolute -inset-1 rounded-sm z-0 ${
          agent.status === 'active' ? 'border-4 border-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' :
          agent.status === 'busy' ? 'border-4 border-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.4)]' :
          'border-4 border-gray-600 opacity-50'
        }`} />
        <div className="relative w-16 h-16 bg-white border-[3px] border-black z-10 overflow-hidden"
          style={{ boxShadow: '3px 3px 0 #000' }}>
          {showImg && imgUrl ? (
            <img src={imgUrl} alt={agent.displayName} className="w-full h-full object-cover"
              onError={e => { e.currentTarget.style.display = 'none' }} />
          ) : (
            <ComicSvg />
          )}
          {/* Dim overlay for offline */}
          {agent.status === 'offline' && (
            <div className="absolute inset-0 bg-black/50 z-20" />
          )}
        </div>
        {/* Status badge */}
        <div className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 border-2 border-black flex items-center justify-center z-20 ${st.bg}`}>
          <span className="text-black font-black text-[10px]">{st.badge}</span>
        </div>
        {/* Status text label */}
        <div className={`absolute -top-2 -right-2 px-1 py-0.5 text-[7px] font-black uppercase z-30 border border-black ${
          agent.status === 'active' ? 'bg-green-400 text-black' :
          agent.status === 'busy' ? 'bg-yellow-400 text-black' :
          'bg-gray-600 text-white'
        }`}>
          {st.label}
        </div>
      </div>

      {/* Name plate */}
      <div className="mt-2 flex items-start gap-1 z-30">
        <div className="bg-black border-2 border-white px-2 py-1 transform -rotate-1"
          style={{ boxShadow: '2px 2px 0 #000' }}>
          <div className="text-[9px] font-black text-yellow-400 tracking-wider uppercase leading-none whitespace-nowrap max-w-[140px] truncate">
            {agent.displayName}
          </div>
          <div className="text-[7px] text-white font-bold uppercase leading-none mt-0.5 max-w-[140px] truncate">
            {agent.role}
          </div>
        </div>
        <div className={`w-4 h-4 border-2 border-black flex items-center justify-center transform rotate-3 ${
          agent.status === 'busy' ? 'bg-yellow-400' : 'bg-gray-200'
        }`}>
          <span className="text-black font-bold text-[8px] leading-none">?</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mini chart inside the table (pure CSS — no recharts dependency)    */
/* ------------------------------------------------------------------ */
function MiniBarChart({ agents }: { agents: Agent[] }) {
  const active = agents.filter(a => a.status === 'active').length
  const busy = agents.filter(a => a.status === 'busy').length
  const offline = agents.filter(a => a.status === 'offline').length
  const total = agents.length || 1
  const bars = [
    { label: 'Active', count: active, color: '#4ade80' },
    { label: 'Busy', count: busy, color: '#60a5fa' },
    { label: 'Offline', count: offline, color: '#6b7280' },
  ]
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-3">
      <div className="text-[9px] text-green-300/60 uppercase tracking-widest font-bold mb-1">
        Agent Status
      </div>
      <div className="flex items-end gap-2 h-[60%] w-full justify-center">
        {bars.map(b => (
          <div key={b.label} className="flex flex-col items-center gap-0.5 flex-1 max-w-[40px]">
            <div className="w-full rounded-t-sm transition-all" style={{
              height: `${Math.max(4, (b.count / total) * 100)}%`,
              backgroundColor: b.color,
              boxShadow: `0 0 8px ${b.color}44`,
            }} />
            <span className="text-[7px] text-white/50">{b.count}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-3 text-[7px] text-white/40 mt-1">
        {bars.map(b => (
          <span key={b.label} className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: b.color }} />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Flying card animation for active agents                            */
/* ------------------------------------------------------------------ */
const CARD_START_OFFSETS = [
  { sx: '-12rem', sy: '-10rem' },
  { sx: '0rem', sy: '-12rem' },
  { sx: '12rem', sy: '-10rem' },
  { sx: '-16rem', sy: '4rem' },
  { sx: '16rem', sy: '4rem' },
  { sx: '-12rem', sy: '10rem' },
  { sx: '0rem', sy: '12rem' },
  { sx: '12rem', sy: '10rem' },
]

const SUITS = ['♠', '♥', '♣', '♦'] as const
const SUIT_COLORS = ['text-black', 'text-red-600', 'text-black', 'text-red-600'] as const

function FlyingCard({ startOffsetIndex, suitOrderIndex, delay }: {
  startOffsetIndex: number; suitOrderIndex: number; delay: number
}) {
  const offset = CARD_START_OFFSETS[startOffsetIndex] || CARD_START_OFFSETS[0]
  const si = suitOrderIndex % 4
  return (
    <div
      className="absolute top-1/2 left-1/2 w-6 h-8 bg-white border border-black rounded-sm flex items-center justify-center animate-fly-card z-20 shadow-sm pointer-events-none"
      style={{ '--sx': offset.sx, '--sy': offset.sy, animationDelay: `${delay}s` } as React.CSSProperties}
    >
      <span className={`text-[12px] ${SUIT_COLORS[si]}`}>{SUITS[si]}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Game Table — green felt poker table with agents around it          */
/* ------------------------------------------------------------------ */
const SEAT_POSITIONS = [
  '-top-10 -left-10',
  '-top-14 left-1/2 -translate-x-1/2',
  '-top-10 -right-10',
  'top-24 -left-20',
  'top-24 -right-20',
  'bottom-[-3rem] -left-10',
  'bottom-[-3.5rem] left-1/2 -translate-x-1/2',
  'bottom-[-3rem] -right-10',
]

function GameTable({ scope, agents }: { scope: BusinessScope; agents: Agent[] }) {

  return (
    <div className="flex flex-col items-center mx-4 my-14">
      {/* Table structure */}
      <div className="relative w-[360px] h-[240px] md:w-[420px] md:h-[280px] rounded-[36px] border-4 border-black"
        style={{
          background: '#3E2723',
          boxShadow: '8px 8px 0px 0px #000',
          transform: 'perspective(800px) rotateX(5deg)',
        }}>
        {/* Green felt surface */}
        <div className="absolute inset-0 rounded-[32px] overflow-hidden flex items-center justify-center"
          style={{
            background: '#14532d',
            borderBottom: '4px solid rgba(0,0,0,0.3)',
            borderRight: '4px solid rgba(0,0,0,0.3)',
          }}>
          {/* Halftone texture */}
          <div className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1.5px)', backgroundSize: '8px 8px' }} />

          {/* Flying cards for active agents */}
          {agents.map((agent, idx) =>
            agent.status !== 'active' ? null : (
              <React.Fragment key={`cards-${agent.id}`}>
                <FlyingCard startOffsetIndex={idx} suitOrderIndex={idx} delay={idx * 0.5} />
                <FlyingCard startOffsetIndex={idx} suitOrderIndex={idx + 1} delay={idx * 0.5 + 1.25} />
              </React.Fragment>
            )
          )}

          {/* Center chart area */}
          <div className="relative w-[82%] h-[72%] z-10 rounded-xl p-2"
            style={{ background: 'rgba(0,0,0,0.2)', border: '2px solid rgba(255,255,255,0.1)' }}>
            <MiniBarChart agents={agents} />
          </div>

          {/* Decorative cards */}
          <div className="absolute bottom-5 left-8 z-20">
            <div className="absolute w-7 h-9 bg-white border-2 border-black transform -rotate-12 rounded-sm flex items-center justify-center"
              style={{ boxShadow: '1px 1px 0 #000' }}>
              <span className="text-red-600 font-bold text-xs">A</span>
            </div>
            <div className="absolute left-3 w-7 h-9 bg-white border-2 border-black transform rotate-6 rounded-sm flex items-center justify-center"
              style={{ boxShadow: '1px 1px 0 #000' }}>
              <span className="text-black font-bold text-xs">K</span>
            </div>
          </div>
        </div>

        {/* Agent seats */}
        {agents.slice(0, SEAT_POSITIONS.length).map((agent, idx) => (
          <AgentAvatar key={agent.id} agent={agent} index={idx} position={SEAT_POSITIONS[idx]} />
        ))}
      </div>

      {/* Table label */}
      <div className="mt-14 flex flex-col items-center">
        <div className="flex items-center gap-2 px-5 py-2 border-4 border-black transform -rotate-1 hover:scale-105 transition-transform"
          style={{ background: '#FACC15', boxShadow: '4px 4px 0px 0px #000' }}>
          {scope.icon && (
            <div className="bg-black p-1 rounded-sm">
              <span className="text-white text-sm">{scope.icon}</span>
            </div>
          )}
          <h3 className="text-black font-black text-lg tracking-wider uppercase"
            style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
            {scope.name}
          </h3>
          <span className="text-black/60 text-sm font-bold ml-1">{agents.length}</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */
export function CommandCenter({ stats, businessScopes, agentsByScopeId }: CommandCenterProps) {
  const totalAgents = Object.values(agentsByScopeId).reduce((sum, arr) => sum + arr.length, 0)

  // Collect all scopes with agents + unassigned
  const tables = useMemo(() => {
    const result: { scope: BusinessScope; agents: Agent[] }[] = []
    for (const scope of businessScopes) {
      const agents = agentsByScopeId[scope.id] || []
      if (agents.length > 0) result.push({ scope, agents })
    }
    const unassigned = agentsByScopeId['unassigned'] || []
    if (unassigned.length > 0) {
      result.push({
        scope: {
          id: 'unassigned', organizationId: '', name: 'Unassigned',
          description: null, icon: '❓', color: '#6b7280',
          isDefault: false, createdAt: new Date(), updatedAt: new Date(),
        },
        agents: unassigned,
      })
    }
    return result
  }, [businessScopes, agentsByScopeId])

  return (
    <div className="relative min-h-[600px] -mx-6 -mt-2 overflow-hidden"
      style={{ background: '#111', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Comic halftone background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1.5px)', backgroundSize: '6px 6px' }} />
      <div className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.05) 50%, transparent 75%, transparent 100%)',
          backgroundSize: '250px 250px',
        }} />

      {/* Top HUD — hidden for now, will be used later */}
      {false && <TopHUD stats={stats} />}

      {/* Tables grid */}
      <div className="flex flex-wrap items-center justify-center gap-x-40 gap-y-10 px-10 py-8 pb-24">
        {tables.map(({ scope, agents }) => (
          <GameTable key={scope.id} scope={scope} agents={agents} />
        ))}
      </div>

      {/* Bottom legend */}
      <div className="flex items-center justify-center gap-4 pb-6 text-[10px]">
        <span className="flex items-center gap-1 text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Active
        </span>
        <span className="flex items-center gap-1 text-blue-400">
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Busy
        </span>
        <span className="flex items-center gap-1 text-yellow-400">
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Idle
        </span>
        <span className="flex items-center gap-1 text-gray-500">
          <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" /> Offline
        </span>
        <span className="text-gray-600 mx-1">·</span>
        <span className="text-gray-400 font-bold">{totalAgents} agents · {tables.length} tables</span>
      </div>
    </div>
  )
}

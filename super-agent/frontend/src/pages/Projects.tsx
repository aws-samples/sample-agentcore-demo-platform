/**
 * Projects List Page
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderKanban, Loader2, Trash2 } from 'lucide-react'
import { RestProjectService, type Project } from '@/services/api/restProjectService'

export function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newRepo, setNewRepo] = useState('')
  const [newAgentId, setNewAgentId] = useState<string>('')
  const [agents, setAgents] = useState<Array<{ id: string; display_name: string }>>([])

  useEffect(() => {
    RestProjectService.listProjects().then(setProjects).finally(() => setIsLoading(false))
    // Load agents for the picker
    import('@/services/api').then(({ AgentService }) => {
      AgentService.getAgents().then((list: Array<{ id: string; displayName: string }>) => {
        setAgents(list.map(a => ({ id: a.id, display_name: a.displayName })))
      }).catch(() => {})
    })
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const project = await RestProjectService.createProject({
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      repo_url: newRepo.trim() || undefined,
      agent_id: newAgentId || undefined,
    })
    setProjects(prev => [project, ...prev])
    setShowCreate(false)
    setNewName('')
    setNewDesc('')
    setNewRepo('')
    navigate(`/projects/${project.id}`)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this project and all its issues?')) return
    await RestProjectService.deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-white">Projects</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors">
          <Plus size={14} /> New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16">
          <FolderKanban size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 mb-2">No projects yet</p>
          <p className="text-xs text-gray-500">Create a project to start managing tasks with AI agents</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="flex items-center gap-4 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors text-left group"
            >
              <FolderKanban size={20} className="text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{p.name}</div>
                {p.description && <div className="text-xs text-gray-500 truncate">{p.description}</div>}
              </div>
              <span className="text-xs text-gray-500">{p._count?.issues ?? 0} issues</span>
              <button onClick={e => handleDelete(p.id, e)} className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 size={14} />
              </button>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-4">New Project</h3>
            <div className="space-y-3">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Project name" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500" autoFocus />
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500" />
              <input value={newRepo} onChange={e => setNewRepo(e.target.value)} placeholder="Git repo URL (optional)" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500" />
              <div>
                <label className="block text-xs text-gray-400 mb-1">Agent in charge</label>
                <select value={newAgentId} onChange={e => setNewAgentId(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none focus:border-blue-500">
                  <option value="">Default Claude Code Agent</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
                <button onClick={handleCreate} disabled={!newName.trim()} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs rounded-lg transition-colors">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * DocGroupsPanel — Manage document group assignments for a business scope.
 * Embedded in ScopeProfile alongside MCP Servers and Scope Memory.
 */

import { useState, useCallback } from 'react'
import { FolderOpen, Plus, Trash2, Loader2, Upload, FileText, X } from 'lucide-react'
import { useScopeDocGroups, useDocGroups } from '@/services/useDocGroups'
import { restDocGroupService, type DocGroupFile } from '@/services/api/restDocGroupService'
import { useToast } from '@/components'

interface DocGroupsPanelProps {
  scopeId: string
  scopeName?: string
}

export function DocGroupsPanel({ scopeId }: DocGroupsPanelProps) {
  const { assignments, isLoading, assign, unassign, load: reloadAssignments } = useScopeDocGroups(scopeId)
  const { groups: allGroups, load: reloadGroups, create: createGroup } = useDocGroups()
  const { success, error: showError } = useToast()

  const [showPicker, setShowPicker] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [files, setFiles] = useState<DocGroupFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const assignedIds = new Set(assignments.map(a => a.document_group_id))
  const availableGroups = allGroups.filter(g => !assignedIds.has(g.id))

  const loadFiles = useCallback(async (groupId: string) => {
    setFilesLoading(true)
    try {
      const data = await restDocGroupService.listFiles(groupId)
      setFiles(data)
    } catch { setFiles([]) }
    finally { setFilesLoading(false) }
  }, [])

  const toggleExpand = (groupId: string) => {
    if (expandedGroup === groupId) { setExpandedGroup(null); return }
    setExpandedGroup(groupId)
    loadFiles(groupId)
  }

  const handleAssign = async (groupId: string) => {
    try {
      await assign(groupId)
      success('Document group assigned')
      setShowPicker(false)
    } catch (e) { showError(e instanceof Error ? e.message : 'Failed to assign') }
  }

  const handleUnassign = async (assignmentId: string) => {
    try {
      await unassign(assignmentId)
      success('Document group removed')
    } catch (e) { showError(e instanceof Error ? e.message : 'Failed to remove') }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const group = await createGroup({ name: newName.trim(), description: newDesc.trim() || undefined })
      await assign(group.id)
      success(`Created and assigned "${group.name}"`)
      setNewName(''); setNewDesc(''); setShowCreate(false)
      reloadGroups()
    } catch (e) { showError(e instanceof Error ? e.message : 'Failed to create') }
  }

  const handleUpload = async (groupId: string, fileList: FileList) => {
    setUploading(true)
    try {
      for (const file of Array.from(fileList)) {
        await restDocGroupService.uploadFile(groupId, file)
      }
      success(`Uploaded ${fileList.length} file(s)`)
      loadFiles(groupId)
      reloadAssignments()
    } catch (e) { showError(e instanceof Error ? e.message : 'Upload failed') }
    finally { setUploading(false) }
  }

  const handleDeleteFile = async (groupId: string, fileId: string) => {
    try {
      await restDocGroupService.deleteFile(groupId, fileId)
      setFiles(prev => prev.filter(f => f.id !== fileId))
      reloadAssignments()
    } catch (e) { showError(e instanceof Error ? e.message : 'Failed to delete') }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-gray-400" />
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Knowledge Base</h3>
          <span className="text-[10px] text-gray-600">{assignments.length} group{assignments.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
            <Plus className="w-3 h-3" /> New Group
          </button>
          <button onClick={() => { setShowPicker(!showPicker); reloadGroups() }}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">
            <Plus className="w-3 h-3" /> Assign
          </button>
        </div>
      </div>

      {/* Create new group form */}
      {showCreate && (
        <div className="mb-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg space-y-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Group name"
            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-blue-500" />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)"
            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-blue-500" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="text-[10px] text-gray-400 hover:text-white">Cancel</button>
            <button onClick={handleCreate} disabled={!newName.trim()}
              className="text-[10px] px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-40">Create & Assign</button>
          </div>
        </div>
      )}

      {/* Assign existing group picker */}
      {showPicker && (
        <div className="mb-3 border border-gray-700 rounded-lg bg-gray-800/50 max-h-40 overflow-y-auto">
          {availableGroups.length === 0 ? (
            <p className="p-3 text-xs text-gray-400">No unassigned groups available.</p>
          ) : availableGroups.map(g => (
            <button key={g.id} onClick={() => handleAssign(g.id)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700/50 text-left border-b border-gray-700/50 last:border-0">
              <div>
                <p className="text-xs text-white">{g.name}</p>
                {g.description && <p className="text-[10px] text-gray-400">{g.description}</p>}
              </div>
              <span className="text-[10px] text-gray-500">{g._count?.files ?? 0} files</span>
            </button>
          ))}
        </div>
      )}

      {/* Assigned groups list */}
      {isLoading ? (
        <div className="py-4 text-center"><Loader2 className="w-4 h-4 text-blue-500 animate-spin mx-auto" /></div>
      ) : assignments.length === 0 ? (
        <div className="py-4 text-center text-xs text-gray-500">No document groups assigned</div>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => {
            const g = a.document_group
            if (!g) return null
            const isExpanded = expandedGroup === g.id
            return (
              <div key={a.id} className="border border-gray-800 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-900 cursor-pointer" onClick={() => toggleExpand(g.id)}>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-white font-medium">{g.name}</span>
                    <span className="text-[10px] text-gray-500">{g._count?.files ?? 0} files</span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleUnassign(a.id) }}
                    className="p-1 text-gray-600 hover:text-red-400 transition-colors" title="Remove from scope">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-800 bg-gray-950">
                    {/* Upload button */}
                    <div className="px-3 py-2 border-b border-gray-800">
                      <label className="flex items-center gap-1 text-[10px] text-blue-400 cursor-pointer hover:text-blue-300">
                        <Upload className="w-3 h-3" />
                        {uploading ? 'Uploading...' : 'Upload files'}
                        <input type="file" multiple className="hidden" disabled={uploading}
                          onChange={e => e.target.files && handleUpload(g.id, e.target.files)} />
                      </label>
                    </div>

                    {filesLoading ? (
                      <div className="py-3 text-center"><Loader2 className="w-3 h-3 text-blue-500 animate-spin mx-auto" /></div>
                    ) : files.length === 0 ? (
                      <div className="py-3 text-center text-[10px] text-gray-500">No files yet</div>
                    ) : (
                      <div className="divide-y divide-gray-800/50">
                        {files.map(f => (
                          <div key={f.id} className="flex items-center justify-between px-3 py-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-3 h-3 text-gray-500 flex-shrink-0" />
                              <span className="text-[10px] text-gray-300 truncate">{f.original_filename}</span>
                              <span className="text-[9px] text-gray-600">{formatSize(f.file_size)}</span>
                            </div>
                            <button onClick={() => handleDeleteFile(g.id, f.id)}
                              className="p-0.5 text-gray-600 hover:text-red-400"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * GroupsTab — Settings page tab for managing user groups.
 * Groups control which users can access which skills and MCP servers.
 */

import { useState } from 'react';
import { Plus, Trash2, Users, ChevronRight, Loader2, AlertCircle, X, UserPlus } from 'lucide-react';
import { useUserGroups } from '@/services/useUserGroups';
import { useTranslation } from '@/i18n';
import type { UserGroup } from '@/services/api/restUserGroupService';

interface Props {
  isAdmin: boolean;
  orgMembers: Array<{ id: string; user_id: string; name?: string | null; email?: string | null }>;
}

export function GroupsTab({ isAdmin, orgMembers }: Props) {
  const { groups, isLoading, error, clearError, createGroup, deleteGroup, addMember, removeMember } = useUserGroups();
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    const result = await createGroup(newName.trim(), newDesc.trim() || undefined);
    setIsCreating(false);
    if (result) {
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
    }
  };

  const handleDelete = async (group: UserGroup) => {
    if (!confirm(t('groups.confirmDelete').replace('{name}', group.name))) return;
    await deleteGroup(group.id);
  };

  const handleAddMember = async (groupId: string) => {
    if (!selectedUserId) return;
    await addMember(groupId, selectedUserId);
    setSelectedUserId('');
    setAddingMemberId(null);
  };

  const getMembersNotInGroup = (group: UserGroup) => {
    const memberUserIds = new Set(group.members.map(m => m.user_id));
    return orgMembers.filter(m => !memberUserIds.has(m.user_id));
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError}><X className="w-4 h-4" /></button>
        </div>
      )}

      {isAdmin && !showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          {t('groups.createGroup')}
        </button>
      )}

      {showCreate && (
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl space-y-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={t('groups.namePlaceholder')}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <input
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder={t('groups.descPlaceholder')}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">{t('common.cancel')}</button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !newName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm"
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common.create')}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-sm">
          {t('groups.empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const isExpanded = expandedId === group.id;
            return (
              <div key={group.id} className="border border-gray-800 rounded-xl overflow-hidden">
                <div
                  onClick={() => setExpandedId(isExpanded ? null : group.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpandedId(isExpanded ? null : group.id); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/30 transition-colors text-left cursor-pointer"
                >
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  <Users className="w-4 h-4 text-blue-400" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{group.name}</div>
                    {group.description && <div className="text-xs text-gray-500 truncate">{group.description}</div>}
                  </div>
                  <span className="text-xs text-gray-500">{group.member_count} {t('groups.members')}</span>
                  {isAdmin && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(group); }}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-800 px-4 py-3 space-y-2">
                    {group.members.map(m => (
                      <div key={m.user_id} className="flex items-center gap-2 py-1 group">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                          {(m.user?.full_name || m.user?.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-300 flex-1">{m.user?.full_name || m.user?.username || m.user_id}</span>
                        {isAdmin && (
                          <button
                            onClick={() => removeMember(group.id, m.user_id)}
                            className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}

                    {isAdmin && addingMemberId !== group.id && (
                      <button
                        onClick={() => setAddingMemberId(group.id)}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {t('groups.addMember')}
                      </button>
                    )}

                    {isAdmin && addingMemberId === group.id && (
                      <div className="flex items-center gap-2 mt-1">
                        <select
                          value={selectedUserId}
                          onChange={e => setSelectedUserId(e.target.value)}
                          className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white outline-none focus:border-blue-500"
                        >
                          <option value="">{t('groups.selectMember')}</option>
                          {getMembersNotInGroup(group).map(m => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.name || m.email || m.user_id}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAddMember(group.id)}
                          disabled={!selectedUserId}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded"
                        >
                          {t('groups.add')}
                        </button>
                        <button
                          onClick={() => { setAddingMemberId(null); setSelectedUserId(''); }}
                          className="text-xs text-gray-400 hover:text-white"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

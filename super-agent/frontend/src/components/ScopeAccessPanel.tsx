/**
 * ScopeAccessPanel — Manage scope-level access control.
 *
 * Shows scope visibility toggle (open/restricted) and member list.
 * Allows scope admins to add/remove members and change roles.
 */

import { useState } from 'react';
import { X, UserPlus, Trash2, ChevronDown, Loader2, AlertCircle, Shield, Globe, Lock } from 'lucide-react';
import { useScopeMembers } from '@/services/useScopeMembers';
import { useMembers } from '@/services/useMembers';
import type { ScopeRole, ScopeVisibility } from '@/services/api/restScopeMembershipService';
import { useTranslation } from '@/i18n';

const SCOPE_ROLES: ScopeRole[] = ['admin', 'member', 'viewer'];

const ROLE_COLORS: Record<ScopeRole, string> = {
  admin: 'bg-blue-500/20 text-blue-300',
  member: 'bg-green-500/20 text-green-300',
  viewer: 'bg-gray-500/20 text-gray-300',
};

interface Props {
  scopeId: string;
  scopeName: string;
  visibility: ScopeVisibility;
  isAdmin: boolean;
  onClose: () => void;
  onVisibilityChange?: (v: ScopeVisibility) => void;
}

export function ScopeAccessPanel({ scopeId, scopeName, visibility, isAdmin, onClose, onVisibilityChange }: Props) {
  const { members: scopeMembers, isLoading, error, clearError, addMember, updateRole, removeMember, updateVisibility } = useScopeMembers(scopeId);
  const { members: orgMembers } = useMembers();
  const { t } = useTranslation();

  const [showAdd, setShowAdd] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<ScopeRole>('viewer');
  const [isAdding, setIsAdding] = useState(false);
  const [currentVisibility, setCurrentVisibility] = useState<ScopeVisibility>(visibility);

  // Org members not yet in this scope
  const availableMembers = orgMembers.filter(
    (om) => !scopeMembers.some((sm) => sm.user_id === om.user_id),
  );

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setIsAdding(true);
    const ok = await addMember(selectedUserId, selectedRole);
    setIsAdding(false);
    if (ok) {
      setSelectedUserId('');
      setSelectedRole('viewer');
      setShowAdd(false);
    }
  };

  const handleVisibilityToggle = async () => {
    const next = currentVisibility === 'open' ? 'restricted' : 'open';
    await updateVisibility(next);
    setCurrentVisibility(next);
    onVisibilityChange?.(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <h2 className="text-white font-semibold">{scopeName} — {t('scopeAccess.title')}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={clearError}><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              {currentVisibility === 'open' ? (
                <Globe className="w-5 h-5 text-green-400" />
              ) : (
                <Lock className="w-5 h-5 text-yellow-400" />
              )}
              <div>
                <div className="text-sm text-white font-medium">
                  {currentVisibility === 'open' ? t('scopeAccess.openScope') : t('scopeAccess.restrictedScope')}
                </div>
                <div className="text-xs text-gray-400">
                  {currentVisibility === 'open'
                    ? t('scopeAccess.openDesc')
                    : t('scopeAccess.restrictedDesc')}
                </div>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={handleVisibilityToggle}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                {currentVisibility === 'open' ? t('scopeAccess.restrict') : t('scopeAccess.open')}
              </button>
            )}
          </div>

          {/* Add Member */}
          {isAdmin && !showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
            >
              <UserPlus className="w-4 h-4" />
              {t('scopeAccess.addMember')}
            </button>
          )}

          {isAdmin && showAdd && (
            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl space-y-3">
              <div className="flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none"
                >
                  <option value="">{t('scopeAccess.selectMember')}</option>
                  {availableMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name || m.email || m.invited_email || 'Unknown'}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as ScopeRole)}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none"
                >
                  {SCOPE_ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">{t('common.cancel')}</button>
                <button
                  onClick={handleAdd}
                  disabled={isAdding || !selectedUserId}
                  className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm"
                >
                  {isAdding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t('groups.add')}
                </button>
              </div>
            </div>
          )}

          {/* Members List */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            </div>
          ) : scopeMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {currentVisibility === 'open'
                ? t('scopeAccess.emptyOpen')
                : t('scopeAccess.emptyRestricted')}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-800/40">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase">{t('scopeAccess.colMember')}</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase">{t('scopeAccess.colScopeRole')}</th>
                    {isAdmin && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {scopeMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-800/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(member.name || member.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-white text-sm">{member.name || member.email || 'Unknown'}</div>
                            {member.email && member.name && (
                              <div className="text-xs text-gray-500">{member.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {isAdmin ? (
                          <div className="relative inline-block">
                            <select
                              value={member.role}
                              onChange={(e) => updateRole(member.id, e.target.value as ScopeRole)}
                              className="appearance-none pl-2 pr-6 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:border-blue-500 outline-none cursor-pointer"
                            >
                              {SCOPE_ROLES.map((r) => (
                                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                          </div>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[member.role]}`}>
                            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => removeMember(member.id)}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                            title={t('scopeAccess.removeFromScope')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

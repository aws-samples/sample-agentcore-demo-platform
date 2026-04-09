/**
 * GroupAccessPopover
 * Inline popover for managing which user groups can access a skill or MCP server.
 * Used in Tools page ToolCard and other places.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Loader2, Check, X } from 'lucide-react';
import { RestUserGroupService, type UserGroup } from '@/services/api/restUserGroupService';

interface GroupAccessPopoverProps {
  resourceType: 'skill' | 'mcp';
  resourceId: string;
  resourceName: string;
}

export function GroupAccessPopover({ resourceType, resourceId, resourceName }: GroupAccessPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allGroups, currentAccess] = await Promise.all([
        RestUserGroupService.listGroups(),
        resourceType === 'skill'
          ? RestUserGroupService.getSkillAccess(resourceId)
          : RestUserGroupService.getMcpAccess(resourceId),
      ]);
      setGroups(allGroups);
      setSelectedIds(currentAccess);
      setOriginalIds(currentAccess);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [resourceType, resourceId]);

  useEffect(() => {
    if (isOpen) void loadData();
  }, [isOpen, loadData]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleGroup = (groupId: string) => {
    setSelectedIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const hasChanges = JSON.stringify([...selectedIds].sort()) !== JSON.stringify([...originalIds].sort());

  const handleSave = async () => {
    setSaving(true);
    try {
      if (resourceType === 'skill') {
        await RestUserGroupService.setSkillAccess(resourceId, selectedIds);
      } else {
        await RestUserGroupService.setMcpAccess(resourceId, selectedIds);
      }
      setOriginalIds(selectedIds);
      setIsOpen(false);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-[10px] text-gray-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
        title="Manage group access"
      >
        <Users className="w-3 h-3" />
        Access
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setIsOpen(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="relative w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
          <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-300 truncate">
              Access: {resourceName}
            </span>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            </div>
          ) : groups.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-500 text-center">
              No groups yet. Create groups in Settings → Groups.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
              {groups.map(g => {
                const selected = selectedIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleGroup(g.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                      selected ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      selected ? 'bg-blue-600 border-blue-500' : 'border-gray-600'
                    }`}>
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="flex-1 truncate">{g.name}</span>
                    <span className="text-[10px] text-gray-500">{g.member_count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {groups.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="px-2 py-1 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors flex items-center gap-1"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                Save
              </button>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

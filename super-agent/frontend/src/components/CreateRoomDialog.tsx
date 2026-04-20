/**
 * CreateRoomDialog Component
 * Dialog for creating a new group chat room.
 * Supports: from scope, manual agent selection, or AI-recommended combination.
 */

import { useState } from 'react';
import { Users, Layers, X, Check } from 'lucide-react';
import type { Agent } from '@/types';
import type { BusinessScope } from '@/services/businessScopeService';
import { useTranslation } from '@/i18n';

interface CreateRoomDialogProps {
  scopes: BusinessScope[];
  agents: Agent[];
  onCreateFromScope: (scopeId: string) => Promise<void>;
  onCreateManual: (options: { title?: string; agentIds: string[]; primaryAgentId?: string; routingStrategy?: string }) => Promise<void>;
  onClose: () => void;
}

type Mode = 'scope' | 'manual' | null;

export function CreateRoomDialog({ scopes, agents, onCreateFromScope, onCreateManual, onClose }: CreateRoomDialogProps) {
  const [mode, setMode] = useState<Mode>(null);
  const [selectedScopeId, setSelectedScopeId] = useState<string>('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [roomTitle, setRoomTitle] = useState('');
  const [routingStrategy, setRoutingStrategy] = useState<string>('auto');
  const [isCreating, setIsCreating] = useState(false);
  const { t } = useTranslation();

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      if (mode === 'scope' && selectedScopeId) {
        await onCreateFromScope(selectedScopeId);
      } else if (mode === 'manual' && selectedAgentIds.length > 0) {
        await onCreateManual({
          title: roomTitle || undefined,
          agentIds: selectedAgentIds,
          primaryAgentId: selectedAgentIds[0],
          routingStrategy,
        });
      }
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  const toggleAgent = (id: string) => {
    setSelectedAgentIds(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{t('room.createTitle')}</h3>
          <button onClick={onClose} className="close-btn"><X size={18} /></button>
        </div>

        {!mode ? (
          <div className="dialog-mode-select">
            <button className="mode-card" onClick={() => setMode('scope')}>
              <Layers size={24} />
              <div className="mode-title">{t('room.fromScope')}</div>
              <div className="mode-desc">{t('room.fromScopeDesc')}</div>
            </button>
            <button className="mode-card" onClick={() => setMode('manual')}>
              <Users size={24} />
              <div className="mode-title">{t('room.manual')}</div>
              <div className="mode-desc">{t('room.manualDesc')}</div>
            </button>
          </div>
        ) : mode === 'scope' ? (
          <div className="dialog-scope-select">
            <label>{t('room.selectScope')}</label>
            <select value={selectedScopeId} onChange={e => setSelectedScopeId(e.target.value)}>
              <option value="">{t('room.chooseScope')}</option>
              {scopes.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="dialog-manual-select">
            <div className="form-group">
              <label>{t('room.titleLabel')}</label>
              <input value={roomTitle} onChange={e => setRoomTitle(e.target.value)} placeholder="e.g. Project Alpha Discussion" />
            </div>
            <div className="form-group">
              <label>{t('room.routingStrategy')}</label>
              <select value={routingStrategy} onChange={e => setRoutingStrategy(e.target.value)}>
                <option value="auto">{t('room.routingAuto')}</option>
                <option value="mention">{t('room.routingMention')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('room.selectAgents').replace('{n}', String(selectedAgentIds.length))}</label>
              <div className="agent-select-list">
                {agents.map(a => (
                  <button
                    key={a.id}
                    className={`agent-select-item ${selectedAgentIds.includes(a.id) ? 'selected' : ''}`}
                    onClick={() => toggleAgent(a.id)}
                  >
                    {selectedAgentIds.includes(a.id) && <Check size={14} />}
                    <span className="agent-select-name">{a.displayName || a.name}</span>
                    <span className="agent-select-role">{a.role}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="dialog-footer">
          {mode && <button onClick={() => setMode(null)} className="back-btn">{t('room.back')}</button>}
          <button
            onClick={handleCreate}
            disabled={isCreating || (mode === 'scope' && !selectedScopeId) || (mode === 'manual' && selectedAgentIds.length === 0)}
            className="create-btn"
          >
            {isCreating ? t('room.creating') : t('room.createRoom')}
          </button>
        </div>
      </div>
    </div>
  );
}

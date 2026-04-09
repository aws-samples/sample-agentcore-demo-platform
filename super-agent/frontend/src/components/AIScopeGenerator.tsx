/**
 * AIScopeGenerator Component
 *
 * Chat-style AI-powered business scope creation flow:
 * 1. Shows user prompt as a chat bubble
 * 2. Streams Claude's analysis as chat content blocks (text + tool_use)
 * 3. User reviews/edits the generated scope + agents
 * 4. Confirm persists everything
 *
 * Mirrors the /chat page styling with UserBubble / AIBubble patterns.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, Loader2, AlertCircle, RefreshCw,
  Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2,
  User, Bot,
} from 'lucide-react';
import { useToast } from '@/components';
import { ChatMessage } from '@/components/chat/ChatMessage';
import type { ContentBlock } from '@/services/chatStreamService';
import {
  generateScope, generateScopeWithDocument, parseScopeConfig, confirmScopeGeneration,
  type GeneratedScopeConfig, type GeneratedAgent, type GeneratedScope, type SSEEvent,
} from '@/services/scopeGeneratorService';
import { consumeSopFile } from '@/services/sopFileStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'input' | 'generating' | 'preview' | 'saving' | 'error';

interface EditableAgent extends GeneratedAgent {
  _id: string;
  _removed: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;
function uid() { return `ag-${++_idCounter}-${Date.now()}`; }

function toEditable(agents: GeneratedAgent[]): EditableAgent[] {
  return agents.map(a => ({ ...a, _id: uid(), _removed: false }));
}

// ---------------------------------------------------------------------------
// Chat Bubble Components
// ---------------------------------------------------------------------------

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-3 flex-row-reverse">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-600">
        <User className="w-4 h-4 text-white" />
      </div>
      <div className="flex flex-col max-w-[70%] items-end">
        <div className="px-4 py-2 rounded-2xl bg-blue-600 text-white rounded-br-md">
          <p className="text-sm whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-md">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function AIStreamingBubble({ blocks, isStreaming }: { blocks: ContentBlock[]; isStreaming: boolean }) {
  if (blocks.length === 0 && isStreaming) {
    return <TypingIndicator />;
  }
  if (blocks.length === 0) return null;

  return (
    <div className="max-w-[85%]">
      <ChatMessage content={blocks} isStreaming={isStreaming} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview Sub-components (unchanged from before)
// ---------------------------------------------------------------------------

function ScopePreviewCard({
  scope, onChange,
}: {
  scope: GeneratedScope;
  onChange: (s: GeneratedScope) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="rounded-xl border border-blue-500/40 bg-gray-800/60 p-5 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-300">Edit Scope</span>
          <button onClick={() => setEditing(false)} className="text-xs text-blue-400 hover:text-blue-300">Done</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Name</label>
            <input value={scope.name} onChange={e => onChange({ ...scope, name: e.target.value })}
              className="w-full mt-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Icon (emoji)</label>
            <input value={scope.icon} onChange={e => onChange({ ...scope, icon: e.target.value })}
              className="w-full mt-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500">Description</label>
          <textarea value={scope.description} onChange={e => onChange({ ...scope, description: e.target.value })} rows={2}
            className="w-full mt-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={scope.color} onChange={e => onChange({ ...scope, color: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer border-0" />
            <span className="text-xs text-gray-400">{scope.color}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 flex items-center gap-4 group cursor-pointer hover:border-gray-600 transition-colors"
      onClick={() => setEditing(true)}>
      <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl" style={{ backgroundColor: `${scope.color}20` }}>
        {scope.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-semibold text-white">{scope.name}</h3>
        <p className="text-sm text-gray-400 mt-0.5">{scope.description}</p>
      </div>
      <Pencil className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

function AgentCard({
  agent, onUpdate, onToggleRemove, canRemove,
}: {
  agent: EditableAgent;
  onUpdate: (a: EditableAgent) => void;
  onToggleRemove: () => void;
  canRemove: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div className={`rounded-xl border transition-all ${agent._removed ? 'border-gray-700/50 bg-gray-800/30 opacity-50' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}>
      <div className="p-4 flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${agent._removed ? 'bg-gray-700 text-gray-500' : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'}`}>
          {agent.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`font-medium truncate ${agent._removed ? 'text-gray-500 line-through' : 'text-white'}`}>
              {agent.displayName}
            </h4>
            <span className="text-xs text-gray-500 font-mono">{agent.name}</span>
          </div>
          <p className={`text-sm mt-0.5 ${agent._removed ? 'text-gray-600' : 'text-gray-400'}`}>{agent.role}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!agent._removed && (
            <button onClick={(e) => { e.stopPropagation(); setEditing(!editing); }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onToggleRemove(); }}
            disabled={!canRemove && !agent._removed}
            className={`p-1.5 rounded-lg transition-colors ${agent._removed ? 'text-green-400 hover:bg-green-500/20' : canRemove ? 'text-red-400 hover:bg-red-500/20' : 'text-gray-600 cursor-not-allowed'}`}>
            {agent._removed ? <RefreshCw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {editing && !agent._removed && (
        <div className="border-t border-gray-700 px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Display Name</label>
              <input value={agent.displayName} onChange={e => onUpdate({ ...agent, displayName: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Role</label>
              <input value={agent.role} onChange={e => onUpdate({ ...agent, role: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">System Prompt</label>
            <textarea value={agent.systemPrompt} onChange={e => onUpdate({ ...agent, systemPrompt: e.target.value })} rows={4}
              className="w-full mt-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
          </div>
          {/* Skills editing */}
          {agent.skills && agent.skills.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Skills ({agent.skills.length})</label>
              {agent.skills.map((skill, idx) => (
                <div key={idx} className="bg-gray-900/60 border border-gray-700 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-600">Name</label>
                      <input value={skill.name} onChange={e => {
                        const updated = [...(agent.skills || [])];
                        updated[idx] = { ...skill, name: e.target.value };
                        onUpdate({ ...agent, skills: updated });
                      }}
                        className="w-full mt-0.5 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600">Description</label>
                      <input value={skill.description} onChange={e => {
                        const updated = [...(agent.skills || [])];
                        updated[idx] = { ...skill, description: e.target.value };
                        onUpdate({ ...agent, skills: updated });
                      }}
                        className="w-full mt-0.5 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-600">Body</label>
                    <textarea value={skill.body} onChange={e => {
                      const updated = [...(agent.skills || [])];
                      updated[idx] = { ...skill, body: e.target.value };
                      onUpdate({ ...agent, skills: updated });
                    }} rows={3}
                      className="w-full mt-0.5 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setEditing(false)} className="text-xs text-blue-400 hover:text-blue-300">Done editing</button>
        </div>
      )}
      {expanded && !editing && (
        <div className="border-t border-gray-700 px-4 py-3 space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">System Prompt</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{agent.systemPrompt}</p>
          </div>
          {/* Skills read-only view */}
          {agent.skills && agent.skills.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Skills ({agent.skills.length})</p>
              <div className="space-y-2">
                {agent.skills.map((skill, idx) => (
                  <div key={idx} className="bg-gray-900/40 border border-gray-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-blue-400">{skill.name}</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-1.5">{skill.description}</p>
                    <pre className="text-xs text-gray-500 whitespace-pre-wrap bg-gray-900/60 rounded p-2 border border-gray-800">{skill.body}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AIScopeGenerator() {
  const navigate = useNavigate();
  const location = useLocation();
  const { success: showSuccess, error: showError } = useToast();

  // Accept pre-filled description and optional SOP file from navigation state
  const navState = location.state as { description?: string; hasSopFile?: boolean } | null;
  const prefilled = navState?.description || '';
  // Consume the SOP file from the ephemeral store (only available once after navigation)
  const [sopFile] = useState<File | null>(() => navState?.hasSopFile ? consumeSopFile() : null);

  // State
  const [step, setStep] = useState<Step>('input');
  const [description, setDescription] = useState(prefilled);
  const [errorMsg, setErrorMsg] = useState('');
  const [scope, setScope] = useState<GeneratedScope | null>(null);
  const [agents, setAgents] = useState<EditableAgent[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const autoTriggered = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Chat-style streaming state
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [userPrompt, setUserPrompt] = useState('');

  // Derived
  const activeAgents = agents.filter(a => !a._removed);
  const canRemoveMore = activeAgents.length > 1;

  // Auto-scroll chat area
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [contentBlocks, step]);

  // -------------------------------------------------------------------------
  // Generate — maps SSE events to ContentBlock[] for chat rendering
  // -------------------------------------------------------------------------
  const handleGenerate = useCallback(async () => {
    if (!description.trim()) return;

    setStep('generating');
    setContentBlocks([]);
    setErrorMsg('');
    setUserPrompt(description.trim());

    const controller = new AbortController();
    abortRef.current = controller;

    // Add an initial "thinking" text block
    setContentBlocks([{ type: 'text', text: sopFile
      ? `Uploading document "${sopFile.name}" and analyzing...\n\n`
      : 'Analyzing your business description...\n\n' }]);

    const sseHandler = (event: SSEEvent) => {
      if (event.type === 'session_start') {
        setContentBlocks(prev => [
          ...prev,
          { type: 'text', text: `Session started. Generating scope configuration...\n\n` },
        ]);
      } else if (event.type === 'assistant' && event.content) {
        setContentBlocks(prev => {
          const next = [...prev];
          for (const block of event.content!) {
            if (block.type === 'text' && block.text) {
              const lastIdx = next.length - 1;
              if (lastIdx >= 0 && next[lastIdx].type === 'text') {
                next[lastIdx] = { type: 'text', text: (next[lastIdx] as { type: 'text'; text: string }).text + block.text };
              } else {
                next.push({ type: 'text', text: block.text });
              }
            } else if (block.type === 'tool_use' && block.name) {
              next.push({
                type: 'tool_use',
                id: block.id || `tool-${Date.now()}`,
                name: block.name,
                input: (typeof block.input === 'object' ? block.input : {}) as Record<string, unknown>,
              });
            }
          }
          return next;
        });
      } else if (event.type === 'result') {
        setContentBlocks(prev => [
          ...prev,
          { type: 'text', text: '\n\n✅ Generation complete. Parsing results...' },
        ]);
      } else if (event.type === 'error') {
        setContentBlocks(prev => [
          ...prev,
          { type: 'text', text: `\n\n❌ Error: ${event.message}` },
        ]);
      }
    };

    try {
      // Use document upload endpoint when a SOP file is provided
      const fullText = sopFile
        ? await generateScopeWithDocument(sopFile, description.trim(), sseHandler, controller.signal)
        : await generateScope(description.trim(), sseHandler, controller.signal);

      // Parse the result
      const config = parseScopeConfig(fullText);
      setScope(config.scope);
      setAgents(toEditable(config.agents));

      setContentBlocks(prev => [
        ...prev,
        { type: 'text', text: `\n\nI've created **"${config.scope.name}"** with **${config.agents.length} agents**. You can review and customize them below.` },
      ]);

      setStep('preview');
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setErrorMsg(msg);
      setContentBlocks(prev => [
        ...prev,
        { type: 'text', text: `\n\n❌ ${msg}` },
      ]);
      setStep('error');
    }
  }, [description, sopFile]);

  // -------------------------------------------------------------------------
  // Auto-trigger generation when arriving with pre-filled description
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (prefilled && !autoTriggered.current) {
      autoTriggered.current = true;
      handleGenerate();
    }
  }, [prefilled, handleGenerate]);

  // -------------------------------------------------------------------------
  // Confirm
  // -------------------------------------------------------------------------
  const handleConfirm = useCallback(async () => {
    if (!scope) return;
    setStep('saving');

    const config: GeneratedScopeConfig = {
      scope,
      agents: activeAgents.map(({ _id, _removed, ...rest }) => rest),
    };

    try {
      const result = await confirmScopeGeneration(config);
      showSuccess('Scope Created', `"${result.scope.name}" with ${result.agents.length} agents`);
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      showError('Save Failed', msg);
      setStep('preview');
    }
  }, [scope, activeAgents, navigate, showSuccess, showError]);

  // -------------------------------------------------------------------------
  // Agent mutations
  // -------------------------------------------------------------------------
  const updateAgent = useCallback((updated: EditableAgent) => {
    setAgents(prev => prev.map(a => a._id === updated._id ? updated : a));
  }, []);

  const toggleRemoveAgent = useCallback((id: string) => {
    setAgents(prev => prev.map(a => a._id === id ? { ...a, _removed: !a._removed } : a));
  }, []);

  const addAgent = useCallback(() => {
    setAgents(prev => [...prev, {
      _id: uid(),
      _removed: false,
      name: `new-agent-${prev.length + 1}`,
      displayName: 'New Agent',
      role: 'Define this agent\'s role',
      systemPrompt: 'You are a helpful assistant.',
    }]);
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const isStreaming = step === 'generating';
  const showChat = userPrompt || step !== 'input';

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/create-business-scope')} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h1 className="text-xl font-semibold">AI Scope Generator</h1>
          </div>
        </div>
      </header>

      {/* Main scrollable area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

          {/* Input step (only shown when no generation has started) */}
          {step === 'input' && !showChat && (
            <div className="space-y-6 pt-4">
              <div>
                <h2 className="text-lg font-bold mb-2">Describe your business</h2>
                <p className="text-sm text-gray-400">Tell us about your business, team, or use case. The AI will generate a scope with specialized agents.</p>
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={6}
                placeholder="e.g. We're an e-commerce fashion brand with 50 employees. We need agents for customer support, inventory management, marketing campaigns, and order fulfillment..."
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => navigate('/create-business-scope')} className="px-6 py-2.5 text-sm text-gray-300 hover:text-white border border-gray-700 rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={handleGenerate} disabled={!description.trim()}
                  className={`px-8 py-2.5 text-sm font-semibold rounded-xl flex items-center gap-2 transition-all ${description.trim() ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:shadow-lg hover:shadow-purple-500/30' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                  <Sparkles className="w-4 h-4" /> Generate
                </button>
              </div>
            </div>
          )}

          {/* Chat conversation area */}
          {showChat && (
            <div className="space-y-4">
              {/* User message bubble */}
              <UserBubble text={userPrompt} />

              {/* AI streaming response */}
              <AIStreamingBubble blocks={contentBlocks} isStreaming={isStreaming} />

              {/* Cancel button while streaming */}
              {isStreaming && (
                <div className="flex justify-center">
                  <button onClick={() => { abortRef.current?.abort(); setStep('input'); setUserPrompt(''); }}
                    className="text-sm text-gray-400 hover:text-white border border-gray-700 px-4 py-1.5 rounded-lg transition-colors">
                    Cancel generation
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Preview & Edit section (appears below chat after generation) */}
          {step === 'preview' && scope && (
            <div className="space-y-6 border-t border-gray-800 pt-6">
              <div>
                <h2 className="text-lg font-bold mb-1">Review & Customize</h2>
                <p className="text-sm text-gray-400">Edit the scope and agents before saving. Click any card to edit.</p>
              </div>

              <ScopePreviewCard scope={scope} onChange={setScope} />

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-300">Agents ({activeAgents.length})</h3>
                <button onClick={addAgent} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Agent
                </button>
              </div>
              <div className="space-y-3">
                {agents.map(agent => (
                  <AgentCard
                    key={agent._id}
                    agent={agent}
                    onUpdate={updateAgent}
                    onToggleRemove={() => toggleRemoveAgent(agent._id)}
                    canRemove={canRemoveMore || agent._removed}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-gray-800">
                <button onClick={() => { setStep('input'); setScope(null); setAgents([]); setUserPrompt(''); setContentBlocks([]); }}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <RefreshCw className="w-4 h-4" /> Start Over
                </button>
                <button onClick={handleConfirm} disabled={activeAgents.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <Check className="w-4 h-4" /> Create Scope
                </button>
              </div>
            </div>
          )}

          {/* Saving */}
          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-green-400 animate-spin mb-4" />
              <p className="text-lg font-medium">Creating scope, agents & generating avatars...</p>
              <p className="text-sm text-gray-400 mt-2">This may take a moment while AI generates unique avatar images</p>
            </div>
          )}

          {/* Error — shown below the chat */}
          {step === 'error' && (
            <div className="border-t border-gray-800 pt-6">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                  <AlertCircle className="w-7 h-7 text-red-400" />
                </div>
                <p className="text-lg font-medium mb-1">Generation Failed</p>
                <p className="text-sm text-gray-400 text-center max-w-md mb-6">{errorMsg}</p>
                <div className="flex gap-3">
                  <button onClick={() => { setStep('input'); setUserPrompt(''); setContentBlocks([]); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 border border-gray-600 rounded-lg hover:border-gray-500 transition-colors">
                    <RefreshCw className="w-4 h-4" /> Try Again
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>
    </div>
  );
}

export default AIScopeGenerator;

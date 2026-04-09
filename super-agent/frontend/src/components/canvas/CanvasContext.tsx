/**
 * Canvas Context - State management for the workflow canvas
 */

import { createContext, useContext, useCallback, useState, useMemo, type ReactNode } from 'react';
import type { 
  CanvasNode, 
  CanvasEdge, 
  CanvasData,
  CanvasNodeType 
} from '@/types/canvas';
import type { WorkflowVariableDefinition } from '@/types/canvas/metadata';
import { 
  createCanvasNode, 
  getRootNodes 
} from '@/lib/canvas/nodes';
import { 
  createEdge, 
  removeNode as removeNodeUtil,
  updateNodeData,
  generateNodeId,
  generateEntityId,
} from '@/lib/canvas/utils';
import { calculateNewNodePosition } from '@/lib/canvas/layout';

interface CanvasContextValue {
  // Canvas data
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  variables: WorkflowVariableDefinition[];
  
  // Selection state
  selectedNodeIds: string[];
  
  // Node operations
  addNode: (type: CanvasNodeType, position?: { x: number; y: number }) => CanvasNode;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, updates: Partial<CanvasNode['data']>) => void;
  selectNode: (nodeId: string, addToSelection?: boolean) => void;
  clearSelection: () => void;
  
  // Edge operations
  addEdge: (source: string, target: string) => CanvasEdge | null;
  removeEdge: (edgeId: string) => void;
  
  // Canvas operations
  setCanvasData: (data: CanvasData) => void;
  setVariables: (variables: WorkflowVariableDefinition[]) => void;
  
  // Readonly state
  readonly: boolean;
  setReadonly: (readonly: boolean) => void;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

interface CanvasProviderProps {
  children: ReactNode;
  initialData?: CanvasData;
  initialVariables?: WorkflowVariableDefinition[];
  readonly?: boolean;
  onChange?: (data: CanvasData) => void;
}

export function CanvasProvider({ 
  children, 
  initialData,
  initialVariables = [],
  readonly: initialReadonly = false,
  onChange,
}: CanvasProviderProps) {
  const [nodes, setNodes] = useState<CanvasNode[]>(initialData?.nodes ?? []);
  const [edges, setEdges] = useState<CanvasEdge[]>(initialData?.edges ?? []);
  const [variables, setVariables] = useState<WorkflowVariableDefinition[]>(initialVariables);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [readonly, setReadonly] = useState(initialReadonly);

  // Notify parent of changes
  const notifyChange = useCallback((newNodes: CanvasNode[], newEdges: CanvasEdge[]) => {
    onChange?.({ nodes: newNodes, edges: newEdges });
  }, [onChange]);

  // Add a new node
  const addNode = useCallback((
    type: CanvasNodeType, 
    position?: { x: number; y: number }
  ): CanvasNode => {
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    const finalPosition = position ?? calculateNewNodePosition(selectedNodes, nodes, edges);
    
    const newNode = createCanvasNode(type, finalPosition);
    
    setNodes(prev => {
      const updated = [...prev, newNode];
      notifyChange(updated, edges);
      return updated;
    });
    
    return newNode;
  }, [nodes, edges, selectedNodeIds, notifyChange]);

  // Remove a node
  const removeNode = useCallback((nodeId: string) => {
    setNodes(prev => {
      const result = removeNodeUtil({ nodes: prev, edges }, nodeId);
      setEdges(result.edges);
      notifyChange(result.nodes, result.edges);
      return result.nodes;
    });
  }, [edges, notifyChange]);

  // Update node data
  const updateNode = useCallback((nodeId: string, updates: Partial<CanvasNode['data']>) => {
    setNodes(prev => {
      const updated = updateNodeData(prev, nodeId, updates);
      notifyChange(updated, edges);
      return updated;
    });
  }, [edges, notifyChange]);

  // Select a node
  const selectNode = useCallback((nodeId: string, addToSelection = false) => {
    setSelectedNodeIds(prev => {
      if (addToSelection) {
        return prev.includes(nodeId) 
          ? prev.filter(id => id !== nodeId)
          : [...prev, nodeId];
      }
      return [nodeId];
    });
    
    // Update node selection state
    setNodes(prev => prev.map(node => ({
      ...node,
      selected: addToSelection 
        ? (node.id === nodeId ? !node.selected : node.selected)
        : node.id === nodeId,
    })));
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedNodeIds([]);
    setNodes(prev => prev.map(node => ({ ...node, selected: false })));
  }, []);

  // Add an edge
  const addEdge = useCallback((source: string, target: string): CanvasEdge | null => {
    // Check if edge already exists
    const exists = edges.some(e => e.source === source && e.target === target);
    if (exists) return null;
    
    // Check for self-loop
    if (source === target) return null;
    
    const newEdge = createEdge(source, target);
    
    setEdges(prev => {
      const updated = [...prev, newEdge];
      notifyChange(nodes, updated);
      return updated;
    });
    
    return newEdge;
  }, [edges, nodes, notifyChange]);

  // Remove an edge
  const removeEdge = useCallback((edgeId: string) => {
    setEdges(prev => {
      const updated = prev.filter(e => e.id !== edgeId);
      notifyChange(nodes, updated);
      return updated;
    });
  }, [nodes, notifyChange]);

  // Set canvas data
  const setCanvasData = useCallback((data: CanvasData) => {
    setNodes(data.nodes);
    setEdges(data.edges);
    notifyChange(data.nodes, data.edges);
  }, [notifyChange]);

  const value = useMemo<CanvasContextValue>(() => ({
    nodes,
    edges,
    variables,
    selectedNodeIds,
    addNode,
    removeNode,
    updateNode,
    selectNode,
    clearSelection,
    addEdge,
    removeEdge,
    setCanvasData,
    setVariables,
    readonly,
    setReadonly,
  }), [
    nodes,
    edges,
    variables,
    selectedNodeIds,
    addNode,
    removeNode,
    updateNode,
    selectNode,
    clearSelection,
    addEdge,
    removeEdge,
    setCanvasData,
    setVariables,
    readonly,
  ]);

  return (
    <CanvasContext.Provider value={value}>
      {children}
    </CanvasContext.Provider>
  );
}

export function useCanvasContext() {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvasContext must be used within a CanvasProvider');
  }
  return context;
}

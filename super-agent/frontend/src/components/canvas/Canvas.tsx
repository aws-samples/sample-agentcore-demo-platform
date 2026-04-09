/**
 * Canvas Component - Main workflow canvas using xyflow
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
  type NodeTypes,
  type EdgeTypes,
  BackgroundVariant,
  ConnectionMode,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { CanvasNode, CanvasEdge, CanvasData, CanvasNodeType } from '@/types/canvas';
import type { NodeExecutionState } from '@/services/useWorkflowExecution';
import { nodeTypes } from './nodes';
import { edgeTypes, defaultEdgeOptions } from './edges';
import { CanvasToolbar } from './CanvasToolbar';

// Grid configuration
const GRID_SIZE = 20;

interface CanvasProps {
  initialData?: CanvasData;
  readonly?: boolean;
  onChange?: (data: CanvasData) => void;
  onNodeSelect?: (nodeId: string | null) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onAddNode?: (type: CanvasNodeType) => void;
  nodeExecutionStates?: Map<string, NodeExecutionState>;
  className?: string;
}

function CanvasInner({
  initialData,
  readonly = false,
  onChange,
  onNodeSelect,
  onNodeDoubleClick,
  onAddNode,
  nodeExecutionStates,
  className = '',
}: CanvasProps) {
  const reactFlowInstance = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize nodes and edges from initial data
  const [nodes, setNodes, onNodesChange] = useNodesState(
    (initialData?.nodes ?? []) as Node[]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    (initialData?.edges ?? []) as Edge[]
  );

  // Track if we're syncing to avoid loops
  const isSyncingRef = useRef(false);

  // Sync with initialData when it changes - check both structure and data
  useEffect(() => {
    // Skip if no data or if we're in the middle of syncing back to parent
    if (!initialData || isSyncingRef.current) {
      return;
    }

    // Check if node IDs changed
    const currentNodeIds = nodes.map(n => n.id).sort().join(',');
    const newNodeIds = initialData.nodes.map(n => n.id).sort().join(',');
    const idsChanged = currentNodeIds !== newNodeIds;

    // Check if node data changed (e.g., title updates, metadata changes from editor panel)
    let dataChanged = false;
    if (!idsChanged && initialData.nodes.length === nodes.length) {
      for (const newNode of initialData.nodes) {
        const currentNode = nodes.find(n => n.id === newNode.id);
        if (currentNode) {
          const currentData = currentNode.data as Record<string, unknown>;
          const newData = newNode.data as Record<string, unknown>;
          if (
            currentData.title !== newData.title ||
            JSON.stringify(currentData.metadata) !== JSON.stringify(newData.metadata)
          ) {
            dataChanged = true;
            break;
          }
        }
      }
    }
    
    if (idsChanged || dataChanged) {
      console.log('🎨 Canvas: Syncing from initialData', {
        idsChanged,
        dataChanged,
        from: currentNodeIds || '(empty)',
        to: newNodeIds || '(empty)',
      });
      setNodes(initialData.nodes as Node[]);
      setEdges(initialData.edges as Edge[]);
    }
  }, [initialData, nodes, edges, setNodes, setEdges]);

  // Merge execution states into node data
  const nodesWithExecutionState = useMemo(() => {
    if (!nodeExecutionStates || nodeExecutionStates.size === 0) {
      return nodes;
    }

    return nodes.map(node => {
      const execState = nodeExecutionStates.get(node.id);
      if (execState) {
        return {
          ...node,
          data: {
            ...node.data,
            executionStatus: execState.status,
            executionProgress: execState.progress,
          },
        };
      }
      return node;
    });
  }, [nodes, nodeExecutionStates]);

  // Notify parent of changes - only when user makes changes, not during sync
  const isUserChangeRef = useRef(false);
  
  useEffect(() => {
    // Only notify parent if this is a user-initiated change
    if (isUserChangeRef.current) {
      isSyncingRef.current = true;
      onChange?.({ 
        nodes: nodes as CanvasNode[], 
        edges: edges as CanvasEdge[] 
      });
      // Reset after a tick
      setTimeout(() => {
        isSyncingRef.current = false;
        isUserChangeRef.current = false;
      }, 0);
    }
  }, [nodes, edges, onChange]);

  // Handle new connections
  const onConnect: OnConnect = useCallback((connection) => {
    if (readonly) return;
    
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || source === target) return;

    // Check if edge already exists (same source + target + handle combo)
    const exists = edges.some(e => 
      e.source === source && e.target === target && 
      (e.sourceHandle ?? null) === (sourceHandle ?? null)
    );
    if (exists) return;

    const newEdge: Edge = {
      id: `edge_${source}_${sourceHandle ?? 'default'}_${target}_${Date.now()}`,
      source,
      target,
      sourceHandle: sourceHandle ?? undefined,
      targetHandle: targetHandle ?? undefined,
      type: 'custom',
    };

    isUserChangeRef.current = true;
    setEdges(eds => [...eds, newEdge]);
  }, [readonly, edges, setEdges]);

  // Handle node click
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    onNodeSelect?.(node.id);
  }, [onNodeSelect]);

  // Handle node double click
  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    onNodeDoubleClick?.(node.id);
  }, [onNodeDoubleClick]);

  // Handle pane click (deselect)
  const handlePaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  // Validate connections: source handles can only connect to target handles, no self-loops
  const isValidConnection = useCallback((connection: { source: string | null; target: string | null; sourceHandle: string | null; targetHandle: string | null }) => {
    if (!connection.source || !connection.target) return false;
    if (connection.source === connection.target) return false;
    return true;
  }, []);

  // Handle node drag stop - snap to grid
  const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    const snappedX = Math.round(node.position.x / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(node.position.y / GRID_SIZE) * GRID_SIZE;

    if (snappedX !== node.position.x || snappedY !== node.position.y) {
      isUserChangeRef.current = true;
      setNodes(nds => nds.map(n => 
        n.id === node.id 
          ? { ...n, position: { x: snappedX, y: snappedY } }
          : n
      ));
    }
  }, [setNodes]);

  // Center on start node at a readable zoom on initial load
  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        // Find the start node or use the first node
        const startNode = nodes.find(n => (n as any).type === 'start') || nodes[0];
        const centerX = startNode.position.x + 160; // approximate half node width
        const centerY = startNode.position.y + 60;  // approximate half node height
        
        reactFlowInstance.setCenter(centerX, centerY, { zoom: 0.75, duration: 200 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [reactFlowInstance, nodes.length]);

  // Wrap change handlers to mark user changes
  const handleNodesChange = useCallback((changes: any) => {
    // Only mark as user change for intentional edits, not React Flow internals
    const isUserChange = changes.some((c: any) => 
      c.type === 'remove' || (c.type === 'position' && c.dragging)
    );
    if (isUserChange) {
      isUserChangeRef.current = true;
    }
    onNodesChange(changes);
  }, [onNodesChange]);

  const handleEdgesChange = useCallback((changes: any) => {
    const isUserChange = changes.some((c: any) => c.type === 'remove');
    if (isUserChange) {
      isUserChangeRef.current = true;
    }
    onEdgesChange(changes);
  }, [onEdgesChange]);

  return (
    <div ref={containerRef} className={`w-full h-full ${className}`}>
      <ReactFlow
        nodes={nodesWithExecutionState}
        edges={edges}
        onNodesChange={readonly ? undefined : handleNodesChange}
        onEdgesChange={readonly ? undefined : handleEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes as NodeTypes}
        edgeTypes={edgeTypes as EdgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Strict}
        selectionMode={SelectionMode.Partial}
        snapToGrid
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={readonly ? null : ['Backspace', 'Delete']}
        multiSelectionKeyCode={['Meta', 'Shift']}
        panOnScroll
        selectionOnDrag={false}
        panOnDrag
        proOptions={{ hideAttribution: true }}
        className="bg-gray-900"
      >
        <Background 
          variant={BackgroundVariant.Dots}
          gap={GRID_SIZE}
          size={1}
          color="rgba(100, 116, 139, 0.3)"
        />
        <Controls 
          showZoom
          showFitView
          showInteractive={!readonly}
          className="bg-gray-800 border-gray-700 rounded-lg"
        />
        {!readonly && (
          <CanvasToolbar 
            onAddNode={(type: CanvasNodeType) => {
              if (onAddNode) {
                onAddNode(type);
              } else {
                const position = reactFlowInstance.screenToFlowPosition({
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                });
                console.log('Add node:', type, position);
              }
            }}
          />
        )}
      </ReactFlow>
    </div>
  );
}

// Wrap with ReactFlowProvider
export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

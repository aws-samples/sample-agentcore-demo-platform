import { useState, useCallback, useRef, useEffect } from 'react'
import type { Workflow, WorkflowNode as WorkflowNodeType, Position } from '@/types'
import { WorkflowNode } from './WorkflowNode'

interface WorkflowCanvasProps {
  workflow: Workflow
  onNodePositionChange?: (nodeId: string, position: Position) => void
}

export function WorkflowCanvas({ workflow, onNodePositionChange }: WorkflowCanvasProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<{
    nodeId: string
    startX: number
    startY: number
    nodeStartX: number
    nodeStartY: number
  } | null>(null)
  const [nodePositions, setNodePositions] = useState<Record<string, Position>>({})
  const canvasRef = useRef<HTMLDivElement>(null)

  // Initialize node positions from workflow
  // Only reset when workflow ID changes, not when nodes update
  useEffect(() => {
    const positions: Record<string, Position> = {}
    workflow.nodes.forEach(node => {
      positions[node.id] = node.position
    })
    setNodePositions(positions)
  }, [workflow.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Note: We intentionally don't include workflow.nodes to avoid resetting during drag

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
  }, [])

  const handleDragStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault()
    const node = workflow.nodes.find(n => n.id === nodeId)
    if (!node) return

    const currentPos = nodePositions[nodeId] || node.position
    setDragState({
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      nodeStartX: currentPos.x,
      nodeStartY: currentPos.y,
    })
    setSelectedNodeId(nodeId)
  }, [workflow.nodes, nodePositions])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState) return

    const deltaX = e.clientX - dragState.startX
    const deltaY = e.clientY - dragState.startY

    const newPosition: Position = {
      x: dragState.nodeStartX + deltaX,
      y: dragState.nodeStartY + deltaY,
    }

    setNodePositions(prev => ({
      ...prev,
      [dragState.nodeId]: newPosition,
    }))
  }, [dragState])

  const handleMouseUp = useCallback(() => {
    if (dragState) {
      const newPosition = nodePositions[dragState.nodeId]
      if (newPosition) {
        onNodePositionChange?.(dragState.nodeId, newPosition)
      }
    }
    setDragState(null)
  }, [dragState, nodePositions, onNodePositionChange])

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedNodeId(null)
    }
  }, [])

  // Get node position (from local state or workflow)
  const getNodePosition = (node: WorkflowNodeType): Position => {
    return nodePositions[node.id] || node.position
  }

  // Render connections between nodes
  const renderConnections = () => {
    return workflow.connections.map(connection => {
      const fromNode = workflow.nodes.find(n => n.id === connection.from)
      const toNode = workflow.nodes.find(n => n.id === connection.to)
      
      if (!fromNode || !toNode) return null

      const fromPos = getNodePosition(fromNode)
      const toPos = getNodePosition(toNode)

      // Calculate path for the connection line
      const startX = fromPos.x
      const startY = fromPos.y + 30 // Bottom of node
      const endX = toPos.x
      const endY = toPos.y - 30 // Top of node

      // Create a curved path
      const midY = (startY + endY) / 2
      const path = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`

      return (
        <g key={connection.id}>
          <path
            d={path}
            fill="none"
            stroke="rgba(100, 116, 139, 0.5)"
            strokeWidth="2"
            strokeDasharray={connection.animated ? '5,5' : undefined}
            className={connection.animated ? 'animate-dash' : ''}
          />
          {/* Arrow head */}
          <polygon
            points={`${endX},${endY} ${endX - 5},${endY - 8} ${endX + 5},${endY - 8}`}
            fill="rgba(100, 116, 139, 0.5)"
          />
        </g>
      )
    })
  }

  // Calculate canvas bounds
  const canvasBounds = workflow.nodes.reduce(
    (bounds, node) => {
      const pos = getNodePosition(node)
      return {
        minX: Math.min(bounds.minX, pos.x - 100),
        maxX: Math.max(bounds.maxX, pos.x + 100),
        minY: Math.min(bounds.minY, pos.y - 50),
        maxY: Math.max(bounds.maxY, pos.y + 50),
      }
    },
    { minX: 0, maxX: 800, minY: 0, maxY: 400 }
  )

  const canvasWidth = Math.max(canvasBounds.maxX - canvasBounds.minX + 200, 800)
  const canvasHeight = Math.max(canvasBounds.maxY - canvasBounds.minY + 200, 400)

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full overflow-auto bg-gray-900/50 rounded-lg border border-gray-800"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
    >
      {/* Grid Background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(55, 65, 81, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(55, 65, 81, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* SVG for connections */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={canvasWidth}
        height={canvasHeight}
        style={{ minWidth: '100%', minHeight: '100%' }}
      >
        {renderConnections()}
      </svg>

      {/* Nodes */}
      <div
        className="relative"
        style={{ width: canvasWidth, height: canvasHeight, minHeight: '100%' }}
      >
        {workflow.nodes.map(node => (
          <WorkflowNode
            key={node.id}
            node={{ ...node, position: getNodePosition(node) }}
            isSelected={selectedNodeId === node.id}
            onSelect={handleNodeSelect}
            onDragStart={handleDragStart}
          />
        ))}
      </div>
    </div>
  )
}

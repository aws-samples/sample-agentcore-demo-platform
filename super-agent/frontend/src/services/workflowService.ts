import type { Workflow, WorkflowCategory, WorkflowImportResult, WorkflowNode, NodeType, Connection } from '@/types'
import { getServiceConfig } from './api/createService'
import { RestWorkflowService } from './api/restWorkflowService'
import { shouldUseRestApi } from './api/index'

// Simulated network delay for realistic behavior
const SIMULATED_DELAY = 300

// Mock workflow data for development
const mockWorkflows: Workflow[] = [
  {
    id: 'workflow-1',
    name: 'Employee Onboarding',
    category: 'hr',
    version: '1.0.0',
    isOfficial: true,
    nodes: [
      { id: 'node-1', type: 'trigger', label: 'New Hire Request', description: 'Triggered when HR submits new hire form', position: { x: 100, y: 100 }, icon: 'play' },
      { id: 'node-2', type: 'agent', label: 'HR Assistant', description: 'Processes new hire documentation', position: { x: 300, y: 100 }, icon: 'bot', agentId: 'agent-1' },
      { id: 'node-3', type: 'human', label: 'Manager Approval', description: 'Manager reviews and approves hire', position: { x: 500, y: 100 }, icon: 'user' },
      { id: 'node-4', type: 'agent', label: 'Onboarding Bot', description: 'Sends welcome materials', position: { x: 700, y: 100 }, icon: 'bot', agentId: 'agent-2' },
      { id: 'node-5', type: 'end', label: 'Complete', description: 'Onboarding process complete', position: { x: 900, y: 100 }, icon: 'check' },
    ],
    connections: [
      { id: 'conn-1', from: 'node-1', to: 'node-2' },
      { id: 'conn-2', from: 'node-2', to: 'node-3' },
      { id: 'conn-3', from: 'node-3', to: 'node-4' },
      { id: 'conn-4', from: 'node-4', to: 'node-5' },
    ],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    createdBy: 'admin',
  },
  {
    id: 'workflow-1-draft',
    name: 'Employee Onboarding',
    category: 'hr',
    version: '1.1.0-draft',
    isOfficial: false,
    parentVersion: '1.0.0',
    nodes: [
      { id: 'node-1', type: 'trigger', label: 'New Hire Request', description: 'Triggered when HR submits new hire form', position: { x: 100, y: 100 }, icon: 'play' },
      { id: 'node-2', type: 'agent', label: 'HR Assistant', description: 'Processes new hire documentation', position: { x: 300, y: 100 }, icon: 'bot', agentId: 'agent-1' },
      { id: 'node-3', type: 'action', label: 'Background Check', description: 'Automated background verification', position: { x: 500, y: 50 }, icon: 'shield', actionType: 'verification' },
      { id: 'node-4', type: 'human', label: 'Manager Approval', description: 'Manager reviews and approves hire', position: { x: 500, y: 150 }, icon: 'user' },
      { id: 'node-5', type: 'agent', label: 'Onboarding Bot', description: 'Sends welcome materials', position: { x: 700, y: 100 }, icon: 'bot', agentId: 'agent-2' },
      { id: 'node-6', type: 'end', label: 'Complete', description: 'Onboarding process complete', position: { x: 900, y: 100 }, icon: 'check' },
    ],
    connections: [
      { id: 'conn-1', from: 'node-1', to: 'node-2' },
      { id: 'conn-2', from: 'node-2', to: 'node-3' },
      { id: 'conn-3', from: 'node-2', to: 'node-4' },
      { id: 'conn-4', from: 'node-3', to: 'node-5' },
      { id: 'conn-5', from: 'node-4', to: 'node-5' },
      { id: 'conn-6', from: 'node-5', to: 'node-6' },
    ],
    createdAt: new Date('2024-01-25'),
    updatedAt: new Date('2024-01-25'),
    createdBy: 'admin',
  },

  {
    id: 'workflow-2',
    name: 'CI/CD Pipeline',
    category: 'deployment',
    version: '2.0.0',
    isOfficial: true,
    nodes: [
      { id: 'node-1', type: 'trigger', label: 'Code Push', description: 'Triggered on git push to main', position: { x: 100, y: 100 }, icon: 'git-branch' },
      { id: 'node-2', type: 'action', label: 'Build', description: 'Compile and build application', position: { x: 300, y: 100 }, icon: 'package', actionType: 'build' },
      { id: 'node-3', type: 'action', label: 'Test', description: 'Run automated tests', position: { x: 500, y: 100 }, icon: 'test-tube', actionType: 'test' },
      { id: 'node-4', type: 'agent', label: 'DevOps Bot', description: 'Manages deployment process', position: { x: 700, y: 100 }, icon: 'bot', agentId: 'agent-4' },
      { id: 'node-5', type: 'human', label: 'Release Approval', description: 'Manual approval for production', position: { x: 900, y: 100 }, icon: 'user-check' },
      { id: 'node-6', type: 'action', label: 'Deploy', description: 'Deploy to production', position: { x: 1100, y: 100 }, icon: 'rocket', actionType: 'deploy' },
      { id: 'node-7', type: 'end', label: 'Complete', description: 'Deployment complete', position: { x: 1300, y: 100 }, icon: 'check' },
    ],
    connections: [
      { id: 'conn-1', from: 'node-1', to: 'node-2' },
      { id: 'conn-2', from: 'node-2', to: 'node-3' },
      { id: 'conn-3', from: 'node-3', to: 'node-4' },
      { id: 'conn-4', from: 'node-4', to: 'node-5' },
      { id: 'conn-5', from: 'node-5', to: 'node-6' },
      { id: 'conn-6', from: 'node-6', to: 'node-7' },
    ],
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-10'),
    createdBy: 'devops-team',
  },
  {
    id: 'workflow-3',
    name: 'Content Campaign',
    category: 'marketing',
    version: '1.0.0',
    isOfficial: true,
    nodes: [
      { id: 'node-1', type: 'trigger', label: 'Campaign Brief', description: 'New campaign request submitted', position: { x: 100, y: 100 }, icon: 'file-text' },
      { id: 'node-2', type: 'agent', label: 'Marketing Assistant', description: 'Generates content drafts', position: { x: 300, y: 100 }, icon: 'bot', agentId: 'agent-5' },
      { id: 'node-3', type: 'human', label: 'Content Review', description: 'Marketing team reviews content', position: { x: 500, y: 100 }, icon: 'eye' },
      { id: 'node-4', type: 'action', label: 'Schedule Posts', description: 'Schedule across platforms', position: { x: 700, y: 100 }, icon: 'calendar', actionType: 'schedule' },
      { id: 'node-5', type: 'end', label: 'Published', description: 'Campaign content published', position: { x: 900, y: 100 }, icon: 'check' },
    ],
    connections: [
      { id: 'conn-1', from: 'node-1', to: 'node-2' },
      { id: 'conn-2', from: 'node-2', to: 'node-3' },
      { id: 'conn-3', from: 'node-3', to: 'node-4' },
      { id: 'conn-4', from: 'node-4', to: 'node-5' },
    ],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-12'),
    createdBy: 'marketing-lead',
  },

  {
    id: 'workflow-4',
    name: 'Customer Support Escalation',
    category: 'support',
    version: '1.2.0',
    isOfficial: true,
    nodes: [
      { id: 'node-1', type: 'trigger', label: 'Support Ticket', description: 'New support ticket created', position: { x: 100, y: 100 }, icon: 'ticket' },
      { id: 'node-2', type: 'agent', label: 'Support Agent', description: 'Initial ticket triage', position: { x: 300, y: 100 }, icon: 'bot', agentId: 'agent-7' },
      { id: 'node-3', type: 'action', label: 'Classify Priority', description: 'Determine ticket priority', position: { x: 500, y: 100 }, icon: 'flag', actionType: 'classify' },
      { id: 'node-4', type: 'human', label: 'Specialist Review', description: 'Human specialist handles complex issues', position: { x: 700, y: 50 }, icon: 'user' },
      { id: 'node-5', type: 'agent', label: 'Auto Response', description: 'Automated response for simple issues', position: { x: 700, y: 150 }, icon: 'bot', agentId: 'agent-7' },
      { id: 'node-6', type: 'end', label: 'Resolved', description: 'Ticket resolved', position: { x: 900, y: 100 }, icon: 'check-circle' },
    ],
    connections: [
      { id: 'conn-1', from: 'node-1', to: 'node-2' },
      { id: 'conn-2', from: 'node-2', to: 'node-3' },
      { id: 'conn-3', from: 'node-3', to: 'node-4' },
      { id: 'conn-4', from: 'node-3', to: 'node-5' },
      { id: 'conn-5', from: 'node-4', to: 'node-6' },
      { id: 'conn-6', from: 'node-5', to: 'node-6' },
    ],
    createdAt: new Date('2024-02-05'),
    updatedAt: new Date('2024-02-15'),
    createdBy: 'support-manager',
  },
  {
    id: 'workflow-5',
    name: 'Leave Request',
    category: 'hr',
    version: '1.0.0',
    isOfficial: true,
    nodes: [
      { id: 'node-1', type: 'trigger', label: 'Leave Request', description: 'Employee submits leave request', position: { x: 100, y: 100 }, icon: 'calendar-off' },
      { id: 'node-2', type: 'agent', label: 'HR Assistant', description: 'Validates leave balance', position: { x: 300, y: 100 }, icon: 'bot', agentId: 'agent-1' },
      { id: 'node-3', type: 'human', label: 'Manager Approval', description: 'Direct manager approves request', position: { x: 500, y: 100 }, icon: 'user-check' },
      { id: 'node-4', type: 'action', label: 'Update Calendar', description: 'Update team calendar', position: { x: 700, y: 100 }, icon: 'calendar', actionType: 'update' },
      { id: 'node-5', type: 'end', label: 'Approved', description: 'Leave request processed', position: { x: 900, y: 100 }, icon: 'check' },
    ],
    connections: [
      { id: 'conn-1', from: 'node-1', to: 'node-2' },
      { id: 'conn-2', from: 'node-2', to: 'node-3' },
      { id: 'conn-3', from: 'node-3', to: 'node-4' },
      { id: 'conn-4', from: 'node-4', to: 'node-5' },
    ],
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-22'),
    createdBy: 'hr-admin',
  },
]

// In-memory store for mock data (simulates backend persistence)
let workflowStore: Workflow[] = [...mockWorkflows]

// Helper to simulate async operations
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Generate unique ID
function generateId(): string {
  return `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export type WorkflowServiceErrorCode = 'NOT_FOUND' | 'VALIDATION_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN'

export class WorkflowServiceError extends Error {
  code: WorkflowServiceErrorCode

  constructor(message: string, code: WorkflowServiceErrorCode) {
    super(message)
    this.name = 'WorkflowServiceError'
    this.code = code
  }
}


// Environment detection - use mock data in all environments except when explicitly configured
// HTTP requests are disabled because MSW in Node.js requires absolute URLs
const useHttpRequests = false

export const MockWorkflowService = {
  /**
   * Retrieves all workflows from the system
   */
  async getWorkflows(): Promise<Workflow[]> {
    if (useHttpRequests) {
      const response = await fetch('/api/workflows')
      if (!response.ok) {
        throw new WorkflowServiceError('Failed to fetch workflows', 'NETWORK_ERROR')
      }
      return response.json()
    } else {
      await delay(SIMULATED_DELAY)
      return workflowStore.map(w => ({ ...w }))
    }
  },

  /**
   * Retrieves a single workflow by ID
   * @throws WorkflowServiceError if workflow not found
   */
  async getWorkflowById(id: string): Promise<Workflow> {
    if (useHttpRequests) {
      const response = await fetch(`/api/workflows/${id}`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new WorkflowServiceError(`Workflow with id "${id}" not found`, 'NOT_FOUND')
        }
        throw new WorkflowServiceError('Failed to fetch workflow', 'NETWORK_ERROR')
      }
      return response.json()
    } else {
      await delay(SIMULATED_DELAY)
      const workflow = workflowStore.find(w => w.id === id)
      if (!workflow) {
        throw new WorkflowServiceError(`Workflow with id "${id}" not found`, 'NOT_FOUND')
      }
      return { ...workflow }
    }
  },

  /**
   * Creates a new workflow
   * @throws WorkflowServiceError if validation fails
   */
  async createWorkflow(data: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workflow> {
    // Validate required fields
    if (!data.name || data.name.trim() === '') {
      throw new WorkflowServiceError('Workflow name is required', 'VALIDATION_ERROR')
    }
    if (!data.category) {
      throw new WorkflowServiceError('Workflow category is required', 'VALIDATION_ERROR')
    }
    if (!data.version || data.version.trim() === '') {
      throw new WorkflowServiceError('Workflow version is required', 'VALIDATION_ERROR')
    }

    if (useHttpRequests) {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        throw new WorkflowServiceError('Failed to create workflow', 'NETWORK_ERROR')
      }
      return response.json()
    } else {
      await delay(SIMULATED_DELAY)

      const now = new Date()
      const newWorkflow: Workflow = {
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      workflowStore.push(newWorkflow)
      return { ...newWorkflow }
    }
  },

  /**
   * Updates an existing workflow
   * @throws WorkflowServiceError if workflow not found or validation fails
   */
  async updateWorkflow(id: string, data: Partial<Omit<Workflow, 'id' | 'createdAt'>>): Promise<Workflow> {
    // Validate fields if provided
    if (data.name !== undefined && data.name.trim() === '') {
      throw new WorkflowServiceError('Workflow name cannot be empty', 'VALIDATION_ERROR')
    }
    if (data.version !== undefined && data.version.trim() === '') {
      throw new WorkflowServiceError('Workflow version cannot be empty', 'VALIDATION_ERROR')
    }

    if (useHttpRequests) {
      const response = await fetch(`/api/workflows/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new WorkflowServiceError(`Workflow with id "${id}" not found`, 'NOT_FOUND')
        }
        throw new WorkflowServiceError('Failed to update workflow', 'NETWORK_ERROR')
      }
      return response.json()
    } else {
      await delay(SIMULATED_DELAY)
      const index = workflowStore.findIndex(w => w.id === id)
      if (index === -1) {
        throw new WorkflowServiceError(`Workflow with id "${id}" not found`, 'NOT_FOUND')
      }

      const updatedWorkflow: Workflow = {
        ...workflowStore[index],
        ...data,
        id: workflowStore[index].id, // Prevent ID modification
        createdAt: workflowStore[index].createdAt, // Prevent createdAt modification
        updatedAt: new Date(),
      }
      workflowStore[index] = updatedWorkflow

      return { ...updatedWorkflow }
    }
  },

  /**
   * Retrieves workflows filtered by category
   */
  async getWorkflowsByCategory(category: WorkflowCategory): Promise<Workflow[]> {
    if (useHttpRequests) {
      const response = await fetch(`/api/workflows?category=${category}`)
      if (!response.ok) {
        throw new WorkflowServiceError('Failed to fetch workflows by category', 'NETWORK_ERROR')
      }
      return response.json()
    } else {
      await delay(SIMULATED_DELAY)
      return workflowStore.filter(w => w.category === category).map(w => ({ ...w }))
    }
  },

  /**
   * Retrieves all versions of a workflow by name and category
   */
  async getWorkflowVersions(name: string, category: WorkflowCategory): Promise<Workflow[]> {
    if (useHttpRequests) {
      const response = await fetch(`/api/workflows?name=${encodeURIComponent(name)}&category=${category}`)
      if (!response.ok) {
        throw new WorkflowServiceError('Failed to fetch workflow versions', 'NETWORK_ERROR')
      }
      const workflows = await response.json()
      return workflows.sort((a: Workflow, b: Workflow) => b.version.localeCompare(a.version))
    } else {
      await delay(SIMULATED_DELAY)
      return workflowStore
        .filter(w => w.name === name && w.category === category)
        .sort((a, b) => b.version.localeCompare(a.version))
        .map(w => ({ ...w }))
    }
  },

  /**
   * Imports a workflow from an uploaded flowchart image
   * This is a placeholder for AI-powered image analysis
   */
  async importFromImage(image: File): Promise<WorkflowImportResult> {
    // Validate image file
    if (!image.type.startsWith('image/')) {
      throw new WorkflowServiceError('Invalid file type. Please upload an image.', 'VALIDATION_ERROR')
    }

    if (useHttpRequests) {
      const formData = new FormData()
      formData.append('image', image)

      const response = await fetch('/api/workflows/import', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new WorkflowServiceError('Failed to import workflow from image', 'NETWORK_ERROR')
      }
      return response.json()
    } else {
      await delay(SIMULATED_DELAY * 3) // Simulate longer processing time

      // Mock result - in production this would use AI to analyze the image
      // Generate different results based on file name to simulate variety
      const fileName = image.name.toLowerCase()
      
      let detectedAgents: string[]
      let detectedFlow: string[]
      let category: WorkflowCategory = 'hr'
      let workflowName = 'Imported Workflow'

      if (fileName.includes('deploy') || fileName.includes('cicd') || fileName.includes('pipeline')) {
        detectedAgents = ['DevOps Bot', 'Build Agent', 'Test Runner']
        detectedFlow = ['Code Push', 'Build', 'Test', 'Deploy', 'Notify']
        category = 'deployment'
        workflowName = 'Imported CI/CD Pipeline'
      } else if (fileName.includes('support') || fileName.includes('ticket')) {
        detectedAgents = ['Support Agent', 'Escalation Bot', 'Resolution Tracker']
        detectedFlow = ['Ticket Created', 'Triage', 'Assign', 'Resolve', 'Close']
        category = 'support'
        workflowName = 'Imported Support Flow'
      } else if (fileName.includes('marketing') || fileName.includes('campaign')) {
        detectedAgents = ['Marketing Assistant', 'Content Generator', 'Analytics Bot']
        detectedFlow = ['Brief', 'Create Content', 'Review', 'Publish', 'Analyze']
        category = 'marketing'
        workflowName = 'Imported Marketing Campaign'
      } else {
        // Default HR workflow
        detectedAgents = ['HR Assistant', 'Onboarding Bot', 'Document Processor']
        detectedFlow = ['Request', 'Process', 'Review', 'Approve', 'Complete']
        category = 'hr'
        workflowName = 'Imported HR Workflow'
      }

      // Generate nodes based on detected flow
      const nodes: WorkflowNode[] = detectedFlow.map((step, index) => {
        let type: NodeType = 'action'
        let icon = 'cog'
        
        if (index === 0) {
          type = 'trigger'
          icon = 'play'
        } else if (index === detectedFlow.length - 1) {
          type = 'end'
          icon = 'check'
        } else if (step.toLowerCase().includes('review') || step.toLowerCase().includes('approve')) {
          type = 'human'
          icon = 'user'
        } else if (index % 2 === 1 && detectedAgents[Math.floor(index / 2)]) {
          type = 'agent'
          icon = 'bot'
        }

        return {
          id: `imported-node-${index + 1}`,
          type,
          label: step,
          description: `${step} step in the workflow`,
          position: { x: 100 + index * 200, y: 100 },
          icon,
          agentId: type === 'agent' ? `agent-${index}` : undefined,
          actionType: type === 'action' ? step.toLowerCase().replace(/\s+/g, '-') : undefined,
        }
      })

      // Generate connections
      const connections: Connection[] = nodes.slice(0, -1).map((node, index) => ({
        id: `imported-conn-${index + 1}`,
        from: node.id,
        to: nodes[index + 1].id,
      }))

      const suggestedWorkflow: Workflow = {
        id: generateId(),
        name: workflowName,
        category,
        version: '1.0.0-draft',
        isOfficial: false,
        nodes,
        connections,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'import',
      }

      return {
        detectedAgents,
        detectedFlow,
        suggestedWorkflow,
      }
    }
  },

  /**
   * Applies natural language changes to a workflow using AI
   * This is a placeholder for AI-powered workflow modification
   */
  async applyNaturalLanguageChanges(workflowId: string, instruction: string): Promise<Workflow> {
    if (!instruction || instruction.trim() === '') {
      throw new WorkflowServiceError('Instruction cannot be empty', 'VALIDATION_ERROR')
    }

    if (useHttpRequests) {
      const response = await fetch(`/api/workflows/${workflowId}/apply-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction })
      })
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new WorkflowServiceError(`Workflow with id "${workflowId}" not found`, 'NOT_FOUND')
        }
        throw new WorkflowServiceError('Failed to apply changes', 'NETWORK_ERROR')
      }
      
      const result = await response.json()
      if (!result.success) {
        throw new WorkflowServiceError('Failed to apply changes', 'UNKNOWN')
      }
      
      // Return the updated workflow
      return this.getWorkflowById(workflowId)
    } else {
      await delay(SIMULATED_DELAY * 2) // Simulate AI processing time

      const workflow = workflowStore.find(w => w.id === workflowId)
      if (!workflow) {
        throw new WorkflowServiceError(`Workflow with id "${workflowId}" not found`, 'NOT_FOUND')
      }

      // Parse the instruction and apply mock changes
      const lowerInstruction = instruction.toLowerCase()
      let updatedNodes = [...workflow.nodes]
      let updatedConnections = [...workflow.connections]
      let changeApplied = false

      // Handle "add" instructions
      if (lowerInstruction.includes('add')) {
        const newNodeId = `node-${Date.now()}`
        let newNode: WorkflowNode

        if (lowerInstruction.includes('agent') || lowerInstruction.includes('bot')) {
          newNode = {
            id: newNodeId,
            type: 'agent',
            label: 'New Agent',
            description: 'Added via AI Copilot',
            position: { x: 400, y: 200 },
            icon: 'bot',
            agentId: 'new-agent',
          }
          changeApplied = true
        } else if (lowerInstruction.includes('approval') || lowerInstruction.includes('review') || lowerInstruction.includes('human')) {
          newNode = {
            id: newNodeId,
            type: 'human',
            label: 'Review Step',
            description: 'Added via AI Copilot',
            position: { x: 400, y: 200 },
            icon: 'user',
          }
          changeApplied = true
        } else if (lowerInstruction.includes('action') || lowerInstruction.includes('step')) {
          newNode = {
            id: newNodeId,
            type: 'action',
            label: 'New Action',
            description: 'Added via AI Copilot',
            position: { x: 400, y: 200 },
            icon: 'cog',
            actionType: 'custom',
          }
          changeApplied = true
        }

        if (changeApplied && newNode!) {
          // Find a good position for the new node
          const maxX = Math.max(...updatedNodes.map(n => n.position.x))
          const avgY = updatedNodes.reduce((sum, n) => sum + n.position.y, 0) / updatedNodes.length
          newNode.position = { x: maxX + 200, y: avgY }
          
          // Insert before the end node if one exists
          const endNodeIndex = updatedNodes.findIndex(n => n.type === 'end')
          if (endNodeIndex !== -1) {
            const endNode = updatedNodes[endNodeIndex]
            const prevNode = updatedNodes[endNodeIndex - 1]
            
            // Position between last node and end
            newNode.position = {
              x: (prevNode.position.x + endNode.position.x) / 2,
              y: (prevNode.position.y + endNode.position.y) / 2,
            }
            
            // Update connections
            const connectionToEnd = updatedConnections.find(c => c.to === endNode.id)
            if (connectionToEnd) {
              connectionToEnd.to = newNodeId
              updatedConnections.push({
                id: `conn-${Date.now()}`,
                from: newNodeId,
                to: endNode.id,
              })
            }
          }
          
          updatedNodes.push(newNode)
        }
      }

      // Handle "remove" or "delete" instructions
      if (lowerInstruction.includes('remove') || lowerInstruction.includes('delete')) {
        // Find node to remove based on instruction
        const nodeToRemove = updatedNodes.find(n => {
          const label = n.label.toLowerCase()
          return lowerInstruction.includes(label) || 
                 (lowerInstruction.includes('last') && n.type !== 'trigger' && n.type !== 'end')
        })

        if (nodeToRemove && nodeToRemove.type !== 'trigger' && nodeToRemove.type !== 'end') {
          // Find connections to/from this node
          const incomingConn = updatedConnections.find(c => c.to === nodeToRemove.id)
          const outgoingConn = updatedConnections.find(c => c.from === nodeToRemove.id)

          // Reconnect the flow
          if (incomingConn && outgoingConn) {
            incomingConn.to = outgoingConn.to
          }

          // Remove the node and its outgoing connection
          updatedNodes = updatedNodes.filter(n => n.id !== nodeToRemove.id)
          updatedConnections = updatedConnections.filter(c => c.from !== nodeToRemove.id && c.to !== nodeToRemove.id)
          if (incomingConn) {
            updatedConnections.push(incomingConn)
          }
          changeApplied = true
        }
      }

      // Handle "rename" instructions
      if (lowerInstruction.includes('rename')) {
        const toIndex = lowerInstruction.indexOf(' to ')
        if (toIndex !== -1) {
          const newName = instruction.slice(toIndex + 4).trim()
          // Find the first non-trigger, non-end node to rename
          const nodeToRename = updatedNodes.find(n => n.type !== 'trigger' && n.type !== 'end')
          if (nodeToRename && newName) {
            nodeToRename.label = newName
            changeApplied = true
          }
        }
      }

      // If no specific change was detected, just update the timestamp
      const updatedWorkflow: Workflow = {
        ...workflow,
        nodes: updatedNodes,
        connections: updatedConnections,
        updatedAt: new Date(),
      }

      const index = workflowStore.findIndex(w => w.id === workflowId)
      workflowStore[index] = updatedWorkflow

      return { ...updatedWorkflow }
    }
  },

  /**
   * Deletes a workflow by ID
   * @throws WorkflowServiceError if workflow not found
   */
  async deleteWorkflow(id: string): Promise<void> {
    if (useHttpRequests) {
      const response = await fetch(`/api/workflows/${id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new WorkflowServiceError(`Workflow with id "${id}" not found`, 'NOT_FOUND')
        }
        throw new WorkflowServiceError('Failed to delete workflow', 'NETWORK_ERROR')
      }
    } else {
      await delay(SIMULATED_DELAY)
      const index = workflowStore.findIndex(w => w.id === id)
      if (index === -1) {
        throw new WorkflowServiceError(`Workflow with id "${id}" not found`, 'NOT_FOUND')
      }
      workflowStore.splice(index, 1)
    }
  },

  /**
   * Resets the workflow store to initial mock data (useful for testing)
   */
  resetStore(): void {
    if (!useHttpRequests) {
      workflowStore = [...mockWorkflows]
    } else {
      // This is now handled by MSW in tests
      console.warn('resetStore() is deprecated when using HTTP requests')
    }
  },

  /**
   * Gets the initial mock workflows (useful for testing)
   */
  getMockWorkflows(): Workflow[] {
    return [...mockWorkflows]
  },
}

/**
 * Workflow Service Interface
 * Defines the contract that mock and REST implementations must follow
 */
export interface IWorkflowService {
  getWorkflows(): Promise<Workflow[]>
  getWorkflowById(id: string): Promise<Workflow>
  createWorkflow(data: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workflow>
  updateWorkflow(id: string, data: Partial<Omit<Workflow, 'id' | 'createdAt'>>): Promise<Workflow>
  getWorkflowsByCategory(category: WorkflowCategory): Promise<Workflow[]>
  getWorkflowVersions?(name: string, category: WorkflowCategory): Promise<Workflow[]>
  importFromImage?(image: File): Promise<WorkflowImportResult>
  applyNaturalLanguageChanges?(workflowId: string, instruction: string): Promise<Workflow>
  deleteWorkflow(id: string): Promise<void>
  resetStore?(): void
  getMockWorkflows?(): Workflow[]
}

/**
 * Unified Workflow Service
 * 
 * Automatically switches between mock and REST API implementations
 * based on environment variables:
 * 
 * - When VITE_API_MODE=rest: Uses RestWorkflowService (REST API backend)
 * - When VITE_USE_MOCK=true: Uses MockWorkflowService
 */
function selectWorkflowService(): IWorkflowService {
  if (shouldUseRestApi()) {
    return RestWorkflowService as unknown as IWorkflowService
  }
  const config = getServiceConfig()
  return config.useMock ? MockWorkflowService : (RestWorkflowService as unknown as IWorkflowService)
}

export const WorkflowService = selectWorkflowService()
export default WorkflowService

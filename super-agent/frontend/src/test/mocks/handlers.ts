import { http, HttpResponse } from 'msw'
import type { Agent, Task, Workflow, Capability, MCPServer, KnowledgeDocument } from '@/types'

// Mock data
const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'HR Assistant',
    displayName: 'HR Assistant',
    role: 'Human Resources Specialist',
    department: 'hr',
    avatar: '/avatars/hr-assistant.png',
    status: 'active',
    metrics: {
      taskCount: 45,
      responseRate: 98.5,
      avgResponseTime: 1200,
      accuracy: 96.2
    },
    tools: ['email', 'calendar', 'hr-system'],
    scope: ['Employee onboarding', 'Leave management', 'Policy queries'],
    systemPrompt: 'You are an HR assistant specialized in employee relations.',
    modelConfig: {
      provider: 'Bedrock',
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      agentType: 'Worker'
    }
  },
  {
    id: 'agent-2',
    name: 'IT Support',
    displayName: 'IT Support Agent',
    role: 'Technical Support Specialist',
    department: 'it',
    avatar: '/avatars/it-support.png',
    status: 'busy',
    metrics: {
      taskCount: 32,
      responseRate: 94.1,
      avgResponseTime: 1800,
      accuracy: 92.8
    },
    tools: ['ticketing', 'remote-access', 'monitoring'],
    scope: ['Hardware troubleshooting', 'Software installation', 'Network issues'],
    systemPrompt: 'You are an IT support specialist focused on technical problem solving.',
    modelConfig: {
      provider: 'OpenAI',
      modelId: 'gpt-4',
      agentType: 'Worker'
    }
  }
]

const mockTasks: Task[] = [
  {
    id: 'task-1',
    agent: {
      id: 'agent-1',
      name: 'HR Assistant',
      role: 'Human Resources Specialist',
      avatar: '/avatars/hr-assistant.png'
    },
    description: 'Process new employee onboarding',
    workflow: 'Employee Onboarding',
    status: 'complete',
    timestamp: new Date('2024-01-08T10:30:00Z')
  },
  {
    id: 'task-2',
    agent: {
      id: 'agent-2',
      name: 'IT Support',
      role: 'Technical Support Specialist',
      avatar: '/avatars/it-support.png'
    },
    description: 'Resolve network connectivity issue',
    workflow: 'IT Support Ticket',
    status: 'running',
    timestamp: new Date('2024-01-08T11:15:00Z')
  }
]

const mockWorkflows: Workflow[] = [
  {
    id: 'workflow-1',
    name: 'Employee Onboarding',
    category: 'hr',
    version: '1.0.0',
    isOfficial: true,
    nodes: [
      { 
        id: 'node-1', 
        type: 'trigger', 
        label: 'New Employee', 
        description: 'Triggered when new employee joins', 
        position: { x: 100, y: 100 }, 
        icon: 'user-plus' 
      },
      { 
        id: 'node-2', 
        type: 'agent', 
        label: 'HR Assistant', 
        description: 'Process onboarding documents', 
        position: { x: 300, y: 100 }, 
        icon: 'user',
        agentId: 'agent-1'
      },
      { 
        id: 'node-3', 
        type: 'human', 
        label: 'Manager Approval', 
        description: 'Manager reviews and approves hire', 
        position: { x: 500, y: 100 }, 
        icon: 'user' 
      },
      { 
        id: 'node-4', 
        type: 'end', 
        label: 'Complete', 
        description: 'Onboarding process complete', 
        position: { x: 700, y: 100 }, 
        icon: 'check' 
      }
    ],
    connections: [
      { id: 'conn-1', from: 'node-1', to: 'node-2' },
      { id: 'conn-2', from: 'node-2', to: 'node-3' },
      { id: 'conn-3', from: 'node-3', to: 'node-4' }
    ],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    createdBy: 'system'
  }
]

const mockCapabilities: Capability[] = [
  {
    id: 'cap-1',
    category: 'Communication',
    name: 'Email Integration',
    description: 'Send and receive emails through corporate email system',
    toolIdentifier: 'email-tool',
    icon: 'mail',
    color: 'blue'
  },
  {
    id: 'cap-2',
    category: 'Knowledge & Data',
    name: 'Document Search',
    description: 'Search through company knowledge base and documents',
    toolIdentifier: 'search-tool',
    icon: 'search',
    color: 'green'
  }
]

export const handlers = [
  // Agent endpoints
  http.get('/api/agents', () => {
    return HttpResponse.json(mockAgents)
  }),

  http.get('/api/agents/:id', ({ params }) => {
    const agent = mockAgents.find(a => a.id === params.id)
    if (!agent) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(agent)
  }),

  http.put('/api/agents/:id', async ({ params, request }) => {
    const updates = await request.json() as Partial<Agent>
    const agentIndex = mockAgents.findIndex(a => a.id === params.id)
    if (agentIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    
    mockAgents[agentIndex] = { ...mockAgents[agentIndex], ...updates }
    return HttpResponse.json(mockAgents[agentIndex])
  }),

  // Task endpoints
  http.get('/api/tasks', () => {
    return HttpResponse.json(mockTasks)
  }),

  // Workflow endpoints
  http.get('/api/workflows', () => {
    return HttpResponse.json(mockWorkflows)
  }),

  http.get('/api/workflows/:id', ({ params }) => {
    const workflow = mockWorkflows.find(w => w.id === params.id)
    if (!workflow) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(workflow)
  }),

  http.put('/api/workflows/:id', async ({ params, request }) => {
    const updates = await request.json() as Partial<Workflow>
    const workflowIndex = mockWorkflows.findIndex(w => w.id === params.id)
    if (workflowIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    
    mockWorkflows[workflowIndex] = { ...mockWorkflows[workflowIndex], ...updates }
    return HttpResponse.json(mockWorkflows[workflowIndex])
  }),

  http.post('/api/workflows/:id/apply-changes', async ({ params, request }) => {
    const { instruction } = await request.json() as { instruction: string }
    const workflow = mockWorkflows.find(w => w.id === params.id)
    if (!workflow) {
      return new HttpResponse(null, { status: 404 })
    }
    
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return HttpResponse.json({
      success: true,
      message: `Applied changes: ${instruction}`
    })
  }),

  http.post('/api/workflows', async ({ request }) => {
    const workflowData = await request.json() as Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>
    
    const newWorkflow: Workflow = {
      ...workflowData,
      id: `workflow-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    mockWorkflows.push(newWorkflow)
    return HttpResponse.json(newWorkflow)
  }),

  http.delete('/api/workflows/:id', ({ params }) => {
    const index = mockWorkflows.findIndex(w => w.id === params.id)
    if (index === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    
    mockWorkflows.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/workflows/import', async ({ request }) => {
    // Simulate image processing
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return HttpResponse.json({
      detectedAgents: ['HR Assistant', 'IT Support'],
      detectedSteps: ['New Employee', 'Process Documents', 'Setup Accounts'],
      suggestedWorkflow: {
        name: 'Imported Workflow',
        category: 'hr',
        version: '1.0.0',
        nodes: [
          {
            id: 'imported-1',
            type: 'trigger',
            label: 'Start Process',
            description: 'Imported trigger node',
            position: { x: 100, y: 100 },
            icon: 'play'
          }
        ],
        connections: []
      }
    })
  }),

  // Capability endpoints
  http.get('/api/capabilities', () => {
    return HttpResponse.json(mockCapabilities)
  }),

  // Chat endpoints
  http.post('/api/chat/message', async ({ request }) => {
    const { message, sessionId, sopContext } = await request.json() as {
      message: string
      sessionId: string
      sopContext: string
    }
    
    // Simulate AI response
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return HttpResponse.json({
      id: `msg-${Date.now()}`,
      type: 'ai',
      content: `This is a mock AI response to: "${message}" in context: ${sopContext}`,
      timestamp: new Date()
    })
  }),

  http.get('/api/chat/history/:sessionId', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/chat/context/:sessionId', () => {
    return HttpResponse.json({
      memories: [],
      useCases: [],
      relatedLinks: []
    })
  }),

  http.get('/api/chat/quick-questions/:sopId', () => {
    return HttpResponse.json([
      {
        id: 'q1',
        icon: 'user',
        category: 'HR',
        text: 'How do I request time off?'
      },
      {
        id: 'q2',
        icon: 'settings',
        category: 'IT',
        text: 'How do I reset my password?'
      }
    ])
  })
]
import type { Capability } from '@/types'

// Mock data for capabilities
const mockCapabilities: Capability[] = [
  // Video Intelligence
  {
    id: 'cap-1',
    category: 'Video Intelligence',
    name: 'Video Analysis',
    description: 'Analyze video content for objects, scenes, and activities',
    toolIdentifier: 'video.analysis.v1',
    icon: '🎬',
    color: '#FF6B6B',
  },
  {
    id: 'cap-2',
    category: 'Video Intelligence',
    name: 'Face Recognition',
    description: 'Detect and identify faces in video streams',
    toolIdentifier: 'video.face.recognition.v1',
    icon: '👤',
    color: '#FF6B6B',
  },
  {
    id: 'cap-3',
    category: 'Video Intelligence',
    name: 'Scene Detection',
    description: 'Identify scenes and transitions in video content',
    toolIdentifier: 'video.scene.detection.v1',
    icon: '🎞️',
    color: '#FF6B6B',
  },

  // Knowledge & Data
  {
    id: 'cap-4',
    category: 'Knowledge & Data',
    name: 'Document Retrieval',
    description: 'Retrieve relevant documents from knowledge base',
    toolIdentifier: 'knowledge.retrieval.v1',
    icon: '📚',
    color: '#4ECDC4',
  },
  {
    id: 'cap-5',
    category: 'Knowledge & Data',
    name: 'Data Query',
    description: 'Query structured data and databases',
    toolIdentifier: 'data.query.v1',
    icon: '🔍',
    color: '#4ECDC4',
  },
  {
    id: 'cap-6',
    category: 'Knowledge & Data',
    name: 'RAG Pipeline',
    description: 'Retrieval-Augmented Generation for context-aware responses',
    toolIdentifier: 'rag.pipeline.v1',
    icon: '🧠',
    color: '#4ECDC4',
  },
  {
    id: 'cap-7',
    category: 'Knowledge & Data',
    name: 'Vector Search',
    description: 'Semantic search using vector embeddings',
    toolIdentifier: 'vector.search.v1',
    icon: '📊',
    color: '#4ECDC4',
  },

  // Communication
  {
    id: 'cap-8',
    category: 'Communication',
    name: 'Email Sending',
    description: 'Send emails with templates and attachments',
    toolIdentifier: 'email.send.v1',
    icon: '📧',
    color: '#95E1D3',
  },
  {
    id: 'cap-9',
    category: 'Communication',
    name: 'Slack Integration',
    description: 'Send messages and notifications to Slack channels',
    toolIdentifier: 'slack.integration.v1',
    icon: '💬',
    color: '#95E1D3',
  },
  {
    id: 'cap-10',
    category: 'Communication',
    name: 'SMS Notifications',
    description: 'Send SMS messages to phone numbers',
    toolIdentifier: 'sms.notification.v1',
    icon: '📱',
    color: '#95E1D3',
  },
  {
    id: 'cap-11',
    category: 'Communication',
    name: 'Webhook Triggers',
    description: 'Trigger webhooks and external APIs',
    toolIdentifier: 'webhook.trigger.v1',
    icon: '🔗',
    color: '#95E1D3',
  },

  // Infrastructure
  {
    id: 'cap-12',
    category: 'Infrastructure',
    name: 'Cloud Deployment',
    description: 'Deploy applications to cloud platforms',
    toolIdentifier: 'cloud.deploy.v1',
    icon: '☁️',
    color: '#FFD93D',
  },
  {
    id: 'cap-13',
    category: 'Infrastructure',
    name: 'Database Management',
    description: 'Manage database operations and queries',
    toolIdentifier: 'db.management.v1',
    icon: '🗄️',
    color: '#FFD93D',
  },
  {
    id: 'cap-14',
    category: 'Infrastructure',
    name: 'Container Orchestration',
    description: 'Manage containerized applications',
    toolIdentifier: 'container.orchestration.v1',
    icon: '📦',
    color: '#FFD93D',
  },
  {
    id: 'cap-15',
    category: 'Infrastructure',
    name: 'Monitoring & Logging',
    description: 'Monitor system health and collect logs',
    toolIdentifier: 'monitoring.logging.v1',
    icon: '📈',
    color: '#FFD93D',
  },
]

export interface CapabilityService {
  getCapabilities(): Promise<Capability[]>
  searchCapabilities(query: string): Promise<Capability[]>
}

export const capabilityService: CapabilityService = {
  async getCapabilities(): Promise<Capability[]> {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockCapabilities)
      }, 100)
    })
  },

  async searchCapabilities(query: string): Promise<Capability[]> {
    // Simulate API call with search
    return new Promise((resolve) => {
      setTimeout(() => {
        const lowerQuery = query.toLowerCase()
        const results = mockCapabilities.filter(
          (cap) =>
            cap.name.toLowerCase().includes(lowerQuery) ||
            cap.description.toLowerCase().includes(lowerQuery) ||
            cap.toolIdentifier.toLowerCase().includes(lowerQuery)
        )
        resolve(results)
      }, 100)
    })
  },
}

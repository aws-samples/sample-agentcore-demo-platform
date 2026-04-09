import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskTable } from './TaskTable'
import type { Task } from '@/types'

// Mock the translation hook
vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

const mockTasks: Task[] = [
  {
    id: 'task-1',
    agent: { id: 'agent-1', name: 'HR Assistant', role: 'Recruitment', avatar: 'H' },
    description: 'Resume screening',
    workflow: 'Hiring Process',
    status: 'complete',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'task-2',
    agent: { id: 'agent-2', name: 'IT Support', role: 'Support', avatar: 'I' },
    description: 'Password reset',
    workflow: 'User Management',
    status: 'running',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: 'task-3',
    agent: { id: 'agent-3', name: 'DevOps Bot', role: 'Deployment', avatar: 'D' },
    description: 'Deploy to production',
    workflow: 'CI/CD Pipeline',
    status: 'failed',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
]

describe('TaskTable', () => {
  it('should render table with headers', () => {
    render(<TaskTable tasks={mockTasks} />)
    
    expect(screen.getByText('tasks.agent')).toBeInTheDocument()
    expect(screen.getByText('tasks.description')).toBeInTheDocument()
    expect(screen.getByText('tasks.workflow')).toBeInTheDocument()
    expect(screen.getByText('tasks.status')).toBeInTheDocument()
    expect(screen.getByText('tasks.time')).toBeInTheDocument()
    expect(screen.getByText('tasks.action')).toBeInTheDocument()
  })

  it('should render all tasks', () => {
    render(<TaskTable tasks={mockTasks} />)
    
    mockTasks.forEach(task => {
      expect(screen.getByText(task.description)).toBeInTheDocument()
      expect(screen.getByText(task.workflow)).toBeInTheDocument()
    })
  })

  it('should display agent information correctly', () => {
    render(<TaskTable tasks={mockTasks} />)
    
    // Check for specific agent names (should be unique)
    expect(screen.getByText('HR Assistant')).toBeInTheDocument()
    expect(screen.getByText('IT Support')).toBeInTheDocument()
    expect(screen.getByText('DevOps Bot')).toBeInTheDocument()
    
    // Check for specific roles (should be unique)
    expect(screen.getByText('Recruitment')).toBeInTheDocument()
    expect(screen.getByText('Support')).toBeInTheDocument()
    expect(screen.getByText('Deployment')).toBeInTheDocument()
  })

  it('should display correct status badges', () => {
    render(<TaskTable tasks={mockTasks} />)
    
    expect(screen.getByText('tasks.status.complete')).toBeInTheDocument()
    expect(screen.getByText('tasks.status.running')).toBeInTheDocument()
    expect(screen.getByText('tasks.status.failed')).toBeInTheDocument()
  })

  it('should call onViewDetails when action button is clicked', async () => {
    const user = userEvent.setup()
    const onViewDetails = vi.fn()
    
    render(<TaskTable tasks={mockTasks} onViewDetails={onViewDetails} />)
    
    const viewButtons = screen.getAllByText('tasks.viewDetails')
    await user.click(viewButtons[0])
    
    expect(onViewDetails).toHaveBeenCalledWith('task-1')
  })

  it('should render empty state when no tasks', () => {
    render(<TaskTable tasks={[]} />)
    
    expect(screen.getByText('No tasks found')).toBeInTheDocument()
  })

  it('should display time in relative format', () => {
    render(<TaskTable tasks={mockTasks} />)
    
    // Check that time is displayed (exact format depends on current time)
    // There should be multiple time elements since we have multiple tasks
    const timeElements = screen.getAllByText(/ago|Just now/)
    expect(timeElements.length).toBeGreaterThan(0)
  })

  it('should have correct status styling', () => {
    const { container } = render(<TaskTable tasks={mockTasks} />)
    
    // Check for status badge styling
    const statusBadges = container.querySelectorAll('[class*="bg-"]')
    expect(statusBadges.length).toBeGreaterThan(0)
  })

  it('should render view details button for each task', () => {
    render(<TaskTable tasks={mockTasks} />)
    
    const viewButtons = screen.getAllByText('tasks.viewDetails')
    expect(viewButtons).toHaveLength(mockTasks.length)
  })

  it('should handle tasks with special characters in description', () => {
    const specialTasks: Task[] = [
      {
        ...mockTasks[0],
        description: 'Task with "quotes" and <special> characters',
      },
    ]
    
    render(<TaskTable tasks={specialTasks} />)
    
    expect(screen.getByText(/Task with/)).toBeInTheDocument()
  })
})

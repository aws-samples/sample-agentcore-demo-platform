// Simple test to check if WorkflowService is working
import { WorkflowService } from './src/services/workflowService.ts'

console.log('Testing WorkflowService...')

try {
  const workflows = await WorkflowService.getWorkflows()
  console.log('✅ WorkflowService.getWorkflows() succeeded')
  console.log('Number of workflows:', workflows.length)
  console.log('First workflow:', workflows[0]?.name)
} catch (error) {
  console.error('❌ WorkflowService.getWorkflows() failed:', error.message)
}
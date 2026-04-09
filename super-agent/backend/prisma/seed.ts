/**
 * Database Seed Script
 * 
 * Populates the database with test data for development.
 * Run with: npx tsx prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create pg Pool
const pool = new pg.Pool({ connectionString });

// Create Prisma adapter and client
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...');

  // Get existing organization or create one
  let org = await prisma.organizations.findFirst();
  
  if (!org) {
    console.log('Creating organization...');
    org = await prisma.organizations.create({
      data: {
        name: 'Demo Company',
        slug: 'demo-company',
        plan_type: 'enterprise',
      },
    });
  }
  
  const orgId = org.id;
  console.log(`Using organization: ${org.name} (${orgId})`);

  // Get or create a test user
  let profile = await prisma.profiles.findFirst();
  
  if (!profile) {
    console.log('Creating test user...');
    profile = await prisma.profiles.create({
      data: {
        id: crypto.randomUUID(),
        username: 'admin@example.com',
        full_name: 'Admin User',
        active_organization_id: orgId,
      },
    });

    await prisma.memberships.create({
      data: {
        user_id: profile.id,
        organization_id: orgId,
        role: 'owner',
      },
    });
  }
  
  const userId = profile.id;
  console.log(`Using user: ${profile.full_name} (${userId})`);

  // Create Business Scopes
  console.log('Creating business scopes...');
  const scopes = await Promise.all([
    prisma.business_scopes.upsert({
      where: { unique_scope_name_per_org: { organization_id: orgId, name: 'Human Resources' } },
      update: {},
      create: {
        organization_id: orgId,
        name: 'Human Resources',
        description: 'HR department operations and employee management',
        icon: '👥',
        color: '#4CAF50',
        is_default: true,
      },
    }),
    prisma.business_scopes.upsert({
      where: { unique_scope_name_per_org: { organization_id: orgId, name: 'Information Technology' } },
      update: {},
      create: {
        organization_id: orgId,
        name: 'Information Technology',
        description: 'IT support and infrastructure management',
        icon: '💻',
        color: '#2196F3',
        is_default: true,
      },
    }),
    prisma.business_scopes.upsert({
      where: { unique_scope_name_per_org: { organization_id: orgId, name: 'Marketing' } },
      update: {},
      create: {
        organization_id: orgId,
        name: 'Marketing',
        description: 'Marketing campaigns and brand management',
        icon: '📢',
        color: '#FF9800',
        is_default: true,
      },
    }),
    prisma.business_scopes.upsert({
      where: { unique_scope_name_per_org: { organization_id: orgId, name: 'Sales' } },
      update: {},
      create: {
        organization_id: orgId,
        name: 'Sales',
        description: 'Sales operations and customer acquisition',
        icon: '💰',
        color: '#9C27B0',
        is_default: true,
      },
    }),
    prisma.business_scopes.upsert({
      where: { unique_scope_name_per_org: { organization_id: orgId, name: 'Customer Support' } },
      update: {},
      create: {
        organization_id: orgId,
        name: 'Customer Support',
        description: 'Customer service and support operations',
        icon: '🎧',
        color: '#E91E63',
        is_default: true,
      },
    }),
  ]);

  const [hrScope, itScope, marketingScope, salesScope, supportScope] = scopes;
  console.log(`Created ${scopes.length} business scopes`);

  // Create Agents
  console.log('Creating agents...');
  const agents = await Promise.all([
    prisma.agents.create({
      data: {
        organization_id: orgId,
        business_scope_id: hrScope.id,
        name: 'hr-assistant',
        display_name: 'HR Assistant',
        role: 'Recruitment Specialist',
        avatar: 'H',
        status: 'active',
        metrics: { taskCount: 156, responseRate: 98, avgResponseTime: '1.2s' },
        tools: [
          { id: 'tool-1', name: 'Resume Parser', description: 'Extracts information from resumes' },
          { id: 'tool-2', name: 'Calendar Integration', description: 'Schedules interviews' },
        ],
        scope: ['Recruitment', 'Onboarding', 'Employee Records'],
        system_prompt: 'You are an HR assistant specialized in recruitment and onboarding processes.',
        model_config: { provider: 'Bedrock', modelId: 'claude-3-sonnet', agentType: 'Worker' },
      },
    }),
    prisma.agents.create({
      data: {
        organization_id: orgId,
        business_scope_id: hrScope.id,
        name: 'onboarding-bot',
        display_name: 'Onboarding Bot',
        role: 'Employee Onboarding',
        avatar: 'O',
        status: 'busy',
        metrics: { taskCount: 89, responseRate: 95, avgResponseTime: '2.1s' },
        tools: [
          { id: 'tool-3', name: 'Document Generator', description: 'Creates onboarding documents' },
        ],
        scope: ['Onboarding', 'Training', 'Policy Distribution'],
        system_prompt: 'You are an onboarding specialist helping new employees get started.',
        model_config: { provider: 'OpenAI', modelId: 'gpt-4', agentType: 'Worker' },
      },
    }),
    prisma.agents.create({
      data: {
        organization_id: orgId,
        business_scope_id: itScope.id,
        name: 'it-support',
        display_name: 'IT Support Agent',
        role: 'Technical Support',
        avatar: 'I',
        status: 'active',
        metrics: { taskCount: 234, responseRate: 99, avgResponseTime: '0.8s' },
        tools: [
          { id: 'tool-4', name: 'Ticket System', description: 'Manages support tickets' },
          { id: 'tool-5', name: 'Remote Access', description: 'Provides remote assistance' },
        ],
        scope: ['Troubleshooting', 'System Access', 'Password Reset'],
        system_prompt: 'You are an IT support agent helping users with technical issues.',
        model_config: { provider: 'Bedrock', modelId: 'claude-3-sonnet', agentType: 'Worker' },
      },
    }),
    prisma.agents.create({
      data: {
        organization_id: orgId,
        business_scope_id: itScope.id,
        name: 'devops-bot',
        display_name: 'DevOps Bot',
        role: 'Deployment Automation',
        avatar: 'D',
        status: 'idle',
        metrics: { taskCount: 78, responseRate: 100, avgResponseTime: '1.5s' },
        tools: [
          { id: 'tool-6', name: 'CI/CD Pipeline', description: 'Manages deployment pipelines' },
          { id: 'tool-7', name: 'Infrastructure Manager', description: 'Provisions cloud resources' },
        ],
        scope: ['CI/CD', 'Infrastructure', 'Monitoring'],
        system_prompt: 'You are a DevOps automation bot managing deployments and infrastructure.',
        model_config: { provider: 'Azure', modelId: 'gpt-4', agentType: 'Orchestrator' },
      },
    }),
    prisma.agents.create({
      data: {
        organization_id: orgId,
        business_scope_id: marketingScope.id,
        name: 'marketing-assistant',
        display_name: 'Marketing Assistant',
        role: 'Content Creator',
        avatar: 'M',
        status: 'active',
        metrics: { taskCount: 112, responseRate: 96, avgResponseTime: '2.3s' },
        tools: [
          { id: 'tool-8', name: 'Content Generator', description: 'Creates marketing content' },
          { id: 'tool-9', name: 'Social Media Manager', description: 'Schedules social posts' },
        ],
        scope: ['Content', 'Social Media', 'Campaign Management'],
        system_prompt: 'You are a marketing assistant helping create and manage content.',
        model_config: { provider: 'OpenAI', modelId: 'gpt-4', agentType: 'Worker' },
      },
    }),
    prisma.agents.create({
      data: {
        organization_id: orgId,
        business_scope_id: salesScope.id,
        name: 'sales-bot',
        display_name: 'Sales Bot',
        role: 'Lead Qualification',
        avatar: 'S',
        status: 'offline',
        metrics: { taskCount: 45, responseRate: 92, avgResponseTime: '1.8s' },
        tools: [
          { id: 'tool-10', name: 'CRM Integration', description: 'Manages customer data' },
          { id: 'tool-11', name: 'Lead Scorer', description: 'Qualifies leads automatically' },
        ],
        scope: ['Lead Gen', 'CRM', 'Sales Pipeline'],
        system_prompt: 'You are a sales bot helping qualify leads and manage the sales pipeline.',
        model_config: { provider: 'Bedrock', modelId: 'claude-3-sonnet', agentType: 'Worker' },
      },
    }),
    prisma.agents.create({
      data: {
        organization_id: orgId,
        business_scope_id: supportScope.id,
        name: 'support-agent',
        display_name: 'Support Agent',
        role: 'Customer Support',
        avatar: 'C',
        status: 'active',
        metrics: { taskCount: 567, responseRate: 97, avgResponseTime: '0.9s' },
        tools: [
          { id: 'tool-12', name: 'Knowledge Base', description: 'Searches support articles' },
          { id: 'tool-13', name: 'Ticket Manager', description: 'Handles support tickets' },
        ],
        scope: ['Tickets', 'FAQ', 'Customer Communication'],
        system_prompt: 'You are a customer support agent helping resolve customer issues.',
        model_config: { provider: 'Bedrock', modelId: 'claude-3-sonnet', agentType: 'Worker' },
      },
    }),
  ]);
  console.log(`Created ${agents.length} agents`);

  // Create Workflows
  console.log('Creating workflows...');
  const workflows = await Promise.all([
    prisma.workflows.create({
      data: {
        organization_id: orgId,
        business_scope_id: hrScope.id,
        name: 'Employee Onboarding',
        version: '1.0.0',
        is_official: true,
        nodes: [
          { id: 'node-1', type: 'trigger', label: 'New Hire Request', position: { x: 100, y: 100 } },
          { id: 'node-2', type: 'agent', label: 'HR Assistant', position: { x: 300, y: 100 }, agentId: agents[0].id },
          { id: 'node-3', type: 'human', label: 'Manager Approval', position: { x: 500, y: 100 } },
          { id: 'node-4', type: 'agent', label: 'Onboarding Bot', position: { x: 700, y: 100 }, agentId: agents[1].id },
          { id: 'node-5', type: 'end', label: 'Complete', position: { x: 900, y: 100 } },
        ],
        connections: [
          { id: 'conn-1', from: 'node-1', to: 'node-2' },
          { id: 'conn-2', from: 'node-2', to: 'node-3' },
          { id: 'conn-3', from: 'node-3', to: 'node-4' },
          { id: 'conn-4', from: 'node-4', to: 'node-5' },
        ],
        created_by: userId,
      },
    }),
    prisma.workflows.create({
      data: {
        organization_id: orgId,
        business_scope_id: itScope.id,
        name: 'CI/CD Pipeline',
        version: '2.0.0',
        is_official: true,
        nodes: [
          { id: 'node-1', type: 'trigger', label: 'Code Push', position: { x: 100, y: 100 } },
          { id: 'node-2', type: 'action', label: 'Build', position: { x: 300, y: 100 } },
          { id: 'node-3', type: 'action', label: 'Test', position: { x: 500, y: 100 } },
          { id: 'node-4', type: 'agent', label: 'DevOps Bot', position: { x: 700, y: 100 }, agentId: agents[3].id },
          { id: 'node-5', type: 'human', label: 'Release Approval', position: { x: 900, y: 100 } },
          { id: 'node-6', type: 'action', label: 'Deploy', position: { x: 1100, y: 100 } },
          { id: 'node-7', type: 'end', label: 'Complete', position: { x: 1300, y: 100 } },
        ],
        connections: [
          { id: 'conn-1', from: 'node-1', to: 'node-2' },
          { id: 'conn-2', from: 'node-2', to: 'node-3' },
          { id: 'conn-3', from: 'node-3', to: 'node-4' },
          { id: 'conn-4', from: 'node-4', to: 'node-5' },
          { id: 'conn-5', from: 'node-5', to: 'node-6' },
          { id: 'conn-6', from: 'node-6', to: 'node-7' },
        ],
        created_by: userId,
      },
    }),
    prisma.workflows.create({
      data: {
        organization_id: orgId,
        business_scope_id: supportScope.id,
        name: 'Customer Support Escalation',
        version: '1.2.0',
        is_official: true,
        nodes: [
          { id: 'node-1', type: 'trigger', label: 'Support Ticket', position: { x: 100, y: 100 } },
          { id: 'node-2', type: 'agent', label: 'Support Agent', position: { x: 300, y: 100 }, agentId: agents[6].id },
          { id: 'node-3', type: 'action', label: 'Classify Priority', position: { x: 500, y: 100 } },
          { id: 'node-4', type: 'human', label: 'Specialist Review', position: { x: 700, y: 50 } },
          { id: 'node-5', type: 'agent', label: 'Auto Response', position: { x: 700, y: 150 }, agentId: agents[6].id },
          { id: 'node-6', type: 'end', label: 'Resolved', position: { x: 900, y: 100 } },
        ],
        connections: [
          { id: 'conn-1', from: 'node-1', to: 'node-2' },
          { id: 'conn-2', from: 'node-2', to: 'node-3' },
          { id: 'conn-3', from: 'node-3', to: 'node-4' },
          { id: 'conn-4', from: 'node-3', to: 'node-5' },
          { id: 'conn-5', from: 'node-4', to: 'node-6' },
          { id: 'conn-6', from: 'node-5', to: 'node-6' },
        ],
        created_by: userId,
      },
    }),
  ]);
  console.log(`Created ${workflows.length} workflows`);

  // Create Tasks
  console.log('Creating tasks...');
  const tasks = await Promise.all([
    prisma.tasks.create({
      data: {
        organization_id: orgId,
        agent_id: agents[0].id,
        workflow_id: workflows[0].id,
        description: 'Resume screening for senior developer position',
        status: 'complete',
        details: { candidateCount: 15, shortlisted: 5 },
        created_by: userId,
      },
    }),
    prisma.tasks.create({
      data: {
        organization_id: orgId,
        agent_id: agents[2].id,
        description: 'Password reset for user john.doe@company.com',
        status: 'complete',
        details: { ticketId: 'IT-2024-001' },
        created_by: userId,
      },
    }),
    prisma.tasks.create({
      data: {
        organization_id: orgId,
        agent_id: agents[4].id,
        description: 'Generate social media content for Q1 campaign',
        status: 'running',
        details: { platform: 'LinkedIn', posts: 5 },
        created_by: userId,
      },
    }),
    prisma.tasks.create({
      data: {
        organization_id: orgId,
        agent_id: agents[3].id,
        workflow_id: workflows[1].id,
        description: 'Deploy application to production',
        status: 'failed',
        details: { error: 'Build failed: missing dependency', attempt: 2 },
        created_by: userId,
      },
    }),
    prisma.tasks.create({
      data: {
        organization_id: orgId,
        agent_id: agents[6].id,
        workflow_id: workflows[2].id,
        description: 'Handle customer complaint about billing',
        status: 'running',
        details: { ticketId: 'SUP-2024-042', priority: 'high' },
        created_by: userId,
      },
    }),
  ]);
  console.log(`Created ${tasks.length} tasks`);

  // Create MCP Servers
  console.log('Creating MCP servers...');
  const mcpServers = await Promise.all([
    prisma.mcp_servers.create({
      data: {
        organization_id: orgId,
        name: 'GitHub Integration',
        description: 'Connect to GitHub repositories and manage code',
        host_address: 'https://api.github.com',
        headers: { 'X-Custom-Header': 'github-integration' },
        status: 'active',
      },
    }),
    prisma.mcp_servers.create({
      data: {
        organization_id: orgId,
        name: 'Slack Integration',
        description: 'Send messages and manage Slack channels',
        host_address: 'https://slack.com/api',
        headers: {},
        status: 'active',
      },
    }),
  ]);
  console.log(`Created ${mcpServers.length} MCP servers`);

  // Create Documents
  console.log('Creating documents...');
  const documents = await Promise.all([
    prisma.documents.create({
      data: {
        organization_id: orgId,
        title: 'Company Policies',
        category: 'HR',
        file_name: 'company-policies.pdf',
        file_type: 'PDF',
        file_path: '/documents/company-policies.pdf',
        status: 'indexed',
      },
    }),
    prisma.documents.create({
      data: {
        organization_id: orgId,
        title: 'API Documentation',
        category: 'Technical',
        file_name: 'api-docs.md',
        file_type: 'MD',
        file_path: '/documents/api-docs.md',
        status: 'indexed',
      },
    }),
    prisma.documents.create({
      data: {
        organization_id: orgId,
        title: 'Product Roadmap',
        category: 'Product',
        file_name: 'roadmap.docx',
        file_type: 'DOCX',
        file_path: '/documents/roadmap.docx',
        status: 'processing',
      },
    }),
  ]);
  console.log(`Created ${documents.length} documents`);

  console.log('\n✅ Database seeded successfully!');
  console.log('\n📋 Summary:');
  console.log(`   Organization: ${org.name}`);
  console.log(`   User: ${profile.username} (login with this email)`);
  console.log(`   Business Scopes: ${scopes.length}`);
  console.log(`   Agents: ${agents.length}`);
  console.log(`   Workflows: ${workflows.length}`);
  console.log(`   Tasks: ${tasks.length}`);
  console.log(`   MCP Servers: ${mcpServers.length}`);
  console.log(`   Documents: ${documents.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

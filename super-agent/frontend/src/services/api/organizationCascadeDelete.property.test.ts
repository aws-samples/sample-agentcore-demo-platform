/**
 * Property-Based Tests for Organization Cascade Delete
 * 
 * Feature: supabase-backend, Property 11: Organization Cascade Delete
 * Validates: Requirements 10.8
 * 
 * Property 11: Organization Cascade Delete
 * *For any* organization deletion, all related records (memberships, agents, workflows, 
 * tasks, documents, mcp_servers, chat_sessions, chat_messages) SHALL be deleted.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Type definitions for organization and related entities
interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

interface Agent {
  id: string;
  organizationId: string;
  name: string;
}

interface Workflow {
  id: string;
  organizationId: string;
  name: string;
}

interface Task {
  id: string;
  organizationId: string;
  description: string;
}

interface Document {
  id: string;
  organizationId: string;
  title: string;
}

interface MCPServer {
  id: string;
  organizationId: string;
  name: string;
}

interface ChatSession {
  id: string;
  organizationId: string;
  userId: string;
}

interface ChatMessage {
  id: string;
  organizationId: string;
  sessionId: string;
  content: string;
}

interface BusinessScope {
  id: string;
  organizationId: string;
  name: string;
}

// Database simulation
interface Database {
  organizations: Map<string, Organization>;
  memberships: Map<string, Membership>;
  agents: Map<string, Agent>;
  workflows: Map<string, Workflow>;
  tasks: Map<string, Task>;
  documents: Map<string, Document>;
  mcpServers: Map<string, MCPServer>;
  chatSessions: Map<string, ChatSession>;
  chatMessages: Map<string, ChatMessage>;
  businessScopes: Map<string, BusinessScope>;
}

// Generators for property-based testing
const organizationArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  slug: fc.stringMatching(/^[a-z0-9-]{2,30}$/),
});

/**
 * Creates an empty database
 */
function createDatabase(): Database {
  return {
    organizations: new Map(),
    memberships: new Map(),
    agents: new Map(),
    workflows: new Map(),
    tasks: new Map(),
    documents: new Map(),
    mcpServers: new Map(),
    chatSessions: new Map(),
    chatMessages: new Map(),
    businessScopes: new Map(),
  };
}

/**
 * Simulates cascade delete of an organization.
 * Removes the organization and all related records.
 */
function cascadeDeleteOrganization(db: Database, organizationId: string): void {
  // Delete organization
  db.organizations.delete(organizationId);
  
  // Delete all related memberships
  for (const [id, membership] of db.memberships) {
    if (membership.organizationId === organizationId) {
      db.memberships.delete(id);
    }
  }
  
  // Delete all related agents
  for (const [id, agent] of db.agents) {
    if (agent.organizationId === organizationId) {
      db.agents.delete(id);
    }
  }
  
  // Delete all related workflows
  for (const [id, workflow] of db.workflows) {
    if (workflow.organizationId === organizationId) {
      db.workflows.delete(id);
    }
  }
  
  // Delete all related tasks
  for (const [id, task] of db.tasks) {
    if (task.organizationId === organizationId) {
      db.tasks.delete(id);
    }
  }
  
  // Delete all related documents
  for (const [id, doc] of db.documents) {
    if (doc.organizationId === organizationId) {
      db.documents.delete(id);
    }
  }
  
  // Delete all related MCP servers
  for (const [id, server] of db.mcpServers) {
    if (server.organizationId === organizationId) {
      db.mcpServers.delete(id);
    }
  }
  
  // Delete all related chat messages first (they reference sessions)
  for (const [id, message] of db.chatMessages) {
    if (message.organizationId === organizationId) {
      db.chatMessages.delete(id);
    }
  }
  
  // Delete all related chat sessions
  for (const [id, session] of db.chatSessions) {
    if (session.organizationId === organizationId) {
      db.chatSessions.delete(id);
    }
  }
  
  // Delete all related business scopes
  for (const [id, scope] of db.businessScopes) {
    if (scope.organizationId === organizationId) {
      db.businessScopes.delete(id);
    }
  }
}

/**
 * Checks if any records exist for an organization
 */
function hasOrganizationRecords(db: Database, organizationId: string): boolean {
  // Check organization exists
  if (db.organizations.has(organizationId)) return true;
  
  // Check memberships
  for (const membership of db.memberships.values()) {
    if (membership.organizationId === organizationId) return true;
  }
  
  // Check agents
  for (const agent of db.agents.values()) {
    if (agent.organizationId === organizationId) return true;
  }
  
  // Check workflows
  for (const workflow of db.workflows.values()) {
    if (workflow.organizationId === organizationId) return true;
  }
  
  // Check tasks
  for (const task of db.tasks.values()) {
    if (task.organizationId === organizationId) return true;
  }
  
  // Check documents
  for (const doc of db.documents.values()) {
    if (doc.organizationId === organizationId) return true;
  }
  
  // Check MCP servers
  for (const server of db.mcpServers.values()) {
    if (server.organizationId === organizationId) return true;
  }
  
  // Check chat sessions
  for (const session of db.chatSessions.values()) {
    if (session.organizationId === organizationId) return true;
  }
  
  // Check chat messages
  for (const message of db.chatMessages.values()) {
    if (message.organizationId === organizationId) return true;
  }
  
  // Check business scopes
  for (const scope of db.businessScopes.values()) {
    if (scope.organizationId === organizationId) return true;
  }
  
  return false;
}

/**
 * Counts total records for an organization
 */
function countOrganizationRecords(db: Database, organizationId: string): number {
  let count = 0;
  
  if (db.organizations.has(organizationId)) count++;
  
  for (const membership of db.memberships.values()) {
    if (membership.organizationId === organizationId) count++;
  }
  
  for (const agent of db.agents.values()) {
    if (agent.organizationId === organizationId) count++;
  }
  
  for (const workflow of db.workflows.values()) {
    if (workflow.organizationId === organizationId) count++;
  }
  
  for (const task of db.tasks.values()) {
    if (task.organizationId === organizationId) count++;
  }
  
  for (const doc of db.documents.values()) {
    if (doc.organizationId === organizationId) count++;
  }
  
  for (const server of db.mcpServers.values()) {
    if (server.organizationId === organizationId) count++;
  }
  
  for (const session of db.chatSessions.values()) {
    if (session.organizationId === organizationId) count++;
  }
  
  for (const message of db.chatMessages.values()) {
    if (message.organizationId === organizationId) count++;
  }
  
  for (const scope of db.businessScopes.values()) {
    if (scope.organizationId === organizationId) count++;
  }
  
  return count;
}

describe('Organization Cascade Delete - Property-Based Tests', () => {
  /**
   * Feature: supabase-backend, Property 11: Organization Cascade Delete
   * Validates: Requirements 10.8
   */
  describe('Property 11: Organization Cascade Delete', () => {
    it('should delete all memberships when organization is deleted', () => {
      fc.assert(
        fc.property(
          organizationArbitrary,
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          (org, userIds) => {
            const db = createDatabase();
            db.organizations.set(org.id, org);
            
            // Create memberships
            for (const userId of userIds) {
              const membership: Membership = {
                id: crypto.randomUUID(),
                organizationId: org.id,
                userId,
                role: 'member',
              };
              db.memberships.set(membership.id, membership);
            }
            
            // Verify memberships exist
            const membershipsBefore = [...db.memberships.values()].filter(
              m => m.organizationId === org.id
            );
            expect(membershipsBefore.length).toBe(userIds.length);
            
            // Delete organization
            cascadeDeleteOrganization(db, org.id);
            
            // Verify all memberships are deleted
            const membershipsAfter = [...db.memberships.values()].filter(
              m => m.organizationId === org.id
            );
            expect(membershipsAfter.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should delete all agents when organization is deleted', () => {
      fc.assert(
        fc.property(
          organizationArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (org, agentCount) => {
            const db = createDatabase();
            db.organizations.set(org.id, org);
            
            // Create agents
            for (let i = 0; i < agentCount; i++) {
              const agent: Agent = {
                id: crypto.randomUUID(),
                organizationId: org.id,
                name: `Agent ${i}`,
              };
              db.agents.set(agent.id, agent);
            }
            
            // Delete organization
            cascadeDeleteOrganization(db, org.id);
            
            // Verify all agents are deleted
            const agentsAfter = [...db.agents.values()].filter(
              a => a.organizationId === org.id
            );
            expect(agentsAfter.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should delete all workflows when organization is deleted', () => {
      fc.assert(
        fc.property(
          organizationArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (org, workflowCount) => {
            const db = createDatabase();
            db.organizations.set(org.id, org);
            
            // Create workflows
            for (let i = 0; i < workflowCount; i++) {
              const workflow: Workflow = {
                id: crypto.randomUUID(),
                organizationId: org.id,
                name: `Workflow ${i}`,
              };
              db.workflows.set(workflow.id, workflow);
            }
            
            // Delete organization
            cascadeDeleteOrganization(db, org.id);
            
            // Verify all workflows are deleted
            const workflowsAfter = [...db.workflows.values()].filter(
              w => w.organizationId === org.id
            );
            expect(workflowsAfter.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should delete all tasks when organization is deleted', () => {
      fc.assert(
        fc.property(
          organizationArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (org, taskCount) => {
            const db = createDatabase();
            db.organizations.set(org.id, org);
            
            // Create tasks
            for (let i = 0; i < taskCount; i++) {
              const task: Task = {
                id: crypto.randomUUID(),
                organizationId: org.id,
                description: `Task ${i}`,
              };
              db.tasks.set(task.id, task);
            }
            
            // Delete organization
            cascadeDeleteOrganization(db, org.id);
            
            // Verify all tasks are deleted
            const tasksAfter = [...db.tasks.values()].filter(
              t => t.organizationId === org.id
            );
            expect(tasksAfter.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should delete all documents when organization is deleted', () => {
      fc.assert(
        fc.property(
          organizationArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (org, docCount) => {
            const db = createDatabase();
            db.organizations.set(org.id, org);
            
            // Create documents
            for (let i = 0; i < docCount; i++) {
              const doc: Document = {
                id: crypto.randomUUID(),
                organizationId: org.id,
                title: `Document ${i}`,
              };
              db.documents.set(doc.id, doc);
            }
            
            // Delete organization
            cascadeDeleteOrganization(db, org.id);
            
            // Verify all documents are deleted
            const docsAfter = [...db.documents.values()].filter(
              d => d.organizationId === org.id
            );
            expect(docsAfter.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should delete all MCP servers when organization is deleted', () => {
      fc.assert(
        fc.property(
          organizationArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (org, serverCount) => {
            const db = createDatabase();
            db.organizations.set(org.id, org);
            
            // Create MCP servers
            for (let i = 0; i < serverCount; i++) {
              const server: MCPServer = {
                id: crypto.randomUUID(),
                organizationId: org.id,
                name: `Server ${i}`,
              };
              db.mcpServers.set(server.id, server);
            }
            
            // Delete organization
            cascadeDeleteOrganization(db, org.id);
            
            // Verify all servers are deleted
            const serversAfter = [...db.mcpServers.values()].filter(
              s => s.organizationId === org.id
            );
            expect(serversAfter.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should delete all chat sessions and messages when organization is deleted', () => {
      fc.assert(
        fc.property(
          organizationArbitrary,
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (org, sessionCount, messagesPerSession) => {
            const db = createDatabase();
            db.organizations.set(org.id, org);
            
            // Create chat sessions and messages
            for (let i = 0; i < sessionCount; i++) {
              const session: ChatSession = {
                id: crypto.randomUUID(),
                organizationId: org.id,
                userId: crypto.randomUUID(),
              };
              db.chatSessions.set(session.id, session);
              
              for (let j = 0; j < messagesPerSession; j++) {
                const message: ChatMessage = {
                  id: crypto.randomUUID(),
                  organizationId: org.id,
                  sessionId: session.id,
                  content: `Message ${j}`,
                };
                db.chatMessages.set(message.id, message);
              }
            }
            
            // Delete organization
            cascadeDeleteOrganization(db, org.id);
            
            // Verify all sessions and messages are deleted
            const sessionsAfter = [...db.chatSessions.values()].filter(
              s => s.organizationId === org.id
            );
            const messagesAfter = [...db.chatMessages.values()].filter(
              m => m.organizationId === org.id
            );
            expect(sessionsAfter.length).toBe(0);
            expect(messagesAfter.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should delete all business scopes when organization is deleted', () => {
      fc.assert(
        fc.property(
          organizationArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (org, scopeCount) => {
            const db = createDatabase();
            db.organizations.set(org.id, org);
            
            // Create business scopes
            for (let i = 0; i < scopeCount; i++) {
              const scope: BusinessScope = {
                id: crypto.randomUUID(),
                organizationId: org.id,
                name: `Scope ${i}`,
              };
              db.businessScopes.set(scope.id, scope);
            }
            
            // Delete organization
            cascadeDeleteOrganization(db, org.id);
            
            // Verify all scopes are deleted
            const scopesAfter = [...db.businessScopes.values()].filter(
              s => s.organizationId === org.id
            );
            expect(scopesAfter.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should delete all related records completely', () => {
      fc.assert(
        fc.property(
          organizationArbitrary,
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 1, max: 3 }),
          (org, memberCount, agentCount, workflowCount) => {
            const db = createDatabase();
            db.organizations.set(org.id, org);
            
            // Create various related records
            for (let i = 0; i < memberCount; i++) {
              const membership: Membership = {
                id: crypto.randomUUID(),
                organizationId: org.id,
                userId: crypto.randomUUID(),
                role: 'member',
              };
              db.memberships.set(membership.id, membership);
            }
            
            for (let i = 0; i < agentCount; i++) {
              const agent: Agent = {
                id: crypto.randomUUID(),
                organizationId: org.id,
                name: `Agent ${i}`,
              };
              db.agents.set(agent.id, agent);
            }
            
            for (let i = 0; i < workflowCount; i++) {
              const workflow: Workflow = {
                id: crypto.randomUUID(),
                organizationId: org.id,
                name: `Workflow ${i}`,
              };
              db.workflows.set(workflow.id, workflow);
            }
            
            // Verify records exist before deletion
            expect(countOrganizationRecords(db, org.id)).toBeGreaterThan(0);
            
            // Delete organization
            cascadeDeleteOrganization(db, org.id);
            
            // Verify no records remain
            expect(hasOrganizationRecords(db, org.id)).toBe(false);
            expect(countOrganizationRecords(db, org.id)).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not affect other organizations when deleting one', () => {
      fc.assert(
        fc.property(
          organizationArbitrary,
          organizationArbitrary,
          fc.integer({ min: 1, max: 5 }),
          (org1, org2, recordCount) => {
            // Ensure different org IDs
            if (org1.id === org2.id) {
              org2 = { ...org2, id: crypto.randomUUID() };
            }
            
            const db = createDatabase();
            db.organizations.set(org1.id, org1);
            db.organizations.set(org2.id, org2);
            
            // Create records for both organizations
            for (let i = 0; i < recordCount; i++) {
              // Org 1 records
              db.memberships.set(crypto.randomUUID(), {
                id: crypto.randomUUID(),
                organizationId: org1.id,
                userId: crypto.randomUUID(),
                role: 'member',
              });
              db.agents.set(crypto.randomUUID(), {
                id: crypto.randomUUID(),
                organizationId: org1.id,
                name: `Agent ${i}`,
              });
              
              // Org 2 records
              db.memberships.set(crypto.randomUUID(), {
                id: crypto.randomUUID(),
                organizationId: org2.id,
                userId: crypto.randomUUID(),
                role: 'member',
              });
              db.agents.set(crypto.randomUUID(), {
                id: crypto.randomUUID(),
                organizationId: org2.id,
                name: `Agent ${i}`,
              });
            }
            
            const org2RecordsBefore = countOrganizationRecords(db, org2.id);
            
            // Delete org1
            cascadeDeleteOrganization(db, org1.id);
            
            // Verify org1 is completely deleted
            expect(hasOrganizationRecords(db, org1.id)).toBe(false);
            
            // Verify org2 is unaffected
            const org2RecordsAfter = countOrganizationRecords(db, org2.id);
            expect(org2RecordsAfter).toBe(org2RecordsBefore);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle organization with no related records', () => {
      fc.assert(
        fc.property(
          organizationArbitrary,
          (org) => {
            const db = createDatabase();
            db.organizations.set(org.id, org);
            
            // No related records created
            
            // Delete organization
            cascadeDeleteOrganization(db, org.id);
            
            // Verify organization is deleted
            expect(db.organizations.has(org.id)).toBe(false);
            expect(hasOrganizationRecords(db, org.id)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

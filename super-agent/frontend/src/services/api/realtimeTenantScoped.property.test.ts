/**
 * Property-Based Tests for Real-time Tenant-Scoped Subscriptions
 * 
 * Feature: supabase-backend, Property 4: Real-time Tenant-Scoped Subscriptions
 * Validates: Requirements 12.2, 12.3
 * 
 * Property 4: Real-time Tenant-Scoped Subscriptions
 * *For any* real-time subscription, change events SHALL only be received for 
 * records belonging to the subscriber's active organization.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ============================================================================
// Type Definitions
// ============================================================================

interface User {
  id: string;
  email: string;
  active_organization_id: string | null;
}

interface TenantScopedRecord {
  id: string;
  organization_id: string;
  [key: string]: unknown;
}

interface RealtimeChangeEvent<T = TenantScopedRecord> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  new: T | null;
  old: T | null;
  timestamp: string;
}

interface SubscriptionContext {
  subscriberId: string;
  subscriberOrgId: string;
  channelTopic: string;
}

type RealtimeTableName = 
  | 'agents'
  | 'workflows'
  | 'tasks'
  | 'business_scopes'
  | 'documents'
  | 'mcp_servers'
  | 'chat_sessions'
  | 'chat_messages';

// ============================================================================
// Generators
// ============================================================================

const userIdArbitrary = fc.uuid();
const organizationIdArbitrary = fc.uuid();
const emailArbitrary = fc.emailAddress();

const tableNameArbitrary = fc.constantFrom<RealtimeTableName>(
  'agents', 'workflows', 'tasks', 'business_scopes', 
  'documents', 'mcp_servers', 'chat_sessions', 'chat_messages'
);

const eventTypeArbitrary = fc.constantFrom<'INSERT' | 'UPDATE' | 'DELETE'>(
  'INSERT', 'UPDATE', 'DELETE'
);

const userArbitrary = fc.record({
  id: userIdArbitrary,
  email: emailArbitrary,
  active_organization_id: fc.option(organizationIdArbitrary, { nil: null }),
});

// Generate valid ISO date strings
const isoDateArbitrary = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime()
}).map(timestamp => new Date(timestamp).toISOString());

const tenantScopedRecordArbitrary = fc.record({
  id: fc.uuid(),
  organization_id: organizationIdArbitrary,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  created_at: isoDateArbitrary,
});

const realtimeChangeEventArbitrary = <T extends TenantScopedRecord>(
  record: T,
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  table: string
): RealtimeChangeEvent<T> => ({
  eventType,
  table,
  schema: 'public',
  new: eventType === 'DELETE' ? null : record,
  old: eventType === 'INSERT' ? null : record,
  timestamp: new Date().toISOString(),
});

// ============================================================================
// Realtime Subscription Simulation Functions
// ============================================================================

/**
 * Generates the channel topic for a table and organization.
 * Format: {table_name}:{organization_id}
 * 
 * This matches the format used by the database broadcast triggers.
 */
function generateChannelTopic(table: RealtimeTableName, organizationId: string): string {
  return `${table}:${organizationId}`;
}

/**
 * Simulates creating a subscription context for a user.
 * The subscription is scoped to the user's active organization.
 */
function createSubscriptionContext(
  user: User,
  table: RealtimeTableName
): SubscriptionContext | null {
  if (!user.active_organization_id) {
    return null; // Cannot subscribe without an active organization
  }

  return {
    subscriberId: user.id,
    subscriberOrgId: user.active_organization_id,
    channelTopic: generateChannelTopic(table, user.active_organization_id),
  };
}

/**
 * Simulates the database broadcast trigger.
 * Broadcasts changes to the org-scoped channel topic.
 */
function broadcastChange<T extends TenantScopedRecord>(
  record: T,
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  table: RealtimeTableName
): { channelTopic: string; event: RealtimeChangeEvent<T> } {
  const orgId = record.organization_id;
  const channelTopic = generateChannelTopic(table, orgId);
  
  return {
    channelTopic,
    event: realtimeChangeEventArbitrary(record, eventType, table),
  };
}

/**
 * Determines if a subscription should receive a broadcast event.
 * 
 * The key tenant isolation property: a subscription only receives events
 * for records in the subscriber's active organization.
 */
function shouldReceiveEvent(
  subscription: SubscriptionContext,
  broadcast: { channelTopic: string; event: RealtimeChangeEvent }
): boolean {
  // Subscription only receives events on its channel topic
  // Channel topic is org-scoped: {table}:{org_id}
  return subscription.channelTopic === broadcast.channelTopic;
}

/**
 * Simulates filtering events for a subscription.
 * Only events matching the subscription's channel topic are delivered.
 */
function filterEventsForSubscription<T extends TenantScopedRecord>(
  subscription: SubscriptionContext,
  broadcasts: Array<{ channelTopic: string; event: RealtimeChangeEvent<T> }>
): RealtimeChangeEvent<T>[] {
  return broadcasts
    .filter(b => shouldReceiveEvent(subscription, b))
    .map(b => b.event);
}

/**
 * Extracts the organization ID from a change event.
 */
function getEventOrgId(event: RealtimeChangeEvent): string | null {
  const record = event.new || event.old;
  return record?.organization_id || null;
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Real-time Tenant-Scoped Subscriptions - Property-Based Tests', () => {
  /**
   * Feature: supabase-backend, Property 4: Real-time Tenant-Scoped Subscriptions
   * Validates: Requirements 12.2, 12.3
   */
  describe('Property 4: Real-time Tenant-Scoped Subscriptions', () => {
    it('should only receive events for records in the subscriber active organization', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          tableNameArbitrary,
          fc.array(tenantScopedRecordArbitrary, { minLength: 1, maxLength: 20 }),
          eventTypeArbitrary,
          (user, table, records, eventType) => {
            // Ensure user has an active organization
            const userWithOrg: User = {
              ...user,
              active_organization_id: user.active_organization_id || records[0].organization_id,
            };

            // Create subscription for the user
            const subscription = createSubscriptionContext(userWithOrg, table);
            
            if (!subscription) {
              return true; // Skip if no subscription could be created
            }

            // Broadcast changes for all records
            const broadcasts = records.map(record => 
              broadcastChange(record, eventType, table)
            );

            // Filter events that the subscription would receive
            const receivedEvents = filterEventsForSubscription(subscription, broadcasts);

            // Property: All received events must be for the subscriber's organization
            const allEventsFromSubscriberOrg = receivedEvents.every(event => {
              const eventOrgId = getEventOrgId(event);
              return eventOrgId === subscription.subscriberOrgId;
            });

            expect(allEventsFromSubscriberOrg).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not receive events from other organizations', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary, // User's org
          organizationIdArbitrary, // Other org
          tableNameArbitrary,
          tenantScopedRecordArbitrary,
          eventTypeArbitrary,
          (user, userOrgId, otherOrgId, table, record, eventType) => {
            // Skip if orgs happen to be the same
            if (userOrgId === otherOrgId) {
              return true;
            }

            const userWithOrg: User = {
              ...user,
              active_organization_id: userOrgId,
            };

            // Create subscription for the user
            const subscription = createSubscriptionContext(userWithOrg, table);
            
            if (!subscription) {
              return true;
            }

            // Record belongs to a different organization
            const otherOrgRecord: TenantScopedRecord = {
              ...record,
              organization_id: otherOrgId,
            };

            // Broadcast change for the other org's record
            const broadcast = broadcastChange(otherOrgRecord, eventType, table);

            // Check if subscription would receive this event
            const wouldReceive = shouldReceiveEvent(subscription, broadcast);

            // Property: Should NOT receive events from other organizations
            expect(wouldReceive).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should receive all events from the subscriber active organization', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          tableNameArbitrary,
          fc.array(tenantScopedRecordArbitrary, { minLength: 1, maxLength: 10 }),
          eventTypeArbitrary,
          (user, orgId, table, records, eventType) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: orgId,
            };

            // Create subscription for the user
            const subscription = createSubscriptionContext(userWithOrg, table);
            
            if (!subscription) {
              return true;
            }

            // All records belong to the user's organization
            const sameOrgRecords = records.map(r => ({
              ...r,
              organization_id: orgId,
            }));

            // Broadcast changes for all records
            const broadcasts = sameOrgRecords.map(record => 
              broadcastChange(record, eventType, table)
            );

            // Filter events that the subscription would receive
            const receivedEvents = filterEventsForSubscription(subscription, broadcasts);

            // Property: Should receive ALL events from the subscriber's organization
            expect(receivedEvents.length).toBe(sameOrgRecords.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly scope channel topics by organization', () => {
      fc.assert(
        fc.property(
          organizationIdArbitrary,
          organizationIdArbitrary,
          tableNameArbitrary,
          (org1Id, org2Id, table) => {
            const topic1 = generateChannelTopic(table, org1Id);
            const topic2 = generateChannelTopic(table, org2Id);

            if (org1Id === org2Id) {
              // Same org should have same topic
              expect(topic1).toBe(topic2);
            } else {
              // Different orgs should have different topics
              expect(topic1).not.toBe(topic2);
            }

            // Topic should contain the org ID
            expect(topic1).toContain(org1Id);
            expect(topic2).toContain(org2Id);

            // Topic should contain the table name
            expect(topic1).toContain(table);
            expect(topic2).toContain(table);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not create subscription without active organization', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          tableNameArbitrary,
          (user, table) => {
            // User without active organization
            const userWithoutOrg: User = {
              ...user,
              active_organization_id: null,
            };

            const subscription = createSubscriptionContext(userWithoutOrg, table);

            // Property: Cannot create subscription without active organization
            expect(subscription).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should isolate subscriptions across different tables', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          tableNameArbitrary,
          tableNameArbitrary,
          tenantScopedRecordArbitrary,
          eventTypeArbitrary,
          (user, orgId, subscribedTable, broadcastTable, record, eventType) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: orgId,
            };

            // Create subscription for one table
            const subscription = createSubscriptionContext(userWithOrg, subscribedTable);
            
            if (!subscription) {
              return true;
            }

            // Record in the same org
            const sameOrgRecord: TenantScopedRecord = {
              ...record,
              organization_id: orgId,
            };

            // Broadcast change on potentially different table
            const broadcast = broadcastChange(sameOrgRecord, eventType, broadcastTable);

            // Check if subscription would receive this event
            const wouldReceive = shouldReceiveEvent(subscription, broadcast);

            if (subscribedTable === broadcastTable) {
              // Same table: should receive event
              expect(wouldReceive).toBe(true);
            } else {
              // Different table: should NOT receive event
              expect(wouldReceive).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle mixed organization events correctly', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          fc.array(organizationIdArbitrary, { minLength: 2, maxLength: 5 }),
          tableNameArbitrary,
          fc.array(tenantScopedRecordArbitrary, { minLength: 5, maxLength: 20 }),
          eventTypeArbitrary,
          (user, orgIds, table, records, eventType) => {
            // Ensure unique org IDs
            const uniqueOrgIds = [...new Set(orgIds)];
            if (uniqueOrgIds.length < 2) {
              return true;
            }

            const activeOrgId = uniqueOrgIds[0];
            
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };

            // Create subscription for the user
            const subscription = createSubscriptionContext(userWithOrg, table);
            
            if (!subscription) {
              return true;
            }

            // Distribute records across organizations
            const recordsWithOrgs = records.map((record, index) => ({
              ...record,
              organization_id: uniqueOrgIds[index % uniqueOrgIds.length],
            }));

            // Broadcast changes for all records
            const broadcasts = recordsWithOrgs.map(record => 
              broadcastChange(record, eventType, table)
            );

            // Filter events that the subscription would receive
            const receivedEvents = filterEventsForSubscription(subscription, broadcasts);

            // Count expected events (only from active org)
            const expectedCount = recordsWithOrgs.filter(
              r => r.organization_id === activeOrgId
            ).length;

            // Property: Should only receive events from active organization
            expect(receivedEvents.length).toBe(expectedCount);

            // All received events should be from active org
            const allFromActiveOrg = receivedEvents.every(event => {
              const eventOrgId = getEventOrgId(event);
              return eventOrgId === activeOrgId;
            });

            expect(allFromActiveOrg).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve event type in received events', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          tableNameArbitrary,
          tenantScopedRecordArbitrary,
          eventTypeArbitrary,
          (user, orgId, table, record, eventType) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: orgId,
            };

            const subscription = createSubscriptionContext(userWithOrg, table);
            
            if (!subscription) {
              return true;
            }

            // Record in the same org
            const sameOrgRecord: TenantScopedRecord = {
              ...record,
              organization_id: orgId,
            };

            // Broadcast change
            const broadcast = broadcastChange(sameOrgRecord, eventType, table);

            // Filter events
            const receivedEvents = filterEventsForSubscription(subscription, [broadcast]);

            // Property: Event type should be preserved
            expect(receivedEvents.length).toBe(1);
            expect(receivedEvents[0].eventType).toBe(eventType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include correct record data in events', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          tableNameArbitrary,
          tenantScopedRecordArbitrary,
          eventTypeArbitrary,
          (user, orgId, table, record, eventType) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: orgId,
            };

            const subscription = createSubscriptionContext(userWithOrg, table);
            
            if (!subscription) {
              return true;
            }

            // Record in the same org
            const sameOrgRecord: TenantScopedRecord = {
              ...record,
              organization_id: orgId,
            };

            // Broadcast change
            const broadcast = broadcastChange(sameOrgRecord, eventType, table);

            // Filter events
            const receivedEvents = filterEventsForSubscription(subscription, [broadcast]);

            expect(receivedEvents.length).toBe(1);
            const event = receivedEvents[0];

            // Property: Event should contain correct record data based on event type
            if (eventType === 'INSERT') {
              expect(event.new).not.toBeNull();
              expect(event.new?.id).toBe(sameOrgRecord.id);
              expect(event.old).toBeNull();
            } else if (eventType === 'DELETE') {
              expect(event.old).not.toBeNull();
              expect(event.old?.id).toBe(sameOrgRecord.id);
              expect(event.new).toBeNull();
            } else {
              // UPDATE
              expect(event.new).not.toBeNull();
              expect(event.old).not.toBeNull();
              expect(event.new?.id).toBe(sameOrgRecord.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

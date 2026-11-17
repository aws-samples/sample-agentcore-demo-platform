/**
 * Ownership enforcement on owner-only DELETE routes.
 *
 * `workflows:delete`, `tasks:delete`, `documents:delete` and `api_keys:delete`
 * are owner-only for the `member` role (see authorization/permissions.ts).
 * These tests drive the real route plugins through `fastify.inject` with the
 * database and the service-layer delete calls stubbed, and check that a
 * member can delete only what they created while admins/owners can delete
 * anything in their organization.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const VICTIM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ATTACKER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ADMIN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RESOURCE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

// Rows the stubbed Prisma client can see: { [model]: { id, organization_id, owner } }
const rows: Record<string, { id: string; organization_id: string; owner: string | null } | null> =
  {};

const findFirst = (model: string, ownerField: string) =>
  vi.fn(async ({ where }: { where: { id: string; organization_id: string } }) => {
    const r = rows[model];
    if (!r || r.id !== where.id || r.organization_id !== where.organization_id) return null;
    return { [ownerField]: r.owner };
  });

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    workflows: { findFirst: findFirst('workflows', 'created_by') },
    tasks: { findFirst: findFirst('tasks', 'created_by') },
    documents: { findFirst: findFirst('documents', 'created_by') },
    api_keys: { findFirst: findFirst('api_keys', 'user_id') },
  },
}));

// Replace token verification with a test header; keep the real role gates.
vi.mock('../../src/middleware/auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/middleware/auth.js')>();
  return {
    ...actual,
    authenticate: async (request: any, reply: any) => {
      const raw = request.headers['x-test-user'];
      if (!raw) return reply.status(401).send({ error: 'Missing authorization header' });
      request.user = JSON.parse(String(raw));
    },
  };
});

const { workflowRoutes } = await import('../../src/routes/workflows.routes.js');
const { taskRoutes } = await import('../../src/routes/tasks.routes.js');
const { documentRoutes } = await import('../../src/routes/documents.routes.js');
const { apiKeysRoutes } = await import('../../src/routes/apiKeys.routes.js');
const { workflowService } = await import('../../src/services/workflow.service.js');
const { taskService } = await import('../../src/services/task.service.js');
const { documentService } = await import('../../src/services/document.service.js');
const { apiKeyService } = await import('../../src/services/apiKey.service.js');
const { authorizationService } = await import('../../src/authorization/authorization.js');

const deleteSpies = {
  workflows: vi.spyOn(workflowService, 'deleteWorkflow').mockResolvedValue(true),
  tasks: vi.spyOn(taskService, 'deleteTask').mockResolvedValue(true),
  documents: vi.spyOn(documentService, 'deleteDocument').mockResolvedValue(true),
  api_keys: vi.spyOn(apiKeyService, 'deleteApiKey').mockResolvedValue(undefined),
};

const cases = [
  { model: 'workflows', url: `/api/workflows/${RESOURCE}`, ok: 204 },
  { model: 'tasks', url: `/api/tasks/${RESOURCE}`, ok: 204 },
  { model: 'documents', url: `/api/documents/${RESOURCE}`, ok: 204 },
  { model: 'api_keys', url: `/api/api-keys/${RESOURCE}`, ok: 200 },
] as const;

const user = (id: string, role: string, orgId = ORG) =>
  JSON.stringify({ id, email: `${id}@example.invalid`, orgId, role });

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await app.register(workflowRoutes, { prefix: '/api/workflows' });
  await app.register(taskRoutes, { prefix: '/api/tasks' });
  await app.register(documentRoutes, { prefix: '/api/documents' });
  await app.register(apiKeysRoutes, { prefix: '/api' });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  for (const s of Object.values(deleteSpies)) s.mockClear();
  for (const k of Object.keys(rows)) delete rows[k];
});

describe.each(cases)('DELETE $url', ({ model, url, ok }) => {
  const del = (u: string) => app.inject({ method: 'DELETE', url, headers: { 'x-test-user': u } });

  it('lets a member delete their own resource', async () => {
    rows[model] = { id: RESOURCE, organization_id: ORG, owner: VICTIM };
    const res = await del(user(VICTIM, 'member'));
    expect(res.statusCode).toBe(ok);
    expect(deleteSpies[model]).toHaveBeenCalledTimes(1);
  });

  it("refuses a member deleting another member's resource", async () => {
    rows[model] = { id: RESOURCE, organization_id: ORG, owner: VICTIM };
    const res = await del(user(ATTACKER, 'member'));
    expect(res.statusCode).toBe(403);
    expect(deleteSpies[model]).not.toHaveBeenCalled();
  });

  it('refuses a member deleting a resource with no recorded owner', async () => {
    rows[model] = { id: RESOURCE, organization_id: ORG, owner: null };
    const res = await del(user(ATTACKER, 'member'));
    expect(res.statusCode).toBe(403);
    expect(deleteSpies[model]).not.toHaveBeenCalled();
  });

  it('refuses a member whose org does not hold the resource, even with a matching user id', async () => {
    rows[model] = { id: RESOURCE, organization_id: OTHER_ORG, owner: VICTIM };
    const res = await del(user(VICTIM, 'member'));
    expect(res.statusCode).toBe(403);
    expect(deleteSpies[model]).not.toHaveBeenCalled();
  });

  it.each(['admin', 'owner'])("lets an org %s delete another member's resource", async (role) => {
    rows[model] = { id: RESOURCE, organization_id: ORG, owner: VICTIM };
    const res = await del(user(ADMIN, role));
    expect(res.statusCode).toBe(ok);
    expect(deleteSpies[model]).toHaveBeenCalledTimes(1);
  });

  it('refuses a viewer', async () => {
    rows[model] = { id: RESOURCE, organization_id: ORG, owner: VICTIM };
    const res = await del(user(VICTIM, 'viewer'));
    expect(res.statusCode).toBe(403);
    expect(deleteSpies[model]).not.toHaveBeenCalled();
  });
});

describe('AuthorizationService owner-only permissions', () => {
  const member = { id: VICTIM, email: 'm@example.invalid', orgId: ORG, role: 'member' as const };
  const admin = { ...member, id: ADMIN, role: 'admin' as const };

  it('fails closed when no owner is supplied', () => {
    expect(authorizationService.can(member, 'workflows:delete')).toBe(false);
    expect(authorizationService.can(member, 'workflows:delete', {})).toBe(false);
    expect(authorizationService.can(member, 'workflows:delete', { resourceOwnerId: null })).toBe(
      false
    );
  });

  it('allows the owner and the bypass roles', () => {
    expect(authorizationService.can(member, 'workflows:delete', { resourceOwnerId: VICTIM })).toBe(
      true
    );
    expect(authorizationService.can(admin, 'workflows:delete', { resourceOwnerId: VICTIM })).toBe(
      true
    );
    expect(authorizationService.can(admin, 'workflows:delete')).toBe(true);
  });

  it('checks the resource org before ownership', () => {
    expect(
      authorizationService.can(member, 'workflows:delete', {
        resourceOwnerId: VICTIM,
        resourceOrgId: OTHER_ORG,
      })
    ).toBe(false);
  });

  it('leaves non-owner-only permissions unchanged', () => {
    expect(authorizationService.can(member, 'workflows:write')).toBe(true);
  });
});

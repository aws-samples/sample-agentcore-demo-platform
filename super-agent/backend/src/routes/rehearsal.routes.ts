/**
 * Rehearsal Routes
 *
 * Endpoints for managing agent rehearsals and evolution proposals.
 * Mounted under /api/business-scopes.
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { rehearsalService } from '../services/rehearsal.service.js';

interface ScopeParam { Params: { scopeId: string } }
interface RehearsalParam { Params: { scopeId: string; rehearsalId: string } }
interface ProposalParam { Params: { scopeId: string; proposalId: string } }

interface TriggerRehearsalBody {
  Params: { scopeId: string };
  Body: { agent_id?: string; memory_ids?: string[] };
}

export async function rehearsalRoutes(fastify: FastifyInstance): Promise<void> {
  /** GET /:scopeId/rehearsals — List rehearsal sessions */
  fastify.get<ScopeParam & { Querystring: { limit?: string } }>(
    '/:scopeId/rehearsals',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const limit = parseInt(request.query.limit ?? '20', 10);
      const data = await rehearsalService.listRehearsals(
        request.user!.orgId,
        request.params.scopeId,
        limit,
      );
      return reply.status(200).send({ data });
    },
  );

  /** POST /:scopeId/rehearsals — Manually trigger a rehearsal */
  fastify.post<TriggerRehearsalBody>(
    '/:scopeId/rehearsals',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const session = await rehearsalService.runRehearsal(
          request.user!.orgId,
          request.params.scopeId,
          {
            agentId: request.body?.agent_id,
            rehearsalType: 'manual',
            memoryIds: request.body?.memory_ids,
          },
        );
        return reply.status(201).send({ data: session });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Rehearsal failed';
        return reply.status(400).send({ error: message, code: 'REHEARSAL_ERROR' });
      }
    },
  );

  /** GET /:scopeId/rehearsals/:rehearsalId — Get rehearsal details */
  fastify.get<RehearsalParam>(
    '/:scopeId/rehearsals/:rehearsalId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const data = await rehearsalService.getRehearsalById(
        request.params.rehearsalId,
        request.user!.orgId,
      );
      if (!data) {
        return reply.status(404).send({ error: 'Rehearsal not found', code: 'NOT_FOUND' });
      }
      return reply.status(200).send({ data });
    },
  );

  /** GET /:scopeId/proposals — List evolution proposals */
  fastify.get<ScopeParam & { Querystring: { status?: string; limit?: string } }>(
    '/:scopeId/proposals',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const limit = parseInt(request.query.limit ?? '20', 10);
      const data = await rehearsalService.listProposals(
        request.user!.orgId,
        request.params.scopeId,
        request.query.status,
        limit,
      );
      return reply.status(200).send({ data });
    },
  );

  /** GET /:scopeId/proposals/:proposalId — Get proposal details */
  fastify.get<ProposalParam>(
    '/:scopeId/proposals/:proposalId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const data = await rehearsalService.getProposalById(
        request.params.proposalId,
        request.user!.orgId,
      );
      if (!data) {
        return reply.status(404).send({ error: 'Proposal not found', code: 'NOT_FOUND' });
      }
      return reply.status(200).send({ data });
    },
  );

  /** POST /:scopeId/proposals/:proposalId/apply — Apply a pending proposal */
  fastify.post<ProposalParam & { Body: { review_note?: string } }>(
    '/:scopeId/proposals/:proposalId/apply',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const data = await rehearsalService.applyProposal(
          request.params.proposalId,
          request.user!.orgId,
          request.user!.id,
          (request.body as { review_note?: string })?.review_note,
        );
        return reply.status(200).send({ data });
      } catch (err) {
        return reply.status(400).send({ error: err instanceof Error ? err.message : 'Apply failed' });
      }
    },
  );

  /** POST /:scopeId/proposals/:proposalId/reject — Reject a pending proposal */
  fastify.post<ProposalParam & { Body: { review_note?: string } }>(
    '/:scopeId/proposals/:proposalId/reject',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const data = await rehearsalService.rejectProposal(
          request.params.proposalId,
          request.user!.orgId,
          request.user!.id,
          (request.body as { review_note?: string })?.review_note,
        );
        return reply.status(200).send({ data });
      } catch (err) {
        return reply.status(400).send({ error: err instanceof Error ? err.message : 'Reject failed' });
      }
    },
  );
}

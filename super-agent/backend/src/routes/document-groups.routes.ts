/**
 * Document Group Routes
 *
 * CRUD for document groups, file upload/delete, and scope assignment.
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireModifyAccess } from '../middleware/auth.js';
import { documentGroupRepository } from '../repositories/document-group.repository.js';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { join } from 'path';
import { mkdir, writeFile, unlink, rm } from 'fs/promises';
import { randomUUID } from 'crypto';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function documentGroupRoutes(fastify: FastifyInstance): Promise<void> {
  // multipart is registered globally in app.ts

  /** GET /api/document-groups — list all groups */
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const groups = await documentGroupRepository.listGroups(request.user!.orgId);
    return reply.send({ data: groups });
  });

  /** POST /api/document-groups — create a group */
  fastify.post<{ Body: { name: string; description?: string } }>(
    '/',
    { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      const { name, description } = request.body;
      if (!name?.trim()) return reply.status(400).send({ error: 'name is required' });

      const id = randomUUID();
      const storagePath = join(config.docGroups.basePath, id);
      await mkdir(storagePath, { recursive: true });

      const group = await documentGroupRepository.createGroup(request.user!.orgId, {
        name: name.trim(),
        description: description?.trim(),
        storage_path: storagePath,
      });
      return reply.status(201).send({ data: group });
    },
  );

  /** PUT /api/document-groups/:id — update name/description */
  fastify.put<{ Params: { id: string }; Body: { name?: string; description?: string } }>(
    '/:id',
    { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      const updated = await documentGroupRepository.updateGroup(
        request.params.id, request.user!.orgId, request.body,
      );
      if (!updated) return reply.status(404).send({ error: 'Not found' });
      return reply.send({ data: updated });
    },
  );

  /** DELETE /api/document-groups/:id — delete group + files on disk */
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      const group = await documentGroupRepository.getGroup(request.params.id, request.user!.orgId);
      if (!group) return reply.status(404).send({ error: 'Not found' });

      // Delete from DB (cascades to files + scope assignments)
      await documentGroupRepository.deleteGroup(group.id, request.user!.orgId);

      // Remove directory on disk
      try { await rm(group.storage_path, { recursive: true, force: true }); } catch {}

      return reply.status(204).send();
    },
  );

  /** GET /api/document-groups/:id/files — list files */
  fastify.get<{ Params: { id: string } }>(
    '/:id/files',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const files = await documentGroupRepository.listFiles(request.params.id, request.user!.orgId);
      // Convert BigInt file_size to Number for JSON serialization
      const serializable = files.map(f => ({ ...f, file_size: Number(f.file_size) }));
      return reply.send({ data: serializable });
    },
  );

  /** POST /api/document-groups/:id/files — upload file (multipart) */
  fastify.post<{ Params: { id: string } }>(
    '/:id/files',
    { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      const group = await documentGroupRepository.getGroup(request.params.id, request.user!.orgId);
      if (!group) return reply.status(404).send({ error: 'Group not found' });

      const file = await request.file({ limits: { fileSize: MAX_FILE_SIZE } });
      if (!file) return reply.status(400).send({ error: 'No file uploaded' });

      const buffer = await file.toBuffer();
      // Use original filename on disk (sanitize to avoid path traversal)
      const safeName = file.filename.replace(/[/\\:*?"<>|]/g, '-');
      const storedFilename = safeName;
      const filePath = join(group.storage_path, storedFilename);

      await writeFile(filePath, buffer);

      const record = await documentGroupRepository.createFile({
        document_group_id: group.id,
        organization_id: request.user!.orgId,
        original_filename: file.filename,
        stored_filename: storedFilename,
        file_size: BigInt(buffer.length),
        mime_type: file.mimetype || 'application/octet-stream',
        uploaded_by: request.user!.id,
      });

      // Auto-index for RAG if enabled (fire-and-forget)
      const { documentIndexerService, isRagEnabled } = await import('../services/rag/document-indexer.service.js');
      if (isRagEnabled()) {
        documentIndexerService.indexFile(
          record.id,
          request.user!.orgId,
          group.id,
          group.storage_path,
          storedFilename,
          file.mimetype || 'application/octet-stream',
          file.filename,
        ).catch(err => console.error('[rag] Auto-index failed:', err));
      }

      return reply.status(201).send({ data: { ...record, file_size: Number(record.file_size) } });
    },
  );

  /** DELETE /api/document-groups/:id/files/:fileId — delete a file */
  fastify.delete<{ Params: { id: string; fileId: string } }>(
    '/:id/files/:fileId',
    { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      const group = await documentGroupRepository.getGroup(request.params.id, request.user!.orgId);
      if (!group) return reply.status(404).send({ error: 'Group not found' });

      const file = await documentGroupRepository.getFile(request.params.fileId, request.user!.orgId);
      if (!file) return reply.status(404).send({ error: 'File not found' });

      await documentGroupRepository.deleteFile(file.id, request.user!.orgId);
      try { await unlink(join(group.storage_path, file.stored_filename)); } catch {}

      return reply.status(204).send();
    },
  );
}

/** Scope ↔ Document Group assignment routes (nested under /api/business-scopes) */
export async function scopeDocGroupRoutes(fastify: FastifyInstance): Promise<void> {
  /** GET /:scopeId/document-groups — list assigned groups */
  fastify.get<{ Params: { scopeId: string } }>(
    '/:scopeId/document-groups',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const assignments = await documentGroupRepository.listScopeAssignments(
        request.params.scopeId, request.user!.orgId,
      );
      return reply.send({ data: assignments });
    },
  );

  /** POST /:scopeId/document-groups — assign a group */
  fastify.post<{ Params: { scopeId: string }; Body: { document_group_id: string } }>(
    '/:scopeId/document-groups',
    { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      const { document_group_id } = request.body;
      if (!document_group_id) return reply.status(400).send({ error: 'document_group_id is required' });

      try {
        const assignment = await documentGroupRepository.assignToScope(
          request.user!.orgId, request.params.scopeId, document_group_id,
        );

        // Bump config_version so active sessions pick up the new document group
        await prisma.$executeRaw`
          UPDATE business_scopes SET config_version = config_version + 1, updated_at = NOW()
          WHERE id = ${request.params.scopeId}::uuid AND organization_id = ${request.user!.orgId}::uuid
        `;

        return reply.status(201).send({ data: assignment });
      } catch (err: any) {
        if (err.code === 'P2002') return reply.status(409).send({ error: 'Already assigned' });
        throw err;
      }
    },
  );

  /** DELETE /:scopeId/document-groups/:assignmentId — unassign */
  fastify.delete<{ Params: { scopeId: string; assignmentId: string } }>(
    '/:scopeId/document-groups/:assignmentId',
    { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      const ok = await documentGroupRepository.unassignFromScope(
        request.params.assignmentId, request.user!.orgId,
      );
      if (!ok) return reply.status(404).send({ error: 'Not found' });

      // Bump config_version so active sessions pick up the removal
      await prisma.$executeRaw`
        UPDATE business_scopes SET config_version = config_version + 1, updated_at = NOW()
        WHERE id = ${request.params.scopeId}::uuid AND organization_id = ${request.user!.orgId}::uuid
      `;

      return reply.status(204).send();
    },
  );
}

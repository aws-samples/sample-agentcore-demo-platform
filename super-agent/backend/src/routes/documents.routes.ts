/**
 * Document Routes
 * REST API endpoints for Document management with S3 integration.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { documentService } from '../services/document.service.js';
import { authenticate, requireModifyAccess } from '../middleware/auth.js';
import {
  createDocumentSchema,
  updateDocumentSchema,
  documentFilterSchema,
  documentStatusSchema,
  type CreateDocumentInput,
  type UpdateDocumentInput,
  type DocumentFilter,
  type DocumentStatus,
} from '../schemas/document.schema.js';
import { paginationSchema, idParamSchema } from '../schemas/common.schema.js';
import { ZodError } from 'zod';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Request types for route handlers
 */
interface GetDocumentsRequest {
  Querystring: DocumentFilter & { page?: number; limit?: number };
}

interface GetDocumentByIdRequest {
  Params: { id: string };
}

interface CreateDocumentRequest {
  Body: CreateDocumentInput;
}

interface UpdateDocumentRequest {
  Params: { id: string };
  Body: UpdateDocumentInput;
}

interface UpdateDocumentStatusRequest {
  Params: { id: string };
  Body: { status: DocumentStatus };
}

interface DeleteDocumentRequest {
  Params: { id: string };
}

interface GetUploadUrlRequest {
  Body: {
    fileName: string;
    contentType: string;
  };
}

interface GetDownloadUrlRequest {
  Params: { id: string };
}

/**
 * Parse and validate Zod schema, throwing AppError on failure
 */
function validateSchema<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw AppError.validation('Validation failed', error.issues);
    }
    throw error;
  }
}

/**
 * Register document routes on the Fastify instance.
 * All routes require authentication and filter by organization_id.
 */
export async function documentRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/documents
   * Get all documents for the authenticated user's organization.
   * Supports filtering by category, status, and file_type.
   * Requirements: 7.1, 7.4
   */
  fastify.get<GetDocumentsRequest>(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all documents for the organization',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            status: { type: 'string', enum: ['indexed', 'processing', 'error'] },
            file_type: { type: 'string', enum: ['PDF', 'TXT', 'MD', 'DOCX'] },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array' },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<GetDocumentsRequest>, reply: FastifyReply) => {
      const { page, limit, ...filterParams } = request.query;

      // Validate filters
      const filters = validateSchema(documentFilterSchema, filterParams);
      const pagination = validateSchema(paginationSchema, { page, limit });

      const result = await documentService.getDocuments(request.user!.orgId, filters, pagination);

      return reply.status(200).send(result);
    }
  );

  /**
   * GET /api/documents/:id
   * Get a single document by ID.
   * Requirements: 7.4
   */
  fastify.get<GetDocumentByIdRequest>(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get a document by ID',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              title: { type: 'string' },
              category: { type: 'string', nullable: true },
              file_name: { type: 'string' },
              file_type: { type: 'string', nullable: true },
              file_path: { type: 'string' },
              status: { type: 'string' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<GetDocumentByIdRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);

      const document = await documentService.getDocumentById(id, request.user!.orgId);

      return reply.status(200).send(document);
    }
  );

  /**
   * GET /api/documents/:id/download
   * Get a presigned download URL for a document.
   * Requirements: 7.6
   */
  fastify.get<GetDownloadUrlRequest>(
    '/:id/download',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get a presigned download URL for a document',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              key: { type: 'string' },
              expiresIn: { type: 'integer' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<GetDownloadUrlRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);

      // Get document to retrieve file path
      const document = await documentService.getDocumentById(id, request.user!.orgId);

      // Generate presigned download URL
      const result = await documentService.getDownloadUrl(document.file_path, request.user!.orgId);

      return reply.status(200).send(result);
    }
  );

  /**
   * POST /api/documents/upload-url
   * Get a presigned URL for uploading a file to S3.
   * Requirements: 7.3
   */
  fastify.post<GetUploadUrlRequest>(
    '/upload-url',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Get a presigned URL for uploading a file',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['fileName', 'contentType'],
          properties: {
            fileName: { type: 'string', minLength: 1 },
            contentType: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              key: { type: 'string' },
              expiresIn: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<GetUploadUrlRequest>, reply: FastifyReply) => {
      const { fileName, contentType } = request.body;

      if (!fileName || fileName.trim() === '') {
        throw AppError.validation('File name is required');
      }

      if (!contentType || contentType.trim() === '') {
        throw AppError.validation('Content type is required');
      }

      const result = await documentService.getUploadUrl(request.user!.orgId, fileName, contentType);

      return reply.status(200).send(result);
    }
  );

  /**
   * POST /api/documents
   * Create a new document record (after file upload).
   * Requirements: 7.2, 7.3
   */
  fastify.post<CreateDocumentRequest>(
    '/',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Create a new document record',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['title', 'file_name', 'file_path'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            category: { type: 'string', maxLength: 100, nullable: true },
            file_name: { type: 'string', minLength: 1, maxLength: 255 },
            file_type: { type: 'string', enum: ['PDF', 'TXT', 'MD', 'DOCX'], nullable: true },
            file_path: { type: 'string', minLength: 1 },
            status: {
              type: 'string',
              enum: ['indexed', 'processing', 'error'],
              default: 'processing',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              title: { type: 'string' },
              category: { type: 'string', nullable: true },
              file_name: { type: 'string' },
              file_type: { type: 'string', nullable: true },
              file_path: { type: 'string' },
              status: { type: 'string' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              details: { type: 'array' },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<CreateDocumentRequest>, reply: FastifyReply) => {
      const data = validateSchema(createDocumentSchema, request.body);

      const document = await documentService.createDocument(data, request.user!.orgId);

      return reply.status(201).send(document);
    }
  );

  /**
   * PUT /api/documents/:id
   * Update an existing document.
   * Requirements: 7.4
   */
  fastify.put<UpdateDocumentRequest>(
    '/:id',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Update a document',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            category: { type: 'string', maxLength: 100, nullable: true },
            status: { type: 'string', enum: ['indexed', 'processing', 'error'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              title: { type: 'string' },
              category: { type: 'string', nullable: true },
              file_name: { type: 'string' },
              file_type: { type: 'string', nullable: true },
              file_path: { type: 'string' },
              status: { type: 'string' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<UpdateDocumentRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);
      const data = validateSchema(updateDocumentSchema, request.body);

      const document = await documentService.updateDocument(id, data, request.user!.orgId);

      return reply.status(200).send(document);
    }
  );

  /**
   * PATCH /api/documents/:id/status
   * Update document status.
   * Requirements: 7.5
   */
  fastify.patch<UpdateDocumentStatusRequest>(
    '/:id/status',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Update document status',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['indexed', 'processing', 'error'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<UpdateDocumentStatusRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);
      const status = validateSchema(documentStatusSchema, request.body.status);

      const document = await documentService.updateDocumentStatus(id, status, request.user!.orgId);

      return reply.status(200).send(document);
    }
  );

  /**
   * DELETE /api/documents/:id
   * Delete a document and its S3 file.
   * Requirements: 7.5
   */
  fastify.delete<DeleteDocumentRequest>(
    '/:id',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Delete a document',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: {
            type: 'null',
            description: 'Document deleted successfully',
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<DeleteDocumentRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);

      await documentService.deleteDocument(id, request.user!.orgId);

      return reply.status(204).send();
    }
  );
}

/**
 * File Routes
 * REST API endpoints for file storage operations with S3 integration.
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fileService } from '../services/file.service.js';
import { authenticate, requireModifyAccess } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { ZodError } from 'zod';

/**
 * Validation schemas
 */
const uploadUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  contentType: z.string().min(1, 'Content type is required'),
});

const fileKeyParamSchema = z.object({
  key: z.string().min(1, 'File key is required'),
});

/**
 * Request types for route handlers
 */
interface GetUploadUrlRequest {
  Body: {
    fileName: string;
    contentType: string;
  };
}

interface GetDownloadUrlRequest {
  Params: { key: string };
}

interface DeleteFileRequest {
  Params: { key: string };
}

interface GetFileMetadataRequest {
  Params: { key: string };
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
 * Register file routes on the Fastify instance.
 * All routes require authentication and enforce organization-based file isolation.
 */
export async function fileRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/files/upload-url
   * Get a presigned URL for uploading a file to S3.
   * Files are stored with organization_id prefix for isolation.
   * Requirements: 12.1, 12.3
   */
  fastify.post<GetUploadUrlRequest>(
    '/upload-url',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Get a presigned URL for uploading a file to S3',
        tags: ['Files'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['fileName', 'contentType'],
          properties: {
            fileName: { type: 'string', minLength: 1, description: 'Original file name' },
            contentType: { type: 'string', minLength: 1, description: 'MIME type of the file' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'Presigned upload URL' },
              key: { type: 'string', description: 'S3 key for the file' },
              expiresIn: { type: 'integer', description: 'URL expiration time in seconds' },
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
    async (request: FastifyRequest<GetUploadUrlRequest>, reply: FastifyReply) => {
      const { fileName, contentType } = validateSchema(uploadUrlSchema, request.body);

      const result = await fileService.getUploadUrl(request.user!.orgId, fileName, contentType);

      return reply.status(200).send(result);
    }
  );

  /**
   * GET /api/files/:key
   * Get a presigned URL for downloading a file from S3.
   * Validates that the file belongs to the user's organization.
   * Requirements: 12.2, 12.3, 12.4
   */
  fastify.get<GetDownloadUrlRequest>(
    '/:key',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get a presigned URL for downloading a file from S3',
        tags: ['Files'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['key'],
          properties: {
            key: { type: 'string', minLength: 1, description: 'S3 key of the file' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'Presigned download URL' },
              key: { type: 'string', description: 'S3 key of the file' },
              expiresIn: { type: 'integer', description: 'URL expiration time in seconds' },
            },
          },
          403: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              requestId: { type: 'string' },
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
      // Decode the URL-encoded key parameter
      const key = decodeURIComponent(request.params.key);
      validateSchema(fileKeyParamSchema, { key });

      const result = await fileService.getDownloadUrl(key, request.user!.orgId);

      return reply.status(200).send(result);
    }
  );

  /**
   * GET /api/files/:key/metadata
   * Get metadata for a file in S3.
   * Validates that the file belongs to the user's organization.
   * Requirements: 12.3, 12.4
   */
  fastify.get<GetFileMetadataRequest>(
    '/:key/metadata',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get metadata for a file in S3',
        tags: ['Files'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['key'],
          properties: {
            key: { type: 'string', minLength: 1, description: 'S3 key of the file' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'S3 key of the file' },
              contentType: { type: 'string', nullable: true, description: 'MIME type of the file' },
              contentLength: { type: 'integer', nullable: true, description: 'File size in bytes' },
              lastModified: {
                type: 'string',
                nullable: true,
                description: 'Last modification timestamp',
              },
            },
          },
          403: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              requestId: { type: 'string' },
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
    async (request: FastifyRequest<GetFileMetadataRequest>, reply: FastifyReply) => {
      // Decode the URL-encoded key parameter
      const key = decodeURIComponent(request.params.key);
      validateSchema(fileKeyParamSchema, { key });

      const metadata = await fileService.getFileMetadata(key, request.user!.orgId);

      return reply.status(200).send(metadata);
    }
  );

  /**
   * DELETE /api/files/:key
   * Delete a file from S3.
   * Validates that the file belongs to the user's organization.
   * Requirements: 12.3, 12.4
   */
  fastify.delete<DeleteFileRequest>(
    '/:key',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Delete a file from S3',
        tags: ['Files'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['key'],
          properties: {
            key: { type: 'string', minLength: 1, description: 'S3 key of the file' },
          },
        },
        response: {
          204: {
            type: 'null',
            description: 'File deleted successfully',
          },
          403: {
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
    async (request: FastifyRequest<DeleteFileRequest>, reply: FastifyReply) => {
      // Decode the URL-encoded key parameter
      const key = decodeURIComponent(request.params.key);
      validateSchema(fileKeyParamSchema, { key });

      await fileService.deleteFile(key, request.user!.orgId);

      return reply.status(204).send();
    }
  );
}

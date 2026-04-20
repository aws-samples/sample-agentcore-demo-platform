# =============================================================================
# Dockerfile for Super Agent Backend
# Multi-stage build for optimized production image
# Requirements: 1.5
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# Install all dependencies including devDependencies for building
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2: Builder
# Build the TypeScript application and generate Prisma client
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY package.json package-lock.json tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Production
# Minimal production image with only runtime dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

WORKDIR /app

# Install OpenSSL for Prisma and curl for health checks
RUN apk add --no-cache openssl curl

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 backend

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Install Claude Code CLI globally so the binary is available on PATH
# Required by ClaudeAgentService to spawn Claude Code subprocesses
RUN npm install -g @anthropic-ai/claude-code

# Create workspace directory for agent workspaces
RUN mkdir -p /app/workspaces && chown backend:nodejs /app/workspaces

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Set ownership to non-root user
RUN chown -R backend:nodejs /app

# Switch to non-root user
USER backend

# Expose application port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Health check - uses the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]

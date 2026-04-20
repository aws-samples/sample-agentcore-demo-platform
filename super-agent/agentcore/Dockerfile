# Super Agent — AgentCore Runtime Container
# Runs Claude Agent SDK inside AWS Bedrock AgentCore.
# Implements the AgentCore HTTP protocol (POST /invocations + GET /ping).

FROM public.ecr.aws/docker/library/node:22-slim
WORKDIR /app

# System dependencies for Claude Code CLI + Python for AgentCore MCP tools
RUN apt-get update && apt-get install -y \
    curl git unzip python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install uv/uvx for running AgentCore MCP server (Browser + Code Interpreter tools)
RUN pip3 install --break-system-packages uv

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Claude Code Bedrock configuration
ENV CLAUDE_CODE_USE_BEDROCK=1 \
    ANTHROPIC_MODEL=us.anthropic.claude-opus-4-6-v1 \
    WORKSPACE_S3_REGION=us-west-2

# Install Node.js dependencies (include dev for TypeScript build)
COPY package*.json ./
RUN npm install

# Build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Create workspace and user directories (node user is UID 1000 in base image)
RUN mkdir -p /workspace
RUN mkdir -p /home/node/.claude/skills
RUN chown -R node:node /workspace /home/node/.claude /app

# Run as non-root
USER node
WORKDIR /workspace

# AgentCore protocol requires port 8080
EXPOSE 8080

CMD ["node", "/app/dist/index.js"]

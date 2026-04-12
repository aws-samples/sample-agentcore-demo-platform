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
# ANTHROPIC_MODEL is set at runtime by deploy script based on region
ENV CLAUDE_CODE_USE_BEDROCK=1

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
RUN mkdir -p /home/node/.aws
RUN chown -R node:node /workspace /home/node/.claude /home/node/.aws /app

# Run as non-root
USER node
WORKDIR /workspace

# AgentCore protocol requires port 8080
EXPOSE 8080

# Entrypoint: write ~/.aws/config from AWS_REGION env var at startup,
# then run the app. This ensures boto3 (used by MCP tools like Browser)
# picks up the correct region even if AWS_REGION/AWS_DEFAULT_REGION are
# not respected by all code paths.
CMD ["sh", "-c", "echo '[default]\nregion = '${AWS_REGION:-us-west-2} > /home/node/.aws/config && exec node /app/dist/index.js"]

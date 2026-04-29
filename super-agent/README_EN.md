# Super Agent

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Amazon Bedrock](https://img.shields.io/badge/Amazon%20Bedrock-Claude-FF9900?logo=amazon-web-services&logoColor=white)](https://aws.amazon.com/bedrock/)
[![AgentCore](https://img.shields.io/badge/AgentCore-Runtime-232F3E?logo=amazon-web-services&logoColor=white)](https://aws.amazon.com/bedrock/agentcore/)

**Give every business process its own AI employee.**

Super Agent is an enterprise multi-agent platform that turns business knowledge into standardized SOPs, then hatches autonomous AI agents from those SOPs. Chain multiple agents together with visual workflows to build automated business pipelines — no code required.

> 📖 [中文文档](README.md)

---

## Architecture

```
User → CloudFront (HTTPS)
         ├── /           → S3 Frontend (React SPA, OAC)
         ├── /api/*      → ALB → ECS Fargate (Backend API)
         └── /health     → ALB → ECS Fargate

Backend (ECS Fargate ARM64):
  ├── Aurora PostgreSQL Serverless v2 (data)
  ├── ElastiCache Redis 7.1 (queues, cache)
  ├── S3 (avatars, workspaces, skills)
  └── Bedrock AgentCore Runtime (agent execution)
        │
        └── Per-session microVM:
              Claude Code CLI + Claude Agent SDK
              ├── Main agent (reads CLAUDE.md, scope context)
              ├── Subagents (.claude/agents/*.md — HR, Sales, Marketing, etc.)
              ├── Skills (.claude/skills/ — skill-creator, app-publisher, etc.)
              ├── Browser Tool (Web Bot Auth, public network)
              └── Code Interpreter (public network, internet access)
```

### How AgentCore Works

There is **one AgentCore Runtime** (infrastructure) but **many agents** (defined in the database). When a user chats:

1. Backend prepares a workspace with the selected scope's `CLAUDE.md`, agent definitions, skills, and MCP server configs
2. Backend uploads the workspace to S3
3. Backend invokes the AgentCore Runtime via `InvokeAgentRuntimeCommand`
4. AgentCore spins up an isolated microVM, downloads the workspace from S3
5. Claude Code CLI runs with `permissionMode: bypassPermissions`, reads `CLAUDE.md` to understand its role
6. Claude uses the `Task` tool to delegate to subagents (defined as `.claude/agents/*.md` files)
7. File changes are synced back to S3 via SDK hooks
8. SSE stream flows back through the backend to the user's browser

The same runtime serves all business scopes (Sales, HR, IT, Marketing, etc.) — differentiation comes from the workspace content, not the runtime.

---

## Core Features

### 💬 Chat — Real-time AI Conversations
- Streaming output with session resume and multi-turn context
- Automatic workspace setup: each conversation loads the agent's skills, knowledge base, and tools
- Multi-channel: Web, Slack, Discord, Telegram, DingTalk, Feishu
- Chat-as-app: generate Mini-SaaS applications from conversations and publish to the internal marketplace

### 🔗 Workflow — Multi-Agent Automation
- Visual DAG editor with drag-and-drop (Agent, Action, Condition, Document, Code nodes)
- Agentic execution: entire workflow driven by a single AI session maintaining full context
- Workflow Copilot: describe a process in natural language, AI generates the workflow plan
- Triggers: cron schedules, webhooks, manual execution
- Execution tracking: real-time progress, history, node-level status

### 🏢 Business Scopes — Domain Isolation
- Separate environments per business domain (Sales, HR, IT, etc.)
- Each scope has its own agents, skills, knowledge base, MCP tools, and memories
- Scope-level memories accumulate over time — agents get smarter with use

### 🧩 Skills & Tools
- Built-in skills: `skill-creator`, `app-publisher`, `app-builder`
- Skills marketplace with GitHub integration
- OpenAPI Spec auto-conversion to skills
- MCP (Model Context Protocol) connectors for 40+ external tools
- AgentCore Browser (Web Bot Auth) and Code Interpreter (public internet)

### 🏗️ Enterprise Features
- Multi-tenant with organization-level data isolation
- Langfuse integration for full-chain observability
- Agent activity metrics and daily aggregation
- API keys, webhooks, audit logging
- Cognito SSO or local JWT authentication

---

## External System Integration

### Inbound — Trigger Agents from External Events
- **IM Channels**: Slack, Discord, Telegram, DingTalk, Feishu — employees chat with agents in their daily tools
- **Webhooks**: External systems (CRM, ticketing, CI/CD) trigger workflows via HTTP
- **Cron Schedules**: Time-based triggers with timezone support
- **REST API**: Programmatic workflow execution with API key auth

### Outbound — Agents Call External Systems
- **OpenAPI Spec → Skill**: Upload a Swagger/OpenAPI spec, auto-generate callable skills
- **MCP Connectors**: Standardized integration with 40+ tools (Salesforce, Jira, Slack, etc.)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, XY Flow |
| Backend | Fastify, TypeScript, Prisma ORM, BullMQ |
| AI | Amazon Bedrock (Claude Sonnet 4.6), Claude Agent SDK |
| Agent Runtime | Amazon Bedrock AgentCore (containerized Claude Code) |
| Database | Aurora PostgreSQL Serverless v2 |
| Cache | ElastiCache Redis 7.1 |
| Storage | S3 (documents, avatars, skills, workspaces) |
| CDN | CloudFront + S3 (OAC, no public access) |
| Compute | ECS Fargate (ARM64) |
| Auth | AWS Cognito or local JWT |
| Infra | AWS CDK + one-click deploy script |

---

## Project Structure

```
super-agent/
├── frontend/          # React SPA (Vite, TypeScript, Tailwind)
├── backend/           # Fastify API server (TypeScript, Prisma)
│   ├── src/           # Application code
│   ├── prisma/        # Schema, migrations, seed scripts
│   └── skills/        # Built-in skills (skill-creator, app-publisher, app-builder)
├── agentcore/         # AgentCore Runtime container
│   └── src/           # HTTP server + Claude Agent SDK runner
├── infra/             # AWS CDK stack + deploy/destroy scripts
│   ├── lib/           # CDK stack definition
│   └── scripts/       # deploy.sh, destroy.sh
└── document/          # User manual and documentation
```

---

## Deployment

### One-Click Deploy to AWS

```bash
cd super-agent/infra
./scripts/deploy.sh --region us-east-1
```

Deploys everything in ~25 minutes:
- VPC, Aurora PostgreSQL, ElastiCache Redis, ECS Fargate, ALB, CloudFront, S3
- AgentCore Runtime + Browser (Web Bot Auth) + Code Interpreter (public internet)
- Database migrations + seed data (demo org, agents, scopes, skills)
- Frontend build + S3 sync + CloudFront invalidation

Options:
```bash
./scripts/deploy.sh --region ap-southeast-1       # Singapore
./scripts/deploy.sh --stack MyStack --region us-west-2
./scripts/deploy.sh --skip-infra                   # Redeploy app only
```

See [infra/README.md](infra/README.md) for the full deployment guide.

### Teardown

```bash
cd super-agent/infra
./scripts/destroy.sh --region us-east-1
```

### Local Development

```bash
# Backend
cd backend
cp .env.example .env    # Edit with your config
npm install
npx prisma generate
npx prisma migrate dev
npm run dev              # http://localhost:3000

# Frontend
cd frontend
npm install
npm run dev              # http://localhost:5173
```

### Default Credentials

After deployment: `admin@example.com` / `admin123`

---

## License

MIT

# Super Agent

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Amazon Bedrock](https://img.shields.io/badge/Amazon%20Bedrock-Claude-FF9900?logo=amazon-web-services&logoColor=white)](https://aws.amazon.com/bedrock/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Give every business process its own AI employee.**

Super Agent is an enterprise-grade multi-agent platform that helps organizations codify business knowledge into standardized SOPs, then hatch autonomous virtual employees (AI Agents) from those SOPs. By chaining multiple agents together with visual workflows, enterprises can build automated business pipelines like building blocks — no coding required, no changes to existing systems.

> 📖 [中文文档](README.md)

---

## Product Positioning

### The Problem with Existing Solutions

Traditional RPA software can only handle structured, rule-based tasks. Implementing a single business process requires a professional development team to configure every node and rule step by step, taking weeks or even months. Next-generation workflow platforms like Dify and Coze have introduced AI capabilities, but fundamentally remain a "tech builds, business uses" model — each node requires precise configuration of API parameters, data mappings, and conditional expressions that business users cannot complete independently.

The bigger problem: once a workflow is deployed, the cost of modifying and evolving it when business needs change is nearly equivalent to reimplementing from scratch. Enterprises must continuously invest expensive technical resources to maintain these "rigid" processes.

### How Super Agent Is Different

Super Agent is a modern enterprise-grade multi-tenant agent platform that non-technical users can operate directly:

- **SOP-Driven**: Business users import existing SOP documents or use natural language to have agents auto-generate SOPs, then hatch complete workflows from SOPs with one click — no technical parameters to configure
- **Low Implementation Cost**: Nodes describe intent in natural language (e.g., "Create an opportunity in CRM") rather than manually configuring URLs, Headers, and Body, dramatically lowering the barrier to build and modify
- **Autonomous Evolution**: Through the Memory mechanism, agents continuously accumulate experience during task execution, autonomously optimizing decisions and behavior — the system gets smarter with use, not more rigid

Super Agent's core philosophy:

> **Define Business → Create Agents → Solidify Workflows → Continuously Evolve**

Enterprises divide business domains through Business Scopes (Sales, HR, IT Operations, etc.), define dedicated knowledge bases, SOPs, and toolsets within each domain, then create AI Agents equipped with these capabilities. Multiple Agents collaborate through Workflows, forming reusable, monitorable, and self-iterating intelligent business pipelines.

---

## Core Value

### 🧠 From Experience to Assets: Business Knowledge Never Lost Again
An enterprise's most valuable asset is the business experience accumulated in veteran employees' minds. Super Agent transforms scattered experience documents, SOPs, and best practices into AI-comprehensible structured knowledge through Business Scopes + Knowledge Base systems, letting every newly created agent stand on the shoulders of "veteran employees."

### 🤖 From SOP to Virtual Employees: One-Click AI Team Hatching
Business users import SOPs or describe business scenarios in natural language, and the system automatically generates AI Agents with professional capabilities — complete with independent role definitions, skill packages, and tool permissions, just like hiring a pre-trained professional employee.

### 🔗 From Solo to Collaboration: Workflows Chain Multiple Agents
A single Agent has limited capabilities, but through the visual Workflow Editor, multiple Agents can be orchestrated into complete business processes. Supports scheduled triggers, Webhook triggers, and conditional branching, enabling complex cross-department collaboration to run automatically.

### 🧩 From Closed to Open: Infinitely Expandable Capabilities
Through the Skills marketplace, MCP (Model Context Protocol) tool connectors, and OpenAPI Spec auto-conversion to Skills, Agents can seamlessly integrate with existing enterprise toolchains, with capability boundaries continuously expanding as more systems are connected.

### 💬 From Tool to Product: Chat as Mini-SaaS
Generate Mini-SaaS applications from conversations using natural language and publish them to the enterprise app marketplace, enabling non-technical users to use AI capabilities with one click — Chat itself is an application builder.

---

## Feature Overview

All of Super Agent's capabilities revolve around two core interaction paradigms:

### 💬 Chat: Real-Time Conversations with AI Employees

Chat is the most direct way users interact with Agents — like talking to a colleague, asking questions, giving instructions, and collaborating on tasks with AI employees.

| Capability | Description |
| --- | --- |
| **Real-Time Conversation** | Streaming output, session resume, multi-turn context retention |
| **Automatic Workspace Setup** | Each conversation automatically loads the Agent's skill packages, knowledge base, and toolchain — Agents work out of the box |
| **Multi-Channel Reach** | Beyond the web interface — supports direct conversations via Slack, DingTalk, Feishu, and other IM channels (see External System Integration) |
| **Chat as Mini-SaaS** | Generate Mini-SaaS applications from conversations using natural language and publish to the enterprise app marketplace — non-technical users can use them with one click |

![Screenshot](images/Screenshot-chat.png)

### 🔗 Workflow: Multi-Agent Automated Pipelines

Workflow is the evolution of Chat — when a task requires multiple Agents to collaborate in sequence, visual workflows chain them together.

| Capability | Description |
| --- | --- |
| **Visual DAG Editor** | Drag-and-drop construction supporting Agent, Action, Condition, Document, Code, and other node types |
| **Agentic Execution Engine** | The entire Workflow is driven by a single AI session maintaining full context — nodes are planning components, not execution units |
| **Workflow Copilot** | Describe business processes in natural language, AI auto-generates Workflow plans with support for multi-turn iterative refinement |
| **Trigger Mechanisms** | Scheduled triggers, Webhook triggers, manual triggers — business processes run on-demand or automatically |
| **Execution Tracing** | Real-time progress visualization, execution history, node-level status tracking |

![Screenshot](images/Screenshot-workflow.png)

### 🧩 Extended Capabilities Around the Dual Core

The following capabilities serve both Chat and Workflow, providing Agents with knowledge, skills, and runtime environments:

| Capability | Description |
| --- | --- |
| **Business Scope** | Divide independent environments by business domain, isolating knowledge, skills, tools, and permissions |
| **Agent Management** | Create and configure AI agents — define roles, system prompts, model parameters, and skill combinations |
| **Skills Marketplace** | Reusable skill packages (including API Spec auto-conversion to Skills), supporting both Scope-level and Agent-level binding |
| **MCP Integration** | Standardized integration with external tools via Model Context Protocol (see External System Integration) |
| **Knowledge Base** | RAG-based document management providing dedicated knowledge retrieval for each Scope |
| **App Marketplace** | Package Agent capabilities as internal applications — publish, rate, and run with one click |
| **Briefing** | Scheduled business scope briefing generation, automatically summarizing key information |
| **Multi-Tenancy & Developer Tools** | Organization-level isolation, role permissions, API Keys, Webhooks, audit logs |

---

## External System Integration

Super Agent provides multiple ways to connect Chat and Workflow with existing enterprise systems:

### Inbound: External Events Trigger Agents

- **IM Channel Integration**: Built-in adapters for five major platforms — Slack, Discord, Telegram, DingTalk, and Feishu. Employees can chat with Agents directly in their daily communication tools. Messages are automatically routed to the corresponding Business Scope and session, following the exact same Chat processing pipeline as the web interface
- **Webhook Triggers**: Create dedicated Webhook endpoints for Workflows. External systems (CRM, ticketing systems, CI/CD pipelines) can trigger workflow execution via HTTP calls, with support for variable parameters and signature verification
- **Scheduled Triggers**: Cron expression-based scheduling with timezone configuration, suitable for daily report generation, periodic data synchronization, routine inspections, and similar scenarios
- **OpenAPI Calls**: Standardized REST API (API Key authentication) enabling external systems to programmatically trigger Workflow execution, query execution status, retrieve results, and abort execution

### Outbound: Agents Call External Systems

- **OpenAPI Spec Auto-Conversion to Skills**: Upload OpenAPI/Swagger specification files (JSON or YAML), and the system automatically parses endpoints, parameters, and authentication methods to generate Scope-level shared skills. Agents can directly use these skills to call external APIs in conversations or workflows without manual configuration
- **MCP Tool Connectors**: Standardized integration with 40+ external tools (Salesforce, Jira, Slack, WeCom, etc.) via Model Context Protocol. Each connector can be bound to a Business Scope, and all Agents within that scope automatically gain calling capabilities

---

## Enterprise-Grade Observability & Audit

As an enterprise-facing multi-tenant, multi-role agent system, Super Agent is designed with enterprise software audit and operational observability requirements in mind:

- **Full-Chain Tracing**: Integrated with the Langfuse observability platform, every conversation automatically records the complete Agent reasoning process, tool call chains, and sub-Agent delegation records. Supports retrospective analysis by session, user, and Agent dimensions — "every step is explainable"
- **Agent Activity Metrics**: Real-time capture of sub-Agent invocations, Skill usage, tool calls, errors, and other key events, automatically aggregated into daily metric summaries. Supports querying activity trends by Agent and time range, giving managers clear visibility into each agent's workload and health status
- **Workflow Execution Audit**: Every workflow execution is fully traceable, with each node's state transitions (Waiting → Executing → Complete/Failed) available for review. Supports execution history queries and error localization
- **Request-Level Logging**: Every operation automatically generates a unique trace identifier spanning the complete call chain, facilitating troubleshooting and cross-system correlation
- **Multi-Tenant Data Isolation**: All data (conversations, execution records, metrics, events) is strictly isolated by organization, ensuring data invisibility between tenants

---

## Tech Stack

| Layer          | Technology                                                        |
| -------------- | ----------------------------------------------------------------- |
| Backend        | Fastify, TypeScript, Prisma ORM, PostgreSQL, Redis (BullMQ)      |
| Frontend       | React 19, Vite, TypeScript, Tailwind CSS, React Router, XY Flow  |
| AI             | Amazon Bedrock (Claude), Claude Agent SDK, Langfuse observability |
| Storage        | AWS S3 (documents, avatars, skills)                               |
| Auth           | AWS Cognito                                                       |
| Infrastructure | AWS CDK (EC2, Aurora Serverless v2, S3, Cognito, CloudWatch)      |
| Containerization | Docker, Docker Compose                                          |

## Prerequisites

- Node.js >= 18
- Docker & Docker Compose
- AWS account with Bedrock access (Claude models)
- PostgreSQL 15+ (or use Docker Compose)
- Redis 7+ (or use Docker Compose)

## Getting Started

> 📦 To deploy Super Agent to AWS, see the [Deployment Guide](infra/README.md).
> 📖 For platform usage tutorials, see the [User Manual](document/user-manual.md).

Local development environment setup:

### 1. Clone the repository

```bash
git clone <repository-url>
cd super-agent
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

The backend runs on `http://localhost:3000` by default.

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Edit .env with your configuration
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` by default.

## License

MIT

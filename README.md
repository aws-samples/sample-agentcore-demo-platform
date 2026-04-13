# AgentCore Demo Platform

[中文文档](README.zh-CN.md)

> A scenario-driven showcase platform for Amazon Bedrock AgentCore, demonstrating product capabilities, architecture patterns, and deployment best practices.

## Overview

This project serves as a unified demo portal for Amazon Bedrock AgentCore, designed for AWS Field Teams (SA · BD · CSM). Demos are organized across three dimensions:

- **Enterprise Function Scenarios**: Agent applications by business function — Marketing, Sales, Customer Service, Legal, R&D, IT, HR, and more — spanning front office, middle office, and back office
- **Industry Scenarios**: Vertical Agent solutions for specific industries — Gaming, Retail, Finance, Healthcare, Automotive, Manufacturing, Media, Education
- **Cross-Industry Scenarios**: Core AI capabilities that apply across industries — Payment & Risk Control, Intelligent Search, Content Generation, Document Processing

## Repository Structure

```
├── demo/                    # Demo Platform frontend (React + Vite static site)
│   ├── src/
│   │   ├── pages/           # Home, Detail, Architecture pages
│   │   ├── components/      # Navbar, architecture diagrams, AWS icons
│   │   ├── data/            # Demo data definitions
│   │   │   ├── projects.json    # Static data for all demos
│   │   │   └── projects.ts      # Type definitions and data exports
│   │   └── styles/          # Global styles + CSS variables + theming
│   ├── package.json
│   └── vite.config.ts
│
└── super-agent/             # Super Agent multi-agent platform
    ├── backend/             # Fastify + Prisma + PostgreSQL
    ├── frontend/            # React 19 + Tailwind
    ├── agentcore/           # AgentCore Runtime container
    ├── infra/               # AWS CDK infrastructure
    └── document/            # User manuals and docs
```

## Getting Started

### Demo Platform (Frontend)

```bash
cd demo
npm install
npm run dev
```

Visit `http://localhost:5173`.

### Super Agent (Multi-Agent Platform)

See [super-agent/README.md](super-agent/README.md) for the full deployment guide.

## Tech Stack

### Demo Platform

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8 |
| Routing | react-router-dom v7 |
| Styling | Pure CSS (no UI framework), dark/light theme support |
| Data | Static data (`demo/src/data/projects.json`) |

### Super Agent

| Layer | Technology |
|---|---|
| Backend | Fastify, TypeScript, Prisma ORM, PostgreSQL, Redis (BullMQ) |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS |
| AI | Amazon Bedrock (Claude), Claude Agent SDK, Langfuse |
| Infrastructure | AWS CDK (EC2, Aurora Serverless v2, S3, Cognito) |

## Scenario Taxonomy

### Enterprise Functions

| Tier | Functions |
|---|---|
| Front Office | Marketing, Sales, Customer Service, PR |
| Middle Office | Operations, Logistics, Supply Chain, R&D |
| Back Office | Finance, HR, IT |

### Industry Verticals

Gaming, Retail, Automotive, Manufacturing, Finance, Healthcare, Media, Education

### Cross-Industry Capabilities

Payment & Risk Control, Intelligent Search, Content Generation & Moderation, Document Processing

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](LICENSE) file.

# AgentCore Demo Platform

[English](README.md)

> 场景驱动的 Agent 应用展示平台，展示 Amazon Bedrock AgentCore 产品能力、架构模式与部署最佳实践。

## 项目背景

本项目是 Amazon Bedrock AgentCore 的演示展示平台，面向 AWS Field Team（SA · BD · CSM），提供 Demo 的统一入口，按三大维度组织：

- **企业职能场景**：按企业职能划分的 Agent 应用（营销、销售、客服、法务、研发、IT、HR 等），涵盖企业前台、中台、后台全链路
- **行业应用场景**：面向特定行业的垂直 Agent 解决方案（游戏、零售、金融、医疗、汽车、制造、媒体、教育）
- **跨行业场景**：跨行业的 AI 核心能力（支付风控、智能搜索、内容生成、文档处理）

## 仓库结构

```
├── demo/                    # Demo Platform 前端（React + Vite 静态站点）
│   ├── src/
│   │   ├── pages/           # 首页、详情页、架构页
│   │   ├── components/      # Navbar、架构图、AWS 图标等
│   │   ├── data/            # Demo 数据定义
│   │   │   ├── projects.json    # 所有 Demo 的静态数据
│   │   │   └── projects.ts      # 类型定义与数据导出
│   │   └── styles/          # 全局样式 + CSS 变量 + 主题
│   ├── package.json
│   └── vite.config.ts
│
└── super-agent/             # Super Agent 多智能体平台
    ├── backend/             # Fastify + Prisma + PostgreSQL
    ├── frontend/            # React 19 + Tailwind
    ├── agentcore/           # AgentCore Runtime 容器
    ├── infra/               # AWS CDK 基础设施
    └── document/            # 用户手册等文档
```

## 快速开始

### Demo Platform（前端展示站点）

```bash
cd demo
npm install
npm run dev
```

访问 `http://localhost:5173`。

### Super Agent（多智能体平台）

参见 [super-agent/README.md](super-agent/README.md) 获取完整的部署指南。

## 技术栈

### Demo Platform

| 层 | 技术 |
|---|---|
| 前端 | React 19, TypeScript, Vite 8 |
| 路由 | react-router-dom v7 |
| 样式 | 纯 CSS（无 UI 框架），支持深色/浅色主题 |
| 数据 | 静态数据（`demo/src/data/projects.json`） |

### Super Agent

| 层 | 技术 |
|---|---|
| 后端 | Fastify, TypeScript, Prisma ORM, PostgreSQL, Redis (BullMQ) |
| 前端 | React 19, Vite, TypeScript, Tailwind CSS |
| AI | Amazon Bedrock (Claude), Claude Agent SDK, Langfuse |
| 基础设施 | AWS CDK (EC2, Aurora Serverless v2, S3, Cognito) |

## 场景分类体系

### 企业职能场景

| 层级 | 职能 |
|---|---|
| 企业前台 | 营销/广告、销售、客服、PR |
| 企业中台 | 运营辅助、物流管理、供应链、研发 |
| 企业后台 | 财务、HR、IT |

### 行业应用场景

游戏、零售、汽车、制造、金融、医疗、媒体、教育

### 跨行业场景

支付风控、智能搜索、内容生成/审核、文档信息处理

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](LICENSE) file.

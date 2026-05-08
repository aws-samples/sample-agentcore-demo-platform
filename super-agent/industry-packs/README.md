# Industry Packs — 行业智能体包

## 概述

Industry Pack 是"企业Agent大赏"的内容生产引擎。每个 Pack 包含一个完整行业的智能体定义，包括：
- 多个业务场景（Scope）
- 每个场景下的多个协作 Agent
- 每个 Agent 的 Skills（能力模块）
- 业务工作流（Workflow）
- 标准操作流程（SOP）
- 数字孪生（Digital Twin）

## 架构关系

```
行业场景汇总.md (场景蓝图)
       ↓
scenario-registry.json (结构化索引)
       ↓
template-input.json (Pack 生成输入)
       ↓ super-agent-batch-v2 生成
manifest.json + scopes/ (完整 Pack)
       ↓ import-to-showcase.ts 导入
Showcase DB (showcase_industries/domains/cases)
       ↓
ShowcasePage.tsx (企业Agent大赏 UI)
       ↓ 用户点击运行
AgentCore Runtime (实际执行)
```

## 目录结构

```
industry-packs/
├── scenario-registry.json          # 场景注册表（Source of Truth）
├── import-to-showcase.ts           # Pack → Showcase 导入脚本
├── README.md                       # 本文件
│
├── industry-pack-customer-service/ # ✅ 已生成
├── industry-pack-sales-management/ # ✅ 已生成
├── industry-pack-finance-risk/     # ✅ 已生成
├── industry-pack-healthcare/       # ✅ 已生成
├── industry-pack-human-resources/  # ✅ 已生成
├── industry-pack-it-operations/    # ✅ 已生成
├── industry-pack-legal-compliance/ # ✅ 已生成
│
├── industry-pack-marketing/        # 📝 已规划（template-input.json）
├── industry-pack-operations/       # 📝 已规划
├── industry-pack-content/          # 📝 已规划
├── industry-pack-voice/            # 📝 已规划
├── industry-pack-video/            # 📝 已规划
└── industry-pack-iot/              # 📝 已规划
```

## Pack 生命周期

### 1. 规划阶段
创建 `template-input.json`，定义：
- 行业基本信息（名称、图标、标签）
- 业务场景种子（scopeSeeds）：场景名称、描述、业务规则
- 数字孪生种子（twinSeeds）：行业专家角色定义
- 行业上下文（industryContext）：趋势、指标、市场特点

### 2. 生成阶段
运行 `super-agent-batch-v2` 生成器：
```bash
# 生成完整 Pack（master-plan → scopes → agents → skills → workflow → sop）
npx tsx scripts/generate-industry-pack.ts --input industry-packs/industry-pack-marketing/template-input.json
```

生成后产出：
- `manifest.json` — Pack 元数据和统计
- `master-plan.json` — 详细的行业分析和场景规划
- `scopes/` — 每个场景的完整定义
  - `agents/` — Agent 定义（system_prompt + skills）
  - `skills/` — Skill 定义（SKILL.md）
  - `workflow/` — 工作流定义
  - `sop/` — 标准操作流程
  - `memories/` — 初始记忆

### 3. 导入阶段
运行导入脚本将 Pack 注册到 Showcase：
```bash
npx tsx industry-packs/import-to-showcase.ts
```

导入逻辑：
- 读取所有 `industry-pack-*` 目录
- 从 `template-input.json` 提取行业和场景信息
- 如果有 `manifest.json`，使用更丰富的 Agent 级别信息
- Upsert 到 `showcase_industries` / `showcase_domains` / `showcase_cases` 表
- 幂等操作，可重复运行

### 4. 展示阶段
用户在"企业Agent大赏"页面：
1. 选择行业（Industry Tab）
2. 浏览场景（Domain Section）
3. 点击具体案例（Case Card）
4. 自动发送 `initial_prompt` 启动 Agent 对话

## 如何新增一个行业 Pack

1. 在 `scenario-registry.json` 中添加行业条目
2. 创建 `industry-pack-{id}/template-input.json`
3. 运行生成器生成完整 Pack
4. 运行 `import-to-showcase.ts` 导入到 Showcase
5. 在前端验证展示效果

## 数据来源

- PPT: `0424 整体PPT.pptx`（Amazon Bedrock AgentCore 应用场景全景图）
- 文档: `docs/行业场景汇总.md`（从 PPT 提取的结构化场景信息）
- 案例: AWS 官方博客、客户案例、内部实践

# Super Agent 平台用户使用手册

## 1. 产品简介

Super Agent 是一个企业级 AI Agent 管理平台，帮助组织快速构建、配置和运营多个 AI 智能体。平台的核心能力包括：

- 按业务领域（Business Scope）组织 AI Agent 团队，每个 Scope 拥有独立的 Agent、技能、知识库和工作流
- 支持通过自然语言、SOP 文档或行业模板一键生成整个业务团队
- 可视化 Workflow 编辑器，支持拖拽式流程编排和实时执行监控
- 多 Agent 群聊，支持智能路由和 @mention 指定 Agent 回复
- 创建"数字分身"（Digital Twin），让 AI 模拟真人的专业知识和沟通风格
- 对接 Slack、Discord、飞书、钉钉、Telegram 等 IM 渠道
- MCP 服务器集成，扩展 Agent 的工具调用能力
- 技能市场，浏览和安装社区技能包

![Super Agent 平台整体系统架构图，展示前端、后端、Agent Runtime、AWS基础设施各组件及其交互关系](imgs/Screenshot%202026-04-01%20at%2015.39.12.png)


---

## 2. 快速开始

### 2.1 登录

打开平台地址，系统会跳转到登录页面。平台支持两种认证方式：

- Cognito 托管登录（生产环境）：通过 AWS Cognito 的 OAuth 流程登录
- 本地账号登录（开发环境）：输入邮箱和密码直接登录

首次登录后，系统会自动关联你的用户 Profile 到默认组织。

### 2.2 接受邀请

如果你收到了邀请邮件，点击邮件中的链接会跳转到邀请接受页面（`/invite/:token`），确认后即可加入对应组织。

### 2.3 第一步：创建 Business Scope

登录后进入 Dashboard，点击右上角的 "Create Team" 按钮，开始创建你的第一个业务团队。详细步骤见第 4 章。

---

## 3. Dashboard 总览

![Command Center 主界面，展示按 Team 分组的 Agent 卡片列表，包含游戏工作室、SLG Gaming Ops 等多个团队及其 Agent 状态](imgs/Screenshot%202026-04-01%20at%2015.59.31.png)


Dashboard 是平台的首页，展示组织内所有 Business Scope 和 Agent 的全局视图。

### 3.1 两种视图模式

Dashboard 提供两种视图，通过右上角的切换按钮选择：

- Classic 视图：按 Business Scope 分组展示 Agent 卡片，每个 Scope 显示名称、图标、Agent 数量，以及 Restricted/Open 访问标识。Standalone Agent（数字分身）单独归类在底部的 "Standalone Agents" 区域。
- Casino 视图：以 Command Center 风格展示全局统计数据（活跃 Agent 数、自动化任务数、SLA 合规率、活跃任务数）和 Scope 概览。

### 3.2 Dashboard 操作

- 点击 "Create Team"：进入 Business Scope 创建流程
- 点击 "Create Agent"：进入数字分身创建向导
- 点击任意 Agent 卡片：跳转到该 Agent 的详情/对话页面
- 点击 Scope 旁的盾牌图标（仅管理员可见）：打开 Scope 访问控制面板，管理成员权限和可见性设置

---

## 4. Business Scope 管理

Business Scope 是平台的核心组织单元，代表一个业务领域（如 HR、IT、Marketing）。每个 Scope 下包含一组专属的 Agent、技能、知识库、工作流和 MCP 服务器配置。

### 4.1 创建 Business Scope

点击 Dashboard 的 "Create Team" 进入创建页面，分两步完成：

![创建 Business Scope 页面：选择组织单元（部门）及 AI 生成策略](imgs/Screenshot%202026-04-01%20at%2016.03.28.png)

**第一步：选择组织单元**

从预设的部门模板中选择：Human Resources、IT & Dev、Operations、Finance、Legal，或选择 "Other" 自定义部门名称。

**第二步：选择生成策略**

平台提供三种 AI 驱动的生成方式：

1. **Generate Reference SOP using Agent**：AI 根据所选部门自动分析行业最佳实践，生成标准 SOP 和对应的 Agent 团队。适合快速启动，无需准备任何文档。

2. **Import SOP document**：上传已有的 SOP 文档（支持 PDF、DOCX、TXT），AI 会解析文档内容，自动提取流程、角色和职责，生成匹配的 Agent 团队。

3. **Build using Natural Language**：用自然语言描述你的业务场景，例如"我们是一家 50 人的电商公司，需要客服、库存管理、营销和订单履约的 Agent"，AI 会根据描述生成完整的 Scope 配置。

选择策略后点击 "Generate with AI"，系统会通过 Claude Agent SDK 流式生成 Scope 配置，包括 Agent 定义、角色分工、System Prompt 和初始技能。

### 4.2 Scope 访问控制

每个 Scope 有两种可见性模式：

- **Open**（默认）：组织内所有成员可见
- **Restricted**：仅 Scope 成员可见，需管理员手动添加成员

管理员可在 Dashboard 点击 Scope 旁的盾牌图标，打开访问控制面板：
- 切换 Open / Restricted 模式
- 添加/移除 Scope 成员
- 设置成员角色（viewer / editor / admin）

### 4.3 Scope Profile 配置

进入 Scope 详情页后，可以配置：
- 名称、描述、图标、颜色
- System Prompt（Scope 级别的全局指令）
- 关联的 MCP 服务器
- 关联的插件（Claude Code Plugins）
- IM 渠道绑定
- 知识库（Document Groups）绑定

<img src="imgs/Screenshot%202026-04-01%20at%2015.41.03.png" alt="Scope 插件管理面板，展示已安装插件列表为空及可选的热门插件（claude-mem 和 superpowers）" width="400" />


---

## 5. Standalone Agent（数字分身）

数字分身是一种特殊的 Agent，它模拟真人的专业知识、沟通风格和人格特征。与 Business Scope 下的团队 Agent 不同，数字分身是独立存在的。

### 5.1 创建数字分身

![创建数字分身第一步——Identity 身份配置页面，用户可上传头像、填写显示名称与职位、描述个人背景，并支持 AI 自动生成系统提示词](imgs/Screenshot%202026-04-01%20at%2016.03.45.png)


点击 Dashboard 的 "Create Agent" 进入四步创建向导：

**Step 1 — Identity（身份）**
- 上传照片：作为数字分身的头像
- 填写显示名称和角色/职位
- 描述自己：填写专业领域、性格特点、沟通风格等
- System Prompt：点击 "AI Generate" 按钮，AI 会根据你的描述自动生成 System Prompt；也可以手动编写

**Step 2 — Knowledge（知识）**
- 上传代表你专业知识的文档（PDF、DOC、TXT、MD、CSV）
- 系统会自动创建 Document Group 并关联到数字分身
- 这些文档将作为 RAG 知识库，供数字分身在回答问题时参考

**Step 3 — Skills（技能）**
- 技能可以在创建后通过 Skill Workshop 配置
- 此步骤为提示说明，可直接跳过

**Step 4 — Publish（发布）**
- 选择发布到 Super Agent Platform（默认开启）
- 可选绑定 IM 渠道（Slack / 飞书 / 钉钉 / Discord / Teams），填写 Channel ID 即可
- 确认摘要信息后点击 "Create Digital Twin" 完成创建

---

## 6. Agent 管理

通过左侧导航栏的 "Agents" 图标进入 Agent 列表页面。

### 6.1 Agent 列表

页面展示当前组织下所有 Agent，可按 Business Scope 筛选。每个 Agent 卡片显示：
- 头像、显示名称、角色
- 当前状态（Active / Busy / Idle / Offline）
- 所属 Business Scope

点击 Agent 卡片可查看详情面板，包含 Agent Profile、技能列表、MCP 服务器、IM 渠道绑定、Scope 记忆和智能简报等标签页。

### 6.2 Agent 配置器

点击 Agent 详情中的配置按钮，进入 Agent Configurator 页面，可编辑：

**基本信息**
- Internal Name：Agent 的内部标识符（如 `hr-assistant`）
- Display Name：用户可见的显示名称
- Role：Agent 的角色描述
- Avatar：支持上传图片、填写 URL 或使用字符
- Status：Active（启用）或 Disabled（禁用）

**AI 配置**
- System Prompt：定义 Agent 的人格、专业领域和行为规范

**能力配置**
- Operational Scope：Agent 的业务范围标签（如 Recruitment、Onboarding）
- Skills：为 Agent 添加技能，每个技能包含名称和 skill.md 指令内容

### 6.3 创建新 Agent

在 Agent 列表页面，可通过配置器的 "new" 模式手动创建 Agent，填写上述所有字段后保存即可。

### 6.4 Skill Workshop

在 Agent 配置页面点击 "Skill Workshop" 按钮，进入技能工坊。在这里可以：
- 浏览已装备的技能
- 从技能市场安装新技能
- 测试技能效果
- 编辑技能的 skill.md 指令内容

---

## 7. 对话（Chat）

通过左侧导航栏的 "Chat" 图标进入对话页面。

### 7.1 选择对话上下文

页面顶部的下拉选择器支持两种对话目标：

- **Business Scope**：选择一个 Scope，与该 Scope 下的 Agent 团队对话
- **Independent Agent**：选择一个独立 Agent（如数字分身）直接对话

选择器支持搜索，输入关键词可快速定位 Scope 或 Agent。

### 7.2 发送消息

在底部输入框输入消息，按 Enter 或点击发送按钮。支持的功能：

- 文本消息：直接输入文字
- 文件附件：点击附件图标上传文件到 Agent 工作区
- 流式响应：Agent 的回复通过 SSE 实时流式展示，包括思考过程和工具调用

### 7.3 会话管理

- 左侧面板显示历史会话列表，点击可切换会话
- 每个会话绑定到特定的 Scope 或 Agent
- 会话标题自动生成，也可手动修改

### 7.4 工作区浏览器

![对话页面示例：左侧显示历史会话列表，顶部可切换Business Scope与群聊模式，右侧工作区文件树展示Agent生成的技能文件结构](imgs/Screenshot%202026-04-01%20at%2015.40.18.png)


对话过程中，Agent 可能会在工作区中创建或修改文件。右侧面板提供：

- 文件树浏览：查看 Agent 工作区的文件结构
- 文件查看/编辑：点击文件可查看内容，支持语法高亮；切换到 Edit 模式可直接编辑并保存
- Markdown/HTML 预览：对 .md 和 .html 文件提供渲染预览
- 图片预览：直接显示图片文件
- App 预览：如果 Agent 生成了 Web 应用（如 React 项目），可在内嵌 iframe 中实时预览，支持 Vite Dev Server 自动启动
- 发布应用：预览中的应用可一键发布到 App Marketplace

### 7.5 群聊（Chat Room）

平台支持多 Agent 群聊模式：

- 创建 Chat Room 时可添加多个 Agent 作为成员
- 消息路由策略：
  - **Auto**：AI 自动分析消息内容，智能路由到最合适的 Agent
  - **Mention**：仅当用户 @mention 某个 Agent 时才路由
- 在消息中使用 `@AgentName` 可指定特定 Agent 回复
- 每条 Agent 回复会标注路由信息（由哪个 Agent 回复、置信度、路由方式）

### 7.6 快捷操作

- Quick Questions：Agent 会根据上下文推荐快捷问题，点击即可发送
- Save to Memory：将对话中的关键信息保存到 Scope Memory，供后续对话参考
- Workspace Actions：对工作区文件执行批量操作

---

## 8. Workflow 编辑器

通过左侧导航栏的 "Workflow" 图标进入可视化工作流编辑器。

### 8.1 Canvas 画布

![Workflow 编辑器画布示例，展示 Security Check 8 工作流的节点编排与 AI Copilot 面板](imgs/Screenshot%202026-04-01%20at%2015.41.39.png)


Workflow 编辑器基于可视化 Canvas，支持拖拽式流程编排。核心概念：

- **节点（Node）**：工作流的基本执行单元
- **连接（Edge）**：定义节点之间的执行顺序和数据流向
- **变量（Variable）**：工作流级别的输入参数，可在节点 Prompt 中通过 `{{变量名}}` 引用

### 8.2 节点类型

| 节点类型 | 说明 |
|---------|------|
| Start | 工作流入口，每个流程必须有一个 |
| End | 工作流出口 |
| Agent | AI Agent 执行节点，发送 Prompt 给 Claude 并获取结果 |
| Action | 确定性操作节点（API 调用、数据转换），无需 AI 参与 |
| Condition | 条件分支节点，根据表达式走 Yes/No 两条路径 |
| Document | 文档处理节点 |
| Code Artifact | 代码生成节点 |

<img src="imgs/Screenshot%202026-04-01%20at%2015.42.16.png" alt="Workflow 编辑器中的添加节点面板，列出 Agent、Start、Action、Condition、Document、Code、End 七种节点类型" width="240" />


### 8.3 创建和编辑工作流

1. 在 Canvas 上拖拽添加节点
2. 连接节点：从一个节点的输出端口拖拽到另一个节点的输入端口
3. 配置节点：点击节点打开配置面板，填写 Prompt、Action 配置或条件表达式
4. 设置变量：在工作流属性面板中定义输入变量

### 8.4 运行工作流

点击 "Run" 按钮启动工作流执行：

- 系统会弹出变量输入对话框，填写运行时参数
- 执行过程通过 WebSocket 实时推送进度
- Canvas 上的节点会实时更新状态颜色：
  - 灰色：Pending（等待中）
  - 蓝色：Running（执行中）
  - 绿色：Completed（已完成）
  - 红色：Failed（失败）
  - 黄色：Skipped（跳过，条件分支未走到）

<img src="imgs/Screenshot%202026-04-01%20at%2015.41.54.png" alt="工作流执行历史面板，展示 Security Check 8 的两次历史执行记录及节点完成情况" width="320" />


### 8.5 执行引擎

工作流由后端的 Workflow Orchestrator 逐节点执行：

- 按 DAG 拓扑排序依次执行节点
- Agent 节点：为每个节点构建聚焦的 Prompt（包含上游节点输出作为上下文），发送给 Claude 执行
- Action 节点：直接在后端执行（如 API 调用），不经过 AI
- Condition 节点：评估条件表达式，决定走 Yes 或 No 分支
- 每个节点支持自动重试（默认 2 次，指数退避）
- 节点失败时，下游所有节点自动标记为 Skipped

### 8.6 Webhook 和定时触发

除了手动运行，工作流还支持：

- **Webhook 触发**：为工作流创建 Webhook URL，外部系统通过 HTTP POST 触发执行
- **定时任务（Schedule）**：配置 Cron 表达式，按计划自动执行工作流

---

## 9. 技能与市场

### 9.1 技能概念

技能（Skill）是 Agent 的能力扩展包，本质上是一组指令文件（skill.md），存储在 S3 上。技能可以：
- 定义 Agent 在特定场景下的行为规范
- 提供领域知识和操作指南
- 被多个 Agent 共享使用

### 9.2 技能管理

<img src="imgs/Screenshot%202026-04-01%20at%2015.40.32.png" alt="技能管理面板展示已安装的16个技能列表，每个技能支持发布至内部目录、查看文档及删除操作" width="420" />


在 Agent 配置页面的 Skills 标签页中：
- 查看已装备的技能列表
- 添加新技能：填写技能名称和 skill.md 内容
- 编辑技能：修改 skill.md 指令内容
- 移除技能：从 Agent 上卸载技能

### 9.3 技能市场

通过导航菜单的 Config > Skills 进入技能市场浏览器：

- 搜索社区技能包
- 查看技能详情（描述、版本、作者）
- 一键安装到当前组织
- 安装后可在 Agent 配置中装备使用

<img src="imgs/Screenshot%202026-04-01%20at%2015.40.51.png" alt="技能市场 External 标签页，展示 skills.sh 社区热门技能包列表及安装选项" width="420" />


<img src="imgs/Screenshot%202026-04-01%20at%2015.40.41.png" alt="技能市场 Internal 标签页，展示可浏览和一键安装的内部技能列表" width="420" />


### 9.4 企业内部技能目录

组织可以发布内部技能到企业技能目录：
- 从 Agent 工作区中提取技能并发布
- 内部技能仅对本组织可见
- 支持版本管理和标签分类

---

## 10. MCP 服务器配置

MCP（Model Context Protocol）服务器为 Agent 提供外部工具调用能力，例如访问数据库、调用 API、操作文件系统等。

### 10.1 进入 MCP 配置

通过导航菜单的 Config > MCP 进入 MCP 配置页面。

### 10.2 添加 MCP 服务器

<img src="imgs/Screenshot%202026-04-01%20at%2015.41.15.png" alt="MCP 服务器配置面板截图，展示可添加的多个 AWS 官方 MCP 服务器列表及其功能描述" width="400" />


点击 "Add Server" 按钮，打开 MCP 目录面板。目录中预置了常用的 MCP 服务器（如 filesystem、GitHub、Slack 等），点击 "Install" 一键安装。

也可以手动创建，填写以下信息：

**服务器类型**
- **stdio（命令行）**：通过本地命令启动 MCP 服务器
  - Command：启动命令（如 `npx`）
  - Arguments：命令参数（如 `-y @modelcontextprotocol/server-filesystem`）
  - Environment Variables：环境变量键值对
- **SSE / HTTP（URL）**：连接远程 MCP 服务器
  - Server URL：服务器地址

**可选配置**
- OAuth 认证：Client ID、Client Secret、Token URL、Scope
- 自定义 Headers：JSON 格式的请求头

### 10.3 管理 MCP 服务器

- 测试连接：点击 "Test Connection" 验证服务器可达性
- 编辑配置：点击服务器列表中的条目修改配置
- 删除服务器：移除不再需要的服务器

### 10.4 Scope 级 MCP 绑定

MCP 服务器创建后，可以在 Business Scope 的配置中将其绑定到特定 Scope。绑定后，该 Scope 下的所有 Agent 在对话时会自动加载对应的 MCP 工具。

---

## 11. IM 渠道集成

平台支持将 Agent 接入主流 IM 工具，让用户在日常使用的聊天软件中直接与 Agent 交互。

### 11.1 支持的渠道

| 渠道 | 接入方式 | 消息限制 |
|------|---------|---------|
| Slack | Events API + Bot Token | 39,000 字符/消息 |
| Discord | Webhook + Bot Token | 2,000 字符/消息 |
| 飞书（Lark） | Event Subscription + App ID/Secret | 30,000 字符/消息 |
| 钉钉 | Robot Webhook | 20,000 字符/消息 |
| Telegram | Bot API + Webhook | 4,096 字符/消息 |

### 11.2 配置 IM 渠道绑定

在 Business Scope 或 Agent 的详情页面，进入 IM Channels 标签页：

1. 点击 "Add Channel"
2. 选择渠道类型（Slack / Discord / 飞书 / 钉钉 / Telegram）
3. 填写 Channel ID 和 Bot Token（或 App ID/Secret）
4. 保存后，平台会自动注册 Webhook 端点

### 11.3 消息流转

IM 渠道的消息处理流程：

1. 用户在 IM 群组中发送消息
2. IM 平台通过 Webhook 将消息推送到 Super Agent 后端（`/api/im/:channelType/webhook`）
3. 后端通过 IM Adapter 解析消息，匹配到对应的 Business Scope
4. 消息路由到 Scope 下的 Agent 处理
5. Agent 的回复通过 IM API 发送回原始群组/线程

### 11.4 注意事项

- 每个渠道的 Bot Token 需要在对应平台（Slack App、Discord Developer Portal、飞书开放平台等）中创建和获取
- Slack 需要配置 Signing Secret 用于请求验证
- 飞书使用 App ID + App Secret 获取 Tenant Access Token（自动缓存 100 分钟）
- 钉钉通过 Webhook URL 回复消息（非 API 调用）
- Telegram 需要调用 `setWebhook` API 注册回调地址
- 超长回复会自动分片发送，确保不超过各平台的消息长度限制

---

## 12. 系统设置

通过左侧导航栏底部的用户头像，打开管理菜单，选择 "Settings" 进入系统设置页面。

### 12.1 成员管理（Members）

- 查看组织内所有成员列表（姓名、邮箱、角色、状态）
- 邀请新成员：输入邮箱发送邀请，可指定角色（admin / member）
- 修改成员角色
- 移除成员
- 查看待接受的邀请

角色说明：
- **Owner**：组织所有者，拥有全部权限
- **Admin**：管理员，可管理成员、Scope 和系统配置
- **Member**：普通成员，可使用 Agent 和查看数据

### 12.2 组织设置（Organization）

- 修改组织名称
- 查看组织 Slug（URL 标识符）
- 查看当前套餐（Plan Type）

### 12.3 API Keys

API Key 用于外部系统通过 REST API 调用工作流：

- 创建 API Key：填写名称，系统生成密钥（仅显示一次，请妥善保存）
- 查看已有 Key 列表（前缀、创建时间、最后使用时间）
- 删除不再使用的 Key
- 每个 Key 默认限速 60 次/分钟

### 12.4 外观设置（Appearance）

- 切换界面语言（中文 / English）
- 主题设置

---

*本手册基于 Super Agent Platform 当前版本编写。如有功能更新，请以实际界面为准。*

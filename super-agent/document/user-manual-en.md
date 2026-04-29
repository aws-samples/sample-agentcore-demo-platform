# Super Agent Platform User Manual

## 1. Product Overview

Super Agent is an enterprise-grade AI Agent management platform that helps organizations rapidly build, configure, and operate multiple AI agents. Core capabilities include:

- Organize AI Agent teams by business domain (Business Scope), with each Scope having its own dedicated Agents, skills, knowledge base, and workflows
- One-click generation of entire business teams via natural language, SOP documents, or industry templates
- Visual Workflow editor with drag-and-drop process orchestration and real-time execution monitoring
- Multi-Agent group chat with intelligent routing and @mention-based Agent selection
- Create "Digital Twins" that let AI simulate a real person's professional knowledge and communication style
- Integration with Slack, Discord, Feishu, DingTalk, Telegram, and other IM channels
- MCP server integration to extend Agent tool-calling capabilities
- Skills marketplace for browsing and installing community skill packages

![Super Agent platform overall system architecture diagram showing frontend, backend, Agent Runtime, AWS infrastructure components and their interactions](imgs/Screenshot%202026-04-01%20at%2015.39.12.png)

---

## 2. Quick Start

### 2.1 Login

Open the platform URL and the system will redirect to the login page. The platform supports two authentication methods:

- Cognito hosted login (production): Login via AWS Cognito's OAuth flow
- Local account login (development): Enter email and password to log in directly

After first login, the system automatically associates your user Profile with the default organization.

### 2.2 Accepting an Invitation

If you received an invitation email, clicking the link will redirect to the invitation acceptance page (`/invite/:token`). Confirm to join the corresponding organization.

### 2.3 First Step: Create a Business Scope

After logging in, go to the Dashboard and click the "Create Team" button in the upper right corner to start creating your first business team. See Chapter 4 for detailed steps.

---

## 3. Dashboard Overview

![Command Center main interface showing Agent cards grouped by Team, including Game Studio, SLG Gaming Ops, and other teams with their Agent statuses](imgs/Screenshot%202026-04-01%20at%2015.59.31.png)

The Dashboard is the platform's home page, displaying a global view of all Business Scopes and Agents within the organization.

### 3.1 Two View Modes

The Dashboard offers two views, selectable via the toggle button in the upper right:

- **Classic View**: Displays Agent cards grouped by Business Scope. Each Scope shows its name, icon, Agent count, and Restricted/Open access indicator. Standalone Agents (Digital Twins) are categorized separately in the "Standalone Agents" section at the bottom.
- **Casino View**: Displays global statistics in a Command Center style (active Agents, automated tasks, SLA compliance rate, active tasks) and Scope overview.

### 3.2 Dashboard Actions

- Click "Create Team": Enter the Business Scope creation flow
- Click "Create Agent": Enter the Digital Twin creation wizard
- Click any Agent card: Navigate to that Agent's detail/conversation page
- Click the shield icon next to a Scope (admin only): Open the Scope access control panel to manage member permissions and visibility settings

---

## 4. Business Scope Management

Business Scope is the platform's core organizational unit, representing a business domain (e.g., HR, IT, Marketing). Each Scope contains a dedicated set of Agents, skills, knowledge base, workflows, and MCP server configurations.

### 4.1 Creating a Business Scope

Click "Create Team" on the Dashboard to enter the creation page, completed in two steps:

![Create Business Scope page: select organizational unit (department) and AI generation strategy](imgs/Screenshot%202026-04-01%20at%2016.03.28.png)

**Step 1: Select Organizational Unit**

Choose from preset department templates: Human Resources, IT & Dev, Operations, Finance, Legal, or select "Other" to customize the department name.

**Step 2: Select Generation Strategy**

The platform offers three AI-driven generation methods:

1. **Generate Reference SOP using Agent**: AI automatically analyzes industry best practices based on the selected department and generates standard SOPs with corresponding Agent teams. Ideal for quick starts without any document preparation.

2. **Import SOP document**: Upload existing SOP documents (supports PDF, DOCX, TXT). AI parses the document content, automatically extracts processes, roles, and responsibilities, and generates matching Agent teams.

3. **Build using Natural Language**: Describe your business scenario in natural language, e.g., "We're a 50-person e-commerce company that needs Agents for customer service, inventory management, marketing, and order fulfillment." AI generates a complete Scope configuration based on the description.

After selecting a strategy, click "Generate with AI." The system uses the Claude Agent SDK to stream-generate the Scope configuration, including Agent definitions, role assignments, System Prompts, and initial skills.

### 4.2 Scope Access Control

Each Scope has two visibility modes:

- **Open** (default): Visible to all members in the organization
- **Restricted**: Visible only to Scope members; administrators must manually add members

Administrators can click the shield icon next to a Scope on the Dashboard to open the access control panel:
- Toggle between Open / Restricted modes
- Add/remove Scope members
- Set member roles (viewer / editor / admin)

### 4.3 Scope Profile Configuration

After entering the Scope detail page, you can configure:
- Name, description, icon, color
- System Prompt (Scope-level global instructions)
- Associated MCP servers
- Associated plugins (Claude Code Plugins)
- IM channel bindings
- Knowledge base (Document Groups) bindings

<img src="imgs/Screenshot%202026-04-01%20at%2015.41.03.png" alt="Scope plugin management panel showing empty installed plugins list and available popular plugins (claude-mem and superpowers)" width="400" />

---

## 5. Standalone Agent (Digital Twin)

A Digital Twin is a special type of Agent that simulates a real person's professional knowledge, communication style, and personality traits. Unlike team Agents under a Business Scope, Digital Twins exist independently.

### 5.1 Creating a Digital Twin

![Creating a Digital Twin Step 1 — Identity configuration page where users can upload an avatar, fill in display name and title, describe personal background, and support AI auto-generation of system prompts](imgs/Screenshot%202026-04-01%20at%2016.03.45.png)

Click "Create Agent" on the Dashboard to enter the four-step creation wizard:

**Step 1 — Identity**
- Upload photo: Used as the Digital Twin's avatar
- Fill in display name and role/title
- Describe yourself: Fill in professional domains, personality traits, communication style, etc.
- System Prompt: Click the "AI Generate" button to have AI auto-generate a System Prompt based on your description; you can also write it manually

**Step 2 — Knowledge**
- Upload documents representing your professional knowledge (PDF, DOC, TXT, MD, CSV)
- The system automatically creates a Document Group and associates it with the Digital Twin
- These documents serve as a RAG knowledge base for the Digital Twin to reference when answering questions

**Step 3 — Skills**
- Skills can be configured after creation through the Skill Workshop
- This step is informational and can be skipped

**Step 4 — Publish**
- Choose to publish to Super Agent Platform (enabled by default)
- Optionally bind IM channels (Slack / Feishu / DingTalk / Discord / Teams) by entering the Channel ID
- Review the summary information and click "Create Digital Twin" to complete

---

## 6. Agent Management

Access the Agent list page via the "Agents" icon in the left navigation bar.

### 6.1 Agent List

The page displays all Agents under the current organization, filterable by Business Scope. Each Agent card shows:
- Avatar, display name, role
- Current status (Active / Busy / Idle / Offline)
- Associated Business Scope

Click an Agent card to view the detail panel, which includes tabs for Agent Profile, skill list, MCP servers, IM channel bindings, Scope memories, and intelligent briefings.

### 6.2 Agent Configurator

Click the configuration button in the Agent detail to enter the Agent Configurator page, where you can edit:

**Basic Information**
- Internal Name: The Agent's internal identifier (e.g., `hr-assistant`)
- Display Name: The user-visible display name
- Role: The Agent's role description
- Avatar: Supports uploading images, entering URLs, or using characters
- Status: Active (enabled) or Disabled

**AI Configuration**
- System Prompt: Defines the Agent's personality, professional domain, and behavioral guidelines

**Capability Configuration**
- Operational Scope: Business scope tags for the Agent (e.g., Recruitment, Onboarding)
- Skills: Add skills to the Agent, each containing a name and skill.md instruction content

### 6.3 Creating a New Agent

On the Agent list page, you can manually create an Agent through the configurator's "new" mode by filling in all the above fields and saving.

### 6.4 Skill Workshop

Click the "Skill Workshop" button on the Agent configuration page to enter the skill workshop. Here you can:
- Browse equipped skills
- Install new skills from the skills marketplace
- Test skill effectiveness
- Edit skill.md instruction content

---

## 7. Chat

Access the chat page via the "Chat" icon in the left navigation bar.

### 7.1 Selecting Chat Context

The dropdown selector at the top of the page supports two conversation targets:

- **Business Scope**: Select a Scope to chat with the Agent team under that Scope
- **Independent Agent**: Select an independent Agent (e.g., Digital Twin) for direct conversation

The selector supports search — enter keywords to quickly locate a Scope or Agent.

### 7.2 Sending Messages

Enter a message in the input box at the bottom and press Enter or click the send button. Supported features:

- Text messages: Enter text directly
- File attachments: Click the attachment icon to upload files to the Agent workspace
- Streaming responses: Agent replies are displayed in real-time via SSE, including thinking processes and tool calls

### 7.3 Session Management

- The left panel displays the historical session list; click to switch sessions
- Each session is bound to a specific Scope or Agent
- Session titles are auto-generated but can be manually modified

### 7.4 Workspace Browser

![Chat page example: left side shows historical session list, top allows switching between Business Scope and group chat mode, right side workspace file tree displays Agent-generated skill file structure](imgs/Screenshot%202026-04-01%20at%2015.40.18.png)

During conversations, Agents may create or modify files in the workspace. The right panel provides:

- File tree browsing: View the Agent workspace's file structure
- File viewing/editing: Click a file to view its content with syntax highlighting; switch to Edit mode to directly edit and save
- Markdown/HTML preview: Rendered preview for .md and .html files
- Image preview: Direct display of image files
- App preview: If the Agent generates a web application (e.g., React project), it can be previewed in real-time in an embedded iframe with automatic Vite Dev Server startup
- Publish app: Applications in preview can be published to the App Marketplace with one click

### 7.5 Group Chat (Chat Room)

The platform supports multi-Agent group chat mode:

- When creating a Chat Room, multiple Agents can be added as members
- Message routing strategies:
  - **Auto**: AI automatically analyzes message content and intelligently routes to the most suitable Agent
  - **Mention**: Routes only when the user @mentions a specific Agent
- Use `@AgentName` in messages to specify a particular Agent to respond
- Each Agent reply is annotated with routing information (which Agent responded, confidence level, routing method)

### 7.6 Quick Actions

- Quick Questions: Agents recommend contextual quick questions; click to send
- Save to Memory: Save key information from conversations to Scope Memory for future reference
- Workspace Actions: Perform batch operations on workspace files

---

## 8. Workflow Editor

Access the visual workflow editor via the "Workflow" icon in the left navigation bar.

### 8.1 Canvas

![Workflow editor canvas example showing Security Check 8 workflow node orchestration and AI Copilot panel](imgs/Screenshot%202026-04-01%20at%2015.41.39.png)

The Workflow editor is based on a visual Canvas supporting drag-and-drop process orchestration. Core concepts:

- **Node**: The basic execution unit of a workflow
- **Edge**: Defines execution order and data flow between nodes
- **Variable**: Workflow-level input parameters, referenceable in node Prompts via `{{variableName}}`

### 8.2 Node Types

| Node Type | Description |
|-----------|-------------|
| Start | Workflow entry point; every process must have one |
| End | Workflow exit point |
| Agent | AI Agent execution node; sends a Prompt to Claude and retrieves results |
| Action | Deterministic operation node (API calls, data transformations); no AI involvement |
| Condition | Conditional branch node; follows Yes/No paths based on expressions |
| Document | Document processing node |
| Code Artifact | Code generation node |

<img src="imgs/Screenshot%202026-04-01%20at%2015.42.16.png" alt="Add node panel in the Workflow editor listing seven node types: Agent, Start, Action, Condition, Document, Code, End" width="240" />

### 8.3 Creating and Editing Workflows

1. Drag and drop to add nodes on the Canvas
2. Connect nodes: Drag from one node's output port to another node's input port
3. Configure nodes: Click a node to open the configuration panel; fill in Prompt, Action configuration, or conditional expressions
4. Set variables: Define input variables in the workflow properties panel

### 8.4 Running Workflows

Click the "Run" button to start workflow execution:

- The system displays a variable input dialog for entering runtime parameters
- Execution progress is pushed in real-time via WebSocket
- Nodes on the Canvas update their status colors in real-time:
  - Gray: Pending
  - Blue: Running
  - Green: Completed
  - Red: Failed
  - Yellow: Skipped (conditional branch not taken)

<img src="imgs/Screenshot%202026-04-01%20at%2015.41.54.png" alt="Workflow execution history panel showing two historical executions of Security Check 8 and node completion status" width="320" />

### 8.5 Execution Engine

Workflows are executed node-by-node by the backend's Workflow Orchestrator:

- Nodes are executed sequentially according to DAG topological sort
- Agent nodes: A focused Prompt is built for each node (including upstream node outputs as context) and sent to Claude for execution
- Action nodes: Executed directly on the backend (e.g., API calls) without going through AI
- Condition nodes: Evaluate conditional expressions to determine Yes or No branch
- Each node supports automatic retry (default 2 times with exponential backoff)
- When a node fails, all downstream nodes are automatically marked as Skipped

### 8.6 Webhook and Scheduled Triggers

In addition to manual execution, workflows also support:

- **Webhook triggers**: Create a Webhook URL for the workflow; external systems trigger execution via HTTP POST
- **Scheduled tasks (Schedule)**: Configure Cron expressions to automatically execute workflows on schedule

---

## 9. Skills & Marketplace

### 9.1 Skills Concept

A Skill is an Agent capability extension package, essentially a set of instruction files (skill.md) stored on S3. Skills can:
- Define Agent behavioral guidelines for specific scenarios
- Provide domain knowledge and operational guides
- Be shared across multiple Agents

### 9.2 Skills Management

<img src="imgs/Screenshot%202026-04-01%20at%2015.40.32.png" alt="Skills management panel showing 16 installed skills, each supporting publishing to internal directory, viewing documentation, and deletion" width="420" />

In the Skills tab of the Agent configuration page:
- View the list of equipped skills
- Add new skills: Enter skill name and skill.md content
- Edit skills: Modify skill.md instruction content
- Remove skills: Uninstall skills from the Agent

### 9.3 Skills Marketplace

Access the skills marketplace browser via Config > Skills in the navigation menu:

- Search community skill packages
- View skill details (description, version, author)
- One-click install to the current organization
- After installation, equip skills in Agent configuration

<img src="imgs/Screenshot%202026-04-01%20at%2015.40.51.png" alt="Skills marketplace External tab showing popular community skill packages from skills.sh and installation options" width="420" />

<img src="imgs/Screenshot%202026-04-01%20at%2015.40.41.png" alt="Skills marketplace Internal tab showing browsable and one-click installable internal skills list" width="420" />

### 9.4 Enterprise Internal Skills Directory

Organizations can publish internal skills to the enterprise skills directory:
- Extract skills from Agent workspaces and publish
- Internal skills are visible only to the organization
- Supports version management and tag categorization

---

## 10. MCP Server Configuration

MCP (Model Context Protocol) servers provide Agents with external tool-calling capabilities, such as accessing databases, calling APIs, operating file systems, etc.

### 10.1 Accessing MCP Configuration

Access the MCP configuration page via Config > MCP in the navigation menu.

### 10.2 Adding MCP Servers

<img src="imgs/Screenshot%202026-04-01%20at%2015.41.15.png" alt="MCP server configuration panel screenshot showing multiple AWS official MCP servers available for addition with their feature descriptions" width="400" />

Click the "Add Server" button to open the MCP directory panel. The directory includes pre-configured common MCP servers (such as filesystem, GitHub, Slack, etc.); click "Install" for one-click installation.

You can also create manually by filling in the following information:

**Server Type**
- **stdio (command line)**: Start MCP server via local command
  - Command: Startup command (e.g., `npx`)
  - Arguments: Command arguments (e.g., `-y @modelcontextprotocol/server-filesystem`)
  - Environment Variables: Key-value pairs
- **SSE / HTTP (URL)**: Connect to remote MCP server
  - Server URL: Server address

**Optional Configuration**
- OAuth authentication: Client ID, Client Secret, Token URL, Scope
- Custom Headers: Request headers in JSON format

### 10.3 Managing MCP Servers

- Test connection: Click "Test Connection" to verify server reachability
- Edit configuration: Click an entry in the server list to modify configuration
- Delete server: Remove servers that are no longer needed

### 10.4 Scope-Level MCP Binding

After creating an MCP server, it can be bound to a specific Scope in the Business Scope configuration. Once bound, all Agents under that Scope will automatically load the corresponding MCP tools during conversations.

---

## 11. IM Channel Integration

The platform supports connecting Agents to mainstream IM tools, allowing users to interact with Agents directly in their daily chat applications.

### 11.1 Supported Channels

| Channel | Integration Method | Message Limit |
|---------|-------------------|---------------|
| Slack | Events API + Bot Token | 39,000 chars/message |
| Discord | Webhook + Bot Token | 2,000 chars/message |
| Feishu (Lark) | Event Subscription + App ID/Secret | 30,000 chars/message |
| DingTalk | Robot Webhook | 20,000 chars/message |
| Telegram | Bot API + Webhook | 4,096 chars/message |

### 11.2 Configuring IM Channel Bindings

On the Business Scope or Agent detail page, go to the IM Channels tab:

1. Click "Add Channel"
2. Select channel type (Slack / Discord / Feishu / DingTalk / Telegram)
3. Enter Channel ID and Bot Token (or App ID/Secret)
4. After saving, the platform automatically registers the Webhook endpoint

### 11.3 Message Flow

IM channel message processing flow:

1. User sends a message in an IM group
2. The IM platform pushes the message to the Super Agent backend via Webhook (`/api/im/:channelType/webhook`)
3. The backend parses the message through the IM Adapter and matches it to the corresponding Business Scope
4. The message is routed to an Agent under the Scope for processing
5. The Agent's reply is sent back to the original group/thread via the IM API

### 11.4 Notes

- Each channel's Bot Token needs to be created and obtained from the corresponding platform (Slack App, Discord Developer Portal, Feishu Open Platform, etc.)
- Slack requires configuring a Signing Secret for request verification
- Feishu uses App ID + App Secret to obtain a Tenant Access Token (automatically cached for 100 minutes)
- DingTalk replies via Webhook URL (not API calls)
- Telegram requires calling the `setWebhook` API to register the callback address
- Overly long replies are automatically split into segments to ensure they don't exceed each platform's message length limits

---

## 12. System Settings

Open the management menu via the user avatar at the bottom of the left navigation bar, and select "Settings" to enter the system settings page.

### 12.1 Member Management (Members)

- View all members in the organization (name, email, role, status)
- Invite new members: Enter email to send invitation; specify role (admin / member)
- Modify member roles
- Remove members
- View pending invitations

Role descriptions:
- **Owner**: Organization owner with full permissions
- **Admin**: Administrator who can manage members, Scopes, and system configuration
- **Member**: Regular member who can use Agents and view data

### 12.2 Organization Settings

- Modify organization name
- View organization Slug (URL identifier)
- View current plan (Plan Type)

### 12.3 API Keys

API Keys are used for external systems to call workflows via REST API:

- Create API Key: Enter a name; the system generates a secret key (displayed only once — save it securely)
- View existing Key list (prefix, creation time, last used time)
- Delete Keys that are no longer in use
- Each Key has a default rate limit of 60 requests/minute

### 12.4 Appearance Settings

- Switch interface language (Chinese / English)
- Theme settings

---

*This manual is based on the current version of the Super Agent Platform. For feature updates, please refer to the actual interface.*

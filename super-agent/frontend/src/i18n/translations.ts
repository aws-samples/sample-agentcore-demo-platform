import type { TranslationData } from '@/types'

export const translations: TranslationData = {
  // Navigation
  'nav.dashboard': {
    en: 'Dashboard',
    cn: '仪表板'
  },
  'nav.chat': {
    en: 'Chat',
    cn: '对话'
  },
  'nav.workflow': {
    en: 'Workflow',
    cn: '工作流'
  },
  'nav.agents': {
    en: 'Agents',
    cn: '智能体'
  },
  'nav.projects': {
    en: 'Projects',
    cn: '项目'
  },
  'nav.tools': {
    en: 'Tools',
    cn: '工具'
  },
  'nav.apps': {
    en: 'Apps',
    cn: '应用'
  },
  'nav.starred': {
    en: 'Starred',
    cn: '明星案例'
  },
  'nav.tasks': {
    en: 'Tasks',
    cn: '任务'
  },

  // Header
  'header.commandCenter': {
    en: 'Command Center',
    cn: '指挥中心'
  },
  'header.productionLive': {
    en: 'Production Live',
    cn: '生产环境'
  },
  'header.globalView': {
    en: 'Global View',
    cn: '全局视图'
  },

  // Dashboard
  'dashboard.title': {
    en: 'Dashboard',
    cn: '仪表板'
  },
  'dashboard.activeAgents': {
    en: 'Active Agents',
    cn: '活跃智能体'
  },
  'dashboard.tasksAutomated': {
    en: 'Tasks Automated',
    cn: '自动化任务'
  },
  'dashboard.slaCompliance': {
    en: 'SLA Compliance',
    cn: 'SLA合规率'
  },
  'dashboard.activeTasks': {
    en: 'Active Tasks',
    cn: '进行中任务'
  },
  'dashboard.createBusinessScope': {
    en: 'Create Business Scope',
    cn: '创建业务范围'
  },
  'dashboard.addNew': {
    en: 'Add New Department',
    cn: '添加新部门'
  },
  'dashboard.unassigned': {
    en: 'Unassigned',
    cn: '未分配'
  },
  'dashboard.trendThisWeek': {
    en: '+2 this week',
    cn: '+2 本周'
  },
  'dashboard.systemHealthy': {
    en: 'System Healthy',
    cn: '系统健康'
  },

  // Create Scope Card
  'createScope.subtitle': {
    en: 'Add new department with AI agents',
    cn: '添加新部门及AI智能体'
  },

  // Task Intelligence Card
  'taskIntel.title': {
    en: 'Task Intelligence',
    cn: '任务智能'
  },
  'taskIntel.active': {
    en: 'Active',
    cn: '活跃'
  },

  // Departments
  'department.hr': {
    en: 'Human Resources',
    cn: '人力资源'
  },
  'department.it': {
    en: 'Information Technology',
    cn: '信息技术'
  },
  'department.marketing': {
    en: 'Marketing',
    cn: '市场营销'
  },
  'department.sales': {
    en: 'Sales',
    cn: '销售'
  },
  'department.support': {
    en: 'Support',
    cn: '客户支持'
  },


  // Agent Status
  'status.active': {
    en: 'Active',
    cn: '活跃'
  },
  'status.busy': {
    en: 'Busy',
    cn: '忙碌'
  },
  'status.offline': {
    en: 'Offline',
    cn: '离线'
  },

  // Agent Management
  'agents.title': {
    en: 'Agent Management',
    cn: '智能体管理'
  },
  'agents.profile': {
    en: 'Agent Profile',
    cn: '智能体档案'
  },
  'agents.metrics': {
    en: 'Performance Metrics',
    cn: '性能指标'
  },
  'agents.taskCount': {
    en: 'Task Count',
    cn: '任务数量'
  },
  'agents.responseRate': {
    en: 'Response Rate',
    cn: '响应率'
  },
  'agents.avgResponseTime': {
    en: 'Avg Response Time',
    cn: '平均响应时间'
  },
  'agents.scope': {
    en: 'Operational Scope',
    cn: '操作范围'
  },
  'agents.tools': {
    en: 'Skills',
    cn: '子代理技能'
  },
  'agents.systemPrompt': {
    en: 'System Prompt',
    cn: '系统提示词'
  },
  'agents.executionLogs': {
    en: 'Execution Logs',
    cn: '执行日志'
  },
  'agents.selectPrompt': {
    en: 'Select an agent from the list to view their profile, metrics, and configuration.',
    cn: '从列表中选择一个智能体以查看其档案、指标和配置。'
  },
  'agents.confirmRemove': {
    en: 'Are you sure you want to remove this agent? This action cannot be undone.',
    cn: '确定要移除此智能体吗？此操作无法撤销。'
  },

  // Agent Configuration
  'agentConfig.title': {
    en: 'Agent Configuration',
    cn: '智能体配置'
  },
  'agentConfig.agentId': {
    en: 'Agent ID',
    cn: '智能体ID'
  },
  'agentConfig.internalName': {
    en: 'Internal Name',
    cn: '内部名称'
  },
  'agentConfig.displayName': {
    en: 'Display Name',
    cn: '显示名称'
  },
  'agentConfig.description': {
    en: 'Description',
    cn: '描述'
  },
  'agentConfig.agentType': {
    en: 'Agent Type',
    cn: '智能体类型'
  },
  'agentConfig.modelProvider': {
    en: 'Model Provider',
    cn: '模型提供商'
  },
  'agentConfig.modelId': {
    en: 'Model ID',
    cn: '模型ID'
  },
  'agentConfig.orchestrator': {
    en: 'Orchestrator',
    cn: '编排器'
  },
  'agentConfig.worker': {
    en: 'Worker',
    cn: '工作者'
  },
  'agentConfig.supervisor': {
    en: 'Supervisor',
    cn: '监督者'
  },
  'agentConfig.basicInfo': {
    en: 'Basic Information',
    cn: '基本信息'
  },
  'agentConfig.aiConfig': {
    en: 'AI Configuration',
    cn: 'AI配置'
  },
  'agentConfig.capabilities': {
    en: 'Capabilities',
    cn: '能力配置'
  },
  'agentConfig.role': {
    en: 'Role',
    cn: '角色'
  },
  'agentConfig.avatar': {
    en: 'Avatar',
    cn: '头像'
  },
  'agentConfig.status': {
    en: 'Status',
    cn: '状态'
  },
  'agentConfig.businessScope': {
    en: 'Business Scope',
    cn: '业务范围'
  },
  'agentConfig.operationalScope': {
    en: 'Operational Scope',
    cn: '操作范围'
  },
  'agentConfig.assignedTools': {
    en: 'Skills',
    cn: '子代理技能'
  },
  'agentConfig.systemPrompt': {
    en: 'System Prompt',
    cn: '系统提示词'
  },
  'agentConfig.identity': {
    en: 'Identity',
    cn: '身份'
  },
  'agentConfig.name': {
    en: 'Name',
    cn: '名称'
  },
  'agentConfig.instructions': {
    en: 'Instructions',
    cn: '指令'
  },
  'agentConfig.tools': {
    en: 'Tools',
    cn: '工具'
  },
  'agentConfig.handoffs': {
    en: 'Handoffs',
    cn: '交接'
  },


  // Chat Interface
  'chat.title': {
    en: 'Chat',
    cn: '对话'
  },
  'chat.placeholder': {
    en: 'Type your message...',
    cn: '输入您的消息...'
  },
  'chat.send': {
    en: 'Send',
    cn: '发送'
  },
  'chat.typing': {
    en: 'AI is typing...',
    cn: 'AI正在输入...'
  },
  'chat.selectSop': {
    en: 'Select SOP Context',
    cn: '选择SOP上下文'
  },
  'chat.contextSwitch': {
    en: 'Context switched to',
    cn: '上下文已切换至'
  },
  'chat.memories': {
    en: 'Memories',
    cn: '记忆'
  },
  'chat.useCases': {
    en: 'Use Cases',
    cn: '使用场景'
  },
  'chat.relatedLinks': {
    en: 'Related Links',
    cn: '相关链接'
  },
  'chat.quickQuestions': {
    en: 'Quick Questions',
    cn: '快捷问题'
  },

  // Workflow Designer
  'workflow.title': {
    en: 'Workflow Designer',
    cn: '工作流设计器'
  },
  'workflow.version': {
    en: 'Version',
    cn: '版本'
  },
  'workflow.official': {
    en: 'Official',
    cn: '正式版'
  },
  'workflow.deployToTest': {
    en: 'Deploy to Test',
    cn: '部署到测试'
  },
  'workflow.category.hr': {
    en: 'HR',
    cn: '人力资源'
  },
  'workflow.category.deployment': {
    en: 'Deployment',
    cn: '部署'
  },
  'workflow.category.marketing': {
    en: 'Marketing',
    cn: '市场营销'
  },
  'workflow.category.support': {
    en: 'Support',
    cn: '客户支持'
  },
  'workflow.copilot.title': {
    en: 'AI Copilot',
    cn: 'AI助手'
  },
  'workflow.copilot.placeholder': {
    en: 'Describe workflow changes in natural language...',
    cn: '用自然语言描述工作流变更...'
  },
  'workflow.copilot.hint': {
    en: 'Press Enter to apply changes. Shift+Enter for new line.',
    cn: '按回车应用更改。Shift+回车换行。'
  },
  'workflow.copilot.error': {
    en: 'Failed to apply changes. Please try again.',
    cn: '应用更改失败，请重试。'
  },
  'workflow.copilot.success': {
    en: 'Workflow updated successfully',
    cn: '工作流更新成功'
  },
  'workflow.import': {
    en: 'Import from Image',
    cn: '从图片导入'
  },
  'workflow.create': {
    en: 'Create Workflow',
    cn: '创建工作流'
  },
  'workflow.createNew': {
    en: 'Create New Workflow',
    cn: '创建新工作流'
  },
  'workflow.workflowName': {
    en: 'Workflow Name',
    cn: '工作流名称'
  },
  'workflow.import.title': {
    en: 'Import Workflow from Image',
    cn: '从图片导入工作流'
  },
  'workflow.import.dropzone': {
    en: 'Drop a flowchart image here or click to browse',
    cn: '拖放流程图图片到此处或点击浏览'
  },
  'workflow.import.supportedFormats': {
    en: 'Supports PNG, JPG, JPEG, GIF',
    cn: '支持 PNG、JPG、JPEG、GIF'
  },
  'workflow.import.analyzing': {
    en: 'Analyzing flowchart...',
    cn: '正在分析流程图...'
  },
  'workflow.import.invalidFileType': {
    en: 'Please upload an image file',
    cn: '请上传图片文件'
  },
  'workflow.import.processingError': {
    en: 'Failed to process image. Please try again.',
    cn: '处理图片失败，请重试。'
  },
  'workflow.import.detectedAgents': {
    en: 'Detected Agents',
    cn: '检测到的智能体'
  },
  'workflow.import.detectedFlow': {
    en: 'Detected Flow Steps',
    cn: '检测到的流程步骤'
  },
  'workflow.import.tryAnother': {
    en: 'Try Another Image',
    cn: '尝试其他图片'
  },
  'workflow.import.accept': {
    en: 'Accept & Create Workflow',
    cn: '接受并创建工作流'
  },
  'workflow.detectedAgents': {
    en: 'Detected Agents',
    cn: '检测到的智能体'
  },
  'workflow.detectedFlow': {
    en: 'Detected Flow',
    cn: '检测到的流程'
  },


  // Task Audit Log
  'taskAudit.title': {
    en: 'Task Audit Log',
    cn: '任务审计日志'
  },

  // Task Execution Center
  'taskExec.title': {
    en: 'Task Execution Center',
    cn: '任务执行中心'
  },
  'taskExec.allSystemsNominal': {
    en: 'All Systems Nominal',
    cn: '所有系统正常'
  },
  'taskExec.started': {
    en: 'Started',
    cn: '开始于'
  },
  'taskExec.workflow': {
    en: 'Workflow',
    cn: '工作流'
  },
  'taskExec.progress': {
    en: 'Task Progress',
    cn: '任务进度'
  },
  'taskExec.logs': {
    en: 'Logs',
    cn: '日志'
  },
  'taskExec.noTasks': {
    en: 'No active tasks',
    cn: '暂无活跃任务'
  },
  'taskExec.status.running': {
    en: 'Running',
    cn: '运行中'
  },
  'taskExec.status.success': {
    en: 'Success',
    cn: '成功'
  },
  'taskExec.status.failed': {
    en: 'Failed',
    cn: '失败'
  },

  // Task Monitor (legacy)
  'tasks.title': {
    en: 'Task Monitor',
    cn: '任务监控'
  },
  'tasks.agent': {
    en: 'Agent',
    cn: '智能体'
  },
  'tasks.description': {
    en: 'Description',
    cn: '描述'
  },
  'tasks.workflow': {
    en: 'Workflow',
    cn: '工作流'
  },
  'tasks.status': {
    en: 'Status',
    cn: '状态'
  },
  'tasks.time': {
    en: 'Time',
    cn: '时间'
  },
  'tasks.action': {
    en: 'Action',
    cn: '操作'
  },
  'tasks.filterByAgent': {
    en: 'Filter by Agent',
    cn: '按智能体筛选'
  },
  'tasks.exportCsv': {
    en: 'Export CSV',
    cn: '导出CSV'
  },
  'tasks.status.complete': {
    en: 'Complete',
    cn: '已完成'
  },
  'tasks.status.running': {
    en: 'Running',
    cn: '运行中'
  },
  'tasks.status.failed': {
    en: 'Failed',
    cn: '失败'
  },
  'tasks.viewDetails': {
    en: 'View Details',
    cn: '查看详情'
  },

  // Tools & Capabilities
  'tools.title': {
    en: 'Tools & Capabilities',
    cn: '工具与能力'
  },
  'tools.search': {
    en: 'Search capabilities...',
    cn: '搜索能力...'
  },
  'tools.category.videoIntelligence': {
    en: 'Video Intelligence',
    cn: '视频智能'
  },
  'tools.category.knowledgeData': {
    en: 'Knowledge & Data',
    cn: '知识与数据'
  },
  'tools.category.communication': {
    en: 'Communication',
    cn: '通信'
  },
  'tools.category.infrastructure': {
    en: 'Infrastructure',
    cn: '基础设施'
  },


  // MCP Configuration
  'mcpConfig.title': {
    en: 'MCP Server Configuration',
    cn: 'MCP服务器配置'
  },
  'mcpConfig.subtitle': {
    en: 'Manage Model Context Protocol servers and integrations',
    cn: '管理模型上下文协议服务器和集成'
  },
  'mcpConfig.addServer': {
    en: 'Add Server',
    cn: '添加服务器'
  },
  'mcpConfig.servers': {
    en: 'Servers',
    cn: '服务器'
  },
  'mcpConfig.noServers': {
    en: 'No servers configured',
    cn: '未配置服务器'
  },
  'mcpConfig.newServer': {
    en: 'New MCP Server',
    cn: '新MCP服务器'
  },
  'mcpConfig.editServer': {
    en: 'Edit MCP Server',
    cn: '编辑MCP服务器'
  },
  'mcpConfig.name': {
    en: 'Server Name',
    cn: '服务器名称'
  },
  'mcpConfig.description': {
    en: 'Description',
    cn: '描述'
  },
  'mcpConfig.hostAddress': {
    en: 'Host Address',
    cn: '主机地址'
  },
  'mcpConfig.oauthConfig': {
    en: 'OAuth Configuration',
    cn: 'OAuth配置'
  },
  'mcpConfig.clientId': {
    en: 'Client ID',
    cn: '客户端ID'
  },
  'mcpConfig.clientSecret': {
    en: 'Client Secret',
    cn: '客户端密钥'
  },
  'mcpConfig.tokenUrl': {
    en: 'Token URL',
    cn: '令牌URL'
  },
  'mcpConfig.scope': {
    en: 'Scope',
    cn: '范围'
  },
  'mcpConfig.headers': {
    en: 'Custom Headers (JSON)',
    cn: '自定义请求头 (JSON)'
  },
  'mcpConfig.headersHint': {
    en: 'Optional: Add custom HTTP headers as JSON',
    cn: '可选：以JSON格式添加自定义HTTP请求头'
  },
  'mcpConfig.testConnection': {
    en: 'Test Connection',
    cn: '测试连接'
  },
  'mcpConfig.status.active': {
    en: 'Active',
    cn: '活跃'
  },
  'mcpConfig.status.inactive': {
    en: 'Inactive',
    cn: '未激活'
  },
  'mcpConfig.status.error': {
    en: 'Error',
    cn: '错误'
  },

  // Knowledge Base
  'knowledge.title': {
    en: 'Knowledge Base',
    cn: '知识库'
  },
  'knowledge.subtitle': {
    en: 'Manage documents and knowledge bases for RAG retrieval',
    cn: '管理用于RAG检索的文档和知识库'
  },
  'knowledge.upload': {
    en: 'Upload Document',
    cn: '上传文档'
  },
  'knowledge.documentTitle': {
    en: 'Document Title',
    cn: '文档标题'
  },
  'knowledge.category': {
    en: 'Category',
    cn: '分类'
  },
  'knowledge.fileName': {
    en: 'File Name',
    cn: '文件名'
  },
  'knowledge.fileType': {
    en: 'File Type',
    cn: '文件类型'
  },
  'knowledge.uploadTime': {
    en: 'Upload Time',
    cn: '上传时间'
  },
  'knowledge.indexingStatus': {
    en: 'Indexing Status',
    cn: '索引状态'
  },
  'knowledge.status.indexed': {
    en: 'Indexed',
    cn: '已索引'
  },
  'knowledge.status.processing': {
    en: 'Processing',
    cn: '处理中'
  },
  'knowledge.status.error': {
    en: 'Error',
    cn: '错误'
  },
  'knowledge.createKb': {
    en: 'Create Knowledge Base',
    cn: '创建知识库'
  },
  'knowledge.vectorDb': {
    en: 'Vector Database',
    cn: '向量数据库'
  },
  'knowledge.databaseEndpoint': {
    en: 'Database Endpoint',
    cn: '数据库端点'
  },
  'knowledge.storageUri': {
    en: 'S3 Storage URI',
    cn: 'S3存储URI'
  },
  'knowledge.sync': {
    en: 'Sync All',
    cn: '同步全部'
  },
  'knowledge.documents': {
    en: 'Documents',
    cn: '文档'
  },
  'knowledge.noDocuments': {
    en: 'No documents uploaded yet',
    cn: '尚未上传任何文档'
  },
  'knowledge.supportedFormats': {
    en: 'Supported formats: PDF, TXT, MD, DOCX',
    cn: '支持的格式：PDF、TXT、MD、DOCX'
  },

  // Infrastructure Configuration
  'infra.title': {
    en: 'Infrastructure Configuration',
    cn: '基础设施配置'
  },
  'infra.subtitle': {
    en: 'Configure deployment infrastructure for your agents',
    cn: '为您的智能体配置部署基础设施'
  },
  'infra.framework': {
    en: 'Application Framework',
    cn: '应用框架'
  },
  'infra.database': {
    en: 'Database Engine',
    cn: '数据库引擎'
  },
  'infra.deploy': {
    en: 'Deploy',
    cn: '部署'
  },
  'infra.selectFramework': {
    en: 'Select a framework',
    cn: '选择框架'
  },
  'infra.selectDatabase': {
    en: 'Select a database',
    cn: '选择数据库'
  },
  'infra.summary': {
    en: 'Configuration Summary',
    cn: '配置摘要'
  },
  'infra.selectBoth': {
    en: 'Please select both a framework and database to deploy',
    cn: '请同时选择框架和数据库以进行部署'
  },

  // Admin Menu
  'admin.languageSync': {
    en: 'Language Sync',
    cn: '语言同步'
  },
  'admin.mcpConfig': {
    en: 'MCP Configuration',
    cn: 'MCP配置'
  },
  'admin.skillConfig': {
    en: 'Skill Configuration',
    cn: '技能配置'
  },
  'admin.restApiConfig': {
    en: 'REST API Config',
    cn: 'REST API配置'
  },
  'admin.knowledgeBase': {
    en: 'Knowledge Base',
    cn: '知识库'
  },
  'admin.frameworkSettings': {
    en: 'Framework Settings',
    cn: '框架设置'
  },
  'admin.settings': {
    en: 'Members & Permissions',
    cn: '成员与权限'
  },
  'admin.logout': {
    en: 'Log Out',
    cn: '退出登录'
  },

  // Common Actions
  'common.save': {
    en: 'Save',
    cn: '保存'
  },
  'common.cancel': {
    en: 'Cancel',
    cn: '取消'
  },
  'common.delete': {
    en: 'Delete',
    cn: '删除'
  },
  'common.edit': {
    en: 'Edit',
    cn: '编辑'
  },
  'common.create': {
    en: 'Create',
    cn: '创建'
  },
  'common.search': {
    en: 'Search',
    cn: '搜索'
  },
  'common.filter': {
    en: 'Filter',
    cn: '筛选'
  },
  'common.loading': {
    en: 'Loading...',
    cn: '加载中...'
  },
  'common.error': {
    en: 'Error',
    cn: '错误'
  },
  'common.success': {
    en: 'Success',
    cn: '成功'
  },
  'common.retry': {
    en: 'Retry',
    cn: '重试'
  },
  'common.close': {
    en: 'Close',
    cn: '关闭'
  },
  'common.confirm': {
    en: 'Confirm',
    cn: '确认'
  },
  'common.allAgents': {
    en: 'All Agents',
    cn: '所有智能体'
  },
  'common.remove': {
    en: 'Remove',
    cn: '移除'
  },
  'common.disable': {
    en: 'Disable',
    cn: '禁用'
  },
  'common.enable': {
    en: 'Enable',
    cn: '启用'
  },

  // Validation Messages
  'validation.required': {
    en: 'This field is required',
    cn: '此字段为必填项'
  },
  'validation.invalidJson': {
    en: 'Invalid JSON format',
    cn: 'JSON格式无效'
  },
  'validation.invalidUrl': {
    en: 'Invalid URL format',
    cn: 'URL格式无效'
  },

  // Toast Messages
  'toast.saveSuccess': {
    en: 'Changes saved successfully',
    cn: '更改已成功保存'
  },
  'toast.saveError': {
    en: 'Failed to save changes',
    cn: '保存更改失败'
  },
  'toast.uploadSuccess': {
    en: 'File uploaded successfully',
    cn: '文件上传成功'
  },
  'toast.uploadError': {
    en: 'Failed to upload file',
    cn: '文件上传失败'
  },
  'toast.connectionError': {
    en: 'Connection error. Please try again.',
    cn: '连接错误，请重试。'
  },

  // Business Scope Creator
  'businessScope.create': {
    en: 'Create Business Scope',
    cn: '创建业务范围'
  },
  'businessScope.inputName': {
    en: 'Enter business domain name',
    cn: '输入业务领域名称'
  },
  'businessScope.generating': {
    en: 'Generating agent team',
    cn: '正在生成智能体团队'
  },
  'businessScope.preview': {
    en: 'Preview generated agents',
    cn: '预览生成的智能体'
  },
  'businessScope.customizing': {
    en: 'Customize appearance',
    cn: '自定义外观'
  },
  'businessScope.saving': {
    en: 'Saving',
    cn: '正在保存'
  },
  'businessScope.errorOccurred': {
    en: 'An error occurred',
    cn: '发生错误'
  },
  'businessScope.name': {
    en: 'Business Scope Name',
    cn: '业务范围名称'
  },
  'businessScope.namePlaceholder': {
    en: 'e.g., Asset Management, Human Resources, Customer Success',
    cn: '例如：逾期资产治理、Human Resources、Customer Success'
  },
  'businessScope.uploadDocs': {
    en: 'Upload Reference Documents (Optional)',
    cn: '上传参考文档（可选）'
  },
  'businessScope.generateAgents': {
    en: 'Generate Agents',
    cn: '生成智能体'
  },
  'businessScope.regenerate': {
    en: 'Regenerate',
    cn: '重新生成'
  },
  'businessScope.customizeAppearance': {
    en: 'Customize Appearance',
    cn: '自定义外观'
  },
  'businessScope.confirmCreate': {
    en: 'Confirm Create',
    cn: '确认创建'
  },
  'businessScope.backToPreview': {
    en: 'Back to Preview',
    cn: '返回预览'
  },
  'businessScope.retry': {
    en: 'Retry',
    cn: '重试'
  },
  'businessScope.confirmCancel': {
    en: 'Confirm Cancel?',
    cn: '确认取消？'
  },
  'businessScope.cancelWarning': {
    en: 'Generation is in progress. Canceling will lose all progress. Are you sure?',
    cn: '生成过程正在进行中，取消将丢失所有进度。确定要取消吗？'
  },
  'businessScope.continueGeneration': {
    en: 'Continue Generation',
    cn: '继续生成'
  },
  'businessScope.confirmCancelBtn': {
    en: 'Confirm Cancel',
    cn: '确认取消'
  },
  'businessScope.generatedCount': {
    en: 'Generated {count} agents',
    cn: '已生成 {count} 个智能体'
  },
  'businessScope.selectedCount': {
    en: '{selected} / {total} selected',
    cn: '{selected} / {total} 已选择'
  },
  'businessScope.savingProgress': {
    en: 'Creating business scope and {count} agents',
    cn: '正在创建业务范围和 {count} 个智能体'
  },
  'businessScope.createFailed': {
    en: 'Creation Failed',
    cn: '创建失败'
  },
  'businessScope.unknownError': {
    en: 'An unknown error occurred. Please try again.',
    cn: '发生未知错误，请重试'
  },

  // Generation Progress
  'generation.complete': {
    en: 'Generation Complete',
    cn: '生成完成'
  },
  'generation.inProgress': {
    en: 'Generating...',
    cn: '正在生成...'
  },
  'generation.scopeCreated': {
    en: '"{name}" business scope has been successfully created',
    cn: '"{name}" 业务范围已成功创建'
  },
  'generation.generatingTeam': {
    en: 'Generating agent team for "{name}"',
    cn: '正在为 "{name}" 生成智能体团队'
  },
  'generation.failed': {
    en: 'Generation Failed',
    cn: '生成失败'
  },
  'generation.retryHint': {
    en: 'You can click "Retry" to restart generation',
    cn: '您可以点击"重试"按钮重新开始生成'
  },
  'generation.success': {
    en: 'Generation Successful',
    cn: '生成成功'
  },
  'generation.successMessage': {
    en: 'Successfully generated {count} agents. Please preview and confirm in the next step.',
    cn: '已成功生成 {count} 个智能体，请在下一步预览和确认'
  },
  'generation.step.businessAnalysis': {
    en: 'Business Analysis',
    cn: '业务分析'
  },
  'generation.step.documentAnalysis': {
    en: 'Document Analysis',
    cn: '文档分析'
  },
  'generation.step.roleIdentification': {
    en: 'Role Identification',
    cn: '角色识别'
  },
  'generation.step.agentCreation': {
    en: 'Agent Creation',
    cn: '智能体创建'
  },
  'generation.step.documentGeneration': {
    en: 'Document Generation',
    cn: '文档生成'
  },
  'generation.step.finalization': {
    en: 'Finalization',
    cn: '完成'
  },

  // Document Uploader
  'docUploader.removeDoc': {
    en: 'Remove document',
    cn: '移除文档'
  },
  'docUploader.dropOrClick': {
    en: 'Drop files here or click to upload',
    cn: '拖拽文件到此处或点击上传'
  },
  'docUploader.releaseToUpload': {
    en: 'Release to upload files',
    cn: '释放以上传文件'
  },
  'docUploader.supportedFormats': {
    en: 'Supports PDF, DOC, DOCX, TXT, MD formats',
    cn: '支持 PDF, DOC, DOCX, TXT, MD 格式'
  },
  'docUploader.unsupportedType': {
    en: 'Unsupported file type: {files}',
    cn: '不支持的文件类型: {files}'
  },
  'docUploader.uploadedCount': {
    en: 'Uploaded {count} files',
    cn: '已上传 {count} 个文件'
  },
  'docUploader.helperText': {
    en: 'Uploading documents helps AI better understand your business scenario (optional)',
    cn: '上传文档可以帮助 AI 更好地理解您的业务场景（可选）'
  },

  // Agent Preview Card
  'agentPreview.removed': {
    en: 'Removed',
    cn: '已移除'
  },
  'agentPreview.restore': {
    en: 'Restore this agent',
    cn: '恢复此智能体'
  },
  'agentPreview.remove': {
    en: 'Remove this agent',
    cn: '移除此智能体'
  },
  'agentPreview.keepOne': {
    en: 'At least one agent must be kept',
    cn: '至少需要保留一个智能体'
  },
  'agentPreview.responsibilities': {
    en: 'Core Responsibilities',
    cn: '核心职责'
  },
  'agentPreview.systemPrompt': {
    en: 'System Prompt Summary',
    cn: '系统提示词摘要'
  },
  'agentPreview.suggestedTools': {
    en: 'Suggested Tools',
    cn: '建议工具'
  },
  'agentPreview.capabilities': {
    en: 'Core Capabilities',
    cn: '核心能力'
  },

  // Business Scope Customizer
  'customizer.preview': {
    en: 'Preview',
    cn: '预览'
  },
  'customizer.agentCount': {
    en: '{count} agents',
    cn: '{count} 个智能体'
  },
  'customizer.recommendation': {
    en: 'Recommended based on business domain',
    cn: '根据业务领域推荐'
  },
  'customizer.applyRecommendation': {
    en: 'Apply Recommendation',
    cn: '应用推荐'
  },
  'customizer.clickToApply': {
    en: 'Click to apply recommended icon and color',
    cn: '点击应用推荐的图标和颜色'
  },
  'customizer.selectIcon': {
    en: 'Select Icon',
    cn: '选择图标'
  },
  'customizer.selectColor': {
    en: 'Select Color',
    cn: '选择颜色'
  },
  'customizer.description': {
    en: 'Description (Optional)',
    cn: '描述（可选）'
  },
  'customizer.descriptionPlaceholder': {
    en: 'Enter a brief description of the business scope...',
    cn: '输入业务范围的简要描述...'
  },
  'customizer.color.green': {
    en: 'Green',
    cn: '绿色'
  },
  'customizer.color.blue': {
    en: 'Blue',
    cn: '蓝色'
  },
  'customizer.color.orange': {
    en: 'Orange',
    cn: '橙色'
  },
  'customizer.color.purple': {
    en: 'Purple',
    cn: '紫色'
  },
  'customizer.color.pink': {
    en: 'Pink',
    cn: '粉色'
  },
  'customizer.color.cyan': {
    en: 'Cyan',
    cn: '青色'
  },
  'customizer.color.redOrange': {
    en: 'Red Orange',
    cn: '红橙'
  },
  'customizer.color.grayBlue': {
    en: 'Gray Blue',
    cn: '灰蓝'
  },
  'customizer.color.brown': {
    en: 'Brown',
    cn: '棕色'
  },
  'customizer.color.indigo': {
    en: 'Indigo',
    cn: '靛蓝'
  }
}

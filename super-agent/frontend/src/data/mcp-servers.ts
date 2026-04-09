/**
 * Shared MCP server catalog used by both the Tools page and the MCPServersPanel.
 * Single source of truth for all recommended / marketplace MCP servers.
 *
 * `config.defaultScopeConfig` is the full MCP server JSON block that gets seeded
 * into `scope_mcp_servers.scope_config` when a user adds the server to a business
 * scope. It mirrors the format of `.claude/settings.json` mcpServers entries so
 * the value can be directly copied over at runtime.
 */

export interface McpServerEntry {
  id: string
  name: string
  description: string
  tags: string[]
  author?: string
  source: 'community' | 'aws'
  marketplaceUrl?: string
  /** Default stdio config for quick-add (if available) */
  config?: {
    type: string
    command: string
    args: string[]
    /**
     * Full MCP server JSON block seeded into scope_config when added to a scope.
     * Matches the shape of a single entry inside `mcpServers` in `.claude/settings.json`.
     */
    defaultScopeConfig?: Record<string, unknown>
  }
}

/** Helper: build a standard uvx-based AWS MCP scope config block wrapped in mcpServers */
function awsScopeConfig(pkg: string, extraEnv?: Record<string, string>): Record<string, unknown> {
  return {
    mcpServers: {
      [pkg]: {
        command: 'uvx',
        args: [`${pkg}@latest`],
        env: { FASTMCP_LOG_LEVEL: 'ERROR', AWS_REGION: 'us-east-1', AWS_PROFILE: '', ...extraEnv },
        disabled: false,
        autoApprove: [],
      },
    },
  }
}

// ── Community / Anthropic MCP Servers ──
const COMMUNITY_SERVERS: McpServerEntry[] = [
  {
    id: 'mcp-m1', name: 'brave-search', source: 'community',
    description: 'Web search via Brave Search API — real-time info, no tracking.',
    tags: ['search', 'web'], author: 'anthropic',
    marketplaceUrl: 'https://mcp.so/server/brave-search',
    config: {
      type: 'stdio', command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-brave-search'],
      defaultScopeConfig: {
        mcpServers: { 'brave-search': {
          command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-brave-search'],
          env: { BRAVE_API_KEY: '' }, disabled: false, autoApprove: [],
        } },
      },
    },
  },
  {
    id: 'mcp-m2', name: 'postgres', source: 'community',
    description: 'Direct PostgreSQL database access with read/write capabilities.',
    tags: ['database', 'sql'], author: 'anthropic',
    marketplaceUrl: 'https://mcp.so/server/postgres',
    config: {
      type: 'stdio', command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-postgres'],
      defaultScopeConfig: {
        mcpServers: { postgres: {
          command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-postgres', 'postgres://user:password@host:5432/database'],
          env: {}, disabled: false, autoApprove: [],
        } },
      },
    },
  },
  {
    id: 'mcp-m3', name: 'puppeteer', source: 'community',
    description: 'Browser automation — screenshots, navigation, form filling.',
    tags: ['browser', 'automation'], author: 'anthropic',
    marketplaceUrl: 'https://mcp.so/server/puppeteer',
    config: {
      type: 'stdio', command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-puppeteer'],
      defaultScopeConfig: {
        mcpServers: { puppeteer: {
          command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-puppeteer'],
          env: {}, disabled: false, autoApprove: [],
        } },
      },
    },
  },
  {
    id: 'mcp-m4', name: 'filesystem', source: 'community',
    description: 'Read/write/search local files with sandboxed access.',
    tags: ['files', 'storage'], author: 'anthropic',
    marketplaceUrl: 'https://mcp.so/server/filesystem',
    config: {
      type: 'stdio', command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-filesystem'],
      defaultScopeConfig: {
        mcpServers: { filesystem: {
          command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-filesystem', '/path/to/allowed/directory'],
          env: {}, disabled: false, autoApprove: [],
        } },
      },
    },
  },
  {
    id: 'mcp-m5', name: 'memory', source: 'community',
    description: 'Persistent key-value memory across conversations.',
    tags: ['memory', 'context'], author: 'anthropic',
    marketplaceUrl: 'https://mcp.so/server/memory',
    config: {
      type: 'stdio', command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-memory'],
      defaultScopeConfig: {
        mcpServers: { memory: {
          command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-memory'],
          env: {}, disabled: false, autoApprove: [],
        } },
      },
    },
  },
  {
    id: 'mcp-m6', name: 'github', source: 'community',
    description: 'GitHub API — repos, issues, PRs, code search.',
    tags: ['github', 'vcs'], author: 'anthropic',
    marketplaceUrl: 'https://mcp.so/server/github',
    config: {
      type: 'stdio', command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-github'],
      defaultScopeConfig: {
        mcpServers: { github: {
          command: 'npx', args: ['-y', '@anthropic-ai/mcp-server-github'],
          env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' }, disabled: false, autoApprove: [],
        } },
      },
    },
  },
]

// ── AWS MCP Servers (from github.com/awslabs/mcp) ──
const AWS_SERVERS: McpServerEntry[] = [
  { id: 'mcp-aws-1', name: 'AWS MCP Server', source: 'aws', description: 'Secure, auditable AWS interactions. Comprehensive AWS API support with documentation access, Agent SOPs, IAM-based permissions, and CloudTrail audit logging.', tags: ['aws', 'api', 'infrastructure'], author: 'awslabs', marketplaceUrl: 'https://awslabs.github.io/mcp/servers/aws-mcp-server/', config: { type: 'stdio', command: 'uvx', args: ['awslabs.aws-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.aws-mcp-server') } },
  { id: 'mcp-aws-2', name: 'AWS Knowledge MCP Server', source: 'aws', description: 'Fully-managed MCP server providing access to latest AWS docs, API references, What\'s New posts, Builder Center, Blog posts, and Well-Architected guidance.', tags: ['aws', 'docs', 'knowledge'], author: 'awslabs', marketplaceUrl: 'https://awslabs.github.io/mcp/servers/aws-knowledge-mcp-server/' },
  { id: 'mcp-aws-3', name: 'AWS Documentation MCP Server', source: 'aws', description: 'Get latest AWS documentation and API references directly in your development environment.', tags: ['aws', 'docs'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/aws-documentation-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.aws-documentation-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.aws-documentation-mcp-server') } },
  { id: 'mcp-aws-4', name: 'AWS IaC MCP Server', source: 'aws', description: 'Complete Infrastructure as Code toolkit with CloudFormation docs, CDK best practices, construct examples, security validation, and deployment troubleshooting.', tags: ['aws', 'iac', 'cloudformation', 'cdk'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/iac-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.iac-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.iac-mcp-server') } },
  { id: 'mcp-aws-5', name: 'AWS Cloud Control API MCP Server', source: 'aws', description: 'Direct AWS resource management with security scanning and best practices.', tags: ['aws', 'cloud-control'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/cloudcontrol-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.cloudcontrol-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.cloudcontrol-mcp-server') } },
  { id: 'mcp-aws-6', name: 'AWS Terraform MCP Server', source: 'aws', description: 'Terraform workflows with integrated security scanning for AWS infrastructure.', tags: ['aws', 'terraform', 'iac'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/terraform-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.terraform-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.terraform-mcp-server') } },
  { id: 'mcp-aws-7', name: 'AWS CloudFormation MCP Server', source: 'aws', description: 'Direct CloudFormation resource management via Cloud Control API.', tags: ['aws', 'cloudformation'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/cfn-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.cfn-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.cfn-mcp-server') } },
  { id: 'mcp-aws-8', name: 'Amazon EKS MCP Server', source: 'aws', description: 'Kubernetes cluster management and application deployment on Amazon EKS.', tags: ['aws', 'eks', 'kubernetes'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/eks-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.eks-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.eks-mcp-server') } },
  { id: 'mcp-aws-9', name: 'Amazon ECS MCP Server', source: 'aws', description: 'Container orchestration and ECS application deployment.', tags: ['aws', 'ecs', 'containers'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/ecs-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.ecs-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.ecs-mcp-server') } },
  { id: 'mcp-aws-10', name: 'Finch MCP Server', source: 'aws', description: 'Local container building with ECR integration.', tags: ['aws', 'finch', 'containers', 'ecr'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/finch-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.finch-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.finch-mcp-server') } },
  { id: 'mcp-aws-11', name: 'AWS Serverless MCP Server', source: 'aws', description: 'Complete serverless application lifecycle with SAM CLI.', tags: ['aws', 'serverless', 'sam', 'lambda'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/serverless-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.serverless-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.serverless-mcp-server') } },
  { id: 'mcp-aws-12', name: 'AWS Lambda Tool MCP Server', source: 'aws', description: 'Execute Lambda functions as AI tools for private resource access.', tags: ['aws', 'lambda'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/lambda-tool-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.lambda-tool-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.lambda-tool-mcp-server') } },
  { id: 'mcp-aws-13', name: 'AWS Support MCP Server', source: 'aws', description: 'Create and manage AWS Support cases.', tags: ['aws', 'support'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/aws-support-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.aws-support-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.aws-support-mcp-server') } },
  { id: 'mcp-aws-14', name: 'Amazon Bedrock KB Retrieval MCP Server', source: 'aws', description: 'Query enterprise knowledge bases with citation support via Amazon Bedrock.', tags: ['aws', 'bedrock', 'rag', 'ai'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/bedrock-kb-retrieval-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.bedrock-kb-retrieval-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.bedrock-kb-retrieval-mcp-server', { KNOWLEDGE_BASE_ID: '' }) } },
  { id: 'mcp-aws-15', name: 'Amazon Kendra Index MCP Server', source: 'aws', description: 'Enterprise search and RAG enhancement via Amazon Kendra.', tags: ['aws', 'kendra', 'search', 'rag'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/kendra-index-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.kendra-index-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.kendra-index-mcp-server', { KENDRA_INDEX_ID: '' }) } },
  { id: 'mcp-aws-16', name: 'Amazon Nova Canvas MCP Server', source: 'aws', description: 'Generate images from text descriptions and color palettes using Amazon Nova.', tags: ['aws', 'nova', 'image-gen', 'ai'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/nova-canvas-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.nova-canvas-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.nova-canvas-mcp-server') } },
  { id: 'mcp-aws-17', name: 'Amazon DynamoDB MCP Server', source: 'aws', description: 'Complete DynamoDB operations and table management.', tags: ['aws', 'dynamodb', 'nosql'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/dynamodb-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.dynamodb-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.dynamodb-mcp-server') } },
  { id: 'mcp-aws-18', name: 'Amazon Aurora PostgreSQL MCP Server', source: 'aws', description: 'PostgreSQL database operations via RDS Data API.', tags: ['aws', 'aurora', 'postgresql'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/postgres-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.postgres-mcp-server@latest'], defaultScopeConfig: { mcpServers: { 'awslabs.postgres-mcp-server': { command: 'uvx', args: ['awslabs.postgres-mcp-server@latest', '--allow_write_query'], env: { AWS_PROFILE: '', AWS_REGION: 'us-east-1', FASTMCP_LOG_LEVEL: 'ERROR' }, disabled: false, autoApprove: [] } } } } },
  { id: 'mcp-aws-19', name: 'Amazon Aurora MySQL MCP Server', source: 'aws', description: 'MySQL database operations via RDS Data API.', tags: ['aws', 'aurora', 'mysql'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/mysql-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.mysql-mcp-server@latest'], defaultScopeConfig: { mcpServers: { 'awslabs.mysql-mcp-server': { command: 'uvx', args: ['awslabs.mysql-mcp-server@latest', '--allow_write_query'], env: { AWS_PROFILE: '', AWS_REGION: 'us-east-1', FASTMCP_LOG_LEVEL: 'ERROR' }, disabled: false, autoApprove: [] } } } } },
  { id: 'mcp-aws-20', name: 'Amazon Aurora DSQL MCP Server', source: 'aws', description: 'Distributed SQL with PostgreSQL compatibility.', tags: ['aws', 'aurora', 'dsql'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/aurora-dsql-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.aurora-dsql-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.aurora-dsql-mcp-server') } },
  { id: 'mcp-aws-21', name: 'Amazon DocumentDB MCP Server', source: 'aws', description: 'MongoDB-compatible document database operations.', tags: ['aws', 'documentdb', 'mongodb'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/documentdb-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.documentdb-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.documentdb-mcp-server') } },
  { id: 'mcp-aws-22', name: 'Amazon Neptune MCP Server', source: 'aws', description: 'Graph database queries with openCypher and Gremlin.', tags: ['aws', 'neptune', 'graph-db'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/neptune-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.neptune-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.neptune-mcp-server') } },
  { id: 'mcp-aws-23', name: 'Amazon Keyspaces MCP Server', source: 'aws', description: 'Apache Cassandra-compatible operations on Amazon Keyspaces.', tags: ['aws', 'keyspaces', 'cassandra'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/keyspaces-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.keyspaces-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.keyspaces-mcp-server') } },
  { id: 'mcp-aws-24', name: 'Amazon Timestream MCP Server', source: 'aws', description: 'Time-series database operations and InfluxDB compatibility.', tags: ['aws', 'timestream', 'timeseries'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/timestream-for-influxdb-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.timestream-for-influxdb-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.timestream-for-influxdb-mcp-server') } },
  { id: 'mcp-aws-25', name: 'Amazon Redshift MCP Server', source: 'aws', description: 'Data warehouse operations and analytics queries.', tags: ['aws', 'redshift', 'analytics'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/redshift-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.redshift-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.redshift-mcp-server') } },
  { id: 'mcp-aws-26', name: 'Amazon OpenSearch MCP Server', source: 'aws', description: 'OpenSearch powered search, analytics, and observability.', tags: ['aws', 'opensearch', 'analytics'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/opensearch-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.opensearch-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.opensearch-mcp-server') } },
  { id: 'mcp-aws-27', name: 'Amazon ElastiCache MCP Server', source: 'aws', description: 'Complete ElastiCache control plane operations.', tags: ['aws', 'elasticache', 'caching'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/elasticache-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.elasticache-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.elasticache-mcp-server') } },
  { id: 'mcp-aws-28', name: 'AWS IAM MCP Server', source: 'aws', description: 'Comprehensive IAM user, role, group, and policy management with security best practices.', tags: ['aws', 'iam', 'security'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/iam-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.iam-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.iam-mcp-server') } },
  { id: 'mcp-aws-29', name: 'AWS Diagram MCP Server', source: 'aws', description: 'Generate architecture diagrams and technical illustrations.', tags: ['aws', 'diagrams', 'architecture'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/diagram-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.diagram-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.diagram-mcp-server') } },
  { id: 'mcp-aws-30', name: 'Amazon SNS / SQS MCP Server', source: 'aws', description: 'Event-driven messaging and queue management.', tags: ['aws', 'sns', 'sqs', 'messaging'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/sns-sqs-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.sns-sqs-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.sns-sqs-mcp-server') } },
  { id: 'mcp-aws-31', name: 'AWS Step Functions MCP Server', source: 'aws', description: 'Execute complex workflows and business processes.', tags: ['aws', 'step-functions', 'workflows'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/stepfunctions-tool-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.stepfunctions-tool-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.stepfunctions-tool-mcp-server') } },
  { id: 'mcp-aws-32', name: 'Amazon Location Service MCP Server', source: 'aws', description: 'Place search, geocoding, and route optimization.', tags: ['aws', 'location', 'geocoding'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/location-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.location-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.location-mcp-server') } },
  { id: 'mcp-aws-33', name: 'AWS Pricing MCP Server', source: 'aws', description: 'AWS service pricing and cost estimates.', tags: ['aws', 'pricing', 'cost'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/pricing-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.pricing-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.pricing-mcp-server') } },
  { id: 'mcp-aws-34', name: 'AWS Cost Explorer MCP Server', source: 'aws', description: 'Detailed cost analysis and reporting.', tags: ['aws', 'cost', 'billing'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/cost-explorer-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.cost-explorer-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.cost-explorer-mcp-server') } },
  { id: 'mcp-aws-35', name: 'Amazon CloudWatch MCP Server', source: 'aws', description: 'Metrics, alarms, and logs analysis and operational troubleshooting.', tags: ['aws', 'cloudwatch', 'monitoring'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/cloudwatch-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.cloudwatch-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.cloudwatch-mcp-server') } },
  { id: 'mcp-aws-36', name: 'AWS S3 Tables MCP Server', source: 'aws', description: 'Manage S3 Tables for optimized analytics.', tags: ['aws', 's3', 'analytics'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/s3-tables-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.s3-tables-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.s3-tables-mcp-server') } },
  { id: 'mcp-aws-37', name: 'AWS AppSync MCP Server', source: 'aws', description: 'Manage and interact with application backends powered by AWS AppSync.', tags: ['aws', 'appsync', 'graphql'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/appsync-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.appsync-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.appsync-mcp-server') } },
  { id: 'mcp-aws-38', name: 'AWS HealthOmics MCP Server', source: 'aws', description: 'Generate, run, debug and optimize lifescience workflows.', tags: ['aws', 'healthomics', 'lifesciences'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/healthomics-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.healthomics-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.healthomics-mcp-server') } },
  { id: 'mcp-aws-39', name: 'AWS CloudTrail MCP Server', source: 'aws', description: 'CloudTrail events querying and analysis.', tags: ['aws', 'cloudtrail', 'audit'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/cloudtrail-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.cloudtrail-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.cloudtrail-mcp-server') } },
  { id: 'mcp-aws-40', name: 'AWS Data Processing MCP Server', source: 'aws', description: 'Comprehensive data processing tools and real-time pipeline visibility across AWS Glue and Amazon EMR.', tags: ['aws', 'glue', 'emr', 'etl'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/dataprocessing-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.dataprocessing-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.dataprocessing-mcp-server') } },
  { id: 'mcp-aws-41', name: 'Amazon Bedrock AgentCore MCP Server', source: 'aws', description: 'Access AgentCore documentation, Runtime, Memory, Code Interpreter, Browser, Gateway, Observability, and Identity services.', tags: ['aws', 'bedrock', 'agentcore', 'agents'], author: 'awslabs', marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/amazon-bedrock-agentcore-mcp-server', config: { type: 'stdio', command: 'uvx', args: ['awslabs.amazon-bedrock-agentcore-mcp-server@latest'], defaultScopeConfig: awsScopeConfig('awslabs.amazon-bedrock-agentcore-mcp-server') } },
]

/** Full catalog: community servers first, then AWS */
export const MCP_SERVER_CATALOG: McpServerEntry[] = [
  ...COMMUNITY_SERVERS,
  ...AWS_SERVERS,
]

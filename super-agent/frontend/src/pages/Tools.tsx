import { useState, useEffect, useCallback } from 'react'
import {
  Search, ExternalLink, Package, Server, Puzzle,
  Sparkles, Download, Star, Globe,
  Wrench, BookOpen, Zap, Shield, BarChart3,
  GitBranch, Terminal, MessageSquare, Database,
  FileText, Code, Eye, Loader2, Cloud,
  Container, Lock, Cpu, Activity, HardDrive,
  Network, DollarSign, Heart, Layers,
} from 'lucide-react'
import { restClient } from '@/services/api/restClient'
import { GroupAccessPopover } from '@/components/GroupAccessPopover'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

type ToolCategory = 'all' | 'skills' | 'mcp' | 'plugins'
type ToolSource = 'all' | 'internal' | 'marketplace'

interface ToolItem {
  id: string
  name: string
  description: string
  category: ToolCategory
  source: ToolSource
  icon: typeof Package
  tags: string[]
  author?: string
  installs?: number
  rating?: number
  installed?: boolean
  marketplaceUrl?: string
  marketplaceName?: string
  /** Real skill/MCP UUID for API calls (e.g. group access). Differs from display `id`. */
  resourceId?: string
}

/* ================================================================== */
/*  Fake data — internal tools only (marketplace loaded from API)      */
/* ================================================================== */

/** Response shape from /api/skills/marketplace/featured */
interface MarketplaceSkillResult {
  owner: string
  name: string
  installRef: string
  url: string
  description: string | null
}

const CACHE_KEY = 'tools_marketplace_skills_cache'
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function getCachedMarketplaceSkills(): MarketplaceSkillResult[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, expiresAt } = JSON.parse(raw) as { data: MarketplaceSkillResult[]; expiresAt: number }
    if (Date.now() > expiresAt) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return data
  } catch {
    localStorage.removeItem(CACHE_KEY)
    return null
  }
}

function setCachedMarketplaceSkills(data: MarketplaceSkillResult[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, expiresAt: Date.now() + CACHE_TTL }))
  } catch { /* storage full — ignore */ }
}

/** Convert a marketplace API result into a ToolItem for display */
function marketplaceSkillToToolItem(skill: MarketplaceSkillResult, index: number): ToolItem {
  return {
    id: `skill-m-${index}`,
    name: skill.name,
    description: skill.description || `Skill from ${skill.owner}`,
    category: 'skills',
    source: 'marketplace',
    icon: Sparkles,
    tags: skill.name.split('-').filter(t => t.length > 1),
    author: skill.owner.split('/')[0] || skill.owner,
    marketplaceUrl: skill.url,
    marketplaceName: 'skills.sh',
  }
}

/** Enterprise skill from /api/skills/enterprise */
interface EnterpriseSkillResult {
  id: string
  skillId: string
  name: string
  displayName: string
  description: string | null
  version: string
  category: string | null
  source: string
  sourceRef: string | null
  installCount: number
  voteScore: number
  publishedBy: string
  publishedAt: string
}

/** Convert an enterprise catalog skill into a ToolItem */
function enterpriseSkillToToolItem(skill: EnterpriseSkillResult): ToolItem {
  return {
    id: `ent-${skill.id}`,
    name: skill.displayName,
    description: skill.description || `Published internally`,
    category: 'skills',
    source: 'internal',
    icon: Zap,
    tags: skill.category ? [skill.category] : [],
    installed: true,
    resourceId: skill.skillId,
  }
}


const STATIC_TOOLS: ToolItem[] = [
  // ── Internal Skills ──
  {
    id: 'skill-1', name: 'Financial Report Generator', description: 'Generates quarterly and annual financial reports with automated data aggregation, chart creation, and executive summary writing.',
    category: 'skills', source: 'internal', icon: BarChart3,
    tags: ['finance', 'reporting'], installed: true,
  },
  {
    id: 'skill-2', name: 'Compliance Checker', description: 'Validates documents and processes against regulatory requirements. Supports SOX, GDPR, and internal policy frameworks.',
    category: 'skills', source: 'internal', icon: Shield,
    tags: ['compliance', 'audit'], installed: true,
  },
  {
    id: 'skill-3', name: 'Code Review Assistant', description: 'Performs thorough code reviews with focus on security vulnerabilities, performance issues, and best practice adherence.',
    category: 'skills', source: 'internal', icon: Code,
    tags: ['development', 'review'], installed: true,
  },
  // ── Internal MCP Servers ──
  {
    id: 'mcp-1', name: 'promptx', description: 'Dynamic prompt management and context injection. Provides structured prompting patterns for consistent agent behavior.',
    category: 'mcp', source: 'internal', icon: Terminal,
    tags: ['prompts', 'context'], installed: true,
  },
  {
    id: 'mcp-2', name: 'GitHub Integration', description: 'Full GitHub API access — repositories, issues, PRs, actions. Enables agents to manage code workflows directly.',
    category: 'mcp', source: 'internal', icon: GitBranch,
    tags: ['github', 'vcs'], installed: true,
  },
  {
    id: 'mcp-3', name: 'Slack Integration', description: 'Send and receive Slack messages, manage channels, and respond to events. Enables agent-to-human communication.',
    category: 'mcp', source: 'internal', icon: MessageSquare,
    tags: ['slack', 'communication'], installed: true,
  },
  // ── Marketplace MCP Servers (mcp.so / Anthropic) ──
  {
    id: 'mcp-m1', name: 'brave-search', description: 'Web search via Brave Search API. Provides real-time internet access for research, fact-checking, and current information retrieval.',
    category: 'mcp', source: 'marketplace', icon: Globe,
    tags: ['search', 'web'], author: 'anthropic', installs: 45000, rating: 4.9,
    marketplaceUrl: 'https://mcp.so/server/brave-search', marketplaceName: 'mcp.so',
  },
  {
    id: 'mcp-m2', name: 'postgres', description: 'Direct PostgreSQL database access with read/write capabilities. Schema inspection, query execution, and data analysis.',
    category: 'mcp', source: 'marketplace', icon: Database,
    tags: ['database', 'sql'], author: 'anthropic', installs: 32000, rating: 4.8,
    marketplaceUrl: 'https://mcp.so/server/postgres', marketplaceName: 'mcp.so',
  },
  {
    id: 'mcp-m3', name: 'puppeteer', description: 'Browser automation and web scraping. Navigate pages, fill forms, take screenshots, and extract structured data from websites.',
    category: 'mcp', source: 'marketplace', icon: Eye,
    tags: ['browser', 'automation'], author: 'anthropic', installs: 28000, rating: 4.7,
    marketplaceUrl: 'https://mcp.so/server/puppeteer', marketplaceName: 'mcp.so',
  },
  {
    id: 'mcp-m4', name: 'filesystem', description: 'Secure file system access with configurable root directories. Read, write, search, and manage files within sandboxed paths.',
    category: 'mcp', source: 'marketplace', icon: FileText,
    tags: ['files', 'storage'], author: 'anthropic', installs: 51000, rating: 4.9,
    marketplaceUrl: 'https://mcp.so/server/filesystem', marketplaceName: 'mcp.so',
  },
  // ── AWS MCP Servers (from github.com/awslabs/mcp) ──
  {
    id: 'mcp-aws-1', name: 'AWS MCP Server', description: 'Secure, auditable AWS interactions. Comprehensive AWS API support with documentation access, Agent SOPs, IAM-based permissions, and CloudTrail audit logging.',
    category: 'mcp', source: 'marketplace', icon: Cloud,
    tags: ['aws', 'api', 'infrastructure'], author: 'awslabs',
    marketplaceUrl: 'https://awslabs.github.io/mcp/servers/aws-mcp-server/', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-2', name: 'AWS Knowledge MCP Server', description: 'Fully-managed MCP server providing access to latest AWS docs, API references, What\'s New posts, Builder Center, Blog posts, and Well-Architected guidance.',
    category: 'mcp', source: 'marketplace', icon: BookOpen,
    tags: ['aws', 'docs', 'knowledge'], author: 'awslabs',
    marketplaceUrl: 'https://awslabs.github.io/mcp/servers/aws-knowledge-mcp-server/', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-3', name: 'AWS Documentation MCP Server', description: 'Get latest AWS documentation and API references directly in your development environment.',
    category: 'mcp', source: 'marketplace', icon: FileText,
    tags: ['aws', 'docs'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/aws-documentation-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-4', name: 'AWS IaC MCP Server', description: 'Complete Infrastructure as Code toolkit with CloudFormation docs, CDK best practices, construct examples, security validation, and deployment troubleshooting.',
    category: 'mcp', source: 'marketplace', icon: Layers,
    tags: ['aws', 'iac', 'cloudformation', 'cdk'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/iac-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-5', name: 'AWS Cloud Control API MCP Server', description: 'Direct AWS resource management with security scanning and best practices.',
    category: 'mcp', source: 'marketplace', icon: Cloud,
    tags: ['aws', 'cloud-control'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/cloudcontrol-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-6', name: 'AWS Terraform MCP Server', description: 'Terraform workflows with integrated security scanning for AWS infrastructure.',
    category: 'mcp', source: 'marketplace', icon: Layers,
    tags: ['aws', 'terraform', 'iac'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/terraform-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-7', name: 'AWS CloudFormation MCP Server', description: 'Direct CloudFormation resource management via Cloud Control API.',
    category: 'mcp', source: 'marketplace', icon: Layers,
    tags: ['aws', 'cloudformation'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/cfn-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-8', name: 'Amazon EKS MCP Server', description: 'Kubernetes cluster management and application deployment on Amazon EKS.',
    category: 'mcp', source: 'marketplace', icon: Container,
    tags: ['aws', 'eks', 'kubernetes'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/eks-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-9', name: 'Amazon ECS MCP Server', description: 'Container orchestration and ECS application deployment.',
    category: 'mcp', source: 'marketplace', icon: Container,
    tags: ['aws', 'ecs', 'containers'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/ecs-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-10', name: 'Finch MCP Server', description: 'Local container building with ECR integration.',
    category: 'mcp', source: 'marketplace', icon: Container,
    tags: ['aws', 'finch', 'containers', 'ecr'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/finch-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-11', name: 'AWS Serverless MCP Server', description: 'Complete serverless application lifecycle with SAM CLI.',
    category: 'mcp', source: 'marketplace', icon: Zap,
    tags: ['aws', 'serverless', 'sam', 'lambda'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/serverless-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-12', name: 'AWS Lambda Tool MCP Server', description: 'Execute Lambda functions as AI tools for private resource access.',
    category: 'mcp', source: 'marketplace', icon: Zap,
    tags: ['aws', 'lambda'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/lambda-tool-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-13', name: 'AWS Support MCP Server', description: 'Create and manage AWS Support cases.',
    category: 'mcp', source: 'marketplace', icon: MessageSquare,
    tags: ['aws', 'support'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/aws-support-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-14', name: 'Amazon Bedrock KB Retrieval MCP Server', description: 'Query enterprise knowledge bases with citation support via Amazon Bedrock.',
    category: 'mcp', source: 'marketplace', icon: Cpu,
    tags: ['aws', 'bedrock', 'rag', 'ai'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/bedrock-kb-retrieval-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-15', name: 'Amazon Kendra Index MCP Server', description: 'Enterprise search and RAG enhancement via Amazon Kendra.',
    category: 'mcp', source: 'marketplace', icon: Globe,
    tags: ['aws', 'kendra', 'search', 'rag'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/kendra-index-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-16', name: 'Amazon Nova Canvas MCP Server', description: 'Generate images from text descriptions and color palettes using Amazon Nova.',
    category: 'mcp', source: 'marketplace', icon: Cpu,
    tags: ['aws', 'nova', 'image-gen', 'ai'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/nova-canvas-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-17', name: 'Amazon DynamoDB MCP Server', description: 'Complete DynamoDB operations and table management.',
    category: 'mcp', source: 'marketplace', icon: Database,
    tags: ['aws', 'dynamodb', 'nosql'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/dynamodb-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-18', name: 'Amazon Aurora PostgreSQL MCP Server', description: 'PostgreSQL database operations via RDS Data API.',
    category: 'mcp', source: 'marketplace', icon: Database,
    tags: ['aws', 'aurora', 'postgresql'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/postgres-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-19', name: 'Amazon Aurora MySQL MCP Server', description: 'MySQL database operations via RDS Data API.',
    category: 'mcp', source: 'marketplace', icon: Database,
    tags: ['aws', 'aurora', 'mysql'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/mysql-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-20', name: 'Amazon Aurora DSQL MCP Server', description: 'Distributed SQL with PostgreSQL compatibility.',
    category: 'mcp', source: 'marketplace', icon: Database,
    tags: ['aws', 'aurora', 'dsql'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/aurora-dsql-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-21', name: 'Amazon DocumentDB MCP Server', description: 'MongoDB-compatible document database operations.',
    category: 'mcp', source: 'marketplace', icon: Database,
    tags: ['aws', 'documentdb', 'mongodb'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/documentdb-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-22', name: 'Amazon Neptune MCP Server', description: 'Graph database queries with openCypher and Gremlin.',
    category: 'mcp', source: 'marketplace', icon: Network,
    tags: ['aws', 'neptune', 'graph-db'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/neptune-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-23', name: 'Amazon Keyspaces MCP Server', description: 'Apache Cassandra-compatible operations on Amazon Keyspaces.',
    category: 'mcp', source: 'marketplace', icon: Database,
    tags: ['aws', 'keyspaces', 'cassandra'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/keyspaces-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-24', name: 'Amazon Timestream MCP Server', description: 'Time-series database operations and InfluxDB compatibility.',
    category: 'mcp', source: 'marketplace', icon: Activity,
    tags: ['aws', 'timestream', 'timeseries'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/timestream-for-influxdb-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-25', name: 'Amazon Redshift MCP Server', description: 'Data warehouse operations and analytics queries.',
    category: 'mcp', source: 'marketplace', icon: Database,
    tags: ['aws', 'redshift', 'analytics'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/redshift-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-26', name: 'Amazon OpenSearch MCP Server', description: 'OpenSearch powered search, analytics, and observability.',
    category: 'mcp', source: 'marketplace', icon: Globe,
    tags: ['aws', 'opensearch', 'analytics'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/opensearch-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-27', name: 'Amazon ElastiCache MCP Server', description: 'Complete ElastiCache control plane operations.',
    category: 'mcp', source: 'marketplace', icon: HardDrive,
    tags: ['aws', 'elasticache', 'caching'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/elasticache-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-28', name: 'AWS IAM MCP Server', description: 'Comprehensive IAM user, role, group, and policy management with security best practices.',
    category: 'mcp', source: 'marketplace', icon: Lock,
    tags: ['aws', 'iam', 'security'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/iam-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-29', name: 'AWS Diagram MCP Server', description: 'Generate architecture diagrams and technical illustrations.',
    category: 'mcp', source: 'marketplace', icon: Layers,
    tags: ['aws', 'diagrams', 'architecture'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/diagram-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-30', name: 'Amazon SNS / SQS MCP Server', description: 'Event-driven messaging and queue management.',
    category: 'mcp', source: 'marketplace', icon: Network,
    tags: ['aws', 'sns', 'sqs', 'messaging'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/sns-sqs-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-31', name: 'AWS Step Functions MCP Server', description: 'Execute complex workflows and business processes.',
    category: 'mcp', source: 'marketplace', icon: GitBranch,
    tags: ['aws', 'step-functions', 'workflows'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/stepfunctions-tool-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-32', name: 'Amazon Location Service MCP Server', description: 'Place search, geocoding, and route optimization.',
    category: 'mcp', source: 'marketplace', icon: Globe,
    tags: ['aws', 'location', 'geocoding'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/location-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-33', name: 'AWS Pricing MCP Server', description: 'AWS service pricing and cost estimates.',
    category: 'mcp', source: 'marketplace', icon: DollarSign,
    tags: ['aws', 'pricing', 'cost'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/pricing-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-34', name: 'AWS Cost Explorer MCP Server', description: 'Detailed cost analysis and reporting.',
    category: 'mcp', source: 'marketplace', icon: DollarSign,
    tags: ['aws', 'cost', 'billing'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/cost-explorer-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-35', name: 'Amazon CloudWatch MCP Server', description: 'Metrics, alarms, and logs analysis and operational troubleshooting.',
    category: 'mcp', source: 'marketplace', icon: Activity,
    tags: ['aws', 'cloudwatch', 'monitoring'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/cloudwatch-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-36', name: 'AWS S3 Tables MCP Server', description: 'Manage S3 Tables for optimized analytics.',
    category: 'mcp', source: 'marketplace', icon: HardDrive,
    tags: ['aws', 's3', 'analytics'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/s3-tables-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-37', name: 'AWS AppSync MCP Server', description: 'Manage and interact with application backends powered by AWS AppSync.',
    category: 'mcp', source: 'marketplace', icon: Network,
    tags: ['aws', 'appsync', 'graphql'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/appsync-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-38', name: 'AWS HealthOmics MCP Server', description: 'Generate, run, debug and optimize lifescience workflows.',
    category: 'mcp', source: 'marketplace', icon: Heart,
    tags: ['aws', 'healthomics', 'lifesciences'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/healthomics-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-39', name: 'AWS CloudTrail MCP Server', description: 'CloudTrail events querying and analysis.',
    category: 'mcp', source: 'marketplace', icon: Shield,
    tags: ['aws', 'cloudtrail', 'audit'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/cloudtrail-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-40', name: 'AWS Data Processing MCP Server', description: 'Comprehensive data processing tools and real-time pipeline visibility across AWS Glue and Amazon EMR.',
    category: 'mcp', source: 'marketplace', icon: Database,
    tags: ['aws', 'glue', 'emr', 'etl'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/dataprocessing-mcp-server', marketplaceName: 'AWS',
  },
  {
    id: 'mcp-aws-41', name: 'Amazon Bedrock AgentCore MCP Server', description: 'Access AgentCore documentation, Runtime, Memory, Code Interpreter, Browser, Gateway, Observability, and Identity services.',
    category: 'mcp', source: 'marketplace', icon: Cpu,
    tags: ['aws', 'bedrock', 'agentcore', 'agents', 'browser', 'code-interpreter'], author: 'awslabs',
    marketplaceUrl: 'https://github.com/awslabs/mcp/tree/main/src/amazon-bedrock-agentcore-mcp-server', marketplaceName: 'AWS',
  },
  // ── Internal Plugins ──
  {
    id: 'plugin-1', name: 'claude-mem', description: 'Persistent memory across sessions — auto-saves context, searchable recall. Agents remember past conversations and decisions.',
    category: 'plugins', source: 'internal', icon: Puzzle,
    tags: ['memory', 'context'], installed: true,
  },
  {
    id: 'plugin-2', name: 'superpowers', description: 'Skills framework for TDD, debugging, brainstorming, and subagent workflows. Extends Claude Code with structured methodologies.',
    category: 'plugins', source: 'internal', icon: Zap,
    tags: ['framework', 'tdd'], installed: true,
  },
  // ── Marketplace Plugins (Anthropic official) ──
  {
    id: 'plugin-m1', name: 'code-graph', description: 'Builds and queries a code dependency graph. Understands imports, call chains, and module relationships across the codebase.',
    category: 'plugins', source: 'marketplace', icon: GitBranch,
    tags: ['analysis', 'dependencies'], author: 'anthropic', installs: 15000, rating: 4.6,
    marketplaceUrl: 'https://github.com/anthropics/code-graph', marketplaceName: 'Anthropic Plugins',
  },
  {
    id: 'plugin-m2', name: 'test-runner', description: 'Intelligent test execution and analysis. Runs relevant tests on code changes, reports failures with context, and suggests fixes.',
    category: 'plugins', source: 'marketplace', icon: Sparkles,
    tags: ['testing', 'ci'], author: 'anthropic', installs: 11000, rating: 4.5,
    marketplaceUrl: 'https://github.com/anthropics/test-runner', marketplaceName: 'Anthropic Plugins',
  },
  {
    id: 'plugin-m3', name: 'doc-writer', description: 'Automated documentation generation from code. Produces README files, API docs, and inline comments following project conventions.',
    category: 'plugins', source: 'marketplace', icon: BookOpen,
    tags: ['documentation', 'writing'], author: 'community', installs: 7800, rating: 4.4,
    marketplaceUrl: 'https://github.com/community/doc-writer', marketplaceName: 'Anthropic Plugins',
  },
]

/* ================================================================== */
/*  Category config                                                    */
/* ================================================================== */
const CATEGORIES: { id: ToolCategory; label: string; icon: typeof Package; count: (tools: ToolItem[]) => number }[] = [
  { id: 'all', label: 'All Tools', icon: Wrench, count: t => t.length },
  { id: 'skills', label: 'Skills', icon: Sparkles, count: t => t.filter(x => x.category === 'skills').length },
  { id: 'mcp', label: 'MCP Servers', icon: Server, count: t => t.filter(x => x.category === 'mcp').length },
  { id: 'plugins', label: 'Plugins', icon: Puzzle, count: t => t.filter(x => x.category === 'plugins').length },
]

/* ================================================================== */
/*  Category border colors                                             */
/* ================================================================== */
const CATEGORY_BORDER: Record<string, string> = {
  skills: 'border-l-yellow-500',
  mcp: 'border-l-blue-500',
  plugins: 'border-l-violet-500',
}

const CATEGORY_TAB_STRIP: Record<string, string> = {
  skills: 'bg-yellow-500',
  mcp: 'bg-blue-500',
  plugins: 'bg-violet-500',
}

/* ================================================================== */
/*  Tool Card                                                          */
/* ================================================================== */
function ToolCard({ tool }: { tool: ToolItem }) {
  const Icon = tool.icon
  const categoryLabel = tool.category === 'skills' ? 'Skill' : tool.category === 'mcp' ? 'MCP' : 'Plugin'
  const categoryColor = tool.category === 'skills' ? 'text-yellow-400 bg-yellow-500/10' : tool.category === 'mcp' ? 'text-blue-400 bg-blue-500/10' : 'text-violet-400 bg-violet-500/10'
  const borderColor = CATEGORY_BORDER[tool.category] || 'border-l-gray-500'

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl overflow-hidden border-l-[3px] ${borderColor} hover:border-gray-700 transition-all group`}>
      <div className="p-4">
        {/* Top row: icon + category + source */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-gray-400" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                {tool.name}
              </h4>
              {tool.author && (
                <p className="text-[10px] text-gray-500">{tool.author}</p>
              )}
            </div>
          </div>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${categoryColor}`}>
            {categoryLabel}
          </span>
        </div>

        {/* Description */}
        <p className="text-[12px] text-gray-400 leading-relaxed line-clamp-3 mb-3">
          {tool.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {tool.tags.map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">#{tag}</span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-800/50">
          {tool.source === 'marketplace' ? (
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              {tool.installs != null && (
                <span className="flex items-center gap-1">
                  <Download className="w-3 h-3" />{(tool.installs / 1000).toFixed(1)}k
                </span>
              )}
              {tool.rating != null && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500" />{tool.rating}
                </span>
              )}
              {tool.marketplaceName && (
                <a href={tool.marketplaceUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                  <ExternalLink className="w-3 h-3" />{tool.marketplaceName}
                </a>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-gray-600 flex items-center gap-1">
                <Wrench className="w-3 h-3" />Internal
              </span>
              {(tool.category === 'skills' || tool.category === 'mcp') && tool.resourceId && (
                <GroupAccessPopover
                  resourceType={tool.category === 'skills' ? 'skill' : 'mcp'}
                  resourceId={tool.resourceId}
                  resourceName={tool.name}
                />
              )}
            </div>
          )}

          {tool.installed ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
              Installed
            </span>
          ) : (
            <button className="text-[10px] font-medium px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1">
              <Download className="w-3 h-3" />Install
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Main Page                                                          */
/* ================================================================== */
export function Tools() {
  const [category, setCategory] = useState<ToolCategory>('all')
  const [source, setSource] = useState<ToolSource>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [marketplaceSkills, setMarketplaceSkills] = useState<ToolItem[]>([])
  const [loadingMarketplace, setLoadingMarketplace] = useState(false)
  const [enterpriseSkills, setEnterpriseSkills] = useState<ToolItem[]>([])

  // Marketplace search state (active when skills + marketplace + has query)
  const [marketSearchResults, setMarketSearchResults] = useState<ToolItem[]>([])
  const [isSearchingMarketplace, setIsSearchingMarketplace] = useState(false)
  const [lastSearchedQuery, setLastSearchedQuery] = useState('')

  const isMarketplaceSkillSearch = (category === 'skills' || category === 'all') && source === 'marketplace'

  // Search the skills.sh marketplace API
  const searchMarketplace = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setMarketSearchResults([])
      setLastSearchedQuery('')
      return
    }
    if (trimmed === lastSearchedQuery) return

    setIsSearchingMarketplace(true)
    try {
      const res = await restClient.get<{ data: MarketplaceSkillResult[] }>(
        `/api/skills/marketplace/search?q=${encodeURIComponent(trimmed)}`,
      )
      const skills = res.data || []
      setMarketSearchResults(skills.map(marketplaceSkillToToolItem))
      setLastSearchedQuery(trimmed)
    } catch {
      setMarketSearchResults([])
    } finally {
      setIsSearchingMarketplace(false)
    }
  }, [lastSearchedQuery])

  // Debounced marketplace search: triggers 500ms after user stops typing
  useEffect(() => {
    if (!isMarketplaceSkillSearch || !searchQuery.trim()) {
      setMarketSearchResults([])
      setLastSearchedQuery('')
      return
    }

    const timer = setTimeout(() => {
      searchMarketplace(searchQuery)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery, isMarketplaceSkillSearch, searchMarketplace])

  // Load marketplace skills from API with localStorage cache
  const loadMarketplaceSkills = useCallback(async () => {
    // 1. Check cache first
    const cached = getCachedMarketplaceSkills()
    if (cached) {
      setMarketplaceSkills(cached.map(marketplaceSkillToToolItem))
      return
    }

    // 2. Fetch from API
    setLoadingMarketplace(true)
    try {
      const res = await restClient.get<{ data: MarketplaceSkillResult[] }>(
        '/api/skills/marketplace/featured',
      )
      const skills = res.data || []

      // 3. Save to cache
      setCachedMarketplaceSkills(skills)

      setMarketplaceSkills(skills.map(marketplaceSkillToToolItem))
    } catch {
      // Silently fail — marketplace section will just be empty
    } finally {
      setLoadingMarketplace(false)
    }
  }, [])

  useEffect(() => {
    loadMarketplaceSkills()
  }, [loadMarketplaceSkills])

  // Load enterprise skills from API
  const loadEnterpriseSkills = useCallback(async () => {
    try {
      const res = await restClient.get<{ items: EnterpriseSkillResult[]; total: number }>(
        '/api/skills/enterprise?limit=100',
      )
      const items = res.items || []
      setEnterpriseSkills(items.map(enterpriseSkillToToolItem))
    } catch {
      // Silently fail — static internal skills still show
    }
  }, [])

  useEffect(() => {
    loadEnterpriseSkills()
  }, [loadEnterpriseSkills])

  // Merge static tools with dynamically loaded marketplace + enterprise skills
  // Deduplicate enterprise skills against static tools by name
  const staticNames = new Set(STATIC_TOOLS.map(t => t.name.toLowerCase()))
  const dedupedEnterprise = enterpriseSkills.filter(t => !staticNames.has(t.name.toLowerCase()))
  const allTools = [...STATIC_TOOLS, ...dedupedEnterprise, ...marketplaceSkills]

  // When searching in skills+marketplace mode, use API search results
  // instead of local filtering
  const useMarketplaceSearchResults = isMarketplaceSkillSearch && searchQuery.trim().length > 0

  const filtered = useMarketplaceSearchResults
    ? marketSearchResults
    : allTools.filter(tool => {
        if (category !== 'all' && tool.category !== category) return false
        if (source === 'internal' && tool.source !== 'internal') return false
        if (source === 'marketplace' && tool.source !== 'marketplace') return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          return (
            tool.name.toLowerCase().includes(q) ||
            tool.description.toLowerCase().includes(q) ||
            tool.tags.some(t => t.includes(q))
          )
        }
        return true
      })

  return (
    <div className="h-full overflow-y-auto">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-800">
        {/* Filters row */}
        <div className="flex items-center gap-3">
          {/* Category tabs */}
          <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-0.5 border border-gray-800">
            {CATEGORIES.map(cat => {
              const CatIcon = cat.icon
              const isActive = category === cat.id
              const stripColor = CATEGORY_TAB_STRIP[cat.id]
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {stripColor && <span className={`w-0.5 h-3.5 rounded-full ${stripColor}`} />}
                  <CatIcon className="w-3.5 h-3.5" />
                  {cat.label}
                  <span className={`text-[10px] ${isActive ? 'text-gray-400' : 'text-gray-600'}`}>
                    {cat.count(allTools)}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Source filter */}
          <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-0.5 border border-gray-800">
            {([
              { id: 'all' as ToolSource, label: 'All' },
              { id: 'internal' as ToolSource, label: 'Internal' },
              { id: 'marketplace' as ToolSource, label: 'Marketplace' },
            ]).map(s => (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  source === s.id ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            {isSearchingMarketplace && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400 animate-spin" />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && isMarketplaceSkillSearch) {
                  searchMarketplace(searchQuery)
                }
              }}
              placeholder={isMarketplaceSkillSearch ? 'Search skills.sh marketplace...' : 'Search tools...'}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
            />
          </div>
        </div>

      </div>

      {/* ── Tool Grid ── */}
      <div className="px-6 py-5">
        {(loadingMarketplace && marketplaceSkills.length === 0) || (isSearchingMarketplace && marketSearchResults.length === 0) ? (
          <div className="flex items-center justify-center py-4 mb-4">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="ml-2 text-sm text-gray-500">
              {isSearchingMarketplace ? 'Searching skills.sh...' : 'Loading marketplace skills...'}
            </span>
          </div>
        ) : null}
        {filtered.length === 0 && !isSearchingMarketplace ? (
          <div className="text-center py-16">
            <Package className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {useMarketplaceSearchResults
                ? `No skills found for "${searchQuery}" on skills.sh`
                : 'No tools match your filters'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {useMarketplaceSearchResults
                ? 'Try a different search term'
                : 'Try adjusting the category, source, or search query'}
            </p>
          </div>
        ) : (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
            {filtered.map(tool => (
              <div key={tool.id} className="break-inside-avoid">
                <ToolCard tool={tool} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

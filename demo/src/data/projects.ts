export type DemoType = 'interactive' | 'walkthrough' | 'notebook' | 'opensource';

export interface LabStep {
  step: number;
  title: string;
  description?: string;
  url?: string;
}

export interface DeployStep {
  step: number;
  title: string;
  command?: string;
}

export interface AgentInfo {
  name: string;
  role: string;
  demoUrl?: string;
}

export interface DemoItem {
  id: string;
  title: string;
  description: string;
  category: 'enterprise' | 'industry' | 'capability' | 'tutorial';
  subcategory: string;
  icon: string;
  demoType: DemoType;
  agentcoreServices: string[];
  awsServices: string[];
  framework: string;
  status: 'ready' | 'coming-soon';
  sourceUrl: string;
  demoUrl?: string;
  deploySteps?: DeployStep[];
  estimatedTime?: string;
  estimatedCost?: string;
  agents?: AgentInfo[];
  architectureImage?: string;
  frameworks?: string[];
  labs?: LabStep[];
  videoUrl?: string;
}

import projectsData from './projects.json';
export const demos: DemoItem[] = (projectsData as DemoItem[]).filter(d => !(d.category === 'tutorial' && d.demoType === 'notebook'));

export const demoTypeMeta: Record<DemoType, { label: string; icon: string; color: string }> = {
  interactive: { label: '在线体验', icon: '▶', color: '#66BB6A' },
  walkthrough: { label: '可部署', icon: '⚙', color: '#4FC3F7' },
  notebook:    { label: 'Notebook', icon: '📓', color: '#CE93D8' },
  opensource:  { label: '开源项目', icon: '📦', color: '#90A4AE' },
};

type CategoryKey = DemoItem['category'];
export const categoryMeta: Record<CategoryKey, { label: string; icon: string; color: string; description: string }> = {
  enterprise: { label: '企业职能场景', icon: '◆', color: '#4FC3F7', description: '按企业职能划分的 Agent 应用：营销、销售、客服、法务、IT、HR 等' },
  industry:   { label: '行业应用场景', icon: '◈', color: '#FF9900', description: '面向特定行业的垂直 Agent 解决方案：游戏、零售、金融、医疗等' },
  capability: { label: '跨行业场景', icon: '◇', color: '#CE93D8', description: '跨行业的 AI 核心能力：支付风控、智能搜索、内容生成、文档处理' },
  tutorial:   { label: '平台能力场景', icon: '▸', color: '#66BB6A', description: 'AgentCore 各项能力的动手实践教程' },
};

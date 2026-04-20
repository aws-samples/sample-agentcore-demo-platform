/**
 * REST Project Service — frontend API client for project management.
 */

import { restClient } from './restClient';

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  repo_url: string | null;
  default_branch: string;
  business_scope_id: string | null;
  agent_id: string | null;
  workspace_session_id: string | null;
  settings: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
  members?: ProjectMember[];
  _count?: { issues: number };
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export interface ProjectIssue {
  id: string;
  project_id: string;
  issue_number: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  labels: string[];
  sort_order: number;
  branch_name: string | null;
  pr_url: string | null;
  estimated_effort: string | null;
  parent_issue_id: string | null;
  workspace_session_id: string | null;
  // AI governance fields
  readiness_score: number | null;
  readiness_details: Record<string, { score: number; max: number; reason: string }> | null;
  acceptance_criteria: Array<{ criterion: string; verified: boolean }> | null;
  ai_analysis_status: string | null;
  last_analyzed_at: string | null;
  // Code diff fields
  diff_stat: DiffStat | null;
  diff_patch: string | null;
  diff_created_at: string | null;
  //
  created_by: string;
  created_at: string;
  updated_at: string;
  created_by_profile?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
  } | null;
  _count?: { comments: number; children: number };
}

export interface DiffStat {
  files_changed: number;
  insertions: number;
  deletions: number;
  files: Array<{ path: string; status: string; insertions: number; deletions: number }>;
}

export interface IssueComment {
  id: string;
  issue_id: string;
  author_user_id: string | null;
  author_agent_id: string | null;
  content: string;
  comment_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface IssueRelation {
  id: string;
  project_id: string;
  source_issue_id: string;
  target_issue_id: string;
  relation_type: 'conflicts_with' | 'depends_on' | 'duplicates' | 'related_to';
  confidence: number;
  reasoning: string | null;
  status: 'pending' | 'confirmed' | 'dismissed';
  created_by_ai: boolean;
  reviewed_by: string | null;
  created_at: string;
  source_issue: { id: string; issue_number: number; title: string; status: string };
  target_issue: { id: string; issue_number: number; title: string; status: string };
}

export interface TriageReport {
  summary: string;
  sprint_estimate: string;
  recommended_order: Array<{ issue_number: number; reason: string }>;
  merge_suggestions: Array<{ issue_numbers: number[]; reason: string; suggested_title: string }>;
  missing_info: Array<{ issue_number: number; what_is_missing: string }>;
  risk_flags: Array<{ issue_number: number; risk: string }>;
}

export const RestProjectService = {
  // Projects
  async createProject(input: { name: string; description?: string; repo_url?: string; agent_id?: string }): Promise<Project> {
    return restClient.post<Project>('/api/projects', input);
  },
  async listProjects(): Promise<Project[]> {
    const res = await restClient.get<{ data: Project[] }>('/api/projects');
    return res.data;
  },
  async getProject(id: string): Promise<Project> {
    return restClient.get<Project>(`/api/projects/${id}`);
  },
  async updateProject(id: string, input: Partial<{ name: string; description: string; repo_url: string; business_scope_id: string; agent_id: string }>): Promise<Project> {
    return restClient.put<Project>(`/api/projects/${id}`, input);
  },
  async deleteProject(id: string): Promise<void> {
    await restClient.delete(`/api/projects/${id}`);
  },

  // Members
  async getMembers(projectId: string): Promise<ProjectMember[]> {
    const res = await restClient.get<{ data: ProjectMember[] }>(`/api/projects/${projectId}/members`);
    return res.data;
  },
  async addMember(projectId: string, userId: string, role?: string): Promise<void> {
    await restClient.post(`/api/projects/${projectId}/members`, { user_id: userId, role });
  },
  async removeMember(projectId: string, userId: string): Promise<void> {
    await restClient.delete(`/api/projects/${projectId}/members/${userId}`);
  },

  // Issues
  async createIssue(projectId: string, input: { title: string; description?: string; status?: string; priority?: string; labels?: string[] }): Promise<ProjectIssue> {
    return restClient.post<ProjectIssue>(`/api/projects/${projectId}/issues`, input);
  },
  async listIssues(projectId: string, filters?: { status?: string; priority?: string }): Promise<ProjectIssue[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await restClient.get<{ data: ProjectIssue[] }>(`/api/projects/${projectId}/issues${query}`);
    return res.data;
  },
  async getIssue(projectId: string, issueId: string): Promise<ProjectIssue & { comments: IssueComment[] }> {
    return restClient.get(`/api/projects/${projectId}/issues/${issueId}`);
  },
  async updateIssue(projectId: string, issueId: string, input: Partial<{ title: string; description: string; priority: string; labels: string[] }>): Promise<ProjectIssue> {
    return restClient.put<ProjectIssue>(`/api/projects/${projectId}/issues/${issueId}`, input);
  },
  async changeStatus(projectId: string, issueId: string, status: string): Promise<ProjectIssue> {
    return restClient.patch<ProjectIssue>(`/api/projects/${projectId}/issues/${issueId}/status`, { status });
  },
  async reorderIssue(projectId: string, issueId: string, sortOrder: number, status?: string): Promise<ProjectIssue> {
    return restClient.patch<ProjectIssue>(`/api/projects/${projectId}/issues/${issueId}/reorder`, { sort_order: sortOrder, status });
  },
  async deleteIssue(projectId: string, issueId: string): Promise<void> {
    await restClient.delete(`/api/projects/${projectId}/issues/${issueId}`);
  },

  // Comments
  async addComment(projectId: string, issueId: string, content: string, commentType?: string): Promise<IssueComment> {
    return restClient.post<IssueComment>(`/api/projects/${projectId}/issues/${issueId}/comments`, { content, comment_type: commentType });
  },
  async listComments(projectId: string, issueId: string): Promise<IssueComment[]> {
    const res = await restClient.get<{ data: IssueComment[] }>(`/api/projects/${projectId}/issues/${issueId}/comments`);
    return res.data;
  },

  // Agent Execution
  async executeIssue(projectId: string, issueId: string): Promise<{ issue: ProjectIssue; session_id: string; branch_name: string }> {
    return restClient.post(`/api/projects/${projectId}/issues/${issueId}/execute`, {});
  },
  async autoProcessNext(projectId: string): Promise<{ status: string; issue?: ProjectIssue; session_id?: string; branch_name?: string }> {
    return restClient.post(`/api/projects/${projectId}/auto-process`, {});
  },

  // AI Beautify
  async beautifyDescription(projectId: string, issueId: string): Promise<string> {
    const res = await restClient.post<{ description: string }>(`/api/projects/${projectId}/issues/${issueId}/beautify`, {});
    return res.description;
  },

  // Workspace
  async ensureWorkspace(projectId: string): Promise<string> {
    const res = await restClient.post<{ session_id: string }>(`/api/projects/${projectId}/ensure-workspace`, {});
    return res.session_id;
  },
  async syncWorkspace(projectId: string): Promise<{ synced: number; path: string }> {
    return restClient.post(`/api/projects/${projectId}/sync-workspace`, {});
  },

  // Settings
  async getSettings(projectId: string): Promise<Record<string, unknown>> {
    return restClient.get(`/api/projects/${projectId}/settings`);
  },
  async updateSettings(projectId: string, settings: Record<string, unknown>): Promise<void> {
    await restClient.put(`/api/projects/${projectId}/settings`, settings);
  },

  // AI Governance
  async enrichIssue(projectId: string, issueId: string): Promise<{ status: string }> {
    return restClient.post(`/api/projects/${projectId}/issues/${issueId}/enrich`, {});
  },
  async reanalyzeIssue(projectId: string, issueId: string): Promise<{ status: string }> {
    return restClient.post(`/api/projects/${projectId}/issues/${issueId}/reanalyze`, {});
  },
  async getIssueRelations(projectId: string, issueId: string): Promise<IssueRelation[]> {
    const res = await restClient.get<{ data: IssueRelation[] }>(`/api/projects/${projectId}/issues/${issueId}/relations`);
    return res.data;
  },
  async getProjectRelations(projectId: string): Promise<IssueRelation[]> {
    const res = await restClient.get<{ data: IssueRelation[] }>(`/api/projects/${projectId}/relations`);
    return res.data;
  },
  async reviewRelation(projectId: string, relationId: string, action: 'confirmed' | 'dismissed'): Promise<void> {
    await restClient.patch(`/api/projects/${projectId}/relations/${relationId}/review`, { action });
  },
  async generateTriage(projectId: string): Promise<TriageReport> {
    return restClient.post(`/api/projects/${projectId}/triage`, {});
  },

  // Code Diff
  async getIssueDiff(projectId: string, issueId: string): Promise<{ diff_stat: DiffStat | null; diff_patch: string | null; diff_created_at: string | null }> {
    return restClient.get(`/api/projects/${projectId}/issues/${issueId}/diff`);
  },
};

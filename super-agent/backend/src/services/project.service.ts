/**
 * Project Management Service
 * CRUD for projects, issues, members, and comments.
 */

import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';

// ============================================================================
// Types
// ============================================================================

export interface CreateProjectInput {
  name: string;
  description?: string;
  repo_url?: string;
  default_branch?: string;
  business_scope_id?: string;
  agent_id?: string;
  settings?: Record<string, unknown>;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  labels?: string[];
  parent_issue_id?: string;
  estimated_effort?: string;
}

export interface CreateCommentInput {
  content: string;
  comment_type?: string;
  metadata?: Record<string, unknown>;
}

const VALID_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'];
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];

// ============================================================================
// Project Service
// ============================================================================

export class ProjectService {
  // --- Projects ---

  async createProject(orgId: string, userId: string, input: CreateProjectInput) {
    const project = await prisma.projects.create({
      data: {
        organization_id: orgId,
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        repo_url: input.repo_url?.trim() ?? null,
        default_branch: input.default_branch ?? 'main',
        business_scope_id: input.business_scope_id ?? null,
        agent_id: input.agent_id ?? null,
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
        created_by: userId,
      },
    });
    // Add creator as owner
    await prisma.project_members.create({
      data: { project_id: project.id, user_id: userId, role: 'owner' },
    });
    return project;
  }

  async listProjects(orgId: string, userId: string) {
    return prisma.projects.findMany({
      where: {
        organization_id: orgId,
        OR: [
          { members: { some: { user_id: userId } } },
          { created_by: userId },
        ],
      },
      include: {
        members: true,
        _count: { select: { issues: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getProject(orgId: string, projectId: string, userId: string) {
    const project = await prisma.projects.findFirst({
      where: {
        id: projectId,
        organization_id: orgId,
        OR: [
          { members: { some: { user_id: userId } } },
          { created_by: userId },
        ],
      },
      include: { members: true },
    });
    if (!project) throw AppError.notFound('Project not found');
    return project;
  }

  async updateProject(orgId: string, projectId: string, userId: string, input: Partial<CreateProjectInput>) {
    await this.getProject(orgId, projectId, userId); // access check
    return prisma.projects.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.description !== undefined && { description: input.description?.trim() ?? null }),
        ...(input.repo_url !== undefined && { repo_url: input.repo_url?.trim() ?? null }),
        ...(input.default_branch !== undefined && { default_branch: input.default_branch }),
        ...(input.settings !== undefined && { settings: input.settings as Prisma.InputJsonValue }),
      },
    });
  }

  async deleteProject(orgId: string, projectId: string, userId: string) {
    const project = await this.getProject(orgId, projectId, userId);
    if ((project as Record<string, unknown>).created_by !== userId) {
      throw AppError.forbidden('Only the project owner can delete it');
    }
    await prisma.projects.delete({ where: { id: projectId } });
  }

  // --- Members ---

  async addMember(_orgId: string, projectId: string, targetUserId: string, role = 'member') {
    await prisma.project_members.upsert({
      where: { unique_project_member: { project_id: projectId, user_id: targetUserId } },
      update: { role },
      create: { project_id: projectId, user_id: targetUserId, role },
    });
  }

  async removeMember(projectId: string, targetUserId: string) {
    await prisma.project_members.deleteMany({
      where: { project_id: projectId, user_id: targetUserId },
    });
  }

  async getMembers(projectId: string) {
    return prisma.project_members.findMany({
      where: { project_id: projectId },
      orderBy: { joined_at: 'asc' },
    });
  }

  // --- Issues ---

  async createIssue(orgId: string, projectId: string, userId: string, input: CreateIssueInput) {
    // Auto-increment issue number per project
    const maxIssue = await prisma.project_issues.findFirst({
      where: { project_id: projectId },
      orderBy: { issue_number: 'desc' },
      select: { issue_number: true },
    });
    const nextNumber = (maxIssue?.issue_number ?? 0) + 1;

    // Compute sort_order: append to end of the target lane
    const status = input.status && VALID_STATUSES.includes(input.status) ? input.status : 'backlog';
    const maxOrder = await prisma.project_issues.findFirst({
      where: { project_id: projectId, status },
      orderBy: { sort_order: 'desc' },
      select: { sort_order: true },
    });
    const sortOrder = (maxOrder?.sort_order ?? 0) + 1;

    return prisma.project_issues.create({
      data: {
        project_id: projectId,
        organization_id: orgId,
        issue_number: nextNumber,
        title: input.title.trim(),
        description: input.description?.trim() ?? null,
        status,
        priority: input.priority && VALID_PRIORITIES.includes(input.priority) ? input.priority : 'medium',
        labels: (input.labels ?? []) as string[],
        sort_order: sortOrder,
        parent_issue_id: input.parent_issue_id ?? null,
        estimated_effort: input.estimated_effort ?? null,
        created_by: userId,
      },
    });
  }

  async listIssues(projectId: string, filters?: { status?: string; priority?: string }) {
    const where: Record<string, unknown> = { project_id: projectId };
    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;

    const issues = await prisma.project_issues.findMany({
      where,
      include: { _count: { select: { comments: true, children: true } } },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });

    // Enrich with creator profiles
    const creatorIds = [...new Set(issues.map(i => i.created_by))];
    const profiles = creatorIds.length > 0
      ? await prisma.profiles.findMany({ where: { id: { in: creatorIds } }, select: { id: true, full_name: true, avatar_url: true, username: true } })
      : [];
    const profileMap = new Map(profiles.map(p => [p.id, p]));

    return issues.map(issue => ({
      ...issue,
      created_by_profile: profileMap.get(issue.created_by) ?? null,
    }));
  }

  async getIssue(projectId: string, issueId: string) {
    const issue = await prisma.project_issues.findFirst({
      where: { id: issueId, project_id: projectId },
      include: { comments: { orderBy: { created_at: 'asc' } }, children: true },
    });
    if (!issue) throw AppError.notFound('Issue not found');
    return issue;
  }

  async updateIssue(projectId: string, issueId: string, input: Partial<CreateIssueInput>) {
    const issue = await prisma.project_issues.findFirst({ where: { id: issueId, project_id: projectId } });
    if (!issue) throw AppError.notFound('Issue not found');

    return prisma.project_issues.update({
      where: { id: issueId },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.description !== undefined && { description: input.description?.trim() ?? null }),
        ...(input.priority !== undefined && VALID_PRIORITIES.includes(input.priority!) && { priority: input.priority }),
        ...(input.labels !== undefined && { labels: input.labels as string[] }),
        ...(input.estimated_effort !== undefined && { estimated_effort: input.estimated_effort ?? null }),
      },
    });
  }

  async changeIssueStatus(projectId: string, issueId: string, newStatus: string) {
    if (!VALID_STATUSES.includes(newStatus)) {
      throw AppError.validation(`Invalid status: ${newStatus}`);
    }
    const issue = await prisma.project_issues.findFirst({ where: { id: issueId, project_id: projectId } });
    if (!issue) throw AppError.notFound('Issue not found');

    return prisma.project_issues.update({
      where: { id: issueId },
      data: { status: newStatus },
    });
  }

  async reorderIssue(projectId: string, issueId: string, newSortOrder: number, newStatus?: string) {
    const issue = await prisma.project_issues.findFirst({ where: { id: issueId, project_id: projectId } });
    if (!issue) throw AppError.notFound('Issue not found');

    const data: Record<string, unknown> = { sort_order: newSortOrder };
    if (newStatus && VALID_STATUSES.includes(newStatus)) data.status = newStatus;

    return prisma.project_issues.update({ where: { id: issueId }, data });
  }

  async deleteIssue(projectId: string, issueId: string) {
    await prisma.project_issues.deleteMany({ where: { id: issueId, project_id: projectId } });
  }

  // --- Comments ---

  async addComment(orgId: string, issueId: string, userId: string, input: CreateCommentInput) {
    return prisma.project_issue_comments.create({
      data: {
        issue_id: issueId,
        organization_id: orgId,
        author_user_id: userId,
        content: input.content,
        comment_type: input.comment_type ?? 'discussion',
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async listComments(issueId: string) {
    return prisma.project_issue_comments.findMany({
      where: { issue_id: issueId },
      orderBy: { created_at: 'asc' },
    });
  }

  // --- Agent Execution ---

  async executeIssue(orgId: string, projectId: string, issueId: string, userId: string) {
    console.log(`[ProjectService] executeIssue called: projectId=${projectId}, issueId=${issueId}, userId=${userId}`);
    const issue = await prisma.project_issues.findFirst({ where: { id: issueId, project_id: projectId } });
    if (!issue) throw AppError.notFound('Issue not found');

    const project = await prisma.projects.findFirst({ where: { id: projectId } });
    if (!project) throw AppError.notFound('Project not found');

    console.log(`[ProjectService] Project agent_id=${project.agent_id}, business_scope_id=${project.business_scope_id}`);

    // Ensure project workspace exists
    const sessionId = await this.ensureWorkspaceSession(orgId, projectId, userId);
    console.log(`[ProjectService] Workspace session: ${sessionId}`);

    const slug = issue.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
    const branchName = `issue/${issue.issue_number}/${slug}`;

    const updated = await prisma.project_issues.update({
      where: { id: issueId },
      data: {
        status: 'in_progress',
        branch_name: branchName,
        workspace_session_id: sessionId,
      },
    });

    await prisma.project_issue_comments.create({
      data: {
        issue_id: issueId,
        organization_id: orgId,
        author_user_id: userId,
        content: `Agent execution started. Branch: \`${branchName}\``,
        comment_type: 'status_change',
        metadata: { branch_name: branchName, session_id: sessionId } as Prisma.InputJsonValue,
      },
    });

    // Actually send the task to the agent via the workspace session
    const taskMessage = `Please work on the following task:

**Issue #${issue.issue_number}: ${issue.title}**
Branch: \`${branchName}\`
${issue.description ? `\nDescription:\n${issue.description}` : ''}
${project.repo_url ? `\nRepository: ${project.repo_url}` : ''}

Please implement this task. Create the branch if needed, write the code, and let me know when done.`;

    // Persist the task message to the workspace session so the console shows it
    const { chatMessageRepository } = await import('../repositories/chat.repository.js');
    await chatMessageRepository.create({
      session_id: sessionId,
      type: 'user',
      content: taskMessage,
      agent_id: null,
      mention_agent_id: null,
      metadata: { source: 'project_execute', issue_id: issueId },
    }, orgId);

    console.log(`[ProjectService] Task message persisted to session. Checking agent config...`);
    // This requires either a business_scope_id or an agent_id on the session
    if (project.business_scope_id || project.agent_id) {
      console.log(`[ProjectService] Sending task to agent via chatService.processMessage. scopeId=${project.business_scope_id}, agentId=${project.agent_id}`);
      const { chatService } = await import('./chat.service.js');
      chatService.processMessage({
        sessionId,
        businessScopeId: project.business_scope_id ?? '',
        message: taskMessage,
        organizationId: orgId,
        userId,
      }).then(result => {
        console.log(`[ProjectService] Agent responded for issue ${issueId}. Response length: ${result.text.length}`);
        // Persist agent response
        chatMessageRepository.create({
          session_id: sessionId,
          type: 'ai',
          content: result.text,
          agent_id: project.agent_id ?? null,
          mention_agent_id: null,
          metadata: { source: 'project_agent_response', issue_id: issueId },
        }, orgId).catch(() => {});
      }).catch(err => {
        console.error(`[ProjectService] Agent execution FAILED for issue ${issueId}:`, err.message || err);
        // Log the error as a message so the console shows it
        chatMessageRepository.create({
          session_id: sessionId,
          type: 'ai',
          content: `Agent execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          agent_id: null,
          mention_agent_id: null,
          metadata: { source: 'project_agent_error', issue_id: issueId },
        }, orgId).catch(() => {});
      });
    } else {
      console.log(`[ProjectService] No agent or scope configured for project ${projectId}. Skipping agent invocation.`);
      // No scope or agent configured — log this to the console
      await chatMessageRepository.create({
        session_id: sessionId,
        type: 'ai',
        content: 'No agent or business scope configured for this project. Assign an agent in project creation to enable automatic execution.',
        agent_id: null,
        mention_agent_id: null,
        metadata: { source: 'project_no_agent' },
      }, orgId);
    }

    return { issue: updated, session_id: sessionId, branch_name: branchName };
  }

  async autoProcessNext(orgId: string, projectId: string, userId: string) {
    const inProgress = await prisma.project_issues.findFirst({
      where: { project_id: projectId, status: 'in_progress' },
    });
    if (inProgress) return null;

    const nextTodo = await prisma.project_issues.findFirst({
      where: { project_id: projectId, status: 'todo' },
      orderBy: { sort_order: 'asc' },
    });
    if (!nextTodo) return null;

    return this.executeIssue(orgId, projectId, nextTodo.id, userId);
  }

  async updateSettings(orgId: string, projectId: string, userId: string, settings: Record<string, unknown>) {
    await this.getProject(orgId, projectId, userId);
    return prisma.projects.update({
      where: { id: projectId },
      data: { settings: settings as Prisma.InputJsonValue },
    });
  }

  async getSettings(orgId: string, projectId: string, userId: string): Promise<Record<string, unknown>> {
    const project = await this.getProject(orgId, projectId, userId);
    return (project as Record<string, unknown>).settings as Record<string, unknown> ?? {};
  }

  /**
   * Ensure the project has a workspace session. Creates one if it doesn't exist.
   * This session is the persistent workspace for the project's agent.
   */
  async ensureWorkspaceSession(orgId: string, projectId: string, userId: string): Promise<string> {
    const project = await prisma.projects.findFirst({ where: { id: projectId } });
    if (!project) throw AppError.notFound('Project not found');

    if (project.workspace_session_id) return project.workspace_session_id;

    // Create a persistent workspace session for this project
    const session = await prisma.chat_sessions.create({
      data: {
        organization_id: orgId,
        user_id: userId,
        business_scope_id: null,
        agent_id: project.agent_id,
        title: `Project: ${project.name}`,
        status: 'idle',
        room_mode: 'single',
        routing_strategy: 'auto',
        context: {
          project_id: projectId,
          repo_url: project.repo_url,
          default_branch: project.default_branch,
        },
      },
    });

    await prisma.projects.update({
      where: { id: projectId },
      data: { workspace_session_id: session.id },
    });

    return session.id;
  }

  /**
   * Use the project's workspace agent to beautify/expand an issue description.
   * Sends a message through the project's chat session so the agent has full context.
   */
  async beautifyDescription(orgId: string, projectId: string, issueId: string, userId: string): Promise<string> {
    const issue = await prisma.project_issues.findFirst({ where: { id: issueId, project_id: projectId } });
    if (!issue) throw AppError.notFound('Issue not found');

    const project = await prisma.projects.findFirst({ where: { id: projectId } });
    if (!project) throw AppError.notFound('Project not found');

    // Ensure workspace session exists
    const sessionId = await this.ensureWorkspaceSession(orgId, projectId, userId);

    // Use the chat service to send a message through the workspace agent
    const { chatService } = await import('./chat.service.js');

    const message = `Please improve the following task description. Make it clear, well-structured, and actionable for a developer. Include acceptance criteria if appropriate. Return ONLY the improved description in Markdown, no preamble or explanation.

Title: ${issue.title}
${issue.description ? `Current description:\n${issue.description}` : 'No description provided yet. Generate a good description based on the title.'}
${project.repo_url ? `Repository: ${project.repo_url}` : ''}`;

    const result = await chatService.processMessage({
      sessionId,
      businessScopeId: project.business_scope_id ?? '',
      message,
      organizationId: orgId,
      userId,
    });

    const improved = result.text;

    // Save the improved description
    await prisma.project_issues.update({
      where: { id: issueId },
      data: { description: improved },
    });

    return improved;
  }
}

export const projectService = new ProjectService();

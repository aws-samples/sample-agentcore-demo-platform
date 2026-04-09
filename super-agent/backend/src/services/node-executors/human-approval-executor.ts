/**
 * Human Approval Node Executor
 *
 * Pauses execution and waits for user approval before continuing.
 *
 * Requirement 3.4: WHEN executing a humanApproval node, THE Node_Executor SHALL
 * pause execution and wait for user approval before continuing.
 */

import { BaseNodeExecutor } from './base-executor.js';
import type { NodeExecutionParams, NodeExecutionResult } from './types.js';
import type { CanvasNodeType } from '../../types/workflow-execution.js';

/**
 * Approval status
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'timeout';

/**
 * Human approval node metadata structure
 */
interface HumanApprovalNodeMeta {
  /** Approval status */
  status?: ApprovalStatus;
  /** Approver user ID */
  approverId?: string;
  /** Approver name */
  approverName?: string;
  /** Approval timestamp */
  approvedAt?: string;
  /** Rejection reason */
  rejectionReason?: string;
  /** Timeout duration in seconds */
  timeoutSeconds?: number;
  /** Instructions for approver */
  instructions?: string;
  /** Auto-approve for testing */
  autoApprove?: boolean;
}

/**
 * Human approval node executor
 *
 * This executor handles human-in-the-loop approval workflows.
 * In a full implementation, it would:
 * 1. Create an approval request in the database
 * 2. Notify the designated approver(s)
 * 3. Pause execution until approval/rejection/timeout
 * 4. Resume execution based on the decision
 *
 * Current implementation supports:
 * - Auto-approve mode for testing
 * - Pre-approved status from metadata
 * - Paused state for manual approval
 */
export class HumanApprovalNodeExecutor extends BaseNodeExecutor {
  readonly supportedTypes: CanvasNodeType[] = ['humanApproval'];

  async execute(params: NodeExecutionParams): Promise<NodeExecutionResult> {
    const { node } = params;
    const metadata = this.getMetadata<HumanApprovalNodeMeta>(params);

    // Check if already approved/rejected
    if (metadata?.status === 'approved') {
      return this.success({
        type: 'humanApproval',
        title: node.data.title,
        status: 'approved',
        approved: true,
        approverId: metadata.approverId,
        approverName: metadata.approverName,
        approvedAt: metadata.approvedAt || new Date().toISOString(),
        timestamp: new Date().toISOString(),
      });
    }

    if (metadata?.status === 'rejected') {
      return this.failure(
        `Approval rejected: ${metadata.rejectionReason || 'No reason provided'}`
      );
    }

    if (metadata?.status === 'timeout') {
      return this.failure('Approval request timed out');
    }

    // Auto-approve mode for testing
    if (metadata?.autoApprove) {
      console.log(`✅ Auto-approving node ${node.id} (autoApprove=true)`);
      return this.success({
        type: 'humanApproval',
        title: node.data.title,
        status: 'approved',
        approved: true,
        autoApproved: true,
        message: 'Auto-approved (testing mode)',
        timestamp: new Date().toISOString(),
      });
    }

    // Create approval request and pause execution
    const approvalRequest = await this.createApprovalRequest(params, metadata);

    // Return paused result - execution will resume when approval is received
    return this.paused({
      type: 'humanApproval',
      title: node.data.title,
      status: 'pending',
      approved: false,
      approvalRequestId: approvalRequest.id,
      instructions: metadata?.instructions || node.data.contentPreview,
      timeoutSeconds: metadata?.timeoutSeconds,
      message: 'Waiting for human approval',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Create an approval request
   *
   * In a full implementation, this would:
   * 1. Store the request in the database
   * 2. Send notifications to approvers
   * 3. Set up timeout handling
   */
  private async createApprovalRequest(
    params: NodeExecutionParams,
    metadata: HumanApprovalNodeMeta | undefined
  ): Promise<{ id: string }> {
    const { node, context } = params;

    // Generate approval request ID
    const requestId = `approval-${context.executionId}-${node.id}-${Date.now()}`;

    // Log the approval request (in production, store in database)
    console.log('📋 Human approval request created:', {
      requestId,
      executionId: context.executionId,
      nodeId: node.id,
      title: node.data.title,
      instructions: metadata?.instructions || node.data.contentPreview,
      timeoutSeconds: metadata?.timeoutSeconds,
    });

    // In production, you would:
    // 1. Store in database:
    //    await this.approvalRepository.create({
    //      id: requestId,
    //      executionId: context.executionId,
    //      nodeId: node.id,
    //      status: 'pending',
    //      instructions: metadata?.instructions,
    //      timeoutAt: metadata?.timeoutSeconds
    //        ? new Date(Date.now() + metadata.timeoutSeconds * 1000)
    //        : null,
    //    });
    //
    // 2. Send notification:
    //    await this.notificationService.sendApprovalRequest({
    //      requestId,
    //      userId: context.userId,
    //      title: node.data.title,
    //      instructions: metadata?.instructions,
    //    });
    //
    // 3. Schedule timeout job:
    //    if (metadata?.timeoutSeconds) {
    //      await this.queueService.addApprovalTimeoutJob({
    //        requestId,
    //        delay: metadata.timeoutSeconds * 1000,
    //      });
    //    }

    return { id: requestId };
  }

  /**
   * Process an approval decision
   *
   * This method would be called when a user approves or rejects the request.
   * It's not part of the execute flow but provided for completeness.
   */
  static async processApprovalDecision(
    requestId: string,
    decision: {
      approved: boolean;
      approverId: string;
      approverName?: string;
      reason?: string;
    }
  ): Promise<void> {
    console.log('📋 Processing approval decision:', {
      requestId,
      approved: decision.approved,
      approverId: decision.approverId,
      reason: decision.reason,
    });

    // In production:
    // 1. Update approval request in database
    // 2. Resume workflow execution if approved
    // 3. Mark workflow as failed if rejected
    // 4. Cancel timeout job
  }
}

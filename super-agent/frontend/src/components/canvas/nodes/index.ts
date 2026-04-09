/**
 * Canvas Node Components
 */

export { AgentNode } from './AgentNode';
export { StartNode } from './StartNode';
export { EndNode } from './EndNode';
export { ActionNode } from './ActionNode';
export { ConditionNode } from './ConditionNode';
export { DocumentNode } from './DocumentNode';
export { CodeArtifactNode } from './CodeArtifactNode';
export { BaseNode } from './BaseNode';

// Import for nodeTypes object - must be after exports to avoid circular issues
import { AgentNode } from './AgentNode';
import { StartNode } from './StartNode';
import { EndNode } from './EndNode';
import { ActionNode } from './ActionNode';
import { ConditionNode } from './ConditionNode';
import { DocumentNode } from './DocumentNode';
import { CodeArtifactNode } from './CodeArtifactNode';
import { BaseNode } from './BaseNode';

export const nodeTypes = {
  agent: AgentNode,
  start: StartNode,
  end: EndNode,
  action: ActionNode,
  condition: ConditionNode,
  document: DocumentNode,
  codeArtifact: CodeArtifactNode,
  // Fallback for other types (including legacy humanApproval)
  humanApproval: BaseNode,
  resource: BaseNode,
  trigger: StartNode,
  loop: BaseNode,
  parallel: BaseNode,
  group: BaseNode,
  memo: BaseNode,
};

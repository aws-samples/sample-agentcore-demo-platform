/**
 * Canvas Edge Components
 */

import { CustomEdge } from './CustomEdge';

export const edgeTypes = {
  custom: CustomEdge,
  default: CustomEdge,
};

export const defaultEdgeOptions = {
  type: 'custom',
  animated: false,
};

export { CustomEdge } from './CustomEdge';

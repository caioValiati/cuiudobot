import { ToolResult } from '../tools/types.js';

export type StepType = 'thought' | 'action' | 'observation' | 'answer';

export interface AgentStep {
  type: StepType;
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: ToolResult;
}

export interface AgentState {
  steps: AgentStep[];
  iteration: number;
  maxIterations: number;
  finished: boolean;
  finalAnswer: string | null;
}

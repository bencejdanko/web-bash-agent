import { PersistentBashSandbox } from '../PersistentBashSandbox';
import { AgentOptions } from '../agent';

export type WorkflowInputType = 'text' | 'textarea' | 'password' | 'select' | 'number' | 'boolean';

export interface WorkflowInputOption {
  label: string;
  value: string;
}

export interface WorkflowInputConfig {
  label: string;
  type: WorkflowInputType;
  description?: string;
  defaultValue?: any;
  required?: boolean;
  placeholder?: string;
  options?: WorkflowInputOption[];
}

export type WorkflowInputSchema = Record<string, WorkflowInputConfig>;

export interface WorkflowStepContext {
  inputs: Record<string, any>;
  results: Record<string, { success: boolean; output: string; toolCalls?: any[] }>;
  sandbox: PersistentBashSandbox;
  fs: any;
  options: AgentOptions;
  log: (msg: string, level?: 'info' | 'tool' | 'result' | 'error') => void;
}

export interface WorkflowStepResult {
  success: boolean;
  output: string;
  toolCalls?: any[];
}

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  dependsOn?: string[];
  outputs?: string[];
  model?: string;
  maxIterations?: number;
  setup?: (inputs: Record<string, any>, context: WorkflowStepContext) => void | Promise<void>;
  prompt?: string | ((inputs: Record<string, any>, context: WorkflowStepContext) => string | Promise<string>);
  run?: (inputs: Record<string, any>, context: WorkflowStepContext) => Promise<WorkflowStepResult | string | void>;
}

export interface WorkflowDefinition {
  id: string;
  title: string;
  description?: string;
  inputs: WorkflowInputSchema;
  steps: WorkflowStep[];
}

export type WorkflowStepStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

export interface LogEntry {
  timestamp: string;
  text: string;
  level: 'info' | 'tool' | 'result' | 'error';
}

export interface WorkflowStepState {
  step: WorkflowStep;
  status: WorkflowStepStatus;
  startTime?: number;
  endTime?: number;
  logs: LogEntry[];
  output?: string;
  error?: string;
}

export interface WorkflowRunOptions {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  bashSandbox?: PersistentBashSandbox;
  filesystem?: Record<string, string>;
  onStepStatusChange?: (stepId: string, status: WorkflowStepStatus, state: WorkflowStepState) => void;
  onStepLog?: (stepId: string, log: LogEntry) => void;
  onWorkflowComplete?: (results: Record<string, WorkflowStepResult>) => void;
  onWorkflowError?: (error: Error) => void;
}

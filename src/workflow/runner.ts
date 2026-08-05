import {
  WorkflowDefinition,
  WorkflowRunOptions,
  WorkflowStepState,
  WorkflowStepResult,
  LogEntry,
} from './types';
import { agent } from '../agent';
import { PersistentBashSandbox } from '../PersistentBashSandbox';

export class WorkflowRunner {
  private definition: WorkflowDefinition;
  private options: WorkflowRunOptions;
  private states: Map<string, WorkflowStepState> = new Map();
  private results: Record<string, WorkflowStepResult> = {};
  private inputs: Record<string, any> = {};
  private sandbox: PersistentBashSandbox;
  private isRunning: boolean = false;
  private isCancelled: boolean = false;

  constructor(definition: WorkflowDefinition, inputs: Record<string, any>, options: WorkflowRunOptions = {}) {
    this.definition = definition;
    this.options = options;
    this.inputs = inputs;

    // Initialize sandbox
    this.sandbox = options.bashSandbox || new PersistentBashSandbox({
      files: options.filesystem || {},
    });

    // Initialize step states
    for (const step of definition.steps) {
      this.states.set(step.id, {
        step,
        status: 'pending',
        logs: [],
      });
    }
  }

  public getStepState(stepId: string): WorkflowStepState | undefined {
    return this.states.get(stepId);
  }

  public getAllStates(): Map<string, WorkflowStepState> {
    return this.states;
  }

  public getResults(): Record<string, WorkflowStepResult> {
    return this.results;
  }

  public cancel() {
    this.isCancelled = true;
  }

  public async run(): Promise<Record<string, WorkflowStepResult>> {
    if (this.isRunning) {
      throw new Error('Workflow runner is already executing.');
    }

    this.isRunning = true;
    this.isCancelled = false;

    try {
      // Execute steps respecting DAG dependencies
      const stepsToRun = [...this.definition.steps];

      while (stepsToRun.length > 0 && !this.isCancelled) {
        // Find steps whose dependencies are all completed
        const readySteps = stepsToRun.filter((step) => {
          const state = this.states.get(step.id);
          if (!state || state.status !== 'pending') return false;

          if (!step.dependsOn || step.dependsOn.length === 0) return true;

          return step.dependsOn.every((depId) => {
            const depState = this.states.get(depId);
            return depState && depState.status === 'completed';
          });
        });

        if (readySteps.length === 0) {
          // Check if remaining steps are blocked by failed dependencies
          const remainingPending = stepsToRun.filter(s => this.states.get(s.id)?.status === 'pending');
          if (remainingPending.length > 0) {
            for (const step of remainingPending) {
              const hasFailedDep = step.dependsOn?.some(depId => {
                const depState = this.states.get(depId);
                return depState?.status === 'error' || depState?.status === 'skipped';
              });

              if (hasFailedDep) {
                this.updateStepStatus(step.id, 'skipped');
              }
            }
          }
          break;
        }

        // Run ready steps (can execute in sequence or parallel; we run ready step sequence)
        for (const step of readySteps) {
          if (this.isCancelled) break;
          await this.executeStep(step);
        }

        // Remove executed/skipped steps from remaining
        const toRemove = new Set<string>();
        for (const step of stepsToRun) {
          const state = this.states.get(step.id);
          if (state && state.status !== 'pending') {
            toRemove.add(step.id);
          }
        }
        for (const id of toRemove) {
          const index = stepsToRun.findIndex(s => s.id === id);
          if (index !== -1) stepsToRun.splice(index, 1);
        }
      }

      if (this.options.onWorkflowComplete) {
        this.options.onWorkflowComplete(this.results);
      }

      return this.results;
    } catch (err: any) {
      if (this.options.onWorkflowError) {
        this.options.onWorkflowError(err instanceof Error ? err : new Error(String(err)));
      }
      throw err;
    } finally {
      this.isRunning = false;
    }
  }

  private async executeStep(step: typeof this.definition.steps[0]) {
    const state = this.states.get(step.id);
    if (!state) return;

    this.updateStepStatus(step.id, 'running');
    state.startTime = Date.now();

    const logFn = (msg: string, level: 'info' | 'tool' | 'result' | 'error' = 'info') => {
      const entry: LogEntry = {
        timestamp: new Date().toLocaleTimeString(),
        text: msg,
        level,
      };
      state.logs.push(entry);
      if (this.options.onStepLog) {
        this.options.onStepLog(step.id, entry);
      }
    };

    const stepCtx = {
      inputs: this.inputs,
      results: this.results,
      sandbox: this.sandbox,
      fs: this.sandbox.fs,
      options: this.options,
      log: logFn,
    };

    logFn(`Starting step: ${step.title}`, 'info');

    try {
      if (step.setup) {
        logFn('Running setup task...', 'info');
        await step.setup(this.inputs, stepCtx);
      }

      let stepResult: WorkflowStepResult;

      if (step.run) {
        logFn('Executing custom step handler...', 'info');
        const rawRes = await step.run(this.inputs, stepCtx);
        if (typeof rawRes === 'object' && rawRes !== null && 'success' in rawRes) {
          stepResult = rawRes as WorkflowStepResult;
        } else {
          stepResult = {
            success: true,
            output: typeof rawRes === 'string' ? rawRes : JSON.stringify(rawRes ?? 'Step complete'),
          };
        }
      } else {
        // Resolve prompt template
        let promptText = '';
        if (typeof step.prompt === 'function') {
          promptText = await step.prompt(this.inputs, stepCtx);
        } else if (typeof step.prompt === 'string') {
          promptText = step.prompt;
        } else {
          promptText = step.description || step.title;
        }

        const modelToUse = step.model || this.inputs.model || this.options.model || 'qwen/qwen3.7-flash';
        logFn(`Launching agent with prompt: "${promptText.substring(0, 80)}${promptText.length > 80 ? '...' : ''}" using model [${modelToUse}]`, 'info');

        const agentOpts: any = {
          bashSandbox: this.sandbox,
          model: modelToUse,
          maxIterations: step.maxIterations || 15,
          onLog: (msg: string, level?: any) => logFn(msg, level || 'info'),
        };

        if (this.inputs.apiKey) agentOpts.apiKey = this.inputs.apiKey;
        else if (this.options.apiKey) agentOpts.apiKey = this.options.apiKey;

        const endpointToUse = this.inputs.endpoint || this.options.endpoint || 'https://openrouter.ai/api/v1';
        agentOpts.endpoint = endpointToUse;

        const res = await agent(promptText, agentOpts);
        stepResult = {
          success: res.success,
          output: res.output,
          toolCalls: res.toolCalls,
        };
      }

      state.output = stepResult.output;
      state.endTime = Date.now();
      this.results[step.id] = stepResult;

      if (stepResult.success !== false) {
        logFn(`Completed step: ${step.title}`, 'result');
        this.updateStepStatus(step.id, 'completed');
      } else {
        state.error = stepResult.output || 'Step execution failed';
        logFn(`Failed step: ${step.title}`, 'error');
        this.updateStepStatus(step.id, 'error');
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      state.error = errMsg;
      state.endTime = Date.now();
      logFn(`Step error: ${errMsg}`, 'error');
      this.results[step.id] = { success: false, output: errMsg };
      this.updateStepStatus(step.id, 'error');
    }
  }

  private updateStepStatus(stepId: string, status: WorkflowStepState['status']) {
    const state = this.states.get(stepId);
    if (state) {
      state.status = status;
      if (this.options.onStepStatusChange) {
        this.options.onStepStatusChange(stepId, status, state);
      }
    }
  }
}

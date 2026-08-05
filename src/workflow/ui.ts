import { WorkflowDefinition, WorkflowRunOptions, WorkflowStepState, WorkflowStepResult } from './types';
import { WorkflowRunner } from './runner';
import { renderWorkflowD3Graph } from './graph';
import { openNotepadModal } from '../commands/notepad';

export interface WorkflowUIOptions extends WorkflowRunOptions {
  autoRun?: boolean;
}

export class WorkflowUI {
  private container: HTMLElement;
  private definition: WorkflowDefinition;
  private options: WorkflowUIOptions;
  private runner: WorkflowRunner | null = null;
  private inputElements: Map<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = new Map();
  private graphContainer: HTMLElement;
  private logContainer: HTMLPreElement;
  private statusEl: HTMLElement;
  private runBtn: HTMLButtonElement;
  private selectedStepId: string;
  private stepStates: Map<string, WorkflowStepState> = new Map();

  constructor(container: HTMLElement, definition: WorkflowDefinition, options: WorkflowUIOptions = {}) {
    this.container = container;
    this.definition = definition;
    this.options = options;
    this.selectedStepId = definition.steps[0]?.id || '';

    // Initialize step state snapshots
    for (const step of definition.steps) {
      this.stepStates.set(step.id, {
        step,
        status: 'pending',
        logs: [],
      });
    }

    this.container.innerHTML = '';
    this.container.style.cssText = 'display: flex; flex-direction: column; gap: 12px; font-family: sans-serif;';

    // 1. Basic Header
    const titleEl = document.createElement('h3');
    titleEl.style.margin = '0';
    titleEl.textContent = definition.title;
    this.container.appendChild(titleEl);

    if (definition.description) {
      const descEl = document.createElement('p');
      descEl.style.margin = '0';
      descEl.style.color = '#555';
      descEl.style.fontSize = '14px';
      descEl.textContent = definition.description;
      this.container.appendChild(descEl);
    }

    // 2. Unstyled Inputs Form
    const formEl = document.createElement('div');
    formEl.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    const inputsSchema = definition.inputs || {};
    for (const [key, schema] of Object.entries(inputsSchema)) {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.flexDirection = 'column';
      label.style.gap = '4px';
      label.style.fontSize = '13px';
      label.textContent = `${schema.label}${schema.required ? ' *' : ''}:`;

      const storageKey = `wf_input_${definition.id}_${key}`;
      const savedVal = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
      const initialVal = savedVal !== null ? savedVal : (schema.defaultValue ?? '');

      let inputEl: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

      if (schema.type === 'textarea') {
        const textarea = document.createElement('textarea');
        textarea.rows = 4;
        textarea.value = initialVal;
        textarea.placeholder = schema.placeholder || '';
        inputEl = textarea;
      } else if (schema.type === 'select') {
        const select = document.createElement('select');
        if (schema.options) {
          for (const opt of schema.options) {
            const optEl = document.createElement('option');
            optEl.value = opt.value;
            optEl.textContent = opt.label;
            select.appendChild(optEl);
          }
        }
        select.value = initialVal;
        inputEl = select;
      } else {
        const input = document.createElement('input');
        input.type = schema.type === 'password' ? 'password' : (schema.type === 'number' ? 'number' : 'text');
        input.value = initialVal;
        input.placeholder = schema.placeholder || '';
        inputEl = input;
      }

      inputEl.addEventListener('input', () => {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(storageKey, inputEl.value);
        }
      });

      this.inputElements.set(key, inputEl);
      label.appendChild(inputEl);
      formEl.appendChild(label);
    }

    this.container.appendChild(formEl);

    // 3. Simple D3 Graph Container
    this.graphContainer = document.createElement('div');
    this.container.appendChild(this.graphContainer);
    this.updateGraph();

    // 4. Status Bar & Execution Button
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; align-items: center; gap: 12px;';

    this.runBtn = document.createElement('button');
    this.runBtn.textContent = 'Run Workflow';
    this.runBtn.onclick = () => this.startExecution();

    this.statusEl = document.createElement('span');
    this.statusEl.style.fontSize = '13px';
    this.statusEl.style.color = '#555';
    this.statusEl.textContent = 'Ready';

    controls.appendChild(this.runBtn);
    controls.appendChild(this.statusEl);
    this.container.appendChild(controls);

    // 5. Plain Pre Log Container
    this.logContainer = document.createElement('pre');
    this.logContainer.style.cssText = 'background: #f4f4f4; border: 1px solid #ccc; padding: 8px; max-height: 160px; overflow: auto; font-size: 12px; margin: 0;';
    this.logContainer.textContent = 'Select a step in the graph to view logs.\n';
    this.container.appendChild(this.logContainer);

    if (options.autoRun) {
      this.startExecution();
    }
  }

  public collectInputs(): Record<string, any> {
    const values: Record<string, any> = {};
    for (const [key, el] of this.inputElements.entries()) {
      values[key] = el.value;
    }
    return values;
  }

  private updateGraph() {
    renderWorkflowD3Graph(this.graphContainer, this.definition, this.stepStates, {
      selectedStepId: this.selectedStepId,
      onSelectStep: (stepId) => {
        this.selectedStepId = stepId;
        this.updateGraph();
        this.renderLogsForStep(stepId);
      },
    });
  }

  private renderLogsForStep(stepId: string) {
    const state = this.stepStates.get(stepId);
    if (!state) return;

    let text = `=== Step: ${state.step.title} [Status: ${state.status.toUpperCase()}] ===\n`;
    if (state.logs.length === 0) {
      text += '(No log entries yet)\n';
    } else {
      for (const log of state.logs) {
        text += `[${log.timestamp}] ${log.text}\n`;
      }
    }

    if (state.output) {
      text += `\n--- Output Summary ---\n${state.output}\n`;
    }
    if (state.error) {
      text += `\nError: ${state.error}\n`;
    }

    this.logContainer.textContent = text;
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }

  public async startExecution() {
    const inputs = this.collectInputs();

    for (const [key, schema] of Object.entries(this.definition.inputs || {})) {
      if (schema.required && (!inputs[key] || String(inputs[key]).trim() === '')) {
        alert(`Please fill in required field: ${schema.label}`);
        return;
      }
    }

    this.runBtn.disabled = true;
    this.runBtn.textContent = 'Running...';
    this.statusEl.textContent = 'Running workflow...';

    for (const step of this.definition.steps) {
      this.stepStates.set(step.id, {
        step,
        status: 'pending',
        logs: [],
      });
    }
    this.updateGraph();

    this.runner = new WorkflowRunner(this.definition, inputs, {
      ...this.options,
      onStepStatusChange: (stepId, status, state) => {
        this.stepStates.set(stepId, state);
        this.statusEl.textContent = `Step ${state.step.title}: ${status}`;
        this.updateGraph();
        if (this.selectedStepId === stepId) {
          this.renderLogsForStep(stepId);
        }
      },
      onStepLog: (stepId) => {
        if (this.selectedStepId === stepId) {
          this.renderLogsForStep(stepId);
        }
      },
      onWorkflowComplete: (results) => {
        this.statusEl.textContent = 'Workflow complete';
        this.runBtn.disabled = false;
        this.runBtn.textContent = 'Run Workflow';
        this.updateGraph();
        this.renderOutputActions();
        if (this.options.onWorkflowComplete) {
          this.options.onWorkflowComplete(results);
        }
      },
      onWorkflowError: (err) => {
        this.statusEl.textContent = `Workflow error: ${err.message}`;
        this.runBtn.disabled = false;
        this.runBtn.textContent = 'Run Workflow';
        this.updateGraph();
        if (this.options.onWorkflowError) {
          this.options.onWorkflowError(err);
        }
      },
    });

    try {
      await this.runner.run();
    } catch {
      // Handled in callback
    }
  }

  private renderOutputActions() {
    const actionContainer = document.createElement('div');
    actionContainer.style.cssText = 'display: flex; gap: 8px; margin-top: 6px;';

    for (const step of this.definition.steps) {
      if (step.outputs) {
        for (const outPath of step.outputs) {
          const fileName = outPath.split('/').pop() || outPath;
          const btn = document.createElement('button');
          btn.textContent = `Open ${fileName}`;
          btn.onclick = () => {
            const sandbox = (this.runner as any)?.sandbox;
            const fs = sandbox ? sandbox.fs : null;
            openNotepadModal({ filename: fileName, filePath: outPath, fs });
          };
          actionContainer.appendChild(btn);
        }
      }
    }

    if (actionContainer.children.length > 0) {
      this.logContainer.appendChild(actionContainer);
    }
  }
}

/**
 * Helper to mount Workflow UI inline inside any target container element.
 */
export function mountWorkflowUI(
  container: HTMLElement,
  definition: WorkflowDefinition,
  options: WorkflowUIOptions = {}
): WorkflowUI {
  return new WorkflowUI(container, definition, options);
}

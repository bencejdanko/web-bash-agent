import { describe, it, expect, vi } from 'vitest';
import { defineWorkflow, computeWorkflowLayoutRanks } from './definition';
import { WorkflowRunner } from './runner';

describe('Workflow Definition & Topological Ranks', () => {
  it('validates a valid workflow definition', () => {
    const wf = defineWorkflow({
      id: 'test-wf',
      title: 'Test Workflow',
      inputs: {
        topic: { label: 'Topic', type: 'text', required: true },
      },
      steps: [
        { id: 'step1', title: 'Step 1' },
        { id: 'step2', title: 'Step 2', dependsOn: ['step1'] },
      ],
    });

    expect(wf.id).toBe('test-wf');
    expect(wf.steps.length).toBe(2);
  });

  it('throws error if duplicate step IDs exist', () => {
    expect(() => {
      defineWorkflow({
        id: 'dup-wf',
        title: 'Dup Workflow',
        inputs: {},
        steps: [
          { id: 'step1', title: 'Step 1' },
          { id: 'step1', title: 'Step 1 Duplicate' },
        ],
      });
    }).toThrow('Duplicate step id');
  });

  it('throws error if unknown dependency is referenced', () => {
    expect(() => {
      defineWorkflow({
        id: 'bad-dep',
        title: 'Bad Dep Workflow',
        inputs: {},
        steps: [
          { id: 'step1', title: 'Step 1', dependsOn: ['nonexistent'] },
        ],
      });
    }).toThrow("references unknown dependency 'nonexistent'");
  });

  it('computes topological ranks correctly for DAG layers', () => {
    const steps = [
      { id: 'start', title: 'Start' },
      { id: 'branchA', title: 'Branch A', dependsOn: ['start'] },
      { id: 'branchB', title: 'Branch B', dependsOn: ['start'] },
      { id: 'merge', title: 'Merge', dependsOn: ['branchA', 'branchB'] },
    ];

    const ranks = computeWorkflowLayoutRanks(steps);

    expect(ranks.get('start')).toBe(0);
    expect(ranks.get('branchA')).toBe(1);
    expect(ranks.get('branchB')).toBe(1);
    expect(ranks.get('merge')).toBe(2);
  });
});

describe('WorkflowRunner Execution', () => {
  it('executes steps in dependency order and collects outputs', async () => {
    const executionOrder: string[] = [];

    const wf = defineWorkflow({
      id: 'exec-wf',
      title: 'Execution Workflow',
      inputs: {
        greeting: { label: 'Greeting', type: 'text', defaultValue: 'Hello' },
      },
      steps: [
        {
          id: 'step1',
          title: 'Step 1',
          run: async (inputs) => {
            executionOrder.push('step1');
            return { success: true, output: `${inputs.greeting} World` };
          },
        },
        {
          id: 'step2',
          title: 'Step 2',
          dependsOn: ['step1'],
          run: async (inputs, ctx) => {
            executionOrder.push('step2');
            const prevOutput = ctx.results.step1.output;
            return { success: true, output: `${prevOutput} -> Step 2 Done` };
          },
        },
      ],
    });

    const runner = new WorkflowRunner(wf, { greeting: 'Hello' });
    const results = await runner.run();

    expect(executionOrder).toEqual(['step1', 'step2']);
    expect(results.step1.output).toBe('Hello World');
    expect(results.step2.output).toBe('Hello World -> Step 2 Done');

    const state1 = runner.getStepState('step1');
    const state2 = runner.getStepState('step2');
    expect(state1?.status).toBe('completed');
    expect(state2?.status).toBe('completed');
  });

  it('skips dependent steps if upstream step fails', async () => {
    const wf = defineWorkflow({
      id: 'fail-wf',
      title: 'Failure Workflow',
      inputs: {},
      steps: [
        {
          id: 'step1',
          title: 'Failing Step',
          run: async () => {
            return { success: false, output: 'Something went wrong' };
          },
        },
        {
          id: 'step2',
          title: 'Dependent Step',
          dependsOn: ['step1'],
          run: async () => {
            return { success: true, output: 'Should not run' };
          },
        },
      ],
    });

    const runner = new WorkflowRunner(wf, {});
    const results = await runner.run();

    expect(results.step1.success).toBe(false);
    expect(runner.getStepState('step1')?.status).toBe('error');
    expect(runner.getStepState('step2')?.status).toBe('skipped');
  });
});

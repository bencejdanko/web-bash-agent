import { WorkflowDefinition, WorkflowStep } from './types';

export interface TopologicalNode {
  step: WorkflowStep;
  rank: number;
  dependencies: string[];
}

export function defineWorkflow<T extends WorkflowDefinition>(workflow: T): T {
  if (!workflow.id) {
    throw new Error('Workflow definition must have an id');
  }
  if (!workflow.title) {
    throw new Error('Workflow definition must have a title');
  }
  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    throw new Error('Workflow definition must have at least one step');
  }

  const stepIds = new Set<string>();
  for (const step of workflow.steps) {
    if (!step.id) {
      throw new Error('All workflow steps must have an id');
    }
    if (stepIds.has(step.id)) {
      throw new Error(`Duplicate step id found: ${step.id}`);
    }
    stepIds.add(step.id);
  }

  // Validate dependencies
  for (const step of workflow.steps) {
    if (step.dependsOn) {
      for (const depId of step.dependsOn) {
        if (!stepIds.has(depId)) {
          throw new Error(`Step '${step.id}' references unknown dependency '${depId}'`);
        }
        if (depId === step.id) {
          throw new Error(`Step '${step.id}' cannot depend on itself`);
        }
      }
    }
  }

  return workflow;
}

/**
 * Calculates topological ranks for nodes to position them horizontally in flowing graph layers.
 */
export function computeWorkflowLayoutRanks(steps: WorkflowStep[]): Map<string, number> {
  const ranks = new Map<string, number>();
  const stepMap = new Map<string, WorkflowStep>();

  for (const step of steps) {
    stepMap.set(step.id, step);
  }

  function getRank(id: string, visited = new Set<string>()): number {
    if (ranks.has(id)) {
      return ranks.get(id)!;
    }
    if (visited.has(id)) {
      throw new Error(`Circular dependency detected involving step '${id}'`);
    }

    visited.add(id);
    const step = stepMap.get(id);
    if (!step || !step.dependsOn || step.dependsOn.length === 0) {
      ranks.set(id, 0);
      return 0;
    }

    let maxDepRank = 0;
    for (const depId of step.dependsOn) {
      const depRank = getRank(depId, new Set(visited));
      maxDepRank = Math.max(maxDepRank, depRank + 1);
    }

    ranks.set(id, maxDepRank);
    return maxDepRank;
  }

  for (const step of steps) {
    getRank(step.id);
  }

  return ranks;
}

import * as d3 from 'd3';
import { WorkflowDefinition, WorkflowStepState } from './types';
import { computeWorkflowLayoutRanks } from './definition';

export interface GraphRenderOptions {
  selectedStepId?: string;
  onSelectStep?: (stepId: string) => void;
}

export function renderWorkflowD3Graph(
  container: HTMLElement,
  definition: WorkflowDefinition,
  states: Map<string, WorkflowStepState>,
  options: GraphRenderOptions = {}
): void {
  // Clear any existing content in container
  d3.select(container).selectAll('*').remove();

  const ranks = computeWorkflowLayoutRanks(definition.steps);

  // Group steps by rank layer
  const rankGroups = new Map<number, typeof definition.steps>();
  let maxRank = 0;

  for (const step of definition.steps) {
    const r = ranks.get(step.id) || 0;
    maxRank = Math.max(maxRank, r);
    if (!rankGroups.has(r)) {
      rankGroups.set(r, []);
    }
    rankGroups.get(r)!.push(step);
  }

  // Vertical Top-to-Down Layout dimensions & spacing
  const layerSpacingY = 70;
  const nodeSpacingX = 200;
  const paddingX = 40;
  const paddingY = 30;

  let maxNodesInRank = 0;
  for (let r = 0; r <= maxRank; r++) {
    const group = rankGroups.get(r) || [];
    maxNodesInRank = Math.max(maxNodesInRank, group.length);
  }

  const svgWidth = Math.max(480, maxNodesInRank * nodeSpacingX + paddingX * 2);
  const svgHeight = Math.max(180, (maxRank + 1) * layerSpacingY + paddingY * 2);

  const nodeMap = new Map<string, { id: string; title: string; status: string; x: number; y: number; isSelected: boolean }>();

  for (let r = 0; r <= maxRank; r++) {
    const group = rankGroups.get(r) || [];
    const y = paddingY + r * layerSpacingY + 10;
    const groupWidth = (group.length - 1) * nodeSpacingX;
    const startX = (svgWidth - groupWidth) / 2;

    group.forEach((step, idx) => {
      const x = startX + idx * nodeSpacingX;
      const state = states.get(step.id);
      nodeMap.set(step.id, {
        id: step.id,
        title: step.title,
        status: state?.status || 'pending',
        x,
        y,
        isSelected: options.selectedStepId === step.id,
      });
    });
  }

  const links: Array<{ source: { x: number; y: number }; target: { x: number; y: number }; status: string }> = [];

  for (const step of definition.steps) {
    if (step.dependsOn) {
      const targetNode = nodeMap.get(step.id);
      if (!targetNode) continue;

      for (const depId of step.dependsOn) {
        const sourceNode = nodeMap.get(depId);
        if (!sourceNode) continue;

        links.push({
          source: { x: sourceNode.x, y: sourceNode.y },
          target: { x: targetNode.x, y: targetNode.y },
          status: sourceNode.status,
        });
      }
    }
  }

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', svgHeight)
    .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
    .style('border', '1px solid #ccc')
    .style('background', '#ffffff')
    .style('font-family', 'sans-serif');

  // Render Downward Vertical Link Paths with D3
  svg
    .append('g')
    .selectAll('path')
    .data(links)
    .enter()
    .append('path')
    .attr('d', (d) => `M ${d.source.x} ${d.source.y} C ${d.source.x} ${d.source.y + 35}, ${d.target.x} ${d.target.y - 35}, ${d.target.x} ${d.target.y}`)
    .attr('stroke', (d) => (d.status === 'completed' ? '#22c55e' : d.status === 'running' ? '#3b82f6' : '#cbd5e1'))
    .attr('stroke-width', 2)
    .attr('fill', 'none');

  // Render Nodes with D3
  const nodes = svg
    .append('g')
    .selectAll('g')
    .data(Array.from(nodeMap.values()))
    .enter()
    .append('g')
    .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      if (options.onSelectStep) {
        options.onSelectStep(d.id);
      }
    });

  // Node Circle
  nodes
    .append('circle')
    .attr('r', 12)
    .attr('fill', (d) => {
      if (d.status === 'completed') return '#22c55e';
      if (d.status === 'running') return '#3b82f6';
      if (d.status === 'error') return '#ef4444';
      if (d.status === 'skipped') return '#94a3b8';
      return '#e2e8f0';
    })
    .attr('stroke', (d) => (d.isSelected ? '#000000' : '#64748b'))
    .attr('stroke-width', (d) => (d.isSelected ? 3 : 1));

  // Node Text Label
  nodes
    .append('text')
    .attr('dx', 18)
    .attr('dy', 4)
    .attr('font-size', '12px')
    .attr('fill', '#000000')
    .text((d) => `${d.title} (${d.status})`);
}

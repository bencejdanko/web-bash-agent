
import { AgentTool } from '../types/tools';
import { AgentSkill } from '../types';

export const createLoadSkillTool = (skills: AgentSkill[]): AgentTool => ({
  definition: {
    type: 'function',
    function: {
      name: 'load_skill',
      description: 'Load the full instructions and documentation for a specific skill.',
      parameters: {
        type: 'object',
        properties: {
          skill_name: {
            type: 'string',
            enum: skills.map((s) => s.name),
            description: 'The name of the skill to load.',
          },
        },
        required: ['skill_name'],
      },
    },
  },
  handler: async ({ skill_name }) => {
    const skill = skills.find((s) => s.name === skill_name);
    if (skill) {
      return `Skill loaded: ${skill.name}\n\nInstructions:\n${skill.instructions}`;
    } else {
      return `Error: Skill '${skill_name}' not found.`;
    }
  },
});

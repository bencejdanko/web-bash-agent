import { createSearchCommand } from './search';
import { createFetchInternalCommand } from './fetch-internal';
import { createNavigateCommand } from './navigate';
import { createRenderDiagramCommand } from './render-diagram';

export interface CommandContext {
    pagefind?: any;
    getFs: () => any;
}

/**
 * Returns a set of standard commands for the agent.
 * Library consumers can use this to easily add the "core" functionality.
 */
export function getDefaultCommands(context: CommandContext) {
    return [
        createSearchCommand(context),
        createFetchInternalCommand(), // Standardized to take context later if needed
        createNavigateCommand(),      // Standardized to take context later if needed
        createRenderDiagramCommand(context)
    ];
}

export {
    createSearchCommand,
    createFetchInternalCommand,
    createNavigateCommand,
    createRenderDiagramCommand
};

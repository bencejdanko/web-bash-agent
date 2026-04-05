import fs from 'node:fs';
import path from 'node:path';

/**
 * Recursively builds a virtual filesystem mapping from a base directory.
 * Includes text-based files and Pagefind metadata.
 */
export function getFilesystem(baseDir: string, skip: string[] = ['node_modules', 'dist', '.git']): Record<string, string> {
    const result: Record<string, string> = {};

    function walk(dir: string, relativePath = '') {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relPath = path.join(relativePath, entry.name);

                // Skip ignored folders
                if (skip.includes(entry.name)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    walk(fullPath, relPath);
                } else if (entry.isFile()) {
                    // Include text files and Pagefind metadata
                    const ext = path.extname(entry.name).toLowerCase();
                    const textExtensions = ['.md', '.mdx', '.json', '.txt', '.astro', '.ts', '.tsx', '.js', '.jsx', '.pf_meta', '.pf_fragment'];
                    
                    if (textExtensions.includes(ext)) {
                        try {
                            const content = fs.readFileSync(fullPath, 'utf-8');
                            // Use / as path separator regardless of OS
                            const unixPath = '/' + relPath.split(path.sep).join('/');
                            result[unixPath] = content;
                        } catch (e) {
                            console.error(`Failed to read file: ${fullPath}`, e);
                        }
                    }
                }
            }
        } catch (e) {
            console.error(`Error walking directory ${dir}:`, e);
        }
    }

    if (fs.existsSync(baseDir)) {
        walk(baseDir);
    }

    return result;
}

/**
 * Standardized way to gather the agent's context (metadata folder + pagefind index).
 * Used for building a "production-ready" virtual filesystem.
 */
export function getAgentContextFilesystem(options: { 
    agentsDir: string; 
    pagefindIndexDir?: string;
    buildDir?: string;
    mounts?: Record<string, string>; // Mapping from virtual path to real path
}): Record<string, string> {
    const realFilesystem: Record<string, string> = {};

    // 1. Mount the .agents (metadata) folder
    if (fs.existsSync(options.agentsDir)) {
        const metadataFs = getFilesystem(options.agentsDir);
        for (const [p, content] of Object.entries(metadataFs)) {
            realFilesystem['/.agents' + p] = content;
        }
    }

    // 2. Mount the Pagefind index
    if (options.pagefindIndexDir && fs.existsSync(options.pagefindIndexDir)) {
        const indexFs = getFilesystem(options.pagefindIndexDir);
        for (const [p, content] of Object.entries(indexFs)) {
            realFilesystem['/pagefind' + p] = content;
        }
    }

    // 3. Mount the build output (dist)
    if (options.buildDir && fs.existsSync(options.buildDir)) {
        const buildFs = getFilesystem(options.buildDir, ['node_modules', '.git']);
        for (const [p, content] of Object.entries(buildFs)) {
            realFilesystem['/build' + p] = content;
        }
    }

    // 4. Mount additional custom directories
    if (options.mounts) {
        for (const [vPath, rPath] of Object.entries(options.mounts)) {
            if (fs.existsSync(rPath)) {
                const mountFs = getFilesystem(rPath);
                for (const [p, content] of Object.entries(mountFs)) {
                    // Ensure vPath starts with / and join it
                    const prefix = vPath.startsWith('/') ? vPath : '/' + vPath;
                    realFilesystem[prefix + p] = content;
                }
            }
        }
    }

    return realFilesystem;
}

import fs from 'node:fs';
import path from 'node:path';

/**
 * Recursively builds a virtual filesystem mapping from a base directory.
 * Includes text-based files.
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
                    const textExtensions = ['.md', '.mdx', '.json', '.txt', '.astro', '.ts', '.tsx', '.js', '.jsx', '.yaml', '.yml', '.svg'];
                    
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
 * Standardized way to gather the agent's context from multiple mount points.
 * @param mounts Mapping from virtual path (e.g. '/.agents') to real filesystem path.
 */
export function getAgentContextFilesystem(mounts: Record<string, string>): Record<string, string> {
    const realFilesystem: Record<string, string> = {};

    for (const [vPath, rPath] of Object.entries(mounts)) {
        if (fs.existsSync(rPath)) {
            const mountFs = getFilesystem(rPath);
            for (const [p, content] of Object.entries(mountFs)) {
                // Ensure vPath starts with / and join it
                const prefix = vPath.startsWith('/') ? vPath : '/' + vPath;
                const joinedPath = (prefix + p).replace(/\/+/g, '/');
                realFilesystem[joinedPath] = content;
            }
        }
    }

    return realFilesystem;
}

import fs from 'node:fs';
import path from 'node:path';

export function getFilesystem(baseDir: string): Record<string, string> {
    const result: Record<string, string> = {};

    function walk(dir: string, relativePath = '') {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.join(relativePath, entry.name);

            // Skip hidden files and common ignore folders, but keep .agents
            if ((entry.name.startsWith('.') && entry.name !== '.agents') || entry.name === 'node_modules' || entry.name === 'dist') {
                continue;
            }

            if (entry.isDirectory()) {
                walk(fullPath, relPath);
            } else if (entry.isFile()) {
                // Only include text-based and index-related files
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
    }

    if (fs.existsSync(baseDir)) {
        walk(baseDir);
    } else {
        console.warn(`Base directory does not exist: ${baseDir}`);
    }

    return result;
}

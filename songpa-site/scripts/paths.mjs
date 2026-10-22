import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const entryHtml = fileURLToPath(new URL('../../index.html', import.meta.url));
export const projectPath = (...parts) => path.join(projectRoot, ...parts);

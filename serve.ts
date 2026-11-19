// Leonida Trophy Tracker — serves app/ on http://localhost:8080 for local tries.
// Node 22, standard library only. Run with: node serve.ts

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const appDir = join(repoRoot, 'app');
const port = Number(process.env.PORT ?? 8080);

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function safePath(urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const resolved = normalize(join(appDir, decoded === '/' ? 'index.html' : decoded));
  if (!resolved.startsWith(appDir)) return null;
  return resolved;
}

const server = createServer((req, res) => {
  const file = safePath(req.url ?? '/');
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found\n');
    return;
  }
  res.writeHead(200, { 'content-type': contentTypes[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

server.listen(port, () => {
  console.log(`Leonida Trophy Tracker at http://localhost:${port}`);
});

server.on('error', (error: Error) => {
  console.error(`Server error: ${error.message}`);
  process.exit(1);
});

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.env.PORT || 3000);
const siteRoot = resolve('outputs/site');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
};

function fileForUrl(url) {
  const parsed = new URL(url, `http://localhost:${port}`);
  const cleanPath = normalize(decodeURIComponent(parsed.pathname)).replace(/^(\.\.[/\\])+/, '');
  const requested = resolve(join(siteRoot, cleanPath));
  if (!requested.startsWith(siteRoot)) return null;
  if (existsSync(requested) && statSync(requested).isFile()) return requested;
  if (existsSync(requested) && statSync(requested).isDirectory()) return join(requested, 'index.html');
  return join(siteRoot, 'index.html');
}

createServer((req, res) => {
  const file = fileForUrl(req.url || '/');
  if (!file || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'content-type': mime[extname(file)] || 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`Sunglasses Lens Intelligence running on http://localhost:${port}`);
});

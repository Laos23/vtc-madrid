import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const decoded = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(root, decoded);
    // La lista de rutas permitidas se comprueba sobre la ruta ya resuelta: así `src/..%2F` o `%5C` no sirven para salir de ella.
    const relative = path.relative(root, target).split(path.sep).join('/');
    const allowed = !decoded.includes('\0') && !decoded.includes('\\') && (relative === 'index.html' || relative === 'favicon.svg' || /^(src|data|temas)\/[^/]/.test(relative) || /^assets\/mascota\/gallo-(96|256)\.png$/.test(relative));
    if (!allowed || !target.startsWith(root + path.sep)) { res.writeHead(403); res.end('Acceso no permitido'); return; }
    const info = await stat(target);
    if (!info.isFile()) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type': `${types[path.extname(target)] || 'application/octet-stream'}${['.html','.js','.css','.json','.svg'].includes(path.extname(target)) ? '; charset=utf-8' : ''}`, 'Content-Length': info.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'" });
    if (req.method === 'HEAD') res.end(); else createReadStream(target).pipe(res);
  } catch { res.writeHead(404); res.end('Archivo no encontrado'); }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} ya está ocupado. Cierra la otra instancia o usa PORT para elegir otro.` : error); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`VTC Madrid disponible en http://127.0.0.1:${server.address().port}`));

import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { build } from '../src/build.mjs';
const out = path.resolve(process.env.SITE_DIST || 'site-dist');
if (!process.env.SITE_DIST) await build({site:'test/fixtures/site',out});
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.js':'text/javascript','.mp4':'video/mp4'};
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url,'http://localhost');
    if (!url.pathname.startsWith('/product/')) throw new Error('prefix');
    let file = path.resolve(out, decodeURIComponent(url.pathname.slice('/product/'.length)) || 'index.html');
    if (!file.startsWith(out + path.sep)) throw new Error('path');
    if ((await fs.stat(file)).isDirectory()) file = path.join(file,'index.html');
    res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173,'127.0.0.1');

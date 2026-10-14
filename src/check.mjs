import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
export async function check(out = 'site-dist') {
  out = path.resolve(out);
  const documents = new Map();
  const errors = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith('.html')) {
        const html = await fs.readFile(file, 'utf8');
        if (/^google-site-verification:\s*[^<>]+\s*$/.test(html.trim())) continue;
        const nodes = [], ids = new Set();
        const tree = parse(html, { onParseError: e => errors.push(`${file}: ${e.code}`) });
        function visit(node) {
          if (node.tagName) {
            const attrs = Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
            nodes.push({ tag: node.tagName, attrs });
            if (attrs.id) { if (ids.has(attrs.id)) errors.push(`${file}: duplicate id ${attrs.id}`); ids.add(attrs.id); }
          }
          for (const child of node.childNodes || []) visit(child);
        }
        visit(tree);
        if (!nodes.find(n => n.tag === 'html')?.attrs.lang) errors.push(`${file}: missing language`);
        for (const tag of ['title', 'main', 'h1']) if (nodes.filter(n => n.tag === tag).length !== 1) errors.push(`${file}: expected one ${tag}`);
        for (const n of nodes) if (n.tag === 'img' && !('alt' in n.attrs)) errors.push(`${file}: missing image alt`);
        documents.set(file, { nodes, ids });
      }
    }
  }
  await walk(out);
  for (const [file, { nodes }] of documents) {
    for (const { attrs } of nodes) for (const key of ['href', 'src', 'poster']) {
      const value = attrs[key];
      if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) continue;
      const url = new URL(value, `https://site.invalid/${path.relative(out, file).split(path.sep).join('/')}`);
      let target = path.resolve(out, '.' + decodeURIComponent(url.pathname));
      if (!target.startsWith(out + path.sep)) { errors.push(`${file}: link escapes output ${value}`); continue; }
      try {
        if ((await fs.stat(target)).isDirectory()) target = path.join(target, 'index.html');
        await fs.access(target);
        if (url.hash && documents.has(target) && !documents.get(target).ids.has(decodeURIComponent(url.hash.slice(1)))) errors.push(`${file}: missing fragment ${value}`);
      } catch { errors.push(`${file}: missing target ${value}`); }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return documents.size;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`Checked ${await check(process.argv[2])} HTML file(s)`);

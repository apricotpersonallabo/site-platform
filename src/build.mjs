import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { validateConfig } from './config.mjs';

const escape = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export const pagePath = (config, locale, slug) => `${locale === config.defaultLanguage ? '' : `${locale}/`}${slug}.html`;
const relative = (from, to) => path.posix.relative(path.posix.dirname(from), to);
async function files(directory, prefix = '') {
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT' && !prefix) return []; throw error; }
  const result = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed: ${directory}/${entry.name}`);
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await files(path.join(directory, entry.name), name + '/'));
    else if (entry.isFile()) result.push(name);
    else throw new Error(`Unsupported static file: ${name}`);
  }
  return result;
}
async function sourceFile(site, source) {
  const resolved = await fs.realpath(path.resolve(site, source));
  if (!resolved.startsWith(site + path.sep)) throw new Error(`Page source escapes site directory: ${source}`);
  return fs.readFile(resolved, 'utf8');
}
function layout(config, page, locale, actualLocale, body, preview) {
  const current = pagePath(config, locale, page.slug);
  const titleFor = (p, lang) => (p.locales?.[lang] || p).title;
  const nav = config.pages.map(p => `<a href="${relative(current, pagePath(config, locale, p.slug))}"${p.slug === page.slug ? ' aria-current="page"' : ''}>${escape(titleFor(p, locale))}</a>`).join('');
  const languages = config.languages.map(lang => `<a href="${relative(current, pagePath(config, lang, page.slug))}" hreflang="${lang}" lang="${lang}"${lang === locale ? ' aria-current="true"' : ''}>${escape(new Intl.DisplayNames([lang], {type:'language'}).of(lang))}</a>`).join(' ');
  const alternates = config.languages.map(lang => `<link rel="alternate" hreflang="${lang}" href="${relative(current, pagePath(config, lang, page.slug))}">`).join('\n');
  return `<!doctype html>
<html lang="${locale}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escape(config.product.description)}">
<title>${escape(titleFor(page, locale))} | ${escape(config.product.name)}</title>
<link rel="stylesheet" href="${relative(current, 'assets/site.css')}">
${config.favicon ? `<link rel="icon" href="${escape(relative(current, config.favicon))}">` : ''}
${alternates}
<style>:root{--site-primary:${config.theme?.primary || '#183153'};--site-accent:${config.theme?.accent || '#a7440a'};}</style>
</head><body>
<a class="skip-link" href="#main">${locale === 'ja' ? '本文へ移動' : 'Skip to content'}</a>
<header class="site-header"><div class="shell header-inner">
<a class="brand" href="${relative(current, pagePath(config, locale, 'index'))}">${escape(config.product.name)}</a>
<nav class="site-nav" aria-label="Primary">${nav}</nav>
${config.languages.length > 1 ? `<nav class="site-nav" aria-label="Languages">${languages}</nav>` : ''}
</div></header>
<main id="main" class="shell" tabindex="-1">
${preview ? '<div class="migration-banner">Migration preview — current production GitHub Pages remains under <code>docs/</code>.</div>' : ''}
${actualLocale !== locale ? `<p class="fallback-note">${locale === 'ja' ? 'このページの翻訳は準備中です。表示言語:' : 'Translation unavailable. Content language:'} <span lang="${actualLocale}">${escape(actualLocale)}</span></p>` : ''}
<article lang="${actualLocale}">${body}</article></main>
<footer class="site-footer"><div class="shell footer-inner"><small>© ${new Date().getUTCFullYear()} ${escape(config.product.name)}</small>
<nav class="footer-nav" aria-label="Related links"><a href="${escape(config.repository.url)}">Source</a>${config.repository.issues ? `<a href="${escape(config.repository.issues)}">Issues</a>` : ''}</nav>
</div></footer></body></html>`;
}
export async function build({ site = 'site', out = 'site-dist', preview = true } = {}) {
  site = await fs.realpath(path.resolve(site)); out = path.resolve(out);
  // Reject symlinked output parents and overlap before any destructive cleanup.
  await fs.mkdir(path.dirname(out), { recursive: true });
  out = path.join(await fs.realpath(path.dirname(out)), path.basename(out));
  if (site === out || site.startsWith(out + path.sep) || out.startsWith(site + path.sep)) throw new Error('Output and site directories must not overlap');
  try { if ((await fs.lstat(out)).isSymbolicLink()) throw new Error('Output cannot be a symlink'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const config = validateConfig(JSON.parse(await fs.readFile(path.join(site, 'site.json'), 'utf8')));
  const output = new Map([['assets/site.css', await fs.readFile(new URL('./site.css', import.meta.url))], ['.nojekyll', '']]);
  const add = (name, data) => {
    if ([...output.keys()].some(existing => existing === name || existing.startsWith(name + '/') || name.startsWith(existing + '/'))) throw new Error(`Output collision: ${name}`);
    output.set(name, data);
  };
  for (const locale of config.languages) for (const page of config.pages) {
    const translation = page.locales?.[locale];
    const actualLocale = translation ? locale : config.defaultLanguage;
    const current = pagePath(config, locale, page.slug);
    const md = new MarkdownIt({ html: false });
    // Leading slash means site root, including when hosted under a Pages project prefix.
    const original = md.normalizeLink.bind(md);
    md.normalizeLink = url => original(url.startsWith('/') && !url.startsWith('//') ? relative(current, url.slice(1)) : url);
    const markdown = await sourceFile(site, (translation || page).source);
    add(current, layout(config, page, locale, actualLocale, md.render(markdown), preview));
  }
  for (const [folder, destination] of [['assets', 'assets/product/'], ['public', '']]) {
    const root = path.join(site, folder);
    try { if ((await fs.lstat(root)).isSymbolicLink()) throw new Error(`Symlinks are not allowed: ${root}`); } catch(e) { if(e.code !== 'ENOENT') throw e; }
    for (const name of await files(root)) {
      const target = destination + name;
      if (folder === 'public' && (target.startsWith('assets/') || config.languages.some(l => l !== config.defaultLanguage && target.startsWith(l + '/')))) throw new Error(`Reserved public path: ${target}`);
      add(target, await fs.readFile(path.join(root, name)));
    }
  }
  // Everything is validated and read before replacing the previous build.
  await fs.rm(out, { recursive: true, force: true });
  for (const [name, data] of output) { await fs.mkdir(path.dirname(path.join(out, name)), { recursive: true }); await fs.writeFile(path.join(out, name), data); }
  return { config, out, pages: config.pages.length * config.languages.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
  const result = await build({ site: arg('--site', 'site'), out: arg('--out', 'site-dist'), preview: !args.includes('--production') });
  console.log(`Built ${result.pages} page(s) to ${result.out}`);
}

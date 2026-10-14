import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { build } from '../src/build.mjs';
import { check } from '../src/check.mjs';
import { validateConfig } from '../src/config.mjs';
const fixture = new URL('./fixtures/site/', import.meta.url);
async function setup(t) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'site-platform-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const site = path.join(temp, 'site'), out = path.join(temp, 'dist');
  await fs.cp(fixture, site, { recursive: true });
  const config = JSON.parse(await fs.readFile(path.join(site, 'site.json')));
  const save = () => fs.writeFile(path.join(site, 'site.json'), JSON.stringify(config));
  return { site, out, config, save };
}
test('localized routes, page-preserving switch, fallback and project-relative assets', async t => {
  const {site, out} = await setup(t);
  assert.equal((await build({site, out})).pages, 6);
  const en = await fs.readFile(path.join(out, 'en/manual.html'), 'utf8');
  assert.match(en, /href="..\/manual.html" hreflang="ja"/);
  assert.match(en, /<article lang="en">/);
  const fr = await fs.readFile(path.join(out, 'fr/manual.html'), 'utf8');
  assert.match(fr, /Translation unavailable/); assert.match(fr, /<article lang="ja">/);
  assert.match(await fs.readFile(path.join(out, 'en/index.html'), 'utf8'), /src="..\/assets\/product\/screenshot.svg"/);
  assert.equal(await fs.readFile(path.join(out, 'google-test.html'), 'utf8'), 'google-site-verification: google-test.html\n');
  assert.equal(await fs.readFile(path.join(out, '.nojekyll'), 'utf8'), '');
  await check(out);
  await build({site, out, preview:false});
  assert.doesNotMatch(await fs.readFile(path.join(out,'index.html'),'utf8'), /migration-banner/);
});
test('legacy single-language contract remains supported', async t => {
  const s = await setup(t); delete s.config.languages; delete s.config.defaultLanguage;
  for (const p of s.config.pages) delete p.locales;
  await s.save(); assert.equal((await build(s)).pages, 2); await check(s.out);
});
test('schema and semantic validation reject invalid configurations', async t => {
  const {config} = await setup(t);
  for (const mutate of [c => c.pages[0].title = '', c => c.theme = {primary:'red;display:none'}, c => c.languages.push('en'), c => c.languages = ['en'], c => c.pages.push(c.pages[0]), c => c.pages[0].locales.zz = {title:'x',source:'x'}, c => c.repository.url='javascript:alert(1)']) {
    const copy = structuredClone(config); mutate(copy); assert.throws(() => validateConfig(copy));
  }
});
test('missing explicit translations fail rather than silently fallback', async t => {
  const s = await setup(t); s.config.pages[0].locales.en.source = 'missing.md'; await s.save();
  await assert.rejects(build(s), /ENOENT/);
});
test('reject traversal, symlinks, output overlap and public collisions', async t => {
  const s = await setup(t);
  await assert.rejects(build({...s,out:s.site}), /overlap/);
  await assert.rejects(build({...s,out:path.dirname(s.site)}), /overlap/);
  s.config.pages[0].source='../secret.md'; await s.save();
  await fs.writeFile(path.join(path.dirname(s.site),'secret.md'),'secret');
  await assert.rejects(build(s), /escapes/);
  s.config.pages[0].source='content/ja/index.md'; await s.save();
  await fs.symlink(path.join(path.dirname(s.site),'secret.md'), path.join(s.site,'assets/leak'));
  await assert.rejects(build(s), /Symlinks/); await fs.unlink(path.join(s.site,'assets/leak'));
  for (const name of ['index.html','.nojekyll','assets/site.css','en/custom.html','manual.html/nested.html']) {
    const file = path.join(s.site,'public',name); await fs.mkdir(path.dirname(file),{recursive:true}); await fs.writeFile(file,'bad');
    await assert.rejects(build(s), /collision|Reserved/); await fs.unlink(file);
  }
});
test('broken links, fragments and malformed generated HTML are detected', async t => {
  const s = await setup(t); await build(s);
  const file = path.join(s.out,'index.html'), original = await fs.readFile(file,'utf8');
  for (const extra of ['<a href="missing.html">broken</a>','<a href="manual.html#missing">fragment</a>','<img src="favicon.svg">','<div id="main"></div>','<div data-x="unterminated>']) {
    await fs.writeFile(file,original.replace('</article>',extra+'</article>'));
    await assert.rejects(check(s.out));
  }
});
test('Markdown escapes HTML and blocks script URLs', async t => {
  const s = await setup(t); await fs.appendFile(path.join(s.site,'content/ja/index.md'),'\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n');
  await build(s); const html = await fs.readFile(path.join(s.out,'index.html'),'utf8');
  assert.doesNotMatch(html, /<script>|href="javascript:/); await check(s.out);
});

test('trusted HTML fragments preserve native forms, locale roots and deferred local scripts', async t => {
  const s = await setup(t);
  s.config.pages[0].source = 'content/ja/form.html';
  s.config.pages[0].scripts = ['assets/product/form.js'];
  s.config.pages[0].locales.en.description = 'English page summary';
  await fs.writeFile(path.join(s.site,'content/ja/form.html'),'<h1>Form</h1><form><label for="choice">Choice</label><select id="choice"><option>One</option></select></form><img alt="Screen" src="/assets/product/screenshot.svg">');
  await fs.writeFile(path.join(s.site,'assets/form.js'),'document.body.dataset.ready="true";');
  await s.save(); await build(s); await check(s.out);
  const html = await fs.readFile(path.join(s.out,'fr/index.html'),'utf8');
  assert.match(await fs.readFile(path.join(s.out,'en/index.html'),'utf8'), /name="description" content="English page summary"/);
  assert.match(html, /<select id="choice">/);
  assert.match(html, /src="..\/assets\/product\/form.js" defer/);
  assert.match(html, /src="..\/assets\/product\/screenshot.svg"/);
  s.config.pages[0].scripts=['assets/../../bad.js']; await s.save();
  await assert.rejects(build(s), /Invalid page script/);
});

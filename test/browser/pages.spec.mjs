import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { promises as fs } from 'node:fs';
import path from 'node:path';
// Enumerate the built site at test time: the same suite validates caller content.
test('all generated pages load, navigate, and pass automated WCAG checks', async ({page}) => {
  const out = path.resolve(process.env.SITE_DIST || 'site-dist');
  async function pages(dir, prefix='') {
    const result=[];
    for(const entry of await fs.readdir(dir,{withFileTypes:true})) {
      if(entry.isDirectory()) result.push(...await pages(path.join(dir,entry.name),prefix+entry.name+'/'));
      else if(entry.name.endsWith('.html') && (await fs.readFile(path.join(dir,entry.name),'utf8')).includes('<article ')) result.push(prefix+entry.name);
    }
    return result;
  }
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400) errors.push(`${r.status()} ${r.url()}`);});
  const routes=await pages(out);
  expect(routes.length).toBeGreaterThan(0);
  test.setTimeout(Math.max(30000, routes.length * 15000));
  for(const route of routes) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('article h1').first()).toBeVisible();
    await expect(page.locator('nav[aria-label="Primary"] [aria-current="page"]')).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
    const links=await page.locator('nav[aria-label="Languages"] a').evaluateAll(nodes=>nodes.map(n=>({href:n.href,lang:n.hreflang})));
    for(const link of links) {
      await page.goto(link.href);
      await expect(page.locator('html')).toHaveAttribute('lang',link.lang);
      expect(new URL(page.url()).pathname.split('/').at(-1)).toBe(route.split('/').at(-1));
    }
  }
  expect(errors).toEqual([]);
});

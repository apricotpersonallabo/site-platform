import { promises as fs } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const siteDir = path.resolve(arg("--site", "site"));
const outDir = path.resolve(arg("--out", "site-dist"));
const configPath = path.join(siteDir, "site.json");

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

function inlineMarkdown(value) {
  let s = escapeHtml(value);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\`(.+?)\`/g, "<code>$1</code>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|[^\s)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let list = null;
  const closeList = () => {
    if (list) out.push(list === "ol" ? "</ol>" : "</ul>");
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; }
      out.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; }
      out.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}

function validate(config) {
  const errors = [];
  if (config?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!config?.product?.name) errors.push("product.name is required");
  if (!config?.product?.description) errors.push("product.description is required");
  if (!config?.repository?.url) errors.push("repository.url is required");
  if (!Array.isArray(config?.pages) || config.pages.length === 0) errors.push("pages must contain at least one page");
  for (const [i, page] of (config.pages || []).entries()) {
    if (!page.slug || !/^[a-z0-9-]+$/.test(page.slug)) errors.push(`pages[${i}].slug is invalid`);
    if (!page.title) errors.push(`pages[${i}].title is required`);
    if (!page.source) errors.push(`pages[${i}].source is required`);
  }
  if (errors.length) throw new Error("Invalid site config:\n- " + errors.join("\n- "));
}

function hrefFor(slug) {
  return slug === "index" ? "index.html" : `${slug}.html`;
}

function layout(config, page, body) {
  const primary = config.theme?.primary || "#183153";
  const accent = config.theme?.accent || "#dc681c";
  const nav = config.pages.map(p => `<a href="${hrefFor(p.slug)}"${p.slug === page.slug ? ' aria-current="page"' : ""}>${escapeHtml(p.title)}</a>`).join("\n");
  const issues = config.repository.issues ? `<a href="${escapeHtml(config.repository.issues)}">Issues</a>` : "";
  return `<!doctype html>
<html lang="${escapeHtml(config.defaultLanguage || "ja")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(config.product.description)}">
  <title>${escapeHtml(page.title)} | ${escapeHtml(config.product.name)}</title>
  <link rel="stylesheet" href="assets/site.css">
  <style>:root{--site-primary:${escapeHtml(primary)};--site-accent:${escapeHtml(accent)};}</style>
</head>
<body>
  <a class="skip-link" href="#main">本文へ移動</a>
  <header class="site-header">
    <div class="shell header-inner">
      <a class="brand" href="index.html">${escapeHtml(config.product.name)}</a>
      <nav class="site-nav" aria-label="Primary">${nav}</nav>
    </div>
  </header>
  <main id="main" class="shell">
    <div class="migration-banner">Migration preview — current production GitHub Pages remains under <code>docs/</code>.</div>
    <article>${body}</article>
  </main>
  <footer class="site-footer">
    <div class="shell footer-inner">
      <small>© ${new Date().getUTCFullYear()} ${escapeHtml(config.product.name)}</small>
      <nav class="footer-nav" aria-label="Related links">
        <a href="${escapeHtml(config.repository.url)}">Source</a>
        ${issues}
      </nav>
    </div>
  </footer>
</body>
</html>`;
}

const raw = await fs.readFile(configPath, "utf8");
const config = JSON.parse(raw);
validate(config);

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(path.join(outDir, "assets"), { recursive: true });
await fs.copyFile(new URL("./site.css", import.meta.url), path.join(outDir, "assets", "site.css"));

for (const page of config.pages) {
  const sourcePath = path.resolve(siteDir, page.source);
  if (!sourcePath.startsWith(siteDir + path.sep)) throw new Error(`Page source escapes site directory: ${page.source}`);
  const markdown = await fs.readFile(sourcePath, "utf8");
  const html = layout(config, page, markdownToHtml(markdown));
  await fs.writeFile(path.join(outDir, hrefFor(page.slug)), html);
}

const assets = path.join(siteDir, "assets");
try {
  await fs.cp(assets, path.join(outDir, "assets", "product"), { recursive: true });
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await fs.writeFile(path.join(outDir, ".nojekyll"), "");
console.log(`Built ${config.pages.length} page(s) from ${siteDir} to ${outDir}`);

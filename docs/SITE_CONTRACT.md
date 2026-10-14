# Product Site Contract (schemaVersion 1)

Products own facts, Markdown and translations. The platform owns rendering and validation.
Existing v1 configurations remain supported. Run with Node.js 22 or later:

```sh
npm ci
node src/build.mjs --site /path/to/product/site --out /path/to/preview
node src/check.mjs /path/to/preview
SITE_DIST=/path/to/preview npm run test:browser
```

Install Chromium first with `npx playwright install --with-deps chromium`.

## Configuration and locales

`site/site.json` requires `schemaVersion: 1`, `product.name`,
`product.description`, `repository.url`, and nonempty `pages`. Each page needs a
unique lowercase `slug`, `title`, and `source` (relative to `site/`). An `index`
page is required. Repository URLs must use HTTP(S); theme colors are six-digit
hex colors. The builder validates the actual JSON Schema in
`schemas/site-config.schema.json` using Ajv, plus cross-field constraints.

```json
{
  "schemaVersion": 1,
  "product": {"name": "Example", "description": "Product description"},
  "repository": {"url": "https://github.com/owner/product"},
  "defaultLanguage": "ja",
  "languages": ["ja", "en"],
  "favicon": "favicon.svg",
  "pages": [{
    "slug": "index", "title": "ホーム", "source": "content/ja/index.md",
    "locales": {"en": {"title": "Home", "source": "content/en/index.md"}}
  }]
}
```

`defaultLanguage` defaults to `ja`; `languages` defaults to only the default
language. If supplied, languages must include the default and have no duplicates.
Use language tags such as `ja`, `en`, `zh-CN`, `pt-BR`. Locale overrides must be
listed in languages and contain both title and source. Sources can live anywhere
inside `site/`; `content/<locale>/` is recommended, not automatically inferred.
Legacy `content/index.md` works unchanged.

| Page | Default locale | Other locale (en) |
| --- | --- | --- |
| index | `index.html` | `en/index.html` |
| manual | `manual.html` | `en/manual.html` |

The site root serves `index.html`; there is no browser-language redirect or
separate `/ja/` copy. Language links preserve the page slug. Alternate-language
links are relative, so user Pages, project Pages and custom domains work without
configuring a base URL.

Missing locale override means fallback to the page's base source/title and the
default language. The requested URL and navigation stay in the requested locale;
a visible notice identifies fallback and `article[lang]` identifies the content's
actual language. A declared translation whose file is missing fails the build.
The document language identifies the requested locale. Shared UI uses Japanese for
`ja`, English for other locales; product content and page titles are product-owned.

## Markdown and static files

Markdown supports headings, paragraphs, lists, code, links and images via
markdown-it. Raw HTML is escaped; script URLs are blocked. Use one H1 per page.
Generated heading IDs are not automatic; fragment links can target explicit
platform IDs such as `#main`.

```text
site/
├── site.json
├── content/ja/index.md
├── content/en/index.md
├── assets/screenshot.png
└── public/
    ├── favicon.svg
    ├── google0123456789.html
    └── robots.txt
```

- `assets/**` copies byte-for-byte to `assets/product/**` (existing v1 convention).
- `public/**` copies byte-for-byte to the output root, including nested files.
- `favicon` names a path relative to the output root, normally supplied in public.
- `assets/site.css` and `.nojekyll` belong to the platform. Public files cannot
  overwrite generated pages, `.nojekyll`, `assets/**`, or additional locale folders.
  Other duplicate output paths fail the build.
- Missing assets/public directories are allowed. Symlinks in static directories
  are rejected; page sources must resolve inside site. Input/output may not overlap.
  All sources are read and collisions checked before clearing the previous output.
- Markdown links beginning with `/` mean the **site root** and are rewritten to
  relative URLs, e.g. `![Screen](/assets/product/screenshot.png)` works in all
  locales and under a GitHub project path. Page links like `manual.html` mean the
  current locale. Use `/manual.html` only when intentionally linking to the
  default locale. Relative Markdown links refer to generated HTML, not source .md.
- Public HTML/CSS and other opaque files are copied unchanged. Authors must use
  project-compatible URLs inside those files. Verification responses are not
  required to be complete HTML documents.

## Validation and deployment boundary

`npm test` covers the contract, fallback, generated output, invalid schemas,
missing sources, copy collisions, traversal, symlinks, and broken links/fragments.
`src/check.mjs` parses generated and public HTML (except Google verification responses),
checks required landmarks/language/H1/title,
duplicate IDs, image alt text, and local href/src/poster targets and fragments.
It does not request external URLs or inspect URLs inside CSS, srcset, or scripts.
Playwright loads every generated page at a project path on desktop and mobile,
checks keyboard skip navigation, language links, browser/resource errors,
horizontal overflow, and axe WCAG 2.1 A/AA rules. Automated checks do not replace
manual accessibility review or content parity review.

`site-preview.yml` builds, validates and uploads an artifact only. It never deploys.
`pages-deploy.yml` is reusable (`workflow_call`) only, disabled by default. It
requires `deploy-enabled: true`, a non-PR event on the caller's default branch,
Pages Actions configuration, and caller permissions `contents: read`,
`pages: write`, `id-token: write`. It validates before uploading the Pages artifact
and deploying through the caller's `github-pages` environment. Use environment
protection rules for production approval. The deployment build omits the migration
banner. Configure Pages separately; the workflow does not change Pages settings.
Pin reusable workflows to an audited full commit SHA; the shared platform checkout
uses `job.workflow_repository` and `job.workflow_sha` to match that workflow.

During migration, `docs/` remains production; `site/` is a candidate. Do not add
production callers until a separate cutover review verifies each product's content,
translations, assets and interactive features. Do not write output over `docs/`.
No product repository or production setting is changed by platform CI.

## Interactive product content

A page source (including a locale source) ending in `.html` is a trusted **body
fragment**, rendered inside the shared article. Other sources are Markdown and
continue to escape raw HTML. HTML fragments can contain product-owned native
forms, tables and stable section IDs. Do not copy document/head/header/footer
shells or shared styles into fragments. Leading-slash href/src/poster values
are rebased in the same way as Markdown links.

Optional `pages[].scripts` lists local output-root `.js` paths, loaded with defer
on that page in every locale, e.g. `["assets/product/playground.js"]`. Supply those
files through assets/public. Scripts own product interactions; shared navigation
and language switching remain platform-owned. These repository-authored HTML and
scripts are trusted executable content; never use untrusted user input as sources.
The output checker verifies their local file references before deployment.

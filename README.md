# Site Platform

Shared rendering, validation, and reusable workflows for Apricot Personal Labo
product sites. Products own their facts, Markdown, translations and static files;
this repository owns HTML, styles, accessibility checks and the site contract.
Existing product `docs/` remains production until an explicit separate cutover.

See [the site contract](docs/SITE_CONTRACT.md) for locale URLs, fallback,
assets/public rules, and deployment requirements, and [the agent guide](docs/AI_AGENT_GUIDE.md)
for responsibility boundaries.

## Development

Requires Node.js 22+.

```sh
npm ci
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

The browser suite builds the multilingual fixture automatically. To validate a
product, build and check it, then set `SITE_DIST` to its absolute output directory:

```sh
node src/build.mjs --site /path/to/product/site --out site-dist
npm run check -- site-dist
SITE_DIST="$PWD/site-dist" npm run test:browser
```

Platform CI runs unit tests and exercises the reusable preview workflow. It also
calls the deployment workflow with deployment disabled to validate the call
contract without publishing a site. Reusable preview performs schema, output,
link, browser smoke and automated accessibility checks before artifact upload.
The opt-in reusable Pages workflow performs the same checks before deployment;
no product production caller is added here.

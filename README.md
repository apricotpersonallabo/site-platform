# Site Platform

Shared rendering and validation layer for Apricot Personal Labo product sites.

Product repositories keep product-specific facts and content under `site/`. This repository owns the shared rendering, layout, styling, validation, and reusable preview workflow.

## Responsibility boundary

- Product repository: product facts, manuals, privacy text, store/repository links, translations, screenshots/assets.
- Site platform: HTML layout, shared navigation/footer, design tokens, accessibility baseline, rendering/validation.
- Reusable workflow: preview build and artifact generation.
- Existing product `docs/`: production source until an explicit cutover.

The current contract uses `site/site.json` plus Markdown so the preview builder has no third-party runtime dependencies. The renderer may later be replaced without changing the product-side ownership model.

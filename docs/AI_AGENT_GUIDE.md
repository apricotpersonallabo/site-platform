# AI Agent Guide

When working in a product repository:

1. Read the product implementation and tests before changing public documentation.
2. Treat `docs/` as the current production website until the repository explicitly declares cutover.
3. Treat `site/` as the migration target.
4. Change product facts only in the product repository.
5. Do not duplicate shared layout/CSS/runtime logic into the product repository.
6. If a requirement concerns layout, shared navigation, accessibility baseline, rendering, or common styling, change the site platform instead.
7. Do not switch GitHub Pages deployment as part of ordinary product documentation edits.

The intended end state is: product repositories decide **what** to publish; the site platform decides **how** it is rendered.

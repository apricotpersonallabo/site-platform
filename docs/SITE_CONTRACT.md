# Product Site Contract

Each product repository may add a `site/` directory without changing the current GitHub Pages configuration.

## Required files

```text
site/
├─ site.json
├─ content/
│  ├─ index.md
│  └─ manual.md
└─ assets/            # optional during migration
```

A privacy page is optional until the product already exposes one.

## site.json

Required fields:

- `schemaVersion`: currently `1`
- `product.name`
- `product.description`
- `repository.url`
- `pages[]`
- each page requires `slug`, `title`, and `source`

Optional fields include `repository.issues`, `theme.primary`, `theme.accent`, and `languages`.

## Migration rule

During migration:

1. `docs/` remains the production GitHub Pages source.
2. `site/` is the candidate future source.
3. Preview CI may build `site/` into `site-dist/`, but must not deploy it.
4. Product changes that affect public documentation should keep `docs/` and `site/` semantically aligned.
5. Cutover is a separate change after preview parity has been verified.

Generated output must never be committed over the existing `docs/` tree during migration.

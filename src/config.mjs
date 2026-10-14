import { readFile } from 'node:fs/promises';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(JSON.parse(await readFile(new URL('../schemas/site-config.schema.json', import.meta.url))));
export function validateConfig(config) {
  if (!validate(config)) throw new Error(`Invalid site config: ${ajv.errorsText(validate.errors)}`);
  const defaultLanguage = config.defaultLanguage || 'ja';
  const languages = config.languages || [defaultLanguage];
  for (const locale of languages) {
    try { Intl.getCanonicalLocales(locale); } catch { throw new Error(`Invalid language tag: ${locale}`); }
  }
  if (config.favicon?.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('Invalid favicon path');
  if (!languages.includes(defaultLanguage)) throw new Error('languages must include defaultLanguage');
  if (!config.pages.some(p => p.slug === 'index')) throw new Error('pages must include index');
  if (new Set(config.pages.map(p => p.slug)).size !== config.pages.length) throw new Error('Duplicate page slug');
  for (const page of config.pages) {
    for (const script of page.scripts || []) if (script.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('Invalid page script path');
    for (const locale of Object.keys(page.locales || {})) {
      if (!languages.includes(locale)) throw new Error(`Undeclared locale: ${locale}`);
    }
  }
  for (const url of [config.repository.url, config.repository.issues].filter(Boolean)) {
    if (!/^https?:\/\//.test(url)) throw new Error('Repository URLs must use HTTP(S)');
  }
  return { ...config, defaultLanguage, languages };
}

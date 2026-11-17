import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { renderDocPage } from './src/doc-page';
import { DOC_PAGES } from './src/pages/doc-pages';

/**
 * Renders the Markdown document pages (manual, changelog, imprint, privacy, licenses) into their HTML file at build time
 * (F33.2): search engines and visitors without JavaScript see the full content, not an empty container. In the browser the
 * page entry point renders the same content again and adds the interactive parts (e.g. the objection to the statistics).
 */
export function prerenderDocPage(html: string, file: string, readSource: (path: string) => string): string {
  const config = DOC_PAGES[file];
  if (!config) return html;
  const container = `<div id="${config.element}"></div>`;
  if (!html.includes(container)) throw new Error(`${file}: Container ${container} fehlt`);
  const { html: body } = renderDocPage({ markdown: readSource(config.source), ...config.page }, file);
  // Function as replacement: "$" in the content must not be read as a replacement pattern
  return html.replace(container, () => `<div id="${config.element}">${body}</div>`);
}

export function prerenderPlugin(root: string): Plugin {
  return {
    name: 'wp-prerender-docs',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => prerenderDocPage(html, basename(ctx.filename), (path) => readFileSync(resolve(root, path), 'utf8')),
    },
  };
}

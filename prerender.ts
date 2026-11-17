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

/**
 * Preloads the main text font (Inter, latin, variable) so that text is drawn in the final font without a swap (F33.10).
 * The file name carries a content hash, so the build finds it in the bundle. Fonts are always requested with CORS.
 */
export function preloadFontHtml(html: string, files: string[]): string {
  const font = files.find((f) => /^assets\/inter-latin-wght-normal-[^/]+\.woff2$/.test(f));
  if (!font || !html.includes('</head>')) return html;
  const tag = `    <link rel="preload" href="./${font}" as="font" type="font/woff2" crossorigin />\n  </head>`;
  return html.replace('</head>', () => tag);
}

export function fontPreloadPlugin(): Plugin {
  return {
    name: 'wp-preload-font',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html, ctx) => preloadFontHtml(html, Object.keys(ctx.bundle ?? {})),
    },
  };
}

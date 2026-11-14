import type { Plugin } from 'vite';

/**
 * Content Security Policy for the static build (N6).
 * Allows only own scripts/styles/fonts plus the Matomo instance (N10); the small inline scripts in <head> (design/light-dark before the
 * first paint) are allowed via SHA-256 hash. Build only – the Vite dev server needs inline code.
 * frame-ancestors (protection against embedding) cannot be set via <meta>, only as an HTTP header when hosting.
 */
/** Matomo visitor statistics (N10, src/analytics.ts): script, tracking requests and noscript pixel. */
export const ANALYTICS_ORIGIN = 'https://analytics.chkania.net';

export const CSP_DIRECTIVES = [
  "default-src 'self'",
  `script-src 'self' ${ANALYTICS_ORIGIN} {hashes}`,
  "style-src 'self'",
  `img-src 'self' data: ${ANALYTICS_ORIGIN}`,
  "font-src 'self' data:",
  `connect-src 'self' ${ANALYTICS_ORIGIN}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
];

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  let bin = '';
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return `'sha256-${btoa(bin)}'`;
}

/** Inserts the CSP as <meta> directly after <meta charset>. */
export async function addCsp(html: string): Promise<string> {
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const hashes = (await Promise.all(inline.map(sha256))).join(' ');
  const policy = CSP_DIRECTIVES.join('; ').replace(' {hashes}', hashes ? ` ${hashes}` : '');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`;
  return html.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n    ${meta}`);
}

export function cspPlugin(): Plugin {
  return {
    name: 'wp-csp',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: (html) => addCsp(html) },
  };
}

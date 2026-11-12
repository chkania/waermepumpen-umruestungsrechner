import type { Plugin } from 'vite';

/**
 * Content-Security-Policy für den statischen Build (N6).
 * Erlaubt nur eigene Skripte/Styles/Schriften; die kleinen Inline-Skripte im <head> (Design/Hell-Dunkel vor dem
 * ersten Zeichnen) werden per SHA-256-Hash freigegeben. Nur im Build – der Vite-Entwicklungsserver braucht Inline-Code.
 * frame-ancestors (Schutz vor Einbetten) lässt sich nicht per <meta> setzen, sondern nur als HTTP-Header beim Hosting.
 */
export const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' {hashes}",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
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

/** Fügt die CSP als <meta> direkt nach <meta charset> ein. */
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

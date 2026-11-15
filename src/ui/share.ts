/**
 * Recommending the calculator to others (F21): prepared messages and share links.
 * Only the address of the calculator is shared – never the user's inputs (no "#z=…"/"#s=…" hash, no query).
 */

export const RECOMMEND_SUBJECT = 'Tipp: Wärmepumpen-Investitionsrechner';
export const RECOMMEND_TEXT =
  'Kennst du schon den Wärmepumpen-Investitionsrechner? Er zeigt kostenlos, ob und wann sich der Umstieg ' +
  'von Gas oder Öl auf eine Wärmepumpe lohnt – mit KfW-Förderung, Steuerbonus und steigenden Energiepreisen.';
const PRIVACY_NOTE = 'Gerechnet wird im Browser, die eigenen Eingaben bleiben auf dem eigenen Gerät.';

export interface RecommendLinks {
  /** Address of the calculator without hash and query. */
  url: string;
  /** Message incl. address, e.g. for messengers or the clipboard. */
  message: string;
  whatsapp: string;
  threema: string;
  email: string;
}

/** Address of the calculator page without user data (hash with inputs, query parameters). */
export function calculatorUrl(href: string): string {
  const u = new URL(href);
  u.hash = '';
  u.search = '';
  // index.html is the start page: share the shorter directory address
  u.pathname = u.pathname.replace(/index\.html$/, '');
  return u.toString();
}

/**
 * Short domain for links with inputs (F9.2) and the QR code in the report (F30.3): shorter links, smaller QR code.
 * It redirects permanently (301) to the main domain; the browser keeps the hash with the inputs.
 */
export const SHARE_BASE = 'https://wpir.de/';
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$|\.(localhost|test)$/;

/** Base address for links with inputs: the short domain, except on a local development host (links stay testable). */
export function shareBaseUrl(href: string): string {
  return LOCAL_HOST.test(new URL(href).hostname) ? calculatorUrl(href) : SHARE_BASE;
}

export function recommendLinks(href: string): RecommendLinks {
  const url = calculatorUrl(href);
  // one line: some WhatsApp clients (e.g. the desktop app) drop everything before a line break
  const message = `${RECOMMEND_TEXT} ${url}`;
  const enc = encodeURIComponent;
  const body = `Hallo,\n\n${RECOMMEND_TEXT}\n\n${url}\n\n${PRIVACY_NOTE}\n`;
  return {
    url,
    message,
    // WhatsApp: app URL scheme opens the installed app directly (phone and desktop);
    // the wa.me web redirect lost the text in WhatsApp Desktop for macOS
    whatsapp: `whatsapp://send?text=${enc(message)}`,
    // Threema: official universal link (opens the app)
    threema: `https://threema.id/compose?text=${enc(message)}`,
    // mailto: opens the default mail program with subject and body (RFC 6068: encode spaces as %20)
    email: `mailto:?subject=${enc(RECOMMEND_SUBJECT)}&body=${enc(body)}`,
  };
}

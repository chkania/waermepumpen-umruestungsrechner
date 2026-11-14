import { escapeHtml } from './ui/format';
import { renderHelp } from './help';
import { APP_VERSION } from './version';

export interface DocPage {
  /** Markdown source (imported via `?raw`, stays as .md file in the repo). */
  markdown: string;
  /** Subtitle in the header. */
  subtitle: string;
  /** Optional HTML preamble before the content (e.g. German summary). */
  intro?: string;
  /** Show table of contents (from two entries). */
  toc?: boolean;
  /** Language of the Markdown content if not German (WCAG 3.1.2), e.g. 'en'. */
  contentLang?: string;
  /** Language of the code blocks (e.g. English license texts) if not German. */
  codeLang?: string;
}

/** Footer of all document pages: calculator, help, license, third parties (N8), changelog (N9), imprint and privacy (N11). */
export const DOC_LINKS: [string, string][] = [
  ['./index.html', 'Rechner'],
  ['./hilfe.html', 'Hilfe'],
  ['./lizenz.html', 'Lizenz'],
  ['./lizenzen-drittanbieter.html', 'Lizenzen von Drittanbietern'],
  ['./changelog.html', `Änderungen (Version ${APP_VERSION})`],
  ['./impressum.html', 'Impressum'],
  ['./datenschutz.html', 'Datenschutz'],
];

/** Renders a Markdown document page in the calculator's style (manual F15, license pages N8). */
export function renderDocPage(page: DocPage): { html: string; title: string } {
  const rendered = renderHelp(page.markdown);
  const { toc, title } = rendered;
  let html = rendered.html.replace(/<h1>[\s\S]*?<\/h1>/, '');
  if (page.codeLang) html = html.replace(/<pre>/g, `<pre lang="${page.codeLang}">`);
  if (page.contentLang) html = `<div lang="${page.contentLang}">${html}</div>`;
  const here = typeof location !== 'undefined' ? location.pathname.split('/').pop() || 'index.html' : '';
  const showToc = page.toc !== false && toc.length >= 2;
  const body = `
  <header class="top help-top">
    <div class="brand">
      <span class="mark" aria-hidden="true">~wp</span>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(page.subtitle)}</p>
    </div>
    <div class="toolbar">
      <a class="tool-link" href="./index.html">← Zum Rechner</a>
    </div>
  </header>
  <div class="help-layout${showToc ? '' : ' no-toc'}">
    ${
      showToc
        ? `<nav class="help-toc" aria-label="Inhalt">
      <div class="help-toc-title">Inhalt</div>
      <ul>${toc.map((t) => `<li class="lvl-${t.level}"><a href="#${t.id}">${escapeHtml(t.text)}</a></li>`).join('')}</ul>
    </nav>`
        : ''
    }
    <main class="help-content">${page.intro ?? ''}${html}</main>
  </div>
  <footer class="doc-footer">
    <nav aria-label="Weitere Seiten"><ul>${DOC_LINKS.map(
      ([href, label]) =>
        `<li><a href="${href}"${href.endsWith(here) ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a></li>`,
    ).join('')}</ul></nav>
    <p>Version ${APP_VERSION} · © 2026 Christoph Kania · PolyForm Noncommercial License 1.0.0</p>
  </footer>`;
  return { html: body, title };
}

/** Mounts the page and keeps design/light-dark in sync with the calculator (also on changes in another tab). */
export function mountDocPage(root: HTMLElement, page: DocPage): void {
  root.innerHTML = renderDocPage(page).html;

  const media = matchMedia('(prefers-color-scheme: dark)');
  const readStored = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const applyTheme = () => {
    const t = readStored('wp-investitionsrechner:theme');
    document.documentElement.dataset.theme = t === 'light' || t === 'dark' ? t : media.matches ? 'dark' : 'light';
  };
  media.addEventListener('change', applyTheme);
  window.addEventListener('storage', (e) => {
    if (e.key === 'wp-investitionsrechner:design') {
      document.documentElement.dataset.design = e.newValue === 'classic' ? 'classic' : 'modern';
    }
    if (e.key === 'wp-investitionsrechner:theme') applyTheme();
  });

  // Scroll to the anchor target after rendering
  if (location.hash) {
    try {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    } catch {
      /* ungültiger Anker */
    }
  }
}

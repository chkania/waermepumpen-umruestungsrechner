import { escapeHtml } from './ui/format';
import { renderHelp } from './help';
import { APP_VERSION } from './version';

export interface DocPage {
  /** Markdown-Quelle (per `?raw` eingebunden, bleibt als .md-Datei im Repo). */
  markdown: string;
  /** Unterzeile im Kopf. */
  subtitle: string;
  /** Optionaler HTML-Vorspann vor dem Inhalt (z. B. deutsche Kurzfassung). */
  intro?: string;
  /** Inhaltsverzeichnis anzeigen (ab zwei Einträgen). */
  toc?: boolean;
  /** Sprache des Markdown-Inhalts, falls nicht Deutsch (WCAG 3.1.2), z. B. 'en'. */
  contentLang?: string;
  /** Sprache der Codeblöcke (z. B. englische Lizenztexte), falls nicht Deutsch. */
  codeLang?: string;
}

/** Fußzeile aller Dokumentseiten: Rechner, Hilfe, Lizenz, Drittanbieter (N8). */
export const DOC_LINKS: [string, string][] = [
  ['./index.html', 'Rechner'],
  ['./hilfe.html', 'Hilfe'],
  ['./lizenz.html', 'Lizenz'],
  ['./lizenzen-drittanbieter.html', 'Lizenzen von Drittanbietern'],
  ['./changelog.html', `Änderungen (Version ${APP_VERSION})`],
];

/** Rendert eine Markdown-Dokumentseite im Stil des Rechners (Handbuch F15, Lizenzseiten N8). */
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

/** Seite einhängen und Design/Hell-Dunkel wie im Rechner halten (auch bei Änderung im anderen Tab). */
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

  // Sprungziel nach dem Rendern anfahren
  if (location.hash) {
    try {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    } catch {
      /* ungültiger Anker */
    }
  }
}

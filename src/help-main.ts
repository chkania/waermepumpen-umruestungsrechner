import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import './style-modern.css';
import './help.css';
import handbook from '../docs/BENUTZERHANDBUCH.md?raw';
import { escapeHtml } from './ui/format';
import { renderHelp } from './help';

const { html, toc, title } = renderHelp(handbook);
const root = document.getElementById('help')!;
root.innerHTML = `
  <header class="top help-top">
    <div class="brand">
      <span class="mark" aria-hidden="true">~wp</span>
      <h1>${escapeHtml(title)}</h1>
      <p>Wärmepumpen-Investitionsrechner</p>
    </div>
    <div class="toolbar">
      <a class="tool-link" href="./index.html">← Zum Rechner</a>
    </div>
  </header>
  <div class="help-layout">
    <nav class="help-toc" aria-label="Inhalt">
      <div class="help-toc-title">Inhalt</div>
      <ul>${toc
        .map((t) => `<li class="lvl-${t.level}"><a href="#${t.id}">${escapeHtml(t.text)}</a></li>`)
        .join('')}</ul>
    </nav>
    <article class="help-content">${html.replace(/<h1>[\s\S]*?<\/h1>/, '')}</article>
  </div>`;

// Design/Hell-Dunkel wie im Rechner: gespeicherte Wahl, bei „Auto“ der Browser-Einstellung folgen,
// und synchron bleiben, wenn die Wahl im Rechner (anderer Tab) geändert wird.
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
if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();

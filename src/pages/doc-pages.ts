import type { DocPage } from '../doc-page';
import { APP_VERSION } from '../version';

/**
 * Settings of the Markdown document pages, shared by the page entry points (rendering in the browser) and the build,
 * which renders the same HTML into the page beforehand (F33.2) – so search engines and visitors without JavaScript see
 * the content. Key: HTML file; `source`: Markdown file relative to the repository root; `element`: ID of the container.
 */
export interface DocPageConfig {
  source: string;
  element: 'doc' | 'help';
  page: Omit<DocPage, 'markdown' | 'rendered'>;
}

/** Non-binding German summary; the English license text below is authoritative. */
const LICENSE_INTRO = `
<section class="doc-intro" aria-labelledby="kurzfassung">
  <h2 id="kurzfassung">Kurzfassung (unverbindlich)</h2>
  <p>Der Wärmepumpen-Investitionsrechner steht unter der <strong>PolyForm Noncommercial License 1.0.0</strong>.</p>
  <ul>
    <li><strong>Erlaubt:</strong> Nutzung, Änderung und Weitergabe für nicht-kommerzielle Zwecke – privat, in Forschung und Lehre, durch gemeinnützige Organisationen und Behörden.</li>
    <li><strong>Nicht erlaubt ohne gesonderte Vereinbarung:</strong> kommerzielle Nutzung, z. B. als Teil eines Beratungs- oder Verkaufsangebots.</li>
    <li><strong>Bei Weitergabe:</strong> diesen Lizenztext (oder seine Adresse) und den Copyright-Hinweis mitgeben.</li>
    <li>Keine Gewährleistung und keine Haftung, soweit gesetzlich zulässig.</li>
  </ul>
  <p class="muted small">Maßgeblich ist allein der folgende englische Originaltext. Das ist eine „Source available“-Lizenz, keine Open-Source-Lizenz im Sinne der OSI.</p>
</section>`;

export const DOC_PAGES: Record<string, DocPageConfig> = {
  'hilfe.html': { source: 'docs/BENUTZERHANDBUCH.md', element: 'help', page: { subtitle: 'Wärmepumpen-Investitionsrechner' } },
  'changelog.html': { source: 'CHANGELOG.md', element: 'doc', page: { subtitle: `Wärmepumpen-Investitionsrechner · aktuelle Version ${APP_VERSION}` } },
  'datenschutz.html': { source: 'docs/DATENSCHUTZ.md', element: 'doc', page: { subtitle: 'Wärmepumpen-Investitionsrechner' } },
  'impressum.html': { source: 'docs/IMPRESSUM.md', element: 'doc', page: { subtitle: 'Wärmepumpen-Investitionsrechner', toc: false } },
  'lizenz.html': {
    source: 'LICENSE.md',
    element: 'doc',
    page: { subtitle: 'Lizenz des Wärmepumpen-Investitionsrechners', intro: LICENSE_INTRO, toc: false, contentLang: 'en' },
  },
  'lizenzen-drittanbieter.html': { source: 'THIRD-PARTY-NOTICES.md', element: 'doc', page: { subtitle: 'Wärmepumpen-Investitionsrechner', codeLang: 'en' } },
};

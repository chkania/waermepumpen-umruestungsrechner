import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../style.css';
import '../style-modern.css';
import '../help.css';
import license from '../../LICENSE.md?raw';
import { initAnalytics } from '../analytics';
import { mountDocPage } from '../doc-page';

/** Non-binding German summary; the English license text below is authoritative. */
const intro = `
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

mountDocPage(document.getElementById('doc')!, { markdown: license, subtitle: 'Lizenz des Wärmepumpen-Investitionsrechners', intro, toc: false, contentLang: 'en' });
initAnalytics('Lizenz');

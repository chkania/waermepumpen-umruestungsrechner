import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../style.css';
import '../style-modern.css';
import '../help.css';
import privacy from '../../docs/DATENSCHUTZ.md?raw';
import { initAnalytics, isOptedOut, setOptOut } from '../analytics';
import { mountDocPage } from '../doc-page';
import { DOC_PAGES } from './doc-pages';

mountDocPage(document.getElementById(DOC_PAGES['datenschutz.html'].element)!, { markdown: privacy, ...DOC_PAGES['datenschutz.html'].page });
mountOptOut(document.getElementById('analytics-opt-out'));
initAnalytics('Datenschutz');

/** Checkbox for the objection (Widerspruch) to visitor statistics (N10). */
export function mountOptOut(el: HTMLElement | null): void {
  if (!el) return;
  el.innerHTML = `
    <label class="check"><input type="checkbox" id="analytics-consent" /> Meine Besuche in der Besucherstatistik erfassen</label>
    <p class="opt-out-status" role="status" aria-live="polite"></p>`;
  const box = el.querySelector<HTMLInputElement>('#analytics-consent')!;
  const status = el.querySelector<HTMLElement>('.opt-out-status')!;
  const show = () => {
    box.checked = !isOptedOut();
    status.textContent = box.checked
      ? 'Ihre Besuche werden derzeit anonymisiert erfasst. Haken entfernen, um zu widersprechen.'
      : 'Sie haben widersprochen: Ihre Besuche werden in diesem Browser nicht erfasst.';
  };
  box.addEventListener('change', () => {
    if (!setOptOut(!box.checked)) {
      status.textContent = 'Ihr Browser erlaubt keinen lokalen Speicher – die Auswahl kann nicht gespeichert werden. Aktivieren Sie alternativ „Do Not Track“.';
      return;
    }
    show();
  });
  show();
}

import { formatSavedAt, type ScenarioView } from '../core/scenario-store';
import { escapeHtml } from './format';

/** Texts of the saved scenarios (F37.3, F37.10, F37.11, F31.4). Shown as text, never as HTML. */
export const SCENARIO_TEXT = {
  noName: 'Bitte zuerst eine Bezeichnung des Szenarios eintragen (Abschnitt Szenario).',
  saveFailed: 'Der Browser-Speicher ist voll bzw. nicht verfügbar. Das Szenario wurde nicht gespeichert. Sichern Sie es bei Bedarf per „Export“.',
  deleteFailed: 'Der Browser-Speicher ist nicht verfügbar. Das Szenario wurde nicht gelöscht.',
  clearFailed: 'Der Browser-Speicher ist nicht verfügbar. Die gespeicherten Szenarien wurden nicht gelöscht.',
  unavailable: 'Der Browser-Speicher ist nicht verfügbar (z. B. im privaten Modus). Gespeicherte Szenarien lassen sich hier nicht nutzen; verwenden Sie „Export“.',
  unreadable: 'Die gespeicherten Szenarien sind nicht lesbar und bleiben unverändert. Mit „Gespeicherte Szenarien leeren“ können Sie wieder neu beginnen.',
  unreadableVariants: 'Die gespeicherten Szenarien sind nicht lesbar. Sie lassen sich unter „Gespeicherte Szenarien“ leeren.',
  changed: 'Die gespeicherten Szenarien haben sich inzwischen geändert. Bitte die Auswahl erneut treffen.',
  empty: 'Noch keine Szenarien gespeichert.',
  cleared: 'Gespeicherte Szenarien geleert.',
};

/** Name shown for an entry without a name (F37.12). */
export const UNNAMED = 'Unbenannter Eintrag';

/** The list in the dialog (F37.5, F37.12): unreadable entries are marked and only "Löschen" works for them. */
export function scenarioListHtml(views: ScenarioView[]): string {
  return `<ul class="scenarios-list" aria-label="Gespeicherte Szenarien">${views.map(scenarioItemHtml).join('')}</ul>`;
}

function scenarioItemHtml(v: ScenarioView): string {
  const label = escapeHtml(v.name || UNNAMED);
  const off = v.readable ? '' : ' disabled';
  return `<li class="scenario-item${v.readable ? '' : ' is-unreadable'}" data-sc-name="${escapeHtml(v.name)}">
    <div class="scenario-info"><span class="scenario-name">${label}</span>${v.readable ? '' : ' <span class="badge">nicht lesbar</span>'} <small class="muted">${escapeHtml(formatSavedAt(v.savedAt))}</small></div>
    <div class="scenario-actions">
      <button type="button" data-sc-recall="${v.index}" aria-label="${label} abrufen"${off}>Abrufen</button>
      <button type="button" data-sc-update="${v.index}" aria-label="${label} aktualisieren"${off}>Aktualisieren</button>
      <button type="button" data-sc-delete="${v.index}" aria-label="${label} löschen">Löschen</button>
    </div>
  </li>`;
}

/** Readable saved scenarios to add to the variant comparison (F31.4); each with its own "Hinzufügen" button. */
export function savedPickHtml(views: ScenarioView[]): string {
  return views
    .filter((v) => v.readable)
    .map((v) => {
      const label = escapeHtml(v.name);
      return `<li><span class="variants-name">${label} <small class="muted">${escapeHtml(formatSavedAt(v.savedAt))}</small></span>
        <button type="button" data-var-saved="${v.index}" aria-label="${label} hinzufügen" data-var-saved-name="${label}">Hinzufügen</button></li>`;
    })
    .join('');
}

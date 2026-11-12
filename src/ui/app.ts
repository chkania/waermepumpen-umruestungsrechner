import { compareInstallTimes, type InstallComparison } from '../core/compare';
import { keyEvents, type KeyEvent, type KeyEvents } from '../core/events';
import { tryParseMonth } from '../core/dates';
import { createDefaults, FUNDING_SOURCE_DATE } from '../core/defaults';
import { DEFAULT_SOURCES, OFFICIAL_REFS, SOURCE_KIND_LABEL } from '../core/sources';
import { priceRows, runAll, type RunResult } from '../core/simulation';
import { tariffComparison } from '../core/tariff';
import { decodeHash, encodeHash, exportFileName, exportJson, importJson, mergeInputs } from '../core/serialize';
import type { Inputs, ScenarioKind, ScenarioResult } from '../core/types';
import { NUMBER_LIMITS, numberRange, TEXT_LIMITS, validMonth, type InputIssue } from '../core/validate';
import { Charts, chartTables, type ChartId } from './charts';
import { SECTIONS, getPath, setPath, type Field } from './fields';
import { escapeHtml, fmtDuration, fmtEur, fmtMonth, fmtNum, fmtPct } from './format';

export const STORAGE_KEY = 'wp-investitionsrechner:v1';
/** Gewähltes Design (Ansichtseinstellung, nicht Teil der Eingaben/Links). */
export const DESIGN_KEY = 'wp-investitionsrechner:design';
export type Design = 'modern' | 'classic';
export const DEFAULT_DESIGN: Design = 'modern';
/** Hell/Dunkel: 'auto' folgt der Browser-/Systemeinstellung, 'light'/'dark' übersteuern sie (F14.5). */
export const THEME_KEY = 'wp-investitionsrechner:theme';
export type ThemeChoice = 'auto' | 'light' | 'dark';

export interface AppEnv {
  storage?: Storage | null;
  today?: Date;
  /** Für Tests abschaltbar. */
  debounceMs?: number;
}

export interface AppController {
  getInputs(): Inputs;
  setInputs(i: Inputs): void;
  recalc(): void;
  lastResult(): { run: RunResult; cmp: InstallComparison; events: KeyEvents } | null;
  getDesign(): Design;
  setDesign(d: Design): void;
  getTheme(): ThemeChoice;
  setTheme(t: ThemeChoice): void;
}

const CHART_TABS: [ChartId, string][] = [
  ['cumulative', 'Kumulierte Kosten'],
  ['annual', 'Jährliche Kosten'],
  ['prices', 'Preisentwicklung'],
  ['install', 'Zeitpunkt der Umrüstung'],
];

export function mountApp(root: HTMLElement, env: AppEnv = {}): AppController {
  const storage = env.storage === undefined ? safeStorage() : env.storage;
  const defaults = createDefaults(env.today ?? new Date());
  const initial = loadInitial(defaults, storage);
  let inputs = initial.inputs;
  // Geteilter Link bei vorhandenen eigenen Eingaben: diese nicht still überschreiben (F9.6)
  let sharedView = initial.source === 'hash' && initial.storedRaw !== null;
  let loadIssues: { origin: string; issues: InputIssue[] } | null = initial.issues.length
    ? { origin: initial.source === 'hash' ? 'dem Link' : 'den gespeicherten Eingaben', issues: initial.issues }
    : null;
  let last: { run: RunResult; cmp: InstallComparison; events: KeyEvents } | null = null;
  let tableKind: ScenarioKind = 'kfw';
  let activeChart: ChartId = 'cumulative';

  root.innerHTML = layout();
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const form = $<HTMLElement>('#inputs');
  form.innerHTML = SECTIONS.map((s) => sectionHtml(s, defaults)).join('');

  const canvases = Object.fromEntries(
    CHART_TABS.map(([id]) => [id, $<HTMLCanvasElement>(`canvas[data-chart="${id}"]`)]),
  ) as Record<ChartId, HTMLCanvasElement>;
  const charts = new Charts(canvases);

  // ---------- Formular ----------
  const fieldByPath = new Map<string, Field>();
  for (const s of SECTIONS) for (const f of s.fields) fieldByPath.set(f.path, f);

  function writeForm(): void {
    for (const el of form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-path]')) {
      const f = fieldByPath.get(el.dataset.path!)!;
      const v = getPath(inputs, f.path);
      if (el instanceof HTMLInputElement && f.type === 'checkbox') el.checked = Boolean(v);
      else if (f.type === 'percent') el.value = String(round(Number(v) * 100, 6));
      else el.value = String(v ?? '');
      setFieldError(el, null);
    }
    refreshVisibility();
    renderScenarioName();
  }

  /** Bezeichnung über den Ergebnissen und im Fenstertitel (F16.1). */
  function renderScenarioName(): void {
    const name = inputs.scenario.name.trim();
    const el = $<HTMLElement>('#scenario-name');
    el.textContent = name;
    el.hidden = name === '';
    document.title = name ? `${name} – Wärmepumpen-Rechner` : 'Wärmepumpen-Rechner';
  }

  function refreshVisibility(): void {
    for (const wrap of form.querySelectorAll<HTMLElement>('[data-field]')) {
      const f = fieldByPath.get(wrap.dataset.field!)!;
      wrap.hidden = f.show ? !f.show(inputs) : false;
      if (typeof f.unit === 'function') {
        const u = wrap.querySelector('.unit');
        if (u) u.textContent = f.unit(inputs);
      }
    }
  }

  /** Fehler als Text und für Screenreader kennzeichnen (WCAG 3.3.1, 1.4.1). */
  function setFieldError(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, msg: string | null): void {
    el.classList.toggle('invalid', msg !== null);
    if (msg === null) el.removeAttribute('aria-invalid');
    else el.setAttribute('aria-invalid', 'true');
    const err = form.querySelector<HTMLElement>(`#${el.id}-err`);
    if (err) {
      err.textContent = msg ?? '';
      err.hidden = msg === null;
    }
  }

  function readField(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
    const f = fieldByPath.get(el.dataset.path!)!;
    const prev = getPath(inputs, f.path);
    let value: unknown;
    let valid = true;
    if (f.type === 'checkbox') value = (el as HTMLInputElement).checked;
    else if (f.type === 'number' || f.type === 'percent') {
      const n = Number(String(el.value).replace(',', '.'));
      value = f.type === 'percent' ? n / 100 : n;
      const [min, max] = numberRange(f.path);
      // Grenzen aus der Eingabeprüfung (F9.5), damit auch Tippfehler den Browser nicht einfrieren
      valid = el.value.trim() !== '' && Number.isFinite(n) && (value as number) >= min && (value as number) <= max;
    } else if (f.type === 'month') {
      value = el.value.trim();
      valid = validMonth(f.path, value as string);
    } else value = el.value;
    setFieldError(el, valid ? null : fieldErrorText(f));
    if (!valid) return;
    setPath(inputs, f.path, value);
    f.onChange?.(inputs, prev);
    if (f.onChange) writeForm();
    refreshVisibility();
    persist();
    if (f.noRecalc) renderScenarioName();
    else schedule();
  }

  // ---------- Hinweise beim Laden: geteilter Link, ungültige Werte (F9.5, F9.6) ----------
  const notice = $<HTMLElement>('#notice');
  function renderNotice(): void {
    const parts: string[] = [];
    if (sharedView) {
      parts.push(`<div class="notice-shared">
        <p><strong>Geteiltes Szenario geöffnet.</strong> Ihre eigenen gespeicherten Eingaben bleiben unverändert, bis Sie dieses Szenario übernehmen. Änderungen wirken nur auf den Link.</p>
        <div class="notice-actions">
          <button type="button" data-notice="adopt">Als meine Eingaben übernehmen</button>
          <button type="button" data-notice="own" class="ghost">Eigene Eingaben laden</button>
        </div></div>`);
    }
    if (loadIssues) {
      parts.push(`<div class="notice-issues">
        <p><strong>${loadIssues.issues.length === 1 ? 'Ein Wert' : `${loadIssues.issues.length} Werte`} aus ${escapeHtml(loadIssues.origin)} ${loadIssues.issues.length === 1 ? 'war' : 'waren'} ungültig und wurde${loadIssues.issues.length === 1 ? '' : 'n'} ersetzt:</strong></p>
        <ul>${loadIssues.issues
          .slice(0, 12)
          .map((x) => `<li>${escapeHtml(fieldByPath.get(x.path)?.label ?? x.path)}: ${escapeHtml(x.reason)}</li>`)
          .join('')}${loadIssues.issues.length > 12 ? `<li>… und ${loadIssues.issues.length - 12} weitere</li>` : ''}</ul>
        <button type="button" data-notice="dismiss" class="ghost">Ausblenden</button></div>`);
    }
    notice.innerHTML = parts.join('');
    notice.hidden = parts.length === 0;
  }
  /** Link-Ansicht verlassen: Hash entfernen, Speichern wieder erlauben. */
  function leaveShared(): void {
    sharedView = false;
    if (location.hash.startsWith('#s=')) history.replaceState(null, '', location.pathname + location.search);
  }
  notice.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-notice]')?.dataset.notice;
    if (action === 'adopt') {
      sharedView = false;
      persist();
      toast('Szenario als eigene Eingaben übernommen.');
    } else if (action === 'own') {
      leaveShared();
      const issues: InputIssue[] = [];
      try {
        inputs = mergeInputs(defaults, JSON.parse(initial.storedRaw ?? '{}'), issues);
      } catch {
        inputs = mergeInputs(defaults, {});
      }
      loadIssues = issues.length ? { origin: 'den gespeicherten Eingaben', issues } : null;
      writeForm();
      recalc();
      toast('Eigene Eingaben geladen.');
    } else if (action === 'dismiss') {
      loadIssues = null;
    } else return;
    renderNotice();
  });

  // ---------- Herkunft der Standardwerte (Popover) ----------
  const closePopovers = (except?: Element) => {
    for (const b of form.querySelectorAll<HTMLButtonElement>('.info-btn[aria-expanded="true"]')) {
      if (b === except) continue;
      b.setAttribute('aria-expanded', 'false');
      (document.getElementById(b.getAttribute('aria-controls')!) as HTMLElement).hidden = true;
    }
  };
  form.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.info-btn');
    if (!btn) return;
    e.preventDefault();
    closePopovers(btn);
    const pop = document.getElementById(btn.getAttribute('aria-controls')!) as HTMLElement;
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    pop.hidden = !open;
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest?.('.info-btn, .src-pop')) closePopovers();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePopovers();
  });

  form.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.path) readField(el);
  });
  form.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.path) readField(el);
  });

  // ---------- Toolbar ----------
  const toast = (msg: string) => {
    const t = $<HTMLElement>('#toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  };

  $<HTMLButtonElement>('#btn-share').addEventListener('click', async () => {
    const hash = encodeHash(defaults, inputs);
    history.replaceState(null, '', hash);
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link in die Zwischenablage kopiert.');
    } catch {
      toast('Link steht in der Adresszeile.');
    }
  });
  $<HTMLButtonElement>('#btn-export').addEventListener('click', () => {
    const blob = new Blob([exportJson(inputs)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = exportFileName(inputs, env.today ?? new Date());
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const fileInput = $<HTMLInputElement>('#file-import');
  $<HTMLButtonElement>('#btn-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const issues: InputIssue[] = [];
      const imported = importJson(defaults, await file.text(), issues);
      leaveShared();
      loadIssues = issues.length ? { origin: 'der Datei', issues } : null;
      controller.setInputs(imported);
      renderNotice();
      toast('Eingaben importiert.');
    } catch (err) {
      toast((err as Error).message);
    }
    fileInput.value = '';
  });
  $<HTMLButtonElement>('#btn-reset').addEventListener('click', () => {
    if (!confirm('Alle Eingaben auf die Standardwerte zurücksetzen?')) return;
    leaveShared();
    loadIssues = null;
    controller.setInputs(createDefaults(env.today ?? new Date()));
    renderNotice();
    toast('Auf Standardwerte zurückgesetzt.');
  });

  // ---------- Tabs ----------
  // Reiter nach ARIA-Muster: ein Tab-Stopp, Pfeiltasten/Pos1/Ende wechseln (WCAG 2.1.1, 4.1.2)
  const tabButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const selectTab = (b: HTMLButtonElement, focus = false) => {
    activeChart = b.dataset.tab as ChartId;
    for (const x of tabButtons) {
      x.setAttribute('aria-selected', String(x === b));
      x.tabIndex = x === b ? 0 : -1;
    }
    root.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== activeChart));
    if (focus) b.focus();
  };
  tabButtons.forEach((b, i) => {
    b.addEventListener('click', () => selectTab(b));
    b.addEventListener('keydown', (e) => {
      const n = tabButtons.length;
      const target =
        e.key === 'ArrowRight' ? tabButtons[(i + 1) % n]
        : e.key === 'ArrowLeft' ? tabButtons[(i - 1 + n) % n]
        : e.key === 'Home' ? tabButtons[0]
        : e.key === 'End' ? tabButtons[n - 1]
        : null;
      if (!target) return;
      e.preventDefault();
      selectTab(target, true);
    });
  });
  $<HTMLSelectElement>('#table-kind').addEventListener('change', (e) => {
    tableKind = (e.target as HTMLSelectElement).value as ScenarioKind;
    if (last) renderYearTable(last.run, last.events);
  });

  const redrawCharts = () => {
    charts.reset();
    if (last) charts.update(last.run, priceRows(inputs), last.cmp, last.events);
  };
  // ---------- Hell/Dunkel ----------
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  let theme: ThemeChoice = readTheme(storage);
  const applyTheme = (t: ThemeChoice) => {
    theme = t;
    document.documentElement.dataset.theme = t === 'auto' ? (media?.matches ? 'dark' : 'light') : t;
    root.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.themeChoice === t)),
    );
  };
  applyTheme(theme);
  media?.addEventListener?.('change', () => {
    if (theme !== 'auto') return;
    applyTheme('auto');
    redrawCharts();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((b) =>
    b.addEventListener('click', () => controller.setTheme(b.dataset.themeChoice as ThemeChoice)),
  );

  // ---------- Design-Umschalter ----------
  let design: Design = readDesign(storage);
  const applyDesign = (d: Design) => {
    design = d;
    document.documentElement.dataset.design = d;
    root.querySelectorAll<HTMLButtonElement>('[data-design-choice]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.designChoice === d)),
    );
  };
  applyDesign(design);
  root.querySelectorAll<HTMLButtonElement>('[data-design-choice]').forEach((b) =>
    b.addEventListener('click', () => controller.setDesign(b.dataset.designChoice as Design)),
  );

  // ---------- Berechnung ----------
  let timer: ReturnType<typeof setTimeout> | undefined;
  function schedule(): void {
    const ms = env.debounceMs ?? 120;
    if (ms <= 0) return recalc();
    clearTimeout(timer);
    timer = setTimeout(recalc, ms);
  }

  function persist(): void {
    try {
      if (!sharedView) storage?.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {
      /* Speicher nicht verfügbar */
    }
    if (location.hash.startsWith('#s=')) history.replaceState(null, '', encodeHash(defaults, inputs));
  }

  function recalc(): void {
    let run: RunResult;
    let cmp: InstallComparison;
    let events: KeyEvents;
    try {
      run = runAll(inputs);
      cmp = compareInstallTimes(inputs);
      events = keyEvents(inputs, run);
    } catch (err) {
      $<HTMLElement>('#warnings').innerHTML = `<div class="alert error">${escapeHtml((err as Error).message)}</div>`;
      return;
    }
    last = { run, cmp, events };
    renderKpis(run);
    renderWarnings(run);
    renderEvents(events);
    renderDetails(run);
    renderTariff();
    renderInstallTable(cmp);
    renderYearTable(run, events);
    const prices = priceRows(inputs);
    charts.update(run, prices, cmp, events);
    renderChartTables(run, prices, cmp);
  }

  function renderChartTables(run: RunResult, prices: ReturnType<typeof priceRows>, cmp: InstallComparison): void {
    const tables = chartTables(run, prices, cmp);
    for (const [id, t] of Object.entries(tables)) {
      const el = root.querySelector<HTMLElement>(`[data-chart-table="${id}"]`);
      if (!el) continue;
      el.innerHTML = `<table class="compact"><caption>${escapeHtml(t.caption)}</caption>
        <thead><tr>${t.head.map((h, i) => `<th scope="col"${i ? ' class="num"' : ''}>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${t.rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td class="num">${escapeHtml(c)}</td>` : `<th scope="row">${escapeHtml(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table>`;
    }
  }

  function renderKpis(run: RunResult): void {
    const best = run.best === 'tax' ? run.tax : run.kfw;
    const saving = run.ref.totalCost - best.totalCost;
    const be = run.best === 'tax' ? run.breakEvenTax : run.breakEvenKfw;
    const install = best.installMonth;
    const beText =
      be === null
        ? 'nicht im Zeitraum'
        : install !== null && be > install
          ? `${fmtMonth(be)} <small>(${fmtDuration(be - install)} nach Inbetriebnahme)</small>`
          : fmtMonth(be);
    $<HTMLElement>('#kpis').innerHTML = `
      ${kpi('Ohne Wärmepumpe', fmtEur(run.ref.totalCost), 'ref', 'Gesamtkosten im Zeitraum')}
      ${kpi('WP + KfW-Zuschuss', fmtEur(run.kfw.totalCost), 'kfw', `Zuschuss ${fmtEur(run.kfw.kfw?.subsidy ?? 0)}`, run.best === 'kfw')}
      ${kpi('WP + Steuerbonus', run.tax.feasible ? fmtEur(run.tax.totalCost) : 'nicht möglich', 'tax', run.tax.feasible ? `Steuerbonus ${fmtEur(run.tax.tax?.total ?? 0)}` : (run.tax.tax?.notes[0] ?? ''), run.best === 'tax')}
      ${kpi(saving >= 0 ? 'Ersparnis mit WP' : 'Mehrkosten mit WP', fmtEur(Math.abs(saving)), saving >= 0 ? 'good' : 'bad', `bester Weg: ${run.best === 'tax' ? 'Steuerbonus' : 'KfW'}`)}
      ${kpi('Amortisation', beText, 'neutral', 'kumulierte Kosten dauerhaft unter Referenz')}
    `;
    $<HTMLElement>('#horizon-note').textContent =
      `Betrachtung ${fmtMonth(run.ref.months[0].month)} – ${fmtMonth(run.ref.months[run.ref.months.length - 1].month)}, ` +
      `Inbetriebnahme WP ${fmtMonth(run.kfw.installMonth)}` +
      (inputs.general.opportunityRate ? `, aufgezinst mit ${fmtPct(inputs.general.opportunityRate, 2)} p. a.` : '');
  }

  function renderWarnings(run: RunResult): void {
    // Förder-/Steuerhinweise, Ersatzkessel und Restschulden erscheinen ausführlicher unter „Wichtige Ereignisse“
    const covered = new Set([...(run.kfw.kfw?.notes ?? []), ...(run.tax.tax?.notes ?? [])]);
    const ws = [...new Set([...run.kfw.warnings, ...run.tax.warnings, ...run.ref.warnings])].filter(
      (w) => !covered.has(w) && !/Ersatzkessel|Restschuld/.test(w),
    );
    $<HTMLElement>('#warnings').innerHTML = ws.length
      ? `<ul class="alert">${ws.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`
      : '';
  }

  function renderEvents(ev: KeyEvents): void {
    const hints = ev.hints
      .map(
        (h) => `<div class="hint level-${h.level}">
          <div class="hint-title">${escapeHtml(h.title)}</div>
          ${h.detail ? `<div class="hint-detail">${escapeHtml(h.detail)}</div>` : ''}
        </div>`,
      )
      .join('');
    const items = ev.timeline
      .map(
        (e) => `<li class="ev level-${e.level}">
          <span class="ev-date">${fmtMonth(e.month)}</span>
          <span class="ev-body">
            <span class="ev-head">${scenarioChip(e)}<span class="ev-title">${escapeHtml(e.title)}</span></span>
            ${e.detail ? `<span class="ev-detail">${escapeHtml(e.detail)}</span>` : ''}
          </span>
          <span class="ev-amount ${e.amount !== undefined && e.amount < 0 ? 'pos' : ''}">${
            e.amount !== undefined ? (e.amount < 0 ? '+' : '−') + fmtEur(Math.abs(e.amount)) + (e.perYear ? '<small>/Jahr</small>' : '') : ''
          }</span>
        </li>`,
      )
      .join('');
    $<HTMLElement>('#events').innerHTML = `
      <h2>Wichtige Ereignisse &amp; Hinweise</h2>
      ${hints ? `<div class="hints">${hints}</div>` : ''}
      ${items ? `<ol class="timeline">${items}</ol>` : ''}`;
  }

  function renderDetails(run: RunResult): void {
    const k = run.kfw.kfw;
    const t = run.tax.tax;
    const kfwHtml = k
      ? `<dl>
          <dt>Antrag (angenommen)</dt><dd>${fmtMonth(k.appMonth)}</dd>
          <dt>Grundförderung</dt><dd>${fmtPct(k.grundRate)}</dd>
          ${k.wsbRate > 0 ? `<dt>Wertschöpfungs-Bonus (EU)</dt><dd>${fmtPct(k.wsbRate)}</dd>` : ''}
          <dt>Klimageschwindigkeitsbonus</dt><dd>${fmtPct(k.kgbRate)}</dd>
          <dt>Einkommensbonus</dt><dd>${fmtPct(k.incomeRate)}</dd>
          <dt>Fördersatz (selbstgenutzte WE)</dt><dd>${fmtPct(k.ownerUnitRate)} <small>max. ${fmtPct(k.maxRate)}</small></dd>
          <dt>Förderfähige Kosten</dt><dd>${fmtEur(k.eligibleCosts)} <small>Höchstbetrag ${fmtEur(k.capTotal)}</small></dd>
          <dt>Zuschuss</dt><dd><strong>${fmtEur(k.subsidy)}</strong></dd>
        </dl>`
      : '<p class="muted">Keine Installation im Zeitraum.</p>';
    const taxHtml = t
      ? t.eligible
        ? `<dl>${t.yearly.map((y) => `<dt>Steuerjahr ${y.year}</dt><dd>${fmtEur(y.amount)}</dd>`).join('')}
            <dt>Summe</dt><dd><strong>${fmtEur(t.total)}</strong></dd></dl>
            <p class="muted small">Erstattung jeweils im Folgejahr. Nicht mit KfW-Zuschuss kombinierbar.</p>`
        : `<p class="muted">${t.notes.map(escapeHtml).join('<br>')}</p>`
      : '<p class="muted">Keine Installation im Zeitraum.</p>';
    const loans = [
      ...run.kfw.loans.map((l) => ({ ...l, path: 'KfW-Weg' })),
      ...run.tax.loans.map((l) => ({ ...l, path: 'Steuer-Weg' })),
    ];
    const loanHtml = loans.length
      ? `<div class="table-wrap"><table class="compact"><thead><tr><th>Weg</th><th>Kredit</th><th class="num">Betrag</th><th class="num">Zins</th><th class="num">Zinskosten*</th></tr></thead><tbody>
          ${loans.map((l) => `<tr><td>${l.path}</td><td>${escapeHtml(l.name.replace('KfW-Kredit ', 'KfW '))}</td><td class="num">${fmtEur(l.principal)}</td><td class="num">${fmtPct(l.rate, 2)}</td><td class="num">${fmtEur(l.totalInterest)}</td></tr>`).join('')}
          </tbody></table></div>${windfallHtml(run)}<p class="muted small">* im Betrachtungszeitraum. Zinssätze sind Annahmen.</p>`
      : '<p class="muted">Keine Kredite – vollständig aus Eigenkapital finanziert.</p>';
    $<HTMLElement>('#details').innerHTML = `
      <div class="card"><h3>KfW-Zuschuss (458)</h3>${kfwHtml}</div>
      <div class="card"><h3>Steuerbonus (§ 35c EStG)</h3>${taxHtml}</div>
      <div class="card"><h3>Finanzierung</h3>${loanHtml}</div>`;
  }

  function renderTariff(): void {
    const el = $<HTMLElement>('#tariff');
    const t = tariffComparison(inputs);
    if (!t || !t.firstFullYear) {
      el.innerHTML = '<h2>Stromkosten: mit oder ohne Wärmepumpentarif</h2><p class="muted">Keine Inbetriebnahme im Betrachtungszeitraum.</p>';
      return;
    }
    const y = t.firstFullYear;
    const hp = inputs.heatPump;
    const cheaperLabel = t.cheaper === 'with' ? 'Wärmepumpentarif' : 'Haushaltsstrom';
    const selectedNote =
      t.selected === t.cheaper
        ? `Die gewählte Variante (${t.selected === 'with' ? 'Wärmepumpentarif' : 'Haushaltsstrom'}) ist die günstigere.`
        : `Gewählt ist „${t.selected === 'with' ? 'Wärmepumpentarif' : 'Haushaltsstrom'}“ – „${cheaperLabel}“ wäre ${fmtEur(Math.abs(t.saving))} günstiger.`;
    el.innerHTML = `
      <h2>Stromkosten: mit oder ohne Wärmepumpentarif</h2>
      <div class="tariff-grid">
        <div class="tariff-col${t.cheaper === 'with' ? ' is-cheaper' : ''}">
          <div class="tariff-head">Mit Wärmepumpentarif${t.cheaper === 'with' ? ' <span class="badge">günstiger</span>' : ''}</div>
          <div class="tariff-val">${fmtEur(y.withTariff)}<small>/Jahr (${y.year})</small></div>
          <div class="tariff-sub">${fmtNum(hp.elecPriceCt, 1)} ct/kWh + ${fmtEur(hp.meterFee)} Zähler − ${fmtEur(hp.para14aReduction)} § 14a</div>
          ${t.setupCost > 0 ? `<div class="tariff-sub">einmalig ${fmtEur(t.setupCost)} Zählerschrank-Umbau${t.setupSubsidy > 0 ? ` − ${fmtEur(t.setupSubsidy)} Zuschuss` : ''}</div>` : ''}
          <div class="tariff-total">${fmtEur(t.totalWith)} im Zeitraum${t.setupCost > 0 ? ' inkl. Umbau' : ''}</div>
        </div>
        <div class="tariff-col${t.cheaper === 'without' ? ' is-cheaper' : ''}">
          <div class="tariff-head">Ohne (Haushaltsstrom)${t.cheaper === 'without' ? ' <span class="badge">günstiger</span>' : ''}</div>
          <div class="tariff-val">${fmtEur(y.withoutTariff)}<small>/Jahr (${y.year})</small></div>
          <div class="tariff-sub">${fmtNum(hp.householdPriceCt, 1)} ct/kWh, kein Zusatzzähler${hp.existing14aOnHousehold ? ', § 14a schon für andere Einrichtung genutzt' : ` − ${fmtEur(hp.para14aReduction)} § 14a`}</div>
          <div class="tariff-total">${fmtEur(t.totalWithout)} im Zeitraum</div>
        </div>
      </div>
      <p class="tariff-note"><strong>${t.saving >= 0 ? 'Ersparnis' : 'Mehrkosten'} mit Wärmepumpentarif: ${fmtEur(Math.abs(t.saving))}</strong> über ${t.years.length} Jahre
        (${fmtEur(Math.abs(y.withoutTariff - y.withTariff))} im Jahr ${y.year}). ${escapeHtml(selectedNote)}</p>
      <p class="muted small">WP-Strom aus dem Netz ${y.year}: ca. ${fmtNum(y.gridKWh)} kWh. ${
        t.breakEvenKWh === null
          ? 'Der WP-Tarif ist nicht günstiger als Haushaltsstrom – ein eigener Zähler lohnt sich nicht.'
          : t.breakEvenKWh === 0
            ? 'Der eigene Zähler lohnt sich bei jedem Verbrauch: Die zusätzliche § 14a-Pauschale deckt den Zählergrundpreis.'
            : `Der eigene Zähler lohnt sich ab ca. ${fmtNum(t.breakEvenKWh)} kWh WP-Strom pro Jahr (${hp.existing14aOnHousehold ? '(Zählergrundpreis − zusätzliche § 14a-Pauschale)' : 'Zählergrundpreis'} ÷ Preisvorteil, heutige Preise).`
      }${
        t.setupCost > 0
          ? t.setupPaybackYears === null
            ? ' Der Zählerschrank-Umbau amortisiert sich nicht.'
            : ` Der Zählerschrank-Umbau (netto ${fmtEur(t.setupCost - t.setupSubsidy)}) hat sich nach ca. ${fmtNum(t.setupPaybackYears, 1)} Jahren durch die günstigeren Stromkosten bezahlt gemacht.`
          : ' Einmalige Kosten für einen zweiten Zähler sind nicht angesetzt (Feld „Zählerschrank-Umbau“).'
      } ${
        hp.existing14aOnHousehold
          ? 'Die § 14a-Pauschale gibt es nur einmal je Zähler: Am Haushaltszähler wird sie schon für eine andere steuerbare Verbrauchseinrichtung (z. B. Wallbox) gewährt – nur mit eigenem WP-Zähler kommt eine zweite hinzu.'
          : 'Die § 14a-Pauschale (Modul 1) ist in beiden Varianten angesetzt. Hängt am Haushaltszähler schon z. B. eine Wallbox mit § 14a, bitte das entsprechende Feld ankreuzen.'
      }</p>
      <details class="tariff-years"><summary>Jahreswerte</summary>
        <div class="table-wrap"><table class="compact">
          <thead><tr><th>Jahr</th><th class="num">Netzbezug WP</th><th class="num">mit WP-Tarif</th><th class="num">Haushaltsstrom</th><th class="num">Differenz</th></tr></thead>
          <tbody>${t.years
            .map(
              (r) => `<tr><td>${r.year}</td><td class="num">${fmtNum(r.gridKWh)} kWh</td><td class="num">${fmtEur(r.withTariff)}</td><td class="num">${fmtEur(r.withoutTariff)}</td><td class="num ${r.withoutTariff - r.withTariff >= 0 ? 'pos' : 'neg'}">${fmtEur(r.withoutTariff - r.withTariff)}</td></tr>`,
            )
            .join('')}</tbody>
        </table></div>
      </details>`;
  }

  function renderInstallTable(cmp: InstallComparison): void {
    $<HTMLElement>('#install-table').innerHTML = `
      <table>
        <thead><tr><th>Inbetriebnahme</th><th class="num">Zuschuss</th><th class="num">WP + KfW</th><th class="num">WP + Steuer</th><th>Bester Weg</th><th class="num">Ersparnis ggü. ohne WP</th><th class="num">Kosten des Wartens</th></tr></thead>
        <tbody>${cmp.rows
          .map(
            (r, i) => `<tr class="${i === cmp.bestIndex ? 'best' : ''}">
              <td>${fmtMonth(r.installMonth)}${i === cmp.bestIndex ? ' <span class="badge">günstigster</span>' : ''}</td>
              <td class="num">${fmtEur(r.kfwSubsidy)}</td>
              <td class="num">${fmtEur(r.kfwTotal)}</td>
              <td class="num">${r.taxFeasible ? fmtEur(r.taxTotal) : '<span class="muted">–</span>'}</td>
              <td>${r.best === 'tax' ? 'Steuerbonus' : 'KfW'}</td>
              <td class="num ${r.savingVsRef >= 0 ? 'pos' : 'neg'}">${fmtEur(r.savingVsRef)}</td>
              <td class="num ${r.extraVsFirst > 0 ? 'neg' : ''}">${i === 0 ? '–' : (r.extraVsFirst > 0 ? '+' : '') + fmtEur(r.extraVsFirst)}</td>
            </tr>`,
          )
          .join('')}</tbody>
      </table>
      <p class="muted small">Referenz ohne Wärmepumpe: ${fmtEur(cmp.refTotal)}. Förderantrag jeweils ${inputs.heatPump.leadMonths} Monate vor Inbetriebnahme.</p>`;
  }

  function renderYearTable(run: RunResult, ev: KeyEvents): void {
    const s: ScenarioResult = run[tableKind];
    const evByYear = new Map<number, KeyEvent[]>();
    for (const e of ev.timeline) {
      if (e.month === null || (e.scenario !== 'all' && e.scenario !== tableKind)) continue;
      if (tableKind === 'ref' && e.scenario === 'all') continue;
      const y = Math.floor(e.month / 12);
      evByYear.set(y, [...(evByYear.get(y) ?? []), e]);
    }
    const cols: [keyof ScenarioResult['years'][number], string][] = [
      ['energy', 'Energie'],
      ['fixed', 'Grund-/Fixkosten'],
      ['maintenance', 'Wartung'],
      ['investment', 'Investition'],
      ['loanPayout', 'Kredit­auszahlung'],
      ['interest', 'Zinsen'],
      ['principal', 'Tilgung'],
      ['fees', 'Vorfällig­keits­entschädigung'],
      ['subsidy', 'Zuschuss'],
      ['taxBonus', 'Steuer­bonus'],
      ['residual', 'Restwert'],
      ['total', 'Summe'],
      ['cumulative', 'Kumuliert'],
    ];
    const used = cols.filter(([k]) => k === 'total' || k === 'cumulative' || s.years.some((y) => Math.abs(y[k] as number) > 0.5));
    $<HTMLElement>('#year-table').innerHTML = `
      <table>
        <thead><tr><th>Jahr</th>${used.map(([, l]) => `<th class="num">${l}</th>`).join('')}<th>Ereignisse</th></tr></thead>
        <tbody>${s.years
          .map(
            (y) =>
              `<tr><td>${y.year}</td>${used
                .map(([k]) => `<td class="num${k === 'total' || k === 'cumulative' ? ' strong' : ''}">${fmtEur(y[k] as number)}</td>`)
                .join('')}<td class="ev-cell">${(evByYear.get(y.year) ?? [])
                .map((e) => `<span class="ev-tag level-${e.level}" title="${escapeHtml(e.detail ?? '')}">${MONTH_SHORT[e.month! % 12]}: ${escapeHtml(e.title)}</span>`)
                .join('')}</td></tr>`,
          )
          .join('')}</tbody>
      </table>`;
  }

  const controller: AppController = {
    getInputs: () => inputs,
    setInputs(i) {
      inputs = mergeInputs(defaults, i);
      writeForm();
      recalc();
      persist();
    },
    recalc,
    lastResult: () => last,
    getDesign: () => design,
    getTheme: () => theme,
    setTheme(t) {
      if (t === theme) return;
      applyTheme(t);
      try {
        storage?.setItem(THEME_KEY, t);
      } catch {
        /* Speicher nicht verfügbar */
      }
      redrawCharts();
    },
    setDesign(d) {
      if (d === design) return;
      applyDesign(d);
      try {
        storage?.setItem(DESIGN_KEY, d);
      } catch {
        /* Speicher nicht verfügbar */
      }
      redrawCharts();
    },
  };

  writeForm();
  renderNotice();
  recalc();
  return controller;
}

interface InitialLoad {
  inputs: Inputs;
  source: 'hash' | 'storage' | 'default';
  issues: InputIssue[];
  /** Eigene gespeicherte Eingaben (roh), falls vorhanden. */
  storedRaw: string | null;
}

function loadInitial(defaults: Inputs, storage: Storage | null): InitialLoad {
  let storedRaw: string | null = null;
  try {
    storedRaw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    /* ignorieren */
  }
  const issues: InputIssue[] = [];
  const fromHash = typeof location !== 'undefined' ? decodeHash(defaults, location.hash, issues) : null;
  if (fromHash) return { inputs: fromHash, source: 'hash', issues, storedRaw };
  issues.length = 0;
  if (storedRaw) {
    try {
      return { inputs: mergeInputs(defaults, JSON.parse(storedRaw), issues), source: 'storage', issues, storedRaw };
    } catch {
      /* ignorieren */
    }
  }
  return { inputs: mergeInputs(defaults, {}), source: 'default', issues: [], storedRaw };
}

function readTheme(storage: Storage | null): ThemeChoice {
  try {
    const v = storage?.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
  } catch {
    /* ignorieren */
  }
  return 'auto';
}

function readDesign(storage: Storage | null): Design {
  try {
    const v = storage?.getItem(DESIGN_KEY);
    if (v === 'modern' || v === 'classic') return v;
  } catch {
    /* ignorieren */
  }
  return DEFAULT_DESIGN;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const SCENARIO_LABEL = { all: 'beide WP-Wege', ref: 'ohne WP', kfw: 'KfW-Weg', tax: 'Steuer-Weg' } as const;

function scenarioChip(e: KeyEvent): string {
  return `<span class="chip chip-${e.scenario}">${SCENARIO_LABEL[e.scenario]}</span>`;
}

function kpi(label: string, value: string, tone: string, sub: string, best = false): string {
  return `<div class="kpi tone-${tone}${best ? ' is-best' : ''}">
    <div class="kpi-label">${escapeHtml(label)}${best ? ' <span class="badge">bester Weg</span>' : ''}</div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-sub">${escapeHtml(sub)}</div>
  </div>`;
}

/** Standardwert lesbar formatieren (für das Herkunfts-Popover). */
export function formatDefault(f: Field, defaults: Inputs): string {
  const v = getPath(defaults, f.path);
  const unit = typeof f.unit === 'function' ? f.unit(defaults) : (f.unit ?? '');
  if (f.type === 'checkbox') return v ? 'Ja' : 'Nein';
  if (f.type === 'select') return f.options?.find(([k]) => k === v)?.[1] ?? String(v);
  if (f.type === 'month') return v ? fmtMonth(Number(tryParseMonth(String(v)))) : '(leer)';
  if (f.type === 'text') return String(v);
  const n = f.type === 'percent' ? Number(v) * 100 : Number(v);
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: 3 })}${unit ? ' ' + unit : ''}`;
}

function sourceHtml(f: Field, id: string, defaults: Inputs): { button: string; pop: string } {
  const src = DEFAULT_SOURCES[f.path];
  if (!src) return { button: '', pop: '' };
  const popId = `${id}-src`;
  let host = '';
  try {
    host = src.url ? new URL(src.url).hostname.replace(/^www\./, '') : '';
  } catch {
    host = '';
  }
  return {
    button: `<button type="button" class="info-btn" aria-label="Woher kommt der Standardwert?" aria-expanded="false" aria-controls="${popId}">i</button>`,
    pop: `<div class="src-pop" id="${popId}" role="note" hidden>
      <div class="src-head"><span class="src-kind kind-${src.kind}">${SOURCE_KIND_LABEL[src.kind]}</span>
        <span class="src-default">Standard: <strong>${escapeHtml(formatDefault(f, defaults))}</strong></span></div>
      <p>${escapeHtml(src.text)}</p>
      ${refsHtml(OFFICIAL_REFS[f.path])}
      ${src.url || src.asOf ? `<p class="src-meta">${src.url ? `<a href="${src.url}" target="_blank" rel="noopener">${escapeHtml(host)}</a>` : ''}${src.url && src.asOf ? ' · ' : ''}${src.asOf ? `Stand ${src.asOf}` : ''}</p>` : ''}
    </div>`,
  };
}

function refsHtml(refs: { label: string; url: string }[] | undefined): string {
  if (!refs?.length) return '';
  return `<div class="src-refs"><span>Offizielle Quellen</span><ul>${refs
    .map((r) => `<li><a href="${r.url}" target="_blank" rel="noopener">${escapeHtml(r.label)}</a></li>`)
    .join('')}</ul></div>`;
}

/** Sondertilgung aus Einmalzahlung je Weg (F12.6): Termin, Betrag, Entschädigung, Zinsersparnis. */
function windfallHtml(run: RunResult): string {
  const rows = (
    [
      ['KfW-Weg', run.kfw.windfall],
      ['Steuer-Weg', run.tax.windfall],
    ] as const
  ).filter(([, w]) => w);
  if (!rows.length) return '';
  const w0 = rows[0][1]!;
  const when =
    w0.availableMonth === w0.month ? fmtMonth(w0.month) : `${fmtMonth(w0.month)} <small>(verfügbar ab ${fmtMonth(w0.availableMonth)})</small>`;
  return `<h4 class="sub-head">Sondertilgung ${when}</h4>
    ${rows
      .map(([path, w]) =>
        w!.note
          ? `<p class="muted small"><strong>${path}:</strong> ${escapeHtml(w!.note)}</p>`
          : `<dl class="wf-dl"><dt class="wf-path">${path}</dt><dd></dd>
              <dt>Getilgt</dt><dd>${fmtEur(w!.used)}</dd>
              ${w!.fees > 0 ? `<dt>Vorfälligkeitsentschädigung</dt><dd>${fmtEur(w!.fees)}</dd>` : ''}
              <dt>Zinsersparnis*</dt><dd><strong>${fmtEur(w!.interestSaved)}</strong></dd>
              ${w!.unused > 0.5 ? `<dt>Nicht eingesetzt</dt><dd>${fmtEur(w!.unused)}</dd>` : ''}</dl>`,
      )
      .join('')}`;
}

/** Fehlertext für ungültige Eingaben (F9.5, WCAG 3.3.1). */
export function fieldErrorText(f: Field): string {
  const keep = ' Der bisherige Wert wird weiter verwendet.';
  if (f.type === 'month') return `Bitte einen Monat zwischen 2000 und 2150 angeben (Jahr und Monat).${keep}`;
  if (f.type === 'number' || f.type === 'percent') {
    if (!(f.path in NUMBER_LIMITS)) return `Bitte eine gültige Zahl eingeben.${keep}`;
    const k = f.type === 'percent' ? 100 : 1;
    const [min, max] = numberRange(f.path).map((x) => (x * k).toLocaleString('de-DE', { maximumFractionDigits: 2 }));
    const unit = typeof f.unit === 'string' && f.unit ? ` ${f.unit}` : '';
    return `Bitte einen Wert von ${min} bis ${max}${unit} eingeben.${keep}`;
  }
  return `Ungültige Eingabe.${keep}`;
}

function fieldHtml(f: Field, defaults: Inputs): string {
  const id = `f-${f.path.replace(/\./g, '-')}`;
  const unit = typeof f.unit === 'string' ? f.unit : '';
  const help = f.help ? `<small class="help" id="${id}-help">${escapeHtml(f.help)}</small>` : '';
  const src = f.noSource ? { button: '', pop: '' } : sourceHtml(f, id, defaults);
  const ph = f.placeholder ? ` placeholder="${escapeHtml(f.placeholder)}"` : '';
  if (f.type === 'checkbox') {
    return `<div class="field check" data-field="${f.path}">
      <div class="label-row"><label for="${id}"><input type="checkbox" id="${id}" data-path="${f.path}"> ${escapeHtml(f.label)}</label>${src.button}</div>${src.pop}${help}</div>`;
  }
  let control: string;
  if (f.type === 'select') {
    control = `<select id="${id}" data-path="${f.path}">${(f.options ?? []).map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join('')}</select>`;
  } else if (f.type === 'month') {
    control = `<input type="month" id="${id}" data-path="${f.path}" placeholder="JJJJ-MM">`;
  } else if (f.type === 'textarea') {
    control = `<textarea id="${id}" data-path="${f.path}" rows="4" maxlength="${TEXT_LIMITS[f.path] ?? 2000}"${ph}></textarea>`;
  } else if (f.type === 'text') {
    control = `<input type="text" id="${id}" data-path="${f.path}" maxlength="${TEXT_LIMITS[f.path] ?? 2000}"${f.noSource ? '' : ' spellcheck="false"'}${ph}>`;
  } else {
    const attrs = [
      f.step !== undefined ? `step="${f.step}"` : 'step="any"',
      f.min !== undefined ? `min="${f.min}"` : '',
      f.max !== undefined ? `max="${f.max}"` : '',
    ].join(' ');
    control = `<input type="number" inputmode="decimal" id="${id}" data-path="${f.path}" ${attrs}>`;
  }
  // Hilfetext und Fehlermeldung mit dem Feld verknüpfen (Screenreader)
  const describedBy = [f.help ? `${id}-help` : '', `${id}-err`].filter(Boolean).join(' ');
  control = control.replace(`data-path="${f.path}"`, `data-path="${f.path}" aria-describedby="${describedBy}"`);
  return `<div class="field" data-field="${f.path}">
    <div class="label-row"><label for="${id}">${escapeHtml(f.label)}</label>${src.button}</div>${src.pop}
    <div class="control">${control}<span class="unit">${escapeHtml(unit)}</span></div>
    <small class="field-error" id="${id}-err" aria-live="polite" hidden></small>${help}</div>`;
}

function sectionHtml(s: (typeof SECTIONS)[number], defaults: Inputs): string {
  return `<details class="section${s.expert ? ' expert' : ''}" ${s.open ? 'open' : ''}>
    <summary>${escapeHtml(s.title)}</summary>
    ${s.note ? `<p class="note">${escapeHtml(s.note)}</p>` : ''}
    <div class="fields">${s.fields.map((f) => fieldHtml(f, defaults)).join('')}</div>
  </details>`;
}

function layout(): string {
  return `
  <header class="top">
    <div class="brand">
      <span class="mark" aria-hidden="true">~wp</span>
      <h1>Wärmepumpen-Investitionsrechner</h1>
      <p>Umstieg von Gas oder Öl: Energiepreise, KfW-Förderung, Kredit und Steuerbonus im Vergleich</p>
    </div>
    <div class="toolbar">
      <div class="design-switch" role="group" aria-label="Design">
        <button type="button" data-design-choice="modern" aria-pressed="false">Modern</button>
        <button type="button" data-design-choice="classic" aria-pressed="false">Klassisch</button>
      </div>
      <div class="design-switch theme-switch" role="group" aria-label="Hell oder dunkel">
        <button type="button" data-theme-choice="light" aria-pressed="false" title="Helles Design">Hell</button>
        <button type="button" data-theme-choice="dark" aria-pressed="false" title="Dunkles Design">Dunkel</button>
        <button type="button" data-theme-choice="auto" aria-pressed="false" title="Wie Browser bzw. System">Auto</button>
      </div>
      <a id="btn-help" class="tool-link" href="./hilfe.html" target="_blank" rel="noopener" title="Benutzerhandbuch in neuem Tab öffnen">Hilfe</a>
      <button id="btn-share" type="button">Link teilen</button>
      <button id="btn-export" type="button">Export</button>
      <button id="btn-import" type="button">Import</button>
      <button id="btn-reset" type="button" class="ghost">Zurücksetzen</button>
      <input id="file-import" type="file" accept="application/json,.json" hidden>
    </div>
  </header>
  <main class="layout">
    <aside id="inputs" class="inputs" aria-label="Eingaben"></aside>
    <section class="results" aria-label="Ergebnisse">
      <div id="notice" class="notice" role="status" hidden></div>
      <h2 id="scenario-name" class="scenario-name" hidden></h2>
      <div id="kpis" class="kpis"></div>
      <p id="horizon-note" class="muted small"></p>
      <div id="warnings"></div>
      <div id="events" class="card events"></div>
      <div class="card">
        <h2 class="visually-hidden">Diagramme</h2>
        <div class="tabs" role="tablist" aria-label="Diagramme">
          ${CHART_TABS.map(([id, l], i) => `<button type="button" role="tab" id="tab-${id}" data-tab="${id}" aria-controls="panel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${l}</button>`).join('')}
        </div>
        ${CHART_TABS.map(
          ([id, l], i) => `<div role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}" data-panel="${id}" ${i === 0 ? '' : 'hidden'}>
            <div class="chart-wrap"><canvas data-chart="${id}" role="img" aria-label="Diagramm ${l}. Die Werte stehen in der Tabelle darunter."></canvas></div>
            <details class="chart-data"><summary>Werte als Tabelle</summary><div class="table-wrap" data-chart-table="${id}"></div></details>
          </div>`,
        ).join('')}
      </div>
      <div id="details" class="details"></div>
      <div id="tariff" class="card tariff"></div>
      <div class="card">
        <h2>Wann umrüsten?</h2>
        <div id="install-table" class="table-wrap"></div>
      </div>
      <div class="card">
        <div class="card-head">
          <h2>Jahresübersicht</h2>
          <select id="table-kind" aria-label="Szenario">
            <option value="kfw">WP + KfW-Zuschuss</option>
            <option value="tax">WP + Steuerbonus</option>
            <option value="ref">Ohne Wärmepumpe</option>
          </select>
        </div>
        <div id="year-table" class="table-wrap"></div>
        <p class="muted small">Positive Werte = Ausgaben, negative = Einnahmen. „Kumuliert" enthält den Opportunitätszins.</p>
      </div>
      <p class="disclaimer">Keine Finanz-, Steuer- oder Förderberatung. Alle Angaben ohne Gewähr; Förderbedingungen Stand ${FUNDING_SOURCE_DATE.split('-').reverse().join('.')} – bitte vor Antragstellung bei KfW, Energieberatung und Steuerberatung prüfen.</p>
    </section>
  </main>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>`;
}

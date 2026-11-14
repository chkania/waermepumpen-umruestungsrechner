import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartType,
  type TooltipItem,
} from 'chart.js';
import type { InstallComparison } from '../core/compare';
import type { KeyEvent, KeyEvents } from '../core/events';
import { energyTotal, type EnergyMonth, type EnergyParts, type EnergyYear } from '../core/energy';
import { VARIATION_TEXT, type Sensitivity } from '../core/sensitivity';
import type { PriceRow, RunResult } from '../core/simulation';
import { fmtEur, fmtMonth, fmtNum } from './format';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, Legend, Tooltip);

export type ChartId = 'cumulative' | 'annual' | 'prices' | 'install' | 'energy' | 'sensitivity';

export const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
/** Dataset labels of the energy chart (F29). */
export const energyLabels = (e: EnergyYear) => ({
  need: 'Bedarf (Nutzenergie)',
  old: e.fuel === 'gas' ? 'Gas – Altanlage' : 'Heizöl – Altanlage',
  hp: 'Strom – Wärmepumpe',
  hpGas: 'Gas zum Kochen – mit Wärmepumpe',
});

/** Bar label of a sensitivity item incl. its variation, e.g. "JAZ (±0,5)". */
export const sensitivityLabel = (id: string, label: string) => `${label} (${VARIATION_TEXT[id] ?? ''})`;

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function palette() {
  return {
    ref: css('--c-ref', '#c2410c'),
    kfw: css('--c-kfw', '#0f766e'),
    tax: css('--c-tax', '#6d28d9'),
    co2: css('--c-muted', '#64748b'),
    grid: css('--c-grid', '#e2e8f0'),
    text: css('--c-text-2', '#475569'),
  };
}

const eurAxis = (title?: string) => ({
  ticks: { callback: (v: string | number) => fmtEur(Number(v)) },
  title: title ? { display: true, text: title } : undefined,
});

export class Charts {
  private charts = new Map<ChartId, Chart>();

  constructor(
    private canvases: Partial<Record<ChartId, HTMLCanvasElement>>,
    /** Higher resolution, e.g. for the printed report (F30). */
    private pixelRatio?: number,
  ) {}

  update(run: RunResult, prices: PriceRow[], cmp: InstallComparison, events?: KeyEvents, sens?: Sensitivity, energy?: EnergyYear): void {
    const c = palette();
    Chart.defaults.color = c.text;
    Chart.defaults.borderColor = c.grid;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

    const years = run.ref.years.map((y) => String(y.year));
    const line = (label: string, data: number[], color: string, dashed = false) => ({
      label,
      data,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      borderDash: dashed ? [6, 4] : [],
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.2,
    });
    const tooltipEur = {
      callbacks: { label: (ctx: TooltipItem<ChartType>) => `${ctx.dataset.label}: ${fmtEur(ctx.parsed.y ?? 0)}` },
    };

    // Event markers (key events/warnings) per scenario and year
    const timeline = events?.timeline ?? [];
    const evFor = (kind: 'ref' | 'kfw' | 'tax', year: number) =>
      timeline.filter(
        (e) =>
          e.month !== null &&
          Math.floor(e.month / 12) === year &&
          e.level !== 'info' &&
          (e.scenario === kind || (e.scenario === 'all' && kind !== 'ref')),
      );
    const marked = (kind: 'ref' | 'kfw' | 'tax', label: string, color: string, dashed = false) => ({
      ...line(label, run[kind].years.map((y) => y.cumulative), color, dashed),
      pointRadius: run[kind].years.map((y) => (evFor(kind, y.year).length ? 5 : 0)),
      pointStyle: 'rectRot' as const,
      pointBorderColor: css('--surface', '#fff'),
      pointBorderWidth: 1.5,
    });
    const kinds = ['ref', 'kfw', 'tax'] as const;
    this.render('cumulative', {
      type: 'line',
      data: {
        labels: years,
        datasets: [
          marked('ref', 'Ohne WP', c.ref),
          marked('kfw', 'WP + KfW', c.kfw),
          marked('tax', run.tax.feasible ? 'WP + Steuerbonus' : 'WP + Steuerbonus (nicht möglich)', c.tax, !run.tax.feasible),
        ],
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { y: eurAxis() },
        plugins: {
          tooltip: {
            ...tooltipEur,
            callbacks: {
              ...tooltipEur.callbacks,
              footer: (items) => {
                const year = Number(items[0]?.label);
                const seen = new Set<KeyEvent>();
                for (const k of kinds) for (const e of evFor(k, year)) seen.add(e);
                return [...seen].map((e) => `◆ ${e.title}`);
              },
            },
          },
        },
      },
    });

    const bar = (label: string, data: number[], color: string) => ({ label, data, backgroundColor: color, borderRadius: 3, maxBarThickness: 18 });
    this.render('annual', {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          bar('Ohne WP', run.ref.years.map((y) => y.total), c.ref),
          bar('WP + KfW', run.kfw.years.map((y) => y.total), c.kfw),
          bar('WP + Steuerbonus', run.tax.years.map((y) => y.total), c.tax),
        ],
      },
      options: { interaction: { mode: 'index', intersect: false }, scales: { y: eurAxis() }, plugins: { tooltip: tooltipEur } },
    });

    this.render('prices', {
      type: 'line',
      data: {
        labels: prices.map((p) => String(p.year)),
        datasets: [
          { ...line('Wärme aus Altanlage (ct/kWh)', prices.map((p) => p.heatCtFossil), c.ref), yAxisID: 'y' },
          { ...line('Wärme aus Wärmepumpe (ct/kWh)', prices.map((p) => p.heatCtWp), c.kfw), yAxisID: 'y' },
          { ...line('CO₂-Preis (€/t)', prices.map((p) => p.co2Price), c.co2, true), yAxisID: 'y2' },
        ],
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { title: { display: true, text: 'ct je kWh Nutzwärme' }, ticks: { callback: (v) => fmtNum(Number(v), 0) } },
          y2: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '€/t CO₂' } },
        },
        plugins: {
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y ?? 0, 1)}` } },
        },
      },
    });

    this.render('install', {
      type: 'bar',
      data: {
        labels: cmp.rows.map((r) => fmtMonth(r.installMonth)),
        datasets: [
          { ...bar('WP + KfW', cmp.rows.map((r) => r.kfwTotal), c.kfw), maxBarThickness: 28 },
          { ...bar('WP + Steuerbonus', cmp.rows.map((r) => (r.taxFeasible ? r.taxTotal : NaN)), c.tax), maxBarThickness: 28 },
          {
            type: 'line' as const,
            label: 'Ohne WP',
            data: cmp.rows.map(() => cmp.refTotal),
            borderColor: c.ref,
            backgroundColor: c.ref,
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      } as ChartConfiguration['data'],
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { y: { ...eurAxis('Gesamtkosten im Betrachtungszeitraum'), beginAtZero: false } },
        plugins: { tooltip: tooltipEur },
      },
    });

    // Energy per month (F29): demand vs. gas/oil and electricity, stacked groups per month
    if (energy) {
      const L = energyLabels(energy);
      const kwh = (x: number) => `${fmtNum(x, 0)} kWh`;
      const parts = (p: EnergyParts) => [`Heizen ${kwh(p.space)}`, `Warmwasser ${kwh(p.dhw)}`, ...(p.cooking > 0 ? [`Kochen ${kwh(p.cooking)}`] : [])];
      const group = (label: string, data: number[], color: string, stack: string) => ({ label, data, backgroundColor: color, borderColor: color, stack, maxBarThickness: 18 });
      const pick = (f: (m: EnergyMonth) => number) => energy.months.map(f);
      const datasets = [
        group(L.need, pick((m) => energyTotal(m.need)), c.co2, 'need'),
        group(L.old, pick((m) => energyTotal(m.old)), c.ref, 'old'),
        group(L.hp, pick((m) => energyTotal(m.hp)), c.kfw, 'hp'),
        ...(energy.cookingStaysGas ? [{ ...group(L.hpGas, pick((m) => m.hpCookingGas), c.ref, 'hp'), backgroundColor: `${c.ref}66` }] : []),
      ];
      this.render('energy', {
        type: 'bar',
        data: { labels: MONTH_SHORT, datasets } as ChartConfiguration['data'],
        options: {
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: { stacked: true },
            y: { stacked: true, title: { display: true, text: 'kWh je Monat' }, ticks: { callback: (v) => fmtNum(Number(v), 0) } },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx: TooltipItem<ChartType>) => {
                  const m = energy.months[ctx.dataIndex];
                  const p = [m.need, m.old, m.hp][ctx.datasetIndex];
                  const value = `${ctx.dataset.label}: ${kwh(Number(ctx.parsed.y ?? 0))}`;
                  return p ? [value, `   ${parts(p).join(' · ')}`] : value;
                },
              },
            },
          },
        },
      });
    }

    // Sensitivity (F27): tornado chart – bars from the base saving to the saving with the lower/higher assumption
    if (sens) {
      const items = sens.items;
      const floating = (label: string, color: string, pick: 'low' | 'high') => ({
        label,
        data: items.map((x) => [sens.base, x[pick]] as [number, number]),
        backgroundColor: color,
        borderColor: color,
        grouped: false,
        barPercentage: 0.7,
      });
      this.render('sensitivity', {
        type: 'bar',
        data: {
          labels: items.map((x) => sensitivityLabel(x.id, x.label)),
          datasets: [floating('Annahme niedriger', c.kfw, 'low'), floating('Annahme höher', c.ref, 'high')],
        } as ChartConfiguration['data'],
        options: {
          indexAxis: 'y',
          scales: {
            x: { ...eurAxis(`Ersparnis mit Wärmepumpe (heute: ${fmtEur(sens.base)})`) },
            y: { ticks: { autoSkip: false } },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx: TooltipItem<ChartType>) => {
                  const x = items[ctx.dataIndex];
                  const high = ctx.datasetIndex === 1;
                  return `${high ? 'höher' : 'niedriger'}: ${high ? x.highValue : x.lowValue} → Ersparnis ${fmtEur(high ? x.high : x.low)}`;
                },
              },
            },
          },
        },
      });
    }
  }

  private render(id: ChartId, cfg: ChartConfiguration & { type: ChartType }): void {
    const canvas = this.canvases[id];
    if (!canvas || !canvas.getContext?.('2d')) return; // e.g. test environment without canvas
    cfg.options = { responsive: true, maintainAspectRatio: false, animation: false, ...(this.pixelRatio ? { devicePixelRatio: this.pixelRatio } : {}), ...cfg.options };
    const existing = this.charts.get(id);
    if (existing && (existing.config as { type?: string }).type === cfg.type) {
      existing.data = cfg.data;
      existing.options = cfg.options!;
      existing.update('none');
      return;
    }
    existing?.destroy();
    this.charts.set(id, new Chart(canvas, cfg));
  }

  /** Reapply colours after a theme change. */
  reset(): void {
    for (const ch of this.charts.values()) ch.destroy();
    this.charts.clear();
  }
}

/** Tabular version of a chart (text alternative, WCAG 1.1.1). */
export interface ChartTable {
  caption: string;
  head: string[];
  rows: string[][];
}

/** Returns the same values as a table for every chart – also without canvas (e.g. screen readers, tests). */
export function chartTables(
  run: RunResult,
  prices: PriceRow[],
  cmp: InstallComparison,
  sens?: Sensitivity,
  energy?: EnergyYear,
): Partial<Record<ChartId, ChartTable>> {
  const scen = [
    ['Ohne WP', run.ref],
    ['WP + KfW', run.kfw],
    [run.tax.feasible ? 'WP + Steuerbonus' : 'WP + Steuerbonus (nicht möglich)', run.tax],
  ] as const;
  const byYear = (key: 'cumulative' | 'total') =>
    run.ref.years.map((y, i) => [String(y.year), ...scen.map(([, s]) => fmtEur(s.years[i]?.[key] ?? 0))]);
  return {
    cumulative: { caption: 'Kumulierte Kosten je Jahr (Endwert inkl. Opportunitätszins)', head: ['Jahr', ...scen.map(([l]) => l)], rows: byYear('cumulative') },
    annual: { caption: 'Jährliche Kosten je Szenario', head: ['Jahr', ...scen.map(([l]) => l)], rows: byYear('total') },
    prices: {
      caption: 'Preisentwicklung: Kosten je kWh Nutzwärme und CO₂-Preis',
      head: ['Jahr', 'Wärme aus Altanlage (ct/kWh)', 'Wärme aus Wärmepumpe (ct/kWh)', 'CO₂-Preis (€/t)'],
      rows: prices.map((p) => [String(p.year), fmtNum(p.heatCtFossil, 1), fmtNum(p.heatCtWp, 1), fmtNum(p.co2Price, 0)]),
    },
    install: {
      caption: 'Gesamtkosten im Betrachtungszeitraum je Zeitpunkt der Umrüstung',
      head: ['Inbetriebnahme', 'WP + KfW', 'WP + Steuerbonus', 'Ohne WP'],
      rows: cmp.rows.map((r) => [fmtMonth(r.installMonth), fmtEur(r.kfwTotal), r.taxFeasible ? fmtEur(r.taxTotal) : 'nicht möglich', fmtEur(cmp.refTotal)]),
    },
    ...(energy ? { energy: energyTable(energy) } : {}),
    ...(sens
      ? {
          sensitivity: {
            caption: `Ersparnis mit Wärmepumpe, wenn jeweils eine Annahme niedriger oder höher ist (heute: ${fmtEur(sens.base)}), sortiert nach Einfluss`,
            head: ['Annahme', 'heute', 'niedriger', 'Ersparnis', 'höher', 'Ersparnis', 'Spanne'],
            rows: sens.items.map((x) => [
              sensitivityLabel(x.id, x.label),
              x.base,
              x.lowValue,
              fmtEur(x.low),
              x.highValue,
              fmtEur(x.high),
              fmtEur(Math.abs(x.high - x.low)),
            ]),
          },
        }
      : {}),
  };
}

/** Table of the energy chart (F29): demand split by use, consumption of the old system and the heat pump, with annual total. */
function energyTable(e: EnergyYear): ChartTable {
  const L = energyLabels(e);
  const n = (x: number) => fmtNum(x, 0);
  // Cooking only appears if it runs on gas today (otherwise it is outside the calculation)
  const cooking = e.months.some((m) => m.need.cooking > 0);
  const row = (label: string, need: EnergyParts, old: number, hp: number, gas: number) => [
    label,
    n(need.space),
    n(need.dhw),
    ...(cooking ? [n(need.cooking)] : []),
    n(energyTotal(need)),
    n(old),
    n(hp),
    ...(e.cookingStaysGas ? [n(gas)] : []),
  ];
  const sumParts = (f: (m: EnergyMonth) => number) => e.months.reduce((a, m) => a + f(m), 0);
  return {
    caption: 'Energie je Monat im typischen Jahr (kWh): Bedarf für Heizen, Warmwasser und Kochen und der Verbrauch dafür',
    head: ['Monat', 'Bedarf Heizen', 'Bedarf Warmwasser', ...(cooking ? ['Bedarf Kochen'] : []), 'Bedarf gesamt', L.old, L.hp, ...(e.cookingStaysGas ? [L.hpGas] : [])],
    rows: [
      ...e.months.map((m) => row(MONTH_SHORT[m.month - 1], m.need, energyTotal(m.old), energyTotal(m.hp), m.hpCookingGas)),
      row('Jahr', { space: sumParts((m) => m.need.space), dhw: sumParts((m) => m.need.dhw), cooking: sumParts((m) => m.need.cooking) }, e.totals.old, e.totals.hp, e.totals.hpCookingGas),
    ],
  };
}

/**
 * Chart of the variant comparison (F31): cumulative costs of the best heat pump way (solid) and without heat pump
 * (dashed) per variant, one colour per variant. Returns null without canvas support (e.g. tests).
 */
export function variantsChart(
  canvas: HTMLCanvasElement,
  curves: { years: number[]; series: { name: string; best: (number | null)[]; ref: (number | null)[] }[] },
): { destroy(): void } | null {
  if (!canvas.getContext?.('2d')) return null;
  const c = palette();
  Chart.defaults.color = c.text;
  Chart.defaults.borderColor = c.grid;
  const colors = [c.kfw, c.ref, c.tax];
  const datasets = curves.series.flatMap((s, i) => {
    const color = colors[i % colors.length];
    const line = (label: string, data: (number | null)[], dashed: boolean) => ({
      label,
      data,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      borderDash: dashed ? [6, 4] : [],
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.2,
      spanGaps: false,
    });
    return [line(`${s.name} – mit WP`, s.best, false), line(`${s.name} – ohne WP`, s.ref, true)];
  });
  return new Chart(canvas, {
    type: 'line',
    data: { labels: curves.years.map(String), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: { y: eurAxis('Kumulierte Kosten') },
      plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtEur(ctx.parsed.y ?? 0)}` } } },
    },
  });
}

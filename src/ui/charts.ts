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
import type { PriceRow, RunResult } from '../core/simulation';
import { fmtEur, fmtMonth, fmtNum } from './format';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, Legend, Tooltip);

export type ChartId = 'cumulative' | 'annual' | 'prices' | 'install';

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

  constructor(private canvases: Record<ChartId, HTMLCanvasElement>) {}

  update(run: RunResult, prices: PriceRow[], cmp: InstallComparison): void {
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

    this.render('cumulative', {
      type: 'line',
      data: {
        labels: years,
        datasets: [
          line('Ohne WP', run.ref.years.map((y) => y.cumulative), c.ref),
          line('WP + KfW', run.kfw.years.map((y) => y.cumulative), c.kfw),
          line(run.tax.feasible ? 'WP + Steuerbonus' : 'WP + Steuerbonus (nicht möglich)', run.tax.years.map((y) => y.cumulative), c.tax, !run.tax.feasible),
        ],
      },
      options: { interaction: { mode: 'index', intersect: false }, scales: { y: eurAxis() }, plugins: { tooltip: tooltipEur } },
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
  }

  private render(id: ChartId, cfg: ChartConfiguration & { type: ChartType }): void {
    const canvas = this.canvases[id];
    if (!canvas || !canvas.getContext?.('2d')) return; // z. B. Testumgebung ohne Canvas
    cfg.options = { responsive: true, maintainAspectRatio: false, animation: false, ...cfg.options };
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

  /** Nach Theme-Wechsel Farben neu setzen. */
  reset(): void {
    for (const ch of this.charts.values()) ch.destroy();
    this.charts.clear();
  }
}

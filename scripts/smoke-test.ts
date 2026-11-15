/**
 * Smoke test after a deployment (N15): is the expected version delivered and does the calculator work?
 *
 *   node scripts/smoke-test.ts                                   checks https://waermepumpen-investitionsrechner.de/
 *   node scripts/smoke-test.ts http://localhost:4173/            checks the local preview (`npm run preview`)
 *   node scripts/smoke-test.ts <url> --version 1.9.1 --commit <sha>
 *
 * Runs in the workflow .github/workflows/deploy.yml after the upload (job "verify", without secrets).
 * Browser: Google Chrome (installed on the GitHub runners) via playwright-core; alternatively CHROME_PATH.
 * The visitor statistics (N10) are blocked, so the check never counts as a visit.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright-core';
import { checkVersionInfo, isIgnoredUrl, parseArgs, sitemapPages, type SmokeOptions } from './smoke-lib.ts';

const INTRO_KEY = 'wp-investitionsrechner:intro-seen';
const OPT_OUT_KEY = 'wp-investitionsrechner:analytics-opt-out';
const TIMEOUT = 20_000;

const failures: string[] = [];
const ok = (msg: string) => console.log(`✓ ${msg}`);
const fail = (msg: string) => {
  failures.push(msg);
  console.log(`✗ ${msg}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** version.json, bypassing caches; a few attempts, in case the webspace still delivers the old state for a moment. */
async function checkVersionFile(opts: SmokeOptions): Promise<void> {
  let errors: string[] = [];
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(new URL(`version.json?t=${Date.now()}`, opts.url), { headers: { 'Cache-Control': 'no-cache' } });
      errors = res.ok ? checkVersionInfo(await res.json(), opts) : [`version.json: HTTP ${res.status}`];
    } catch (err) {
      errors = [`version.json nicht abrufbar: ${(err as Error).message}`];
    }
    if (!errors.length) return ok(`version.json: Version ${opts.version}${opts.commit ? `, Commit ${opts.commit.slice(0, 7)}` : ''}`);
    if (attempt < 6) await sleep(10_000);
  }
  errors.forEach(fail);
}

async function launch(): Promise<Browser> {
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    return await chromium.launch({ channel: 'chrome' });
  } catch {
    return chromium.launch(); // Chromium of Playwright, if installed (`npx playwright-core install chromium`)
  }
}

/** Opens a page and collects script errors, console errors and failed requests (except the blocked statistics). */
async function openPage(browser: Browser, url: string): Promise<{ page: Page; errors: string[]; status: number }> {
  const context = await browser.newContext({ locale: 'de-DE' });
  await context.addInitScript(
    ([intro, optOut]) => {
      localStorage.setItem(intro, '1');
      localStorage.setItem(optOut, '1');
    },
    [INTRO_KEY, OPT_OUT_KEY],
  );
  await context.route((u) => isIgnoredUrl(u.toString()), (route) => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`Skriptfehler: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isIgnoredUrl(m.location().url)) errors.push(`Konsole: ${m.text()}`);
  });
  page.on('requestfailed', (r) => {
    if (!isIgnoredUrl(r.url())) errors.push(`Laden fehlgeschlagen: ${r.url()} (${r.failure()?.errorText ?? '?'})`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !isIgnoredUrl(r.url())) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  const res = await page.goto(url, { waitUntil: 'load' });
  return { page, errors, status: res?.status() ?? 0 };
}

async function step(name: string, fn: () => Promise<string | void>): Promise<void> {
  try {
    const detail = await fn();
    ok(detail ? `${name}: ${detail}` : name);
  } catch (err) {
    fail(`${name}: ${(err as Error).message.split('\n')[0]}`);
  }
}

async function checkCalculator(browser: Browser, opts: SmokeOptions): Promise<void> {
  const { page, errors, status } = await openPage(browser, opts.url);
  if (status !== 200) fail(`Rechner: HTTP ${status}`);

  await step('Versionsanzeige', async () => {
    const text = (await page.locator('#app-version').textContent({ timeout: TIMEOUT }))?.trim();
    if (text !== `Version ${opts.version}`) throw new Error(`„${text}“, erwartet „Version ${opts.version}“`);
    return text;
  });

  const kpi = page.locator('#kpis .kpi-value').first();
  await step('Kennzahlen berechnet', async () => {
    await page.waitForFunction(() => /\d.*€/.test(document.querySelector('#kpis .kpi-value')?.textContent ?? ''));
    return (await kpi.textContent())?.trim();
  });

  await step('Diagramm gezeichnet (Chart.js nachgeladen)', async () => {
    await page.waitForFunction(() =>
      [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-chart]')].some((c) => {
        if (!c.width || !c.height) return false;
        const data = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data;
        return !!data && data.some((v, i) => i % 4 === 3 && v > 0);
      }),
    );
  });

  await step('Neuberechnung nach Eingabe', async () => {
    const before = (await kpi.textContent())?.trim();
    const field = page.locator('#f-oldHeating-consumption');
    const value = Number((await field.inputValue()).replace(',', '.')) || 20000;
    await field.fill(String(Math.round(value * 1.5)));
    await field.dispatchEvent('change');
    await page.waitForFunction((b) => document.querySelector('#kpis .kpi-value')?.textContent?.trim() !== b, before);
    return `${before} → ${(await kpi.textContent())?.trim()}`;
  });

  await step('Quellenhinweis öffnet sich', async () => {
    const btn = page.locator('.info-btn:visible').first();
    await btn.click();
    const pop = page.locator(`#${await btn.getAttribute('aria-controls')}`);
    await pop.waitFor({ state: 'visible' });
    if (!(await pop.textContent())?.includes('Standard:')) throw new Error('kein Inhalt');
  });

  if (errors.length) errors.forEach((e) => fail(`Rechner – ${e}`));
  else ok('Rechner ohne Fehler in der Konsole');
  await page.context().close();
}

async function checkOtherPages(browser: Browser, opts: SmokeOptions): Promise<void> {
  let pages: string[] = [];
  await step('sitemap.xml', async () => {
    const res = await fetch(new URL('sitemap.xml', opts.url));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pages = sitemapPages(await res.text(), opts.url);
    return `${pages.length} weitere Seiten`;
  });
  for (const url of pages) {
    const name = new URL(url).pathname;
    const { page, errors, status } = await openPage(browser, url);
    try {
      if (status !== 200) throw new Error(`HTTP ${status}`);
      const heading = (await page.locator('h1').first().textContent({ timeout: TIMEOUT }))?.trim();
      if (!heading) throw new Error('keine Überschrift');
      if (name.endsWith('/changelog.html') && !(await page.locator('main, body').first().textContent())?.includes(opts.version))
        throw new Error(`Version ${opts.version} fehlt im Changelog`);
      if (errors.length) throw new Error(errors.join('; '));
      ok(`${name}: ${heading}`);
    } catch (err) {
      fail(`${name}: ${(err as Error).message}`);
    } finally {
      await page.context().close();
    }
  }
}

async function main(): Promise<void> {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
  const opts = parseArgs(process.argv.slice(2), pkg.version);
  console.log(`Prüfe ${opts.url} (erwartet Version ${opts.version})`);
  await checkVersionFile(opts);
  const browser = await launch();
  try {
    await checkCalculator(browser, opts);
    await checkOtherPages(browser, opts);
  } finally {
    await browser.close();
  }
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    appendFileSync(
      summary,
      failures.length
        ? `### ✗ Prüfung nach dem Deployment fehlgeschlagen\n${failures.map((f) => `- ${f}`).join('\n')}\n`
        : `### ✓ Version ${opts.version} ausgeliefert, Rechner funktioniert\n${opts.url}\n`,
    );
  }
  if (failures.length) {
    console.log(`\n${failures.length} Prüfung(en) fehlgeschlagen.`);
    process.exitCode = 1;
  } else console.log('\nAlle Prüfungen bestanden.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

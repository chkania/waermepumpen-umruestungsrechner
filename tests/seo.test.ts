import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const BASE = 'https://waermepumpen-investitionsrechner.de/';
const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const pages = readdirSync(root).filter((f) => f.endsWith('.html'));
const urlOf = (page: string) => BASE + (page === 'index.html' ? '' : page);

describe('N13 Suchmaschinen: kanonische Adresse, robots.txt, Sitemap', () => {
  it('jede Seite verweist auf ihre Adresse unter der Hauptdomain', () => {
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      const links = [...read(page).matchAll(/<link rel="canonical" href="([^"]+)" \/>/g)].map((m) => m[1]);
      expect(links, page).toEqual([urlOf(page)]);
    }
  });

  it('robots.txt erlaubt alles und nennt die Sitemap', () => {
    const robots = read('public/robots.txt');
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/^Disallow: \/\s*$/m);
    expect(robots).toContain(`Sitemap: ${BASE}sitemap.xml`);
  });

  it('Sitemap enthält genau alle Seiten', () => {
    const locs = [...read('public/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.sort()).toEqual(pages.map(urlOf).sort());
  });
});

describe('F33 Inhalt für Suchmaschinen und Linkvorschauen', () => {
  const index = read('index.html');
  // Plain text of an HTML fragment. Tags are removed until none are left, so nested fragments cannot survive as markup.
  const text = (html: string) => {
    let t = html;
    let previous: string;
    do {
      previous = t;
      t = t.replace(/<[^<>]*>/g, ' ');
    } while (t !== previous);
    return t.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
  };

  it('F33.1 Rechner ohne JavaScript: Überschrift, Text und Links zu allen Seiten im HTML', () => {
    const app = /<div id="app">([\s\S]*?)<\/div>\s*<script/.exec(index)![1];
    expect(app).toMatch(/<h1>Wärmepumpen-Investitionsrechner<\/h1>/);
    expect((app.match(/<h2[ >]/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(text(app).split(' ').length).toBeGreaterThanOrEqual(400);
    for (const page of pages.filter((p) => p !== 'index.html' && p !== 'lizenzen-drittanbieter.html')) expect(app, page).toContain(`href="./${page}"`);
    expect(app).toContain('<noscript>');
    expect(read('rechenweg.html')).toMatch(/<div id="doc">\s*<main class="static-intro">\s*<h1>Rechenweg<\/h1>/);
  });

  it('F33.3 Titel und Beschreibung: aussagekräftig, nicht zu lang, je Seite verschieden; Rechner setzt denselben Titel', async () => {
    const { PAGE_TITLE } = await import('../src/project');
    const titles = pages.map((p) => /<title>([^<]+)<\/title>/.exec(read(p))![1]);
    expect(new Set(titles).size).toBe(pages.length);
    expect(titles[pages.indexOf('index.html')]).toBe(PAGE_TITLE);
    expect(PAGE_TITLE.length).toBeLessThanOrEqual(65);
    expect(PAGE_TITLE).toMatch(/Wärmepumpe.*KfW/);
    for (const p of pages) {
      const d = /<meta name="description" content="([^"]+)"/.exec(read(p))?.[1];
      expect(d, p).toBeTruthy();
      expect(d!.length, p).toBeLessThanOrEqual(160);
    }
  });

  it('F33.4 Linkvorschau (Open Graph) und strukturierte Daten', () => {
    const og = (k: string) => new RegExp(`<meta property="og:${k}" content="([^"]+)"`).exec(index)?.[1];
    expect(og('title')).toBe(/<title>([^<]+)<\/title>/.exec(index)![1]);
    expect(og('url')).toBe(BASE);
    expect(og('image')).toBe(`${BASE}og-image.png`);
    expect(index).toContain('<meta name="twitter:card" content="summary_large_image" />');
    // the image exists locally with the declared size (PNG header: width/height at bytes 16–23)
    const png = readFileSync(join(root, 'public/og-image.png'));
    expect(png.readUInt32BE(16)).toBe(Number(og('image:width')));
    expect(png.readUInt32BE(20)).toBe(Number(og('image:height')));
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(index)![1]);
    expect(ld).toMatchObject({ '@context': 'https://schema.org', '@type': 'WebApplication', url: BASE, isAccessibleForFree: true, inLanguage: 'de' });
    expect(ld.offers.price).toBe('0');
    expect(ld.author).toEqual({ '@type': 'Person', name: 'Christoph Kania', sameAs: ['https://github.com/chkania'] });
  });

  it('F33.2 Dokumentseiten werden beim Build mit Inhalt vorgerendert', async () => {
    const { prerenderDocPage } = await import('../prerender');
    const { DOC_PAGES } = await import('../src/pages/doc-pages');
    for (const [file, config] of Object.entries(DOC_PAGES)) {
      const out = prerenderDocPage(read(file), file, read);
      const container = new RegExp(`<div id="${config.element}">([\\s\\S]*)</div>\\s*<script`).exec(out)![1];
      expect(container, file).toMatch(/<h1>[^<]+<\/h1>/);
      expect(text(container).length, file).toBeGreaterThan(500);
      expect(container, file).toContain(`<a href="./${file}" aria-current="page">`);
      expect((container.match(/aria-current="page"/g) ?? []).length, file).toBe(1);
    }
    expect(Object.keys(DOC_PAGES).sort()).toEqual(pages.filter((p) => !['index.html', 'rechenweg.html'].includes(p)).sort());
    expect(prerenderDocPage('<div id="app"></div>', 'index.html', read)).toBe('<div id="app"></div>');
    expect(() => prerenderDocPage('<body></body>', 'hilfe.html', read)).toThrow('Container');
    // "$" in the content is kept as written
    expect(prerenderDocPage('<div id="doc"></div>', 'impressum.html', () => '# T\n\nPreis $& und $1')).toContain('Preis $&amp; und $1');
  });
});

describe('F33.5 Struktur und Links der statischen Einführung', () => {
  const index = read('index.html');
  const intro = /<main class="static-intro">([\s\S]*?)<\/main>/.exec(index)![1];

  it('Überschriften, Liste, Bild mit Alternativtext und Gliederungselemente', () => {
    expect((intro.match(/<h3>/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(intro).toMatch(/<h2 id="static-answers">Was der Rechner beantwortet<\/h2>/);
    expect((intro.match(/<ol>[\s\S]*?<\/ol>/)?.[0].match(/<li>/g) ?? []).length).toBe(4);
    expect(intro).toMatch(/<img class="static-logo" src="\.\/favicon\.svg"[^>]*alt="[^"]+"/);
    expect(intro).toContain('<header class="static-head">');
    expect((intro.match(/<section /g) ?? []).length).toBe(4);
    expect(intro).toContain('<footer class="static-foot">');
  });

  it('jeder Link der Einführung hat einen Titel; interne Ziele mit Anker existieren im Handbuch', async () => {
    const links = [...intro.matchAll(/<a href="([^"]+)"([^>]*)>/g)];
    expect(links.length).toBeGreaterThanOrEqual(10);
    for (const [, href, attrs] of links) expect(attrs, href).toContain('title="');
    const { renderHelp } = await import('../src/help');
    const { toc } = renderHelp(read('docs/BENUTZERHANDBUCH.md'));
    const ids = new Set(toc.map((t) => t.id));
    const anchors = links.map((l) => l[1]).filter((h) => h.startsWith('./hilfe.html#')).map((h) => h.split('#')[1]);
    expect(anchors.length).toBeGreaterThanOrEqual(5);
    for (const a of anchors) expect(ids.has(a), a).toBe(true);
  });

  it('Hell/Dunkel-Skript liegt als eigene Datei vor; kein Inline-Skript mehr auf den Seiten', () => {
    expect(read('public/theme-init.js')).toContain("localStorage.getItem('wp-investitionsrechner:theme')");
    for (const p of pages) {
      const html = read(p);
      expect(html, p).toContain('<script src="./theme-init.js"></script>');
      expect(html, p).not.toMatch(/<script>(?![\s\S]*?<\/script>[\s\S]*?type="module")[\s\S]*?localStorage/);
    }
  });
});

describe('F33.7 Externe Quellen der Einführung', () => {
  const index = read('index.html');
  const intro = /<main class="static-intro">([\s\S]*?)<\/main>/.exec(index)![1];

  it('externe Links öffnen in neuem Tab mit noopener und nennen die Quelle im Titel', () => {
    const external = [...intro.matchAll(/<a href="(https:\/\/[^"]+)"([^>]*)>/g)];
    expect(external.length).toBeGreaterThanOrEqual(4);
    for (const [, href, attrs] of external) {
      expect(attrs, href).toContain('target="_blank"');
      expect(attrs, href).toContain('rel="noopener"');
      expect(attrs, href).toMatch(/title="[^"]*öffnet in neuem Tab\)/);
    }
  });

  it('die Quellen entsprechen den Adressen, die der Rechner selbst angibt (sources.ts)', () => {
    const sources = read('src/core/sources.ts');
    for (const url of [
      'https://www.gesetze-im-internet.de/estg/__35c.html',
      'https://www.umweltbundesamt.de/themen/co2-emissionen-pro-kilowattstunde-strom-2025-nur',
      'https://www.kfw.de/PDF/Download-Center/F%C3%B6rderprogramme-(Inlandsf%C3%B6rderung)/PDF-Dokumente/6000005131_M_458.pdf',
    ]) {
      expect(index, url).toContain(url);
      expect(sources, url).toContain(url);
    }
  });

  it('die Zahl im Text stimmt mit dem Standardwert des Strommixes überein', async () => {
    const { defaults } = await import('../src/core/defaults').then((m) => ({ defaults: m.createDefaults }));
    const d = defaults(new Date(2026, 10, 11));
    expect(d.prices.gridCo2Path).toContain('2025:344');
    expect(intro).toContain('344 Gramm je Kilowattstunde');
  });
});

describe('F33.8 llms.txt', () => {
  const llms = read('public/llms.txt');

  it('beginnt mit Titel und Kurzbeschreibung, nennt alle Seiten mit absoluter Adresse', () => {
    expect(llms.startsWith('# Wärmepumpen-Investitionsrechner\n')).toBe(true);
    expect(llms).toMatch(/^> .+/m);
    const locs = pages.map(urlOf).filter((u) => !u.endsWith('lizenzen-drittanbieter.html'));
    for (const u of locs) expect(llms, u).toContain(`(${u})`);
  });

  it('verlinkt nur https-Adressen der eigenen Domain oder bekannte Quellen', () => {
    const links = [...llms.matchAll(/\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThanOrEqual(10);
    for (const l of links) expect(l.startsWith('https://')).toBe(true);
    expect(links.filter((l) => l.startsWith(BASE)).length).toBeGreaterThanOrEqual(7);
  });
});

describe('F33.9 Keine Inhaltswechsel beim Laden', () => {
  it('theme-init.js setzt die Klasse js vor der ersten Anzeige; CSS blendet die Einführung dann aus', () => {
    expect(read('public/theme-init.js')).toContain("html.classList.add('js')");
    expect(read('src/style.css')).toMatch(/\.js \.static-intro \{ display: none; \}/);
    for (const p of ['index.html', 'rechenweg.html']) expect(read(p), p).toContain('<script src="./theme-init.js"></script>');
  });
});

describe('F33.10 Schrift vorladen, Bild mit Titel, JSON-LD ohne Sonderzeichen', () => {
  it('preloadFontHtml setzt den Link vor </head>, nur wenn die Schrift im Build liegt', async () => {
    const { preloadFontHtml } = await import('../prerender');
    const head = '<html><head><title>x</title></head><body></body></html>';
    const out = preloadFontHtml(head, ['assets/main.js', 'assets/inter-latin-wght-normal-Dx4kXJAl.woff2']);
    expect(out).toContain('<link rel="preload" href="./assets/inter-latin-wght-normal-Dx4kXJAl.woff2" as="font" type="font/woff2" crossorigin />');
    expect(out.indexOf('rel="preload"')).toBeLessThan(out.indexOf('</head>'));
    expect(preloadFontHtml(head, ['assets/main.js'])).toBe(head);
  });

  it('Bild der Einführung hat Titel und Alternativtext; JSON-LD nur mit ASCII-Zeichen', () => {
    const index = read('index.html');
    expect(index).toMatch(/<img class="static-logo"[^>]*title="Wärmepumpen-Investitionsrechner"/);
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(index)![1];
    expect(/[^\x00-\x7F]/.test(ld)).toBe(false);
    expect(JSON.parse(ld).description).toContain('für');
  });

  it('Cache-Regel für theme-init.js im .htaccess', () => {
    expect(read('public/.htaccess')).toContain('"^theme-init\\.js$"');
    expect(read('public/.htaccess')).toContain('Header set Cache-Control "public, max-age=86400"');
  });
});

describe('F39 Weg zum Angebot und zur Förderung', () => {
  const md = read('docs/ANGEBOT.md');
  // Plain text of an HTML fragment (tags removed until none are left)
  const plainText = (html: string) => {
    let t = html;
    let previous: string;
    do {
      previous = t;
      t = t.replace(/<[^<>]*>/g, ' ');
    } while (t !== previous);
    return t.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
  };
  const allowedHosts = ['www.kfw.de', 'verbraucherzentrale-energieberatung.de', 'www.energie-effizienz-experten.de'];
  const allowedNumbers = ['1', '2', '3', '4', '5', '6', '20', '458'];

  it('F39.1 Quelltext: mindestens 600 Wörter, Ansprache mit „Sie“', () => {
    const words = md.replace(/<[^>]+>/g, ' ').split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w));
    expect(words.length).toBeGreaterThanOrEqual(600);
    expect(md).not.toMatch(/\b(du|dein|deine|dir|dich|euch)\b/i);
  });

  it('F39.1/F33.2 angebot.html ist eine Dokumentseite mit Titel, Canonical und Beschreibung; Container enthält kein Formular', async () => {
    const html = read('angebot.html');
    expect(html).toContain('<title>Weg zum Angebot und zur Förderung – Wärmepumpen-Investitionsrechner</title>');
    expect(html).toContain('<link rel="canonical" href="https://waermepumpen-investitionsrechner.de/angebot.html" />');
    expect(html).toContain('<div id="doc"></div>');
    expect(html).toContain('<script src="./theme-init.js"></script>');
    const { prerenderDocPage } = await import('../prerender');
    const { DOC_PAGES } = await import('../src/pages/doc-pages');
    expect(DOC_PAGES['angebot.html'].element).toBe('doc');
    const out = prerenderDocPage(html, 'angebot.html', read);
    const container = /<div id="doc">([\s\S]*)<\/div>\s*<script/.exec(out)![1];
    expect(container).not.toMatch(/<(input|select|textarea|form)[\s>]/);
  });

  it('F39.2 genau ein h1 und sechs h2 in der Reihenfolge der Anforderung; Hinweis vor dem ersten h2', async () => {
    const { prerenderDocPage } = await import('../prerender');
    const out = prerenderDocPage(read('angebot.html'), 'angebot.html', read);
    const container = /<div id="doc">([\s\S]*)<\/div>\s*<script/.exec(out)![1];
    expect((container.match(/<h1[ >]/g) ?? []).length).toBe(1);
    expect(container).toMatch(/<h1>Weg zum Angebot und zur Förderung<\/h1>/);
    const main = /<main class="help-content">([\s\S]*?)<\/main>/.exec(container)![1];
    expect((main.match(/<h2[ >]/g) ?? []).length).toBe(6);
    const titles = [...main.matchAll(/<h2 id="[^"]+"><a[^>]*>#<\/a>([^<]+)<\/h2>/g)].map((m) => m[1]);
    expect(titles).toEqual([
      'Ergebnis sichern',
      'Unterlagen für den Termin',
      'Angebote einholen und prüfen',
      'Förderung beantragen',
      'Installation',
      'Abnahme',
    ]);
    // every step is a list
    for (const part of main.split(/<h2[ >]/).slice(1)) expect(part.split('</ul>')[0], 'Checkliste').toMatch(/<ul>\s*<li>/);
  });

  it('F39.7 Hinweis vor dem ersten Schritt, ohne Überschrift, mit Stand der Förderbedingungen', async () => {
    const { DOC_PAGES } = await import('../src/pages/doc-pages');
    const { FUNDING_SOURCE_DATE } = await import('../src/core/defaults');
    const intro = DOC_PAGES['angebot.html'].page.intro!;
    expect(intro).not.toMatch(/<h[1-6][ >]/);
    const text = plainText(intro);
    expect(text).toContain('keine Finanz-, Steuer- oder Förderberatung');
    expect(text).toContain('Sie prüft keine Angebote und keine Förderanträge');
    expect(text).toContain('Angaben ohne Gewähr');
    expect(text).toContain(`Förderbedingungen Stand ${FUNDING_SOURCE_DATE.split('-').reverse().join('.')}`);
    expect(text).toMatch(/Stand \d{2}\.\d{2}\.\d{4}/);
    expect(text).toContain('Datenschutzbestimmungen');
  });

  it('F39.4 externe Links: nur erlaubte Hosts, target, rel und Titel nach F33.7; keine weiteren Adressen', async () => {
    const { prerenderDocPage } = await import('../prerender');
    const out = prerenderDocPage(read('angebot.html'), 'angebot.html', read);
    const main = /<main class="help-content">([\s\S]*?)<\/main>/.exec(out)![1];
    const links = [...main.matchAll(/<a href="(https:\/\/[^"]+)"([^>]*)>/g)];
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const [, href, attrs] of links) {
      expect(allowedHosts, href).toContain(new URL(href).hostname);
      expect(attrs, href).toContain('target="_blank"');
      expect(attrs, href).toContain('rel="noopener"');
      expect(attrs, href).toMatch(/title="[^"]*\(öffnet in neuem Tab\)"/);
    }
    // nothing else is loaded or linked (no embeds, no private guides)
    expect([...main.matchAll(/https?:\/\/[^"\s<]+/g)].length).toBe(links.length);
    expect(md).not.toMatch(/src=|<iframe|<img|<script/);
  });

  it('F39.3/F39.2 Ziffern im Quelltext nur aus der erlaubten Liste (A8), außerhalb von href', () => {
    const body = md.replace(/href="[^"]*"/g, '');
    const numbers = body.match(/\d+/g) ?? [];
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.filter((n) => !allowedNumbers.includes(n))).toEqual([]);
  });

  it('F39.6 Druck: Druckregel gilt nur für den Rechner; Dokumentseiten (#doc, #help) setzen im Druck helle Tokens, der Bericht-Block bleibt unverändert', () => {
    const css = read('src/style.css');
    expect(css).toContain('body > :not(.report):not(#doc):not(#help) { display: none !important; }');
    expect(css).not.toContain('body > :not(.report) { display: none !important; }');
    const print = /@media print \{([\s\S]*?)\n\}\n/.exec(css)![1];
    // light tokens only for the document pages, not for the root (so the report keeps its look)
    const docBlock = /#doc, #help \{([^}]*)\}/.exec(print)![1];
    expect(docBlock).toMatch(/--bg: [^;]+ !important;/);
    expect(docBlock).toMatch(/--c-text: [^;]+ !important;/);
    // text and background of the document pages are set on the container itself (inherited colour of body is dark)
    expect(docBlock).toMatch(/(^|\s)color: var\(--c-text\) !important;/);
    expect(docBlock).toMatch(/(^|\s)background: var\(--bg\) !important;/);
    expect(print).not.toMatch(/(^|\s):root \{\s*--bg/);
    expect(print).toMatch(/\.report \{\s*display: block;/);
    expect(print).toContain('.help-toc, .help-top .toolbar { display: none !important; }');
  });

  it('F39.2 Förderung beantragen: Reihenfolge BzA → Liefervertrag → Antrag → Umsetzung nach der Zusage', () => {
    const section = /## Förderung beantragen([\s\S]*?)## Installation/.exec(md)![1];
    const at = (s: string) => section.indexOf(s);
    expect(at('Bestätigung zum Antrag')).toBeGreaterThanOrEqual(0);
    expect(at('Bestätigung zum Antrag')).toBeLessThan(at('Leistungsvertrag'));
    expect(at('Leistungsvertrag')).toBeLessThan(at('Meine KfW'));
    expect(at('Meine KfW')).toBeLessThan(at('nach der Zusage'));
  });

  it('F39.5/F33 Auffindbarkeit: Sitemap, llms.txt und statische Einführung verlinken die Seite', () => {
    expect(read('public/sitemap.xml')).toContain('https://waermepumpen-investitionsrechner.de/angebot.html');
    expect(read('public/llms.txt')).toContain('(https://waermepumpen-investitionsrechner.de/angebot.html)');
    expect(read('index.html')).toMatch(/<a href="\.\/angebot\.html" title="[^"]+">/);
  });
});

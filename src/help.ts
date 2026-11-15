import { marked } from 'marked';

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Creates a URL-safe ID from a German heading. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[<>]/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Renders the manual (Markdown) to HTML with anchor IDs and table of contents (F15). */
export function renderHelp(markdown: string): { html: string; toc: TocEntry[]; title: string } {
  let html = marked.parse(markdown, { async: false, gfm: true }) as string;
  const toc: TocEntry[] = [];
  const used = new Set<string>();
  let title = '';
  html = html.replace(/<h([1-3])>([\s\S]*?)<\/h\1>/g, (_m, lvl: string, inner: string) => {
    const level = Number(lvl);
    const text = inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    if (level === 1) {
      title = text;
      return `<h1>${inner}</h1>`;
    }
    let id = slugify(text) || 'abschnitt';
    for (let n = 2; used.has(id); n++) id = `${slugify(text)}-${n}`;
    used.add(id);
    toc.push({ id, text, level: level as 2 | 3 });
    return `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${inner}</h${level}>`;
  });
  // Make tables scrollable (mobile)
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
  return { html, toc, title };
}

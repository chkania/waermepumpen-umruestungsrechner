import { describe, expect, it } from 'vitest';
import { calculatorUrl, RECOMMEND_SUBJECT, RECOMMEND_TEXT, recommendLinks, SHARE_BASE, shareBaseUrl } from '../src/ui/share';

const shared = 'https://rechner.example.de/index.html?probe=1#s=eyJidWlsZGluZyI6eyJob3VzZWhvbGRJbmNvbWUiOjk5OTk5fX0';

describe('F21 Weiterempfehlen', () => {
  it('teilt nur die Adresse des Rechners, nie die eigenen Eingaben', () => {
    expect(calculatorUrl(shared)).toBe('https://rechner.example.de/');
    expect(calculatorUrl('https://example.de/tools/rechner/')).toBe('https://example.de/tools/rechner/');
    const l = recommendLinks(shared);
    for (const v of Object.values(l)) {
      expect(v).not.toContain('eyJ'); // base64 of the inputs
      expect(v).not.toContain('probe');
    }
  });

  it('WhatsApp und Threema mit vorbelegtem Text samt Adresse', () => {
    const l = recommendLinks(shared);
    expect(l.whatsapp.startsWith('whatsapp://send?text=')).toBe(true);
    expect(l.threema.startsWith('https://threema.id/compose?text=')).toBe(true);
    for (const link of [l.whatsapp, l.threema]) {
      const text = new URLSearchParams(link.slice(link.indexOf('?') + 1)).get('text')!;
      // single line – WhatsApp desktop drops text before a line break
      expect(text).toBe(`${RECOMMEND_TEXT} https://rechner.example.de/`);
      expect(text).not.toContain('\n');
    }
  });

  it('E-Mail: mailto mit Betreff und Text, Leerzeichen als %20 (RFC 6068)', () => {
    const { email } = recommendLinks(shared);
    expect(email.startsWith('mailto:?subject=')).toBe(true);
    expect(email).not.toContain('+');
    const params = new URLSearchParams(email.slice('mailto:?'.length));
    expect(params.get('subject')).toBe(RECOMMEND_SUBJECT);
    expect(params.get('body')).toContain(RECOMMEND_TEXT);
    expect(params.get('body')).toContain('https://rechner.example.de/');
  });

  it('keine Links zu Facebook oder X', () => {
    expect(JSON.stringify(recommendLinks(shared))).not.toMatch(/facebook|twitter|x\.com/);
  });
});

describe('F9.2 Link mit Werten: kurze Domain', () => {
  it('Links mit Eingaben zeigen auf wpir.de, lokal auf die eigene Adresse', () => {
    expect(SHARE_BASE).toBe('https://wpir.de/');
    expect(shareBaseUrl('https://waermepumpen-investitionsrechner.de/index.html?x=1#z=abc')).toBe(SHARE_BASE);
    expect(shareBaseUrl('https://www.waermepumpen-umruestungsrechner.de/')).toBe(SHARE_BASE);
    expect(shareBaseUrl('http://localhost:5173/#z=abc')).toBe('http://localhost:5173/');
    expect(shareBaseUrl('http://127.0.0.1:4173/index.html')).toBe('http://127.0.0.1:4173/');
    expect(shareBaseUrl('http://[::1]:4173/')).toBe('http://[::1]:4173/');
    expect(shareBaseUrl('http://rechner.localhost/')).toBe('http://rechner.localhost/');
    expect(shareBaseUrl('http://localhost.example.de/')).toBe(SHARE_BASE);
  });
});

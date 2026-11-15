/**
 * SourceFetcher: HTTP-Abrufe mit Caching, Retry und Fehlerbehandlung
 * 
 * Features:
 * - 3× Retry mit exponentiellem Backoff (1s, 2s, 4s)
 * - 30s Timeout (konfigurierbar)
 * - In-Memory Cache mit 1h TTL
 * - Aussagekräftige Fehler bei Timeout, DNS, HTTP-Fehler
 */

interface CacheEntry {
  data: string;
  timestamp: number;
  ttlMs: number;
}

export interface FetchOptions {
  timeout?: number; // ms, default 30000
  format?: 'text' | 'json'; // default 'text'
  cacheTtlMs?: number; // default 3600000 (1h)
  noCache?: boolean; // ignore cache
}

export class SourceFetcher {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly defaultTimeout = 30000; // 30s
  private readonly defaultCacheTtl = 3600000; // 1h

  async fetch(
    url: string,
    options: FetchOptions = {}
  ): Promise<string> {
    const { timeout = this.defaultTimeout, cacheTtlMs = this.defaultCacheTtl, noCache = false } = options;

    // Prüfe Cache
    if (!noCache && this.cache.has(url)) {
      const entry = this.cache.get(url)!;
      if (Date.now() - entry.timestamp < entry.ttlMs) {
        console.log(`[Fetcher] Cache hit: ${url}`);
        return entry.data;
      } else {
        // Abgelaufen
        this.cache.delete(url);
      }
    }

    // Fetch mit Retry-Logik
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const backoffMs = attempt === 0 ? 0 : Math.pow(2, attempt) * 1000; // 0, 1000, 2000, 4000
        if (attempt > 0) {
          console.log(`[Fetcher] Retry ${attempt}/${maxRetries - 1} für ${url} (wait ${backoffMs}ms)`);
          await new Promise(r => setTimeout(r, backoffMs));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'WP-Investitionsrechner-Agent/1.0 (https://github.com/christophkania/wpinvestitionsrechner)',
            },
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.text();

          // In Cache speichern
          this.cache.set(url, {
            data,
            timestamp: Date.now(),
            ttlMs: cacheTtlMs,
          });

          return data;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Spezifische Fehlertypen
        if (lastError.name === 'AbortError') {
          lastError = new Error(`Timeout nach ${timeout}ms`);
        }
        if (lastError.message.includes('ENOTFOUND') || lastError.message.includes('getaddrinfo')) {
          lastError = new Error(`DNS-Fehler: ${url}`);
        }

        if (attempt === maxRetries - 1) {
          // Letzer Versuch gescheitert
          throw new Error(
            `Konnte nicht abrufen nach ${maxRetries} Versuchen: ${url}\n` +
            `Letzter Fehler: ${lastError.message}`
          );
        }
      }
    }

    // Falls wir hier ankommen: sollte nicht passieren
    throw lastError || new Error('Unbekannter Fehler beim Abrufen');
  }

  /** Cache manuell löschen */
  clearCache(url?: string) {
    if (url) {
      this.cache.delete(url);
    } else {
      this.cache.clear();
    }
  }

  /** Cache-Statistik (für Testing/Debugging) */
  getCacheStats() {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.data.length;
    }
    return {
      entries: this.cache.size,
      totalSizeBytes: totalSize,
    };
  }
}

export const globalFetcher = new SourceFetcher();

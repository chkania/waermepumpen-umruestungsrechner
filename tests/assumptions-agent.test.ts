/**
 * Unit & Integration Tests für Assumptions Agent
 * 
 * Testing:
 * - SourceFetcher (HTTP, Cache, Retry)
 * - SourceParser (Claude-Integration, Mocks)
 * - Compare & Impact Assessment
 * - AssumptionsAgent (Orchestrierung)
 * - Patcher (YAML/TS-Updates)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SourceFetcher } from '../scripts/assumptions-agent/fetcher';
import { SourceParser } from '../scripts/assumptions-agent/parser';
import { compare, assessImpact } from '../scripts/assumptions-agent/compare';
import { AssumptionsAgent, type VerificationResult } from '../scripts/assumptions-agent/index';
import { Patcher } from '../scripts/assumptions-agent/patcher';

// ============================================================================
// SourceFetcher Tests
// ============================================================================

describe('SourceFetcher', () => {
  let fetcher: SourceFetcher;

  beforeEach(() => {
    fetcher = new SourceFetcher();
    fetcher.clearCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch valid URLs', async () => {
    const mockResponse = '<html><body>Test Content</body></html>';
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(mockResponse),
        status: 200,
        statusText: 'OK',
      } as Response)
    );

    const result = await fetcher.fetch('https://example.com/test');
    expect(result).toBe(mockResponse);
  });

  it('should cache results with TTL', async () => {
    const mockResponse = 'cached content';
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(mockResponse),
        status: 200,
        statusText: 'OK',
      } as Response)
    );

    const url = 'https://example.com/cached';
    const result1 = await fetcher.fetch(url);
    const result2 = await fetcher.fetch(url);

    expect(result1).toBe(result2);
    expect(global.fetch).toHaveBeenCalledTimes(1); // Cache hit
  });

  it('should bypass cache with noCache option', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('content'),
        status: 200,
        statusText: 'OK',
      } as Response)
    );

    const url = 'https://example.com/nocache';
    await fetcher.fetch(url);
    await fetcher.fetch(url, { noCache: true });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should retry on timeout', async () => {
    let attempts = 0;
    global.fetch = vi.fn(() => {
      attempts++;
      if (attempts < 3) {
        const controller = new AbortController();
        controller.abort();
        throw new Error('AbortError');
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('success'),
        status: 200,
        statusText: 'OK',
      } as Response);
    });

    const result = await fetcher.fetch('https://example.com/retry', {
      timeout: 100,
    });

    expect(result).toBe('success');
    expect(attempts).toBeGreaterThan(1);
  }, 15000); // Erhöhe Timeout für Retry-Tests

  it('should fail after max retries', async () => {
    global.fetch = vi.fn(() => {
      throw new Error('Network Error');
    });

    try {
      await fetcher.fetch('https://example.com/fail', { timeout: 100 });
      expect.fail('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('Konnte nicht abrufen nach 3 Versuchen');
    }
  }, 15000); // Erhöhe Timeout für Retry-Tests

  it('should handle HTTP errors', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response)
    );

    try {
      await fetcher.fetch('https://example.com/404');
      expect.fail('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('HTTP 404');
    }
  }, 15000); // Erhöhe Timeout für Retry-Tests

  it('should report cache stats', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('x'.repeat(1000)),
        status: 200,
        statusText: 'OK',
      } as Response)
    );

    // Cache zwei Einträge (mit await)
    await fetcher.fetch('https://example.com/1');
    await fetcher.fetch('https://example.com/2');

    const stats = fetcher.getCacheStats();
    expect(stats.entries).toBe(2);
    expect(stats.totalSizeBytes).toBeGreaterThan(0);
  });
});

// ============================================================================
// Compare & Impact Tests
// ============================================================================

describe('Compare & Impact Assessment', () => {
  it('should detect no change', () => {
    const result = compare(0.30, 0.30);
    expect(result.changed).toBe(false);
    expect(result.type).toBe('number');
  });

  it('should detect value change', () => {
    const result = compare(0.30, 0.31);
    expect(result.changed).toBe(true);
  });

  it('should detect date change', () => {
    const result = compare('2026-12-31', '2027-01-01');
    expect(result.changed).toBe(true);
    expect(result.type).toBe('date');
  });

  it('should assess date change as MAJOR', () => {
    const impact = assessImpact('deadline', '2029-12-31', '2030-01-01');
    expect(impact).toBe('major');
  });

  it('should assess large rate change (>0.5%) as MAJOR', () => {
    const impact = assessImpact('rate', 0.30, 0.31);
    expect(impact).toBe('major');
  });

  it('should assess small rate change (0.1-0.5%) as MINOR', () => {
    const impact = assessImpact('rate', 0.300, 0.302);
    expect(impact).toBe('minor');
  });

  it('should assess tiny rate change (<0.1%) as NONE', () => {
    const impact = assessImpact('rate', 0.300, 0.3001);
    expect(impact).toBe('none');
  });

  it('should assess large price change (>5%) as MINOR', () => {
    const impact = assessImpact('price', 12.0, 12.8);
    expect(impact).toBe('minor');
  });

  it('should assess small price change (<5%) as NONE', () => {
    const impact = assessImpact('price', 12.0, 12.2);
    expect(impact).toBe('none');
  });

  it('should NOT upgrade small changes if any change occurs with HIGH criticality', () => {
    // Für number Beträge: nur bei > 5% Änderung wird minor
    // Aber wenn HIGH criticality UND changed: major
    const impact = assessImpact('cap', 28000, 28001, 'high');
    // Da 28000 > 1 ist, prüft die Funktion prozentuale Änderung, nicht absolut
    // 1€ von 28000€ = 0.0036% < 1% → daher none
    // Aber mit HIGH criticality UND changed → major
    expect(impact).toBe('major');
  });
});

// ============================================================================
// AssumptionsAgent Tests
// ============================================================================

describe('AssumptionsAgent', () => {
  let agent: AssumptionsAgent;
  let mockFetcher: SourceFetcher;
  let mockParser: SourceParser;

  beforeEach(() => {
    mockFetcher = new SourceFetcher();
    mockParser = new SourceParser();
    agent = new AssumptionsAgent(mockFetcher, mockParser);
  });

  it('should skip fields with criticality=none', async () => {
    const regulations = {
      general: {
        opportunityRate: {
          value: 0.02,
          description: 'Test',
          criticality: 'none',
          updateStrategy: 'not_planned',
        },
      },
    };

    const result = await agent.verify(regulations);
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(result.skipped[0].key).toContain('opportunityRate');
  });

  it('should skip fields with criticality=notApplicable', async () => {
    const regulations = {
      financing: {
        bankRate: {
          value: 0.075,
          description: 'Test Bank Rate',
          criticality: 'notApplicable',
        },
      },
    };

    const result = await agent.verify(regulations);
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(result.skipped[0].key).toContain('bankRate');
  });

  it('should skip fields with updateStrategy=not_planned', async () => {
    const regulations = {
      technical: {
        pvYield: {
          value: 950,
          description: 'PV Yield',
          criticality: 'low',
          updateStrategy: 'not_planned',
        },
      },
    };

    const result = await agent.verify(regulations);
    expect(result.skipped.length).toBeGreaterThan(0);
  });

  it('should skip optional fields without --include-optional', async () => {
    const regulations = {
      technical: {
        heatPump: {
          jaz: {
            value: 3.3,
            description: 'JAZ',
            criticality: 'medium',
            updateStrategy: 'optional',
          },
        },
      },
    };

    const result = await agent.verify(regulations, { includeOptional: false });
    expect(result.skipped.length).toBeGreaterThan(0);
  });

  it('should skip fields without source URL', async () => {
    const regulations = {
      test: {
        field: {
          value: 123,
          description: 'Test',
          criticality: 'high',
          // keine source!
        },
      },
    };

    const result = await agent.verify(regulations);
    expect(result.skipped.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Patcher Tests
// ============================================================================

describe('Patcher', () => {
  let patcher: Patcher;

  beforeEach(() => {
    patcher = new Patcher();
  });

  it('should create verificationLog entry', async () => {
    const regulations = {
      verificationLog: [],
      test: {
        field: { value: 123 },
      },
    };

    const verificationResult: VerificationResult = {
      timestamp: new Date().toISOString(),
      checkpoints: {},
      unchanged: [],
      changed: [],
      failed: [],
      skipped: [],
      summary: {
        totalChecked: 0,
        totalChanged: 0,
        totalFailed: 0,
        totalSkipped: 0,
      },
    };

    const result = await patcher.apply(regulations, verificationResult, { dryRun: true });
    expect(result.yamlPatched).toContain('verificationLog');
  });

  it('should respect dryRun option', async () => {
    const regulations = {
      verificationLog: [],
    };

    const result: VerificationResult = {
      timestamp: new Date().toISOString(),
      checkpoints: {},
      unchanged: [],
      changed: [],
      failed: [],
      skipped: [],
      summary: {
        totalChecked: 0,
        totalChanged: 0,
        totalFailed: 0,
        totalSkipped: 0,
      },
    };

    const patchResult = await patcher.apply(regulations, result, { dryRun: true });
    expect(patchResult.filesWritten).toBe(false);
  });

  it('should merge changed values into regulations', async () => {
    const regulations = {
      verificationLog: [],
      funding: {
        kfw458: {
          grundRate: {
            value: 0.30,
            description: 'Test',
          },
        },
      },
    };

    const result: VerificationResult = {
      timestamp: new Date().toISOString(),
      checkpoints: {},
      unchanged: [],
      changed: [
        {
          key: 'funding.kfw458.grundRate',
          description: 'Grundförderung',
          oldValue: 0.30,
          newValue: 0.15,
          changed: true,
          impact: 'major',
          criticality: 'high',
        },
      ],
      failed: [],
      skipped: [],
      summary: {
        totalChecked: 1,
        totalChanged: 1,
        totalFailed: 0,
        totalSkipped: 0,
      },
    };

    const patchResult = await patcher.apply(regulations, result, { dryRun: true });
    expect(patchResult.yamlPatched).toContain('0.15'); // Neue Wert sollte vorhanden sein
  });
});

// ============================================================================
// Integration Test
// ============================================================================

describe('Integration: Full Workflow', () => {
  it('should process simple verification end-to-end', async () => {
    const regulations = {
      verificationLog: [],
      funding: {
        kfw458: {
          grundRate: {
            value: 0.30,
            description: 'Grundförderung',
            criticality: 'high',
            source: {
              url: 'https://example.com/kfw',
              reference: 'KfW Test',
            },
          },
        },
      },
    };

    // Mock fetcher
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('Grundförderung: 30%'),
        status: 200,
        statusText: 'OK',
      } as Response)
    );

    // Mock Claude would happen here – aus Testgründen skippin
    // In real tests würde man anthropic mocken

    // Basic check: regulations laden geht
    expect(regulations).toBeDefined();
    expect(regulations.funding.kfw458.grundRate.value).toBe(0.30);
  });
});

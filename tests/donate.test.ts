import { describe, expect, it } from 'vitest';
import { DONATION_ACCOUNT } from '../src/project';
import { compactIban, epcPayload, formatIban, ibanValid } from '../src/ui/donate';
import { qrSvg } from '../src/ui/qr';

describe('F19.5 Unterstützen per Überweisung (GiroCode)', () => {
  it('Konto: gültige IBAN, Verwendungszweck ohne Umlaute und in der zulässigen Länge', () => {
    expect(ibanValid(DONATION_ACCOUNT.iban)).toBe(true);
    expect(DONATION_ACCOUNT.purpose).toMatch(/^[\x20-\x7e]{1,140}$/);
    expect(DONATION_ACCOUNT.name.length).toBeLessThanOrEqual(70);
  });

  it('IBAN-Prüfziffer und Darstellung', () => {
    expect(ibanValid('DE89 3704 0044 0532 0130 00')).toBe(true);
    expect(ibanValid('DE88370400440532013000')).toBe(false);
    expect(ibanValid('kein iban')).toBe(false);
    expect(formatIban('de89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
    expect(compactIban('DE89 3704 0044 0532 0130 00')).toBe('DE89370400440532013000');
  });

  it('GiroCode-Inhalt nach EPC069-12: Version 002, UTF-8, SCT, ohne BIC und Betrag', () => {
    const lines = epcPayload({ name: ' Erika Mustermann ', iban: 'DE89 3704 0044 0532 0130 00', purpose: 'Spende' }).split('\n');
    expect(lines).toEqual(['BCD', '002', '1', 'SCT', '', 'Erika Mustermann', 'DE89370400440532013000', '', '', '', 'Spende']);
    const long = epcPayload({ name: 'x'.repeat(80), iban: 'DE89370400440532013000', purpose: 'y'.repeat(200) }).split('\n');
    expect(long[5]).toHaveLength(70);
    expect(long[10]).toHaveLength(140);
    // fits into a QR code with error correction M
    expect(qrSvg(epcPayload(DONATION_ACCOUNT), 'GiroCode')).toMatch(/^<svg class="qr"/);
  });
});

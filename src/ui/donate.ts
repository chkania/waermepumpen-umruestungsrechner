/**
 * Support by SEPA transfer (F19.5): GiroCode payload (EPC QR code, EPC069-12) and IBAN helpers.
 * The QR code is generated in the browser (uqr) – no external service is contacted.
 */

export interface TransferAccount {
  name: string;
  iban: string;
  purpose: string;
}

/** IBAN without spaces, upper case. */
export const compactIban = (iban: string) => iban.replace(/\s+/g, '').toUpperCase();

/** IBAN in groups of four for reading, e.g. "DE62 5002 4024 …". */
export const formatIban = (iban: string) => compactIban(iban).replace(/(.{4})(?!$)/g, '$1 ');

/** Checks the IBAN check digits (ISO 13616, mod 97). */
export function ibanValid(iban: string): boolean {
  const s = compactIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const digits = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

/**
 * Payload of the GiroCode: version 002 (BIC optional within the EEA), UTF-8, SEPA credit transfer, no amount
 * (the donor chooses it in the banking app), unstructured remittance information.
 */
export function epcPayload(acc: TransferAccount): string {
  const name = acc.name.trim().slice(0, 70);
  const purpose = acc.purpose.trim().slice(0, 140);
  return ['BCD', '002', '1', 'SCT', '', name, compactIban(acc.iban), '', '', '', purpose].join('\n');
}

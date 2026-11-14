import { encode } from 'uqr';

/**
 * QR code as inline SVG (F30.3), e.g. for the link with the inputs in the printed report.
 * Error correction "M" (about 15 % may be damaged, e.g. by paper or printing); falls back to "L" for long texts.
 * Returns null if the text does not fit into a QR code at all.
 */
export function qrSvg(text: string, label: string): string | null {
  let qr: ReturnType<typeof encode> | null = null;
  for (const ecc of ['M', 'L'] as const) {
    try {
      qr = encode(text, { ecc, border: 4 });
      break;
    } catch {
      qr = null;
    }
  }
  if (!qr) return null;
  // One path for all dark modules: each module a 1×1 square in a viewBox of size × size
  let d = '';
  qr.data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return `<svg class="qr" viewBox="0 0 ${qr.size} ${qr.size}" role="img" aria-label="${label}" shape-rendering="crispEdges"><rect width="${qr.size}" height="${qr.size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

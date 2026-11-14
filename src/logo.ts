/**
 * Logo (F23): house with a switch curve – short warm line (gas/oil) turning into a rising blue arrow
 * (heat pump pays off). Inline SVG for the page header; colours come from the design tokens via CSS
 * (.logo-*), so light/dark follow automatically. Standalone files for favicon and presentations: docs/logo/.
 * Geometry (viewBox 64): the warm and blue parts meet at a mitred joint (Gehrung) so nothing protrudes.
 */
export const LOGO_PATHS = {
  house: 'M10 29 L32 10 L54 29 V54 H10 Z',
  warm: 'M15.5 42.5 H25.06 L26.94 47.5 H15.5 Z',
  rise: 'M26.94 47.5 L44.15 32.38 L40.85 28.62 L25.06 42.5 Z',
  arrowHead: 'M34 30 H43 V39',
} as const;

/** Decorative logo for the page header (the page title next to it names the calculator). */
export function logoSvg(className = 'mark'): string {
  const p = LOGO_PATHS;
  return `<svg class="${className}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path class="logo-house" d="${p.house}"/>
        <path class="logo-warm" d="${p.warm}"/>
        <path class="logo-rise" d="${p.rise}"/>
        <path class="logo-arrow" d="${p.arrowHead}"/>
      </svg>`;
}

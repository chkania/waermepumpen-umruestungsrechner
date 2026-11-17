import { encodeHash } from '../core/serialize';
import type { Inputs } from '../core/types';

/** Address of the derivation page (Rechenweg, F32). Separate module so the calculator does not bundle the page builders. */
export const DERIVATION_PAGE = './rechenweg.html';

/** Link to the derivation page with all inputs (differences from the defaults, as "Link mit Werten teilen"). */
export function derivationLink(base: string, defaults: Inputs, inputs: Inputs): string {
  return base + encodeHash(defaults, inputs);
}

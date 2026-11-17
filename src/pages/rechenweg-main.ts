import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../style.css';
import '../style-modern.css';
import '../help.css';
import { initAnalytics } from '../analytics';
import { createDefaults } from '../core/defaults';
import { mountDocPage } from '../doc-page';
import { bindDerivation, derivationHtml, loadDerivationInputs } from '../ui/derivation';

// Derivation page (F32): inputs from the link, otherwise those saved by the calculator in this browser
const root = document.getElementById('doc')!;
const defaults = createDefaults(new Date());
let storage: Storage | null = null;
try {
  storage = localStorage;
} catch {
  /* storage blocked */
}
const { inputs, source } = loadDerivationInputs(defaults, location.hash, storage);
const content = derivationHtml(inputs, source);
const name = inputs.scenario.name.trim();
// The hash holds the inputs, not a heading anchor: mountDocPage only scrolls to existing IDs
mountDocPage(root, { rendered: content, subtitle: name ? `Wärmepumpen-Investitionsrechner · ${name}` : 'Wärmepumpen-Investitionsrechner' });
bindDerivation(root, { inputs, defaults, run: content.run, pageUrl: location.href.split('#')[0] });
initAnalytics('Rechenweg');

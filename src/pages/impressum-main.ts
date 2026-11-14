import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../style.css';
import '../style-modern.css';
import '../help.css';
import imprint from '../../docs/IMPRESSUM.md?raw';
import { initAnalytics } from '../analytics';
import { mountDocPage } from '../doc-page';

mountDocPage(document.getElementById('doc')!, { markdown: imprint, subtitle: 'Wärmepumpen-Investitionsrechner', toc: false });
initAnalytics('Impressum');

import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import './style-modern.css';
import './help.css';
import handbook from '../docs/BENUTZERHANDBUCH.md?raw';
import { initAnalytics } from './analytics';
import { mountDocPage } from './doc-page';

mountDocPage(document.getElementById('help')!, { markdown: handbook, subtitle: 'Wärmepumpen-Investitionsrechner' });
initAnalytics('Hilfe');

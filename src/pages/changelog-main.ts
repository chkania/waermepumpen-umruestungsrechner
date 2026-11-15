import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../style.css';
import '../style-modern.css';
import '../help.css';
import changelog from '../../CHANGELOG.md?raw';
import { initAnalytics } from '../analytics';
import { mountDocPage } from '../doc-page';
import { APP_VERSION } from '../version';

mountDocPage(document.getElementById('doc')!, { markdown: changelog, subtitle: `Wärmepumpen-Investitionsrechner · aktuelle Version ${APP_VERSION}` });
initAnalytics('Änderungen');

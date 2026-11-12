import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../style.css';
import '../style-modern.css';
import '../help.css';
import notices from '../../THIRD-PARTY-NOTICES.md?raw';
import { mountDocPage } from '../doc-page';

mountDocPage(document.getElementById('doc')!, { markdown: notices, subtitle: 'Wärmepumpen-Investitionsrechner', codeLang: 'en' });

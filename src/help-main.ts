import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import './style-modern.css';
import './help.css';
import handbook from '../docs/BENUTZERHANDBUCH.md?raw';
import { initAnalytics } from './analytics';
import { mountDocPage } from './doc-page';
import { DOC_PAGES } from './pages/doc-pages';

mountDocPage(document.getElementById(DOC_PAGES['hilfe.html'].element)!, { markdown: handbook, ...DOC_PAGES['hilfe.html'].page });
initAnalytics('Hilfe');

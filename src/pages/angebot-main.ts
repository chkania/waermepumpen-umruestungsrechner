import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../style.css';
import '../style-modern.css';
import '../help.css';
import angebot from '../../docs/ANGEBOT.md?raw';
import { initAnalytics } from '../analytics';
import { mountDocPage } from '../doc-page';
import { DOC_PAGES } from './doc-pages';

mountDocPage(document.getElementById(DOC_PAGES['angebot.html'].element)!, { markdown: angebot, ...DOC_PAGES['angebot.html'].page });
initAnalytics('Weg zum Angebot');

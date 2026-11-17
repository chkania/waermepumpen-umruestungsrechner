import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../style.css';
import '../style-modern.css';
import '../help.css';
import imprint from '../../docs/IMPRESSUM.md?raw';
import { initAnalytics } from '../analytics';
import { mountDocPage } from '../doc-page';
import { DOC_PAGES } from './doc-pages';

mountDocPage(document.getElementById(DOC_PAGES['impressum.html'].element)!, { markdown: imprint, ...DOC_PAGES['impressum.html'].page });
initAnalytics('Impressum');

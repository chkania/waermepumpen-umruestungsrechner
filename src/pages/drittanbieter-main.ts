import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../style.css';
import '../style-modern.css';
import '../help.css';
import notices from '../../THIRD-PARTY-NOTICES.md?raw';
import { initAnalytics } from '../analytics';
import { mountDocPage } from '../doc-page';
import { DOC_PAGES } from './doc-pages';

mountDocPage(document.getElementById(DOC_PAGES['lizenzen-drittanbieter.html'].element)!, { markdown: notices, ...DOC_PAGES['lizenzen-drittanbieter.html'].page });
initAnalytics('Lizenzen Drittanbieter');

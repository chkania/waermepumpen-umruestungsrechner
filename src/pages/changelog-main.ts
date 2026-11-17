import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../style.css';
import '../style-modern.css';
import '../help.css';
import changelog from '../../CHANGELOG.md?raw';
import { initAnalytics } from '../analytics';
import { mountDocPage } from '../doc-page';
import { DOC_PAGES } from './doc-pages';

mountDocPage(document.getElementById(DOC_PAGES['changelog.html'].element)!, { markdown: changelog, ...DOC_PAGES['changelog.html'].page });
initAnalytics('Änderungen');

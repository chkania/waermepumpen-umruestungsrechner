import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../style.css';
import '../style-modern.css';
import '../help.css';
import license from '../../LICENSE.md?raw';
import { initAnalytics } from '../analytics';
import { mountDocPage } from '../doc-page';
import { DOC_PAGES } from './doc-pages';

mountDocPage(document.getElementById(DOC_PAGES['lizenz.html'].element)!, { markdown: license, ...DOC_PAGES['lizenz.html'].page });
initAnalytics('Lizenz');

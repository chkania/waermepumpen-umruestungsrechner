import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import './style-modern.css';
import { initAnalytics } from './analytics';
import { mountApp } from './ui/app';

mountApp(document.getElementById('app')!);
initAnalytics('Rechner');

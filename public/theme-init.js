// Light/dark theme before the first paint (no flash). Loaded synchronously in <head> from its own file
// so that the Content Security Policy needs no inline-script hash (F33.5).
(function () {
  var t = null;
  try {
    t = localStorage.getItem('wp-investitionsrechner:theme');
  } catch (e) {}
  var html = document.documentElement;
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  html.dataset.theme = t === 'light' || t === 'dark' ? t : dark ? 'dark' : 'light';
})();

# F33 – Auffindbarkeit und Linkvorschau

- F33.1 Inhalt ohne JavaScript: `index.html` enthält im Container des Rechners eine statische Einführung (H1, Zwischenüberschriften, mindestens 250 Wörter, Links zu allen eigenen Seiten, `<noscript>`-Hinweis); `rechenweg.html` eine kurze Einleitung. Der Rechner bzw. die Seite ersetzt sie beim Start; sie ist nicht versteckt (kein Cloaking). *(Test: seo)*
- F33.2 Die Markdown-Dokumentseiten (Handbuch, Weg zum Angebot (F39), Änderungen, Impressum, Datenschutz, Lizenz, Drittanbieter) werden beim Build vorgerendert (`prerender.ts`, Einstellungen gemeinsam mit den Seiteneinstiegen in `src/pages/doc-pages.ts`); im Browser rendert der Einstieg denselben Inhalt erneut. *(Test: seo)*
- F33.3 Titel und Beschreibung mit Suchbegriffen: Titel des Rechners „Wärmepumpe: Lohnt sich der Umstieg? Rechner mit KfW-Förderung“ (auch im Fenstertitel ohne Szenario-Bezeichnung, `PAGE_TITLE`), Beschreibung je Seite höchstens 160 Zeichen, Titel je Seite verschieden. *(Test: seo)*
- F33.4 Linkvorschau: Open-Graph- und Twitter-Angaben mit eigenem Vorschaubild `public/og-image.png` (1200 × 630, Quelle `docs/logo/og-image.svg`); strukturierte Daten `WebApplication` (JSON-LD, wird nicht ausgeführt, daher ohne Auswirkung auf die CSP). Nichts wird von fremden Servern geladen. *(Test: seo, logo)*

- F33.5 Die statische Einführung in `index.html` gliedert sich in Abschnitte (`section`, `header`, `footer`) mit H2/H3, einer nummerierten Liste der Schritte und einem Logo mit Alternativtext. Jeder Link hat einen Titel; die Ziele im Benutzerhandbuch existieren als Anker. Das Hell/Dunkel-Skript im `<head>` liegt als `public/theme-init.js` vor (synchron, ohne Inline-Skript, daher keine Hashes in der CSP). *(Test: seo)*

- F33.6 Die `.htaccess` des Rechners liegt als `public/.htaccess` im Repository und wird mit jedem Deployment auf den Webspace übertragen (Weiterleitung aller anderen Hostnamen auf die Hauptdomain mit 301, Cache-Regeln, Sicherheitsheader). Der Upload-Schritt schließt sie nicht mehr aus; der Build bricht ab, wenn sie fehlt. *(Test: htaccess)*

- F33.7 Die Einführung erklärt die Methode (monatliche Rechnung über den Betrachtungszeitraum) und die wichtigsten Regeln (KfW 458, § 35c EStG, CO₂-Preis, Strommix, Lebensdauer). Zahlen stammen aus den Quellen, die der Rechner ohnehin nennt (`src/core/sources.ts`); externe Links öffnen in neuem Tab und nennen das im Titel. Mindestens 400 Wörter, Lesbarkeit geprüft. *(Test: seo)*

- F33.8 `public/llms.txt`: kurze Beschreibung des Rechners für KI-Assistenten, Liste aller Seiten und Quellen mit absoluten Adressen. Keine Einstellungen für KI-Crawler (`robots.txt` bleibt unverändert). Das JSON-LD nennt das GitHub-Profil des Autors als `sameAs`; weitere Angaben zur Person sind bewusst nicht enthalten. *(Test: seo)*

- F33.9 Mit JavaScript wird die statische Einführung (Rechner, Rechenweg) vor der ersten Anzeige ausgeblendet (Klasse `js` auf `<html>`, gesetzt in `public/theme-init.js`). Sie wird dann durch den Rechner ersetzt, ohne sichtbaren Sprung. Ohne JavaScript bleibt sie sichtbar. *(Test: seo)*

- F33.10 Die Haupt-Schrift (Inter, latin, variabel) wird im `<head>` aller HTML-Seiten vorgeladen (`fontPreloadPlugin` in `prerender.ts`), damit Text ohne Schriftwechsel erscheint. Das Bild der Einführung hat Titel und Alternativtext; das JSON-LD enthält nur ASCII-Zeichen (Unicode-Escapes). `theme-init.js` wird einen Tag gecacht, Favicon eine Woche (`public/.htaccess`). *(Test: seo, htaccess)*

# N6 – Sicherheit

- N6 Sicherheit: Alle dynamischen Texte werden vor der HTML-Ausgabe maskiert (`escapeHtml`). Der Build setzt eine Content-Security-Policy per `<meta>` (`csp.ts`: nur eigene Skripte, Inline-Skripte im `<head>` per SHA-256-Hash, keine Inline-Event-Handler, `object-src`/`base-uri`/`form-action` gesperrt); im Entwicklungsserver nicht aktiv. Beim Hosting setzt die `.htaccess` zusätzlich `X-Frame-Options: DENY`, HSTS, COOP, `nosniff` und eine Referrer-Policy als HTTP-Header (`docs/DEPLOYMENT.md`). *(Test: validate)*

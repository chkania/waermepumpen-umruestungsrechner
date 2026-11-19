# N13 – Suchmaschinen

- N13 Suchmaschinen: Jede HTML-Seite nennt per `<link rel="canonical">` ihre Adresse unter der Hauptdomain `https://waermepumpen-investitionsrechner.de/` (alle weiteren Domains, auch die Kurzdomain `wpir.de`, leiten dorthin weiter, `docs/DEPLOYMENT.md`). `public/robots.txt` erlaubt alles und verweist auf `public/sitemap.xml`, die genau alle Seiten auflistet. Neue Seite → Canonical-Link und Sitemap-Eintrag ergänzen. *(Test: seo)*

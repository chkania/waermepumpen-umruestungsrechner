# N14 – Ladezeit

- N14 Ladezeit: Die Diagrammbibliothek Chart.js wird erst nach der ersten Darstellung nachgeladen (eigenes Modul `src/ui/chart-render.ts`, dynamischer Import); Kennzahlen, Tabellen und Texte erscheinen ohne sie. Der Bericht wartet beim Klick auf „Bericht“ auf das Modul. Die Quellen-Popover (F11) bekommen ihren Inhalt erst beim ersten Öffnen, damit die Seite weniger Elemente hat. *(Test: performance, ui)*

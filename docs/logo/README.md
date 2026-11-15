# Logo – Wärmepumpen-Investitionsrechner

Ein Haus mit einer „Umstiegskurve“: Die kurze warme Linie steht für Gas oder Öl. Sie knickt in einen steigenden blauen Pfeil für die Wärmepumpe, die sich rechnet.

## Dateien

| Datei | Verwendung |
|---|---|
| `logo.svg`, `logo-512.png`, `logo-1024.png` | Bildmarke auf hellem Grund |
| `logo-dunkel.svg`, `logo-dunkel-512.png`, `logo-dunkel-1024.png` | Bildmarke auf dunklem Grund |
| `logo-kachel.svg` | Bildmarke auf heller Kachel (wie das Favicon), für beliebige Hintergründe |
| `logo-schriftzug.png`, `logo-schriftzug-dunkel.png` | Bildmarke mit Schriftzug für Präsentationen, Dokumente und Social Media |
| `logo-schriftzug.svg`, `logo-schriftzug-dunkel.svg` | dasselbe als Vektor; die Schrift Inter muss installiert sein, sonst lieber die PNG verwenden |

Im Rechner selbst:
- Die Kopfzeile nutzt `src/logo.ts` (Inline-SVG, Farben aus den Design-Tokens, folgt Hell/Dunkel).
- Das Favicon liegt in `public/favicon.svg` und `public/apple-touch-icon.png`.

## Farben

| Element | Hell | Dunkel |
|---|---|---|
| Haus, Schrift | `#23252a` | `#ecebe7` |
| Wärmepumpe (Pfeil) | `#2864a6` | `#6fa3dc` |
| Gas/Öl (warme Linie) | `#b4532a` | `#e08a5f` |

Die Farben entsprechen den Tokens des Rechners (`--c-text`, `--accent`, `--c-ref`).

Schrift des Schriftzugs: Inter Bold.

## Regeln

- Rund um das Logo mindestens ein Achtel seiner Breite frei lassen.
- Mindestgröße der Bildmarke: 16 px. Den Schriftzug erst ab etwa 120 px Breite verwenden.
- Logo nicht verzerren, nicht umfärben, nicht mit Schatten oder Verläufen versehen.
- Bei geänderter Form: `src/logo.ts` (`LOGO_PATHS`) und alle SVG-Dateien hier sowie in `public/` gleich halten. `tests/logo.test.ts` prüft das.
- PNG-Dateien neu erzeugen mit `rsvg-convert`, z. B. `rsvg-convert -w 1024 logo.svg -o logo-1024.png`.

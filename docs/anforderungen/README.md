# Wärmepumpen-Investitionsrechner – Anforderungen

Verbindliche Sammlung der Anforderungen, eine Datei je Anforderung (mit ihren Unterpunkten, z. B. F13.1–F13.7). Bei jeder Änderung an der Anwendung mitpflegen:

- **Neue Anforderung:** nächste freie ID, neue Datei `<ID>-<kurztitel>.md` (Überschrift `# <ID> – <Titel>`), Zeile in der Tabelle unten, Eintrag im [Änderungsprotokoll](aenderungsprotokoll.md).
- **Neuer Unterpunkt oder geänderter Text:** in der Datei der Anforderung, dazu ein Eintrag im Änderungsprotokoll.
- Jeder Unterpunkt nennt die Tests, die ihn absichern (*(Test: …)*).

## Ziel

Zweck, Benutzer, Grundentscheidungen und Abgrenzung stehen in der [Produktbeschreibung](produktbeschreibung.md).

## Weitere Dokumente

- [Produktbeschreibung](produktbeschreibung.md): Zweck, Benutzer, Hauptfunktionen, Grundentscheidungen, Abgrenzung – der Rahmen für jede neue Anforderung
- [Entscheidungen aus der Anforderungsaufnahme](entscheidungen.md) (E1–E12)
- [Offene Punkte und Annahmen](annahmen.md) (A*)
- [Quellen](quellen.md)
- [Änderungsprotokoll](aenderungsprotokoll.md)

## Funktionale Anforderungen

| ID | Titel |
|---|---|
| [F1](F1-zeitmodell.md) | Zeitmodell |
| [F2](F2-energiepreise.md) | Energiepreise |
| [F3](F3-referenzszenario-ohne-wp.md) | Referenzszenario (ohne WP) |
| [F4](F4-waermepumpen-szenario.md) | Wärmepumpen-Szenario |
| [F5](F5-foerderung-und-steuer.md) | Förderung und Steuer |
| [F6](F6-finanzierung.md) | Finanzierung |
| [F7](F7-vergleich-der-installationszeitpunkte.md) | Vergleich der Installationszeitpunkte |
| [F8](F8-ergebnisse.md) | Ergebnisse |
| [F9](F9-persistenz.md) | Persistenz |
| [F10](F10-wichtige-ereignisse-hinweise.md) | Wichtige Ereignisse & Hinweise |
| [F11](F11-herkunft-der-standardwerte.md) | Herkunft der Standardwerte |
| [F12](F12-sondertilgung-aus-einmalzahlung.md) | Sondertilgung aus Einmalzahlung |
| [F13](F13-stromkosten-mit-oder-ohne-waermepumpentarif.md) | Stromkosten mit oder ohne Wärmepumpentarif |
| [F14](F14-design.md) | Design |
| [F15](F15-benutzerhandbuch.md) | Benutzerhandbuch |
| [F16](F16-szenario-beschreibung.md) | Szenario-Beschreibung |
| [F17](F17-verbrauchsaufteilung-raumwaerme-warmwasser-kochen.md) | Verbrauchsaufteilung: Raumwärme, Warmwasser, Kochen |
| [F18](F18-einordnung-des-hauses.md) | Einordnung des Hauses |
| [F19](F19-projektlinks-und-mitmachen.md) | Projektlinks und Mitmachen |
| [F20](F20-einfuehrung-beim-ersten-besuch.md) | Einführung beim ersten Besuch |
| [F21](F21-weiterempfehlen.md) | Weiterempfehlen |
| [F22](F22-regelmaessige-pruefung-der-annahmen.md) | Regelmäßige Prüfung der Annahmen |
| [F23](F23-logo.md) | Logo |
| [F24](F24-alle-eingabeabschnitte-auf-zuklappen.md) | Alle Eingabeabschnitte auf-/zuklappen |
| [F25](F25-co2-bilanz.md) | CO₂-Bilanz |
| [F26](F26-schaetzung-der-jahresarbeitszahl.md) | Schätzung der Jahresarbeitszahl |
| [F27](F27-einflussgroessen-sensitivitaetsanalyse.md) | Einflussgrößen (Sensitivitätsanalyse) |
| [F28](F28-pv-anlage-im-monatsmodell.md) | PV-Anlage im Monatsmodell |
| [F29](F29-energie-je-monat.md) | Energie je Monat |
| [F30](F30-bericht-zum-drucken-bzw-als-pdf.md) | Bericht zum Drucken bzw. als PDF |
| [F31](F31-varianten-vergleichen.md) | Varianten vergleichen |
| [F32](F32-rechenweg.md) | Rechenweg |
| [F33](F33-auffindbarkeit-und-linkvorschau.md) | Auffindbarkeit und Linkvorschau |
| [F34](F34-inbetriebnahme-der-bestandsheizung.md) | Inbetriebnahme der Bestandsheizung |
| [F35](F35-export-fuer-ki-assistenten.md) | Export für KI-Assistenten |
| [F36](F36-monatliche-belastung.md) | Monatliche Belastung |
| [F37](F37-szenarien-im-browser-speichern.md) | Szenarien im Browser speichern und vergleichen |
| [F38](F38-werkzeugleiste-mit-menues.md) | Werkzeugleiste mit Menüs |

## Nicht-funktionale Anforderungen

| ID | Titel |
|---|---|
| [N1](N1-rechenkern-ohne-dom.md) | Rechenkern ohne DOM |
| [N2](N2-zentrale-annahmen.md) | Zentrale Annahmen |
| [N3](N3-regressionstests.md) | Regressionstests |
| [N4](N4-responsive-und-offline.md) | Responsive und offline |
| [N5](N5-haftungshinweis.md) | Haftungshinweis |
| [N6](N6-sicherheit.md) | Sicherheit |
| [N7](N7-barrierefreiheit.md) | Barrierefreiheit |
| [N8](N8-lizenz.md) | Lizenz |
| [N9](N9-versionierung.md) | Versionierung |
| [N10](N10-besucherstatistik.md) | Besucherstatistik |
| [N11](N11-impressum-und-datenschutz.md) | Impressum und Datenschutz |
| [N12](N12-deployment.md) | Deployment |
| [N13](N13-suchmaschinen.md) | Suchmaschinen |
| [N14](N14-ladezeit.md) | Ladezeit |
| [N15](N15-pruefung-nach-dem-deployment.md) | Prüfung nach dem Deployment |

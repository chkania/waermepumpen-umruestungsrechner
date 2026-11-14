# Beispieldaten

Testdateien für „Datei laden“ im Rechner (Format wie der Export, Stichtag 11/2026). Die Zahlen sind ausgedacht und dienen nur zum Ausprobieren.

| Datei | Szenario | Was damit geprüft wird |
|---|---|---|
| `01-altbau-oel-familie.json` | EFH 1962, unsaniert, Ölheizung 28 Jahre, Familie mit niedrigem Einkommen | Öl, Einkommens- und Klimageschwindigkeitsbonus, Höchstsatz 80 %, KfW-Kredit 358, Klasse G |
| `02-gas-brennwert-pv-steuerbonus.json` | Haus 2008, Gas-Brennwert 9 Jahre, PV 8 kWp mit 5 kWh Speicher, hohes Einkommen | KfW-Zuschuss vs. § 35c, Kredit 359, kein separater WP-Tarif, Gasherd → Induktion |
| `03-mehrfamilienhaus-vermietet.json` | MFH 1985, 6 Wohnungen, vermietet, teilsaniert | Höchstgrenzen mehrerer Wohneinheiten, keine Boni/kein Steuerbonus, nur Bankkredit |
| `04-reihenhaus-sondertilgung-gasherd.json` | Reihenhaus 1995, teilsaniert, Lebensversicherung 2031 | Sondertilgung mit eigenem Datum, Gasherd bleibt (Hinweis Induktion), § 14a mit Wallbox |
| `05-stresstest-teurer-strom.json` | Altbau 1938, JAZ 2,6, Strom +4,5 % p. a., Umrüstung 2029, 25 Jahre | Fall, in dem die Wärmepumpe teurer ist; Ersatz-WP im Zeitraum, ohne EU-Bonus, Warmwasser getrennt |

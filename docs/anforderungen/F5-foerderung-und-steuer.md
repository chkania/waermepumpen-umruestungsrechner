# F5 – Förderung und Steuer

- F5.1 **KfW 458** (Zuschuss, Antragsmonat maßgeblich):
  - Grundförderung 30 %; ab Anträgen im 1. Quartal 2027 (angenommen ab 01/2027) für Wärmepumpen 15 % plus Wertschöpfungs-Bonus 15 % bei EU-Ursprung (Richtlinie Nr. 8.4.1 c, 8.4.6). Eingabe „Wärmepumpe mit Ursprung in der EU“ (Default: ja).
  - Klimageschwindigkeitsbonus (nur selbstgenutzt, Ersatz einer funktionstüchtigen Öl-Heizung oder einer Gasheizung ≥ 20 Jahre): 16 %, ab 02/2027 halbjährlich (Feb/Aug) −4 Prozentpunkte, ab Anträgen 08/2028 entfallen.
  - Einkommensbonus (nur selbstgenutzt, zu versteuerndes Haushaltseinkommen): ≤ 30.000 € → 40 %, ≤ 40.000 € → 30 %, ≤ 50.000 € → 10 %; mit kindergeldberechtigtem Kind < 18 Grenzen +10.000 €.
  - Höchstfördersatz 70 %; 80 % bei zvE bis 30.000 € bzw. 40.000 € mit Familienzuschlag (Richtlinie Nr. 8.4.1).
  - Förderfähige Kosten: 1. Wohneinheit 28.000 € (ab 02/2027 halbjährlich −750 €, Untergrenze 22.000 € ab 08/2030, Richtlinie Nr. 8.3.1 a), 2.–6. WE je 15.000 €, ab 7. WE je 8.000 €. Boni gelten nur für den Kostenanteil der selbstgenutzten WE (Kosten gleichmäßig auf WE verteilt).
  - Auszahlung `n` Monate nach Installation (Default 3). Liegt die Auszahlung nach dem Betrachtungszeitraum, wird der Zuschuss als Forderung im letzten Monat eingerechnet (wie die Ablösung einer Restschuld), mit Warnung.
  - Effizienzbonus existiert nicht mehr (nicht modelliert).
  *(Test: funding)*
- F5.2 **§ 35c EStG**: 20 % der Kosten (max. 200.000 € Kosten, max. 40.000 € Steuerermäßigung), verteilt 7 % / 7 % / 6 % auf Abschlussjahr und zwei Folgejahre; Erstattung jeweils im Folgejahr (Monat wählbar, Default Juni). Nur selbstgenutzt, Gebäude ≥ 10 Jahre, Abschluss bis 31.12.2029 (editierbar). Optional begrenzt durch die jährliche Einkommensteuerschuld (keine Erstattung darüber hinaus, kein Vor-/Rücktrag). *(Test: tax)*
- F5.3 KfW-Zuschuss und Steuerbonus werden **nicht** kombiniert; beide Wege werden als eigenständige Szenarien gerechnet (E4). *(Test: simulation)*

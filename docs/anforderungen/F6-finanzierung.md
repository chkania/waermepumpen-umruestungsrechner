# F6 – Finanzierung

- F6.1 Eigenkapitaleinsatz (€) je Szenario; Rest wird über Kredit finanziert. *(Test: simulation)*
- F6.2 KfW-Weg: Ergänzungskredit 358 (selbstgenutztes EFH, Haushalts-zVE ≤ 90.000 €) sonst 359; max. 120.000 € je WE; Annuitätendarlehen mit tilgungsfreien Anlaufjahren, Laufzeit, Zinsbindung, Anschlusszins. Ein darüber hinausgehender Rest läuft über den Bankkredit. Schalter „KfW-Kredit nutzen“ (Default: ja); ohne ihn läuft der gesamte Finanzierungsbedarf über den Bankkredit, der Zuschuss bleibt unverändert. Option: Zuschuss bei Auszahlung als Sondertilgung (verkürzt Laufzeit, Rate bleibt). *(Test: loan, simulation)*
- F6.3 Steuer-Weg: freier Bankkredit (Zins, Laufzeit, tilgungsfreie Jahre). *(Test: simulation)*
- F6.4 Opportunitätszins p. a. (Default 2 %): Alle Zahlungsströme werden monatlich mit diesem Zins aufgezinst (Endwert-Betrachtung). Bei 0 % entspricht das der einfachen Summe. *(Test: simulation)*
- F6.5 Kreditzinsen sind Annahmen (die KfW veröffentlicht tagesaktuelle Zinsen) und müssen in der UI als „bitte prüfen" gekennzeichnet sein.

# F29 – Energie je Monat

- F29.1 `src/core/energy.ts`: typisches Jahr mit den Monatsprofilen (F17). Bedarf = Raumwärme + Warmwasser (Nutzwärme) + Kochen (Gas × 0,5 als Nutzenergie, nur wenn heute mit Gas gekocht wird); Altanlage = Nutzwärme ÷ Nutzungsgrad + Kochgas; Wärmepumpe = Nutzwärme ÷ JAZ + Induktionsstrom (Kochgas × Faktor) bzw. weiter Kochgas. *(Test: energy)*
- F29.2 Diagramm-Reiter „Energie je Monat“: je Monat Balken für Bedarf, Gas/Heizöl der Altanlage und Strom der Wärmepumpe (+ Kochgas gestapelt), Tooltip mit Aufteilung Heizen/Warmwasser/Kochen; Satz über dem Diagramm mit Jahressummen und kWh je kWh Bedarf; Hinweis, dass die JAZ ein Jahresmittel ist. Tabelle in `chartTables()` mit Monaten und Jahressumme, Spalte Kochen nur mit Gasherd. *(Test: ui)*

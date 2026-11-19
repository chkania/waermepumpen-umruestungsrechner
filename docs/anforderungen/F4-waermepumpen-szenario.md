# F4 – Wärmepumpen-Szenario

- F4.1 Investition WP gesamt (brutto) und davon förderfähig (Default: gesamt), zuzüglich nicht förderfähiger Nebenkosten (z. B. Stilllegung Gasanschluss). Investitionskosten steigen mit Rate p. a. bis zur Installation. *(Test: simulation)*
- F4.2 Ab Installation: WP-Strom = Wärmebedarf / JAZ; Gas-Grundpreis, Gas-/Ölwartung und Schornsteinfeger entfallen; WP-Wartung €/Jahr fällt an. *(Test: simulation)*
- F4.3 Lebensdauer WP (Default 20 Jahre) für Restwert. Ist der Betrachtungszeitraum länger, wird nach Ablauf eine Ersatz-WP zum heutigen Preis × Investitionskosten-Steigerung ohne Förderung eingerechnet (Warnung und Ereignis). *(Test: simulation, events)*
- F4.4 Fällt die Altanlage vor dem gewählten Installationszeitpunkt aus, muss auch im WP-Szenario ein Ersatzkessel gekauft werden (inkl. Warnhinweis). *(Test: simulation)*

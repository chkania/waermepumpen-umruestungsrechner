# F11 – Herkunft der Standardwerte

- F11.1 Jedes Eingabefeld hat einen Info-Button („i") neben der Beschriftung; er öffnet ein Popover mit dem Standardwert, der Art der Herkunft und einer Erläuterung (ggf. Link und Stand). Nur ein Popover ist gleichzeitig offen; Klick daneben oder Escape schließt. *(Test: ui)*
- F11.2 Herkunftsarten: *Offizielle Quelle* (mit Link + Stand), *Gesetz / Regelung*, *Marktdaten (recherchiert)* (mit Link + Stand), *Schätzung* (keine konkrete Erhebung, mit typischer Spanne), *Beispielwert* (eigene Angabe nötig), *Technischer Richtwert*, *Modellannahme*. Schätzungen und Annahmen müssen ehrlich als solche gekennzeichnet sein. *(Test: sources)*
- F11.3 Die Herkunft wird zentral in `src/core/sources.ts` gepflegt; jedes Feld braucht einen Eintrag, verwaiste Einträge sind unzulässig. *(Test: sources)*
- F11.4 Soweit relevant nennt das Popover zusätzlich die **offiziellen Fundstellen** mit Link (BEG-EM-Richtlinie mit Nummer, KfW-Merkblätter 458 und 358/359 mit Seite, KfW-Infoblatt mit Nummer, Gesetze mit Paragraf). Jede KfW-Förderregel (`funding.*`) muss auf Richtlinie oder Merkblatt verweisen. *(Test: sources, ui)*

# F1 – Zeitmodell

- F1.1 Startmonat (Default: aktueller Monat) und Betrachtungszeitraum in Jahren (Default 20). Die Simulation läuft monatlich, Ergebnisse werden je Kalenderjahr aggregiert. *(Test: simulation)*
- F1.2 Der Wärmebedarf wird über ein Heizgradtag-ähnliches Monatsprofil (Summe = 100 %) auf die Monate verteilt, damit ein Wechsel mitten im Jahr korrekt abgebildet wird. *(Test: simulation)*
- F1.3 Der Installationszeitpunkt der WP ist als Monat wählbar. Bis dahin entstehen die Kosten der Altanlage (mit steigenden Preisen). *(Test: simulation)*
- F1.4 Der Förderantrag wird `Vorlauf` Monate (Default 4) vor der Installation gestellt; die Förderkonditionen richten sich nach dem Antragsmonat. *(Test: funding, compare)*

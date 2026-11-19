# N3 – Regressionstests

- N3 Regressionstests: `npm test` muss vor jeder Änderung und danach grün sein; ein Snapshot-Test sichert die Ergebnisse des Default-Szenarios. Bewusste Ergebnisänderungen → Snapshot mit `npm test -- -u` aktualisieren und im Änderungsprotokoll begründen.

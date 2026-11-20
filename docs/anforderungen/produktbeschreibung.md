# Produktbeschreibung

Fachlicher Rahmen des Wärmepumpen-Investitionsrechners. Er gilt für jede neue oder geänderte Anforderung: Der `requirements-reviewer` prüft, dass eine Anforderung in diesen Rahmen passt und vom Nutzer gefordert ist. Was hier steht, ist gesetzt; eine Anforderung, die dem widerspricht, braucht eine ausdrückliche Entscheidung des Nutzers und eine Änderung dieses Dokuments.

## Zweck

Eine Single-Page-Anwendung, mit der Eigentümer:innen eine Gas- oder Ölheizung wirtschaftlich mit dem Umstieg auf eine Wärmepumpe vergleichen. Sie beantwortet die Frage: **Lohnt sich der Umstieg finanziell – und wann?** Sie rechnet mit steigenden Energie- und CO₂-Preisen, der Bundesförderung (KfW 458), Ergänzungskredit (KfW 358/359), Bankkredit und Steuerbonus (§ 35c EStG) und vergleicht verschiedene Umrüstzeitpunkte.

Anspruch: eine **transparente Überschlagsrechnung** mit offengelegten Annahmen, die man nachvollziehen und mit eigenen Werten überprüfen kann. Sie ersetzt weder ein Angebot noch eine Planung noch eine Beratung.

## Benutzer

- **Primär: selbstnutzende Eigentümer:innen** eines Bestandsgebäudes mit Gas- oder Ölheizung, ohne Fachkenntnisse in Heizungstechnik, Förderrecht oder Finanzierung. Sie sollen ohne Handbuch zu einem ersten Ergebnis kommen; Fachbegriffe werden erklärt, Standardwerte sind vorbelegt.
- **Mitnutzer: Berater:innen und Handwerksbetriebe** (z. B. Energieberatung). Sie dürfen den Rechner nutzen, mehrere Szenarien im Browser halten und vergleichen. Es wird aber nichts speziell für sie gebaut; Funktionen für sie sind kein Selbstzweck.
- **Nicht Zielgruppe:** Fachleute, die eine Heizung planen oder auslegen, und Entwickler:innen als Anwender. Für Entwickler:innen gibt es nur die Mitmach-Hinweise.

## Hauptfunktionen

- Eingabe von Haus, Heizung (Gas oder Öl), Energiepreisen, Wärmepumpe, Strom (inkl. Wärmepumpentarif, PV), Förderung, Finanzierung; sinnvolle Standardwerte mit offengelegter Herkunft.
- Monatliche Simulation über den Betrachtungszeitraum für drei Wege: ohne Wärmepumpe, Wärmepumpe mit KfW-Zuschuss (optional KfW-Kredit), Wärmepumpe mit Steuerbonus.
- Ergebnisse: Gesamtkosten, Amortisation, monatliche Belastung, Diagramme und Tabellen, wichtige Ereignisse und Hinweise, CO₂-Bilanz, Vergleich der Installationszeitpunkte, Einflussgrößen (Sensitivität), Rechenweg.
- Szenarien sichern, teilen und vergleichen: automatisch im Browser, mehrere benannte Szenarien im Browser, Link mit Werten, Datei-Export und -Import (JSON), Export für KI-Assistenten, Bericht zum Drucken oder als PDF, Vergleich mehrerer Varianten.
- Benutzerhandbuch und kurze Einführung; Herkunft jedes Standardwerts per Info-Popover.
- Die Seite „Weg zum Angebot und zur Förderung“ (Checklisten, Verweise auf neutrale Stellen; keine Beratung).

## Grundentscheidungen

Das Prinzip steht hier, die Einzelheiten in der genannten Anforderung (einzige Quelle).

- **Alles im Browser, nichts auf dem Server:** keine Konten, keine Server-Speicherung, keine Synchronisation zwischen Geräten. Eingaben und Ergebnisse verlassen den Browser nur, wenn der Nutzer sie selbst weitergibt (Link, Datei, Bericht). Speicherwege: F9, F37.
- **Datenschutz zuerst:** keine Übertragung von Eingaben, Ergebnissen oder Szenario-Namen, keine neuen externen Dienste. Details: N10, N11.
- **Statische Webanwendung ohne UI-Framework,** auch offline nutzbar. Details: E1, N4, N14.
- **Transparenz vor Genauigkeit:** Jede Annahme hat eine sichtbare Herkunft und ist änderbar, der Rechenweg ist einsehbar, zeitkritische Annahmen werden regelmäßig geprüft. Details: N2, F11, F22, F32.
- **Normale Anwender zuerst:** Standardwerte genügen für ein Ergebnis, Expertenfelder sind eingeklappt. Sprache und Ansprache: `CLAUDE.md` (Konventionen).
- **Barrierefrei** und für das Handy geeignet. Details: N7, N4.
- **Kostenlos, ohne Werbung, nicht kommerziell;** offen für Mithilfe auf GitHub. Keine Finanz-, Steuer- oder Förderberatung, Angaben ohne Gewähr. Details: N5, N8.

## Was der Rechner nicht ist

- **Kein kompletter Sanierungsrechner:** keine Dämmung, Fenster, Dach, Photovoltaik-Planung oder Gesamtsanierung. Die Wärmepumpe ist das einzige Ziel.
- **Kein Planungs- oder Auslegungswerkzeug:** keine Heizlastberechnung, Geräteauswahl, Hydraulik oder Bemessung. Die Jahresarbeitszahl wird nur geschätzt, wenn der Nutzer keinen Wert kennt.
- **Kein Angebots- oder Beratungsersatz** und kein Förderantrag.
- **Nicht für Profis gebaut:** keine Funktionen, die nur Fachleute brauchen (z. B. Kundenverwaltung, Mandanten, Reports für Dritte als Dienst).
- **Nicht gemeint:** Neubau und Gewerbe- bzw. Nichtwohngebäude.
- **Derzeit nicht abgedeckt, mögliche Erweiterung:** Vermieter, Wohnungseigentümergemeinschaften, Förderprogramme der Länder und Kommunen (stehen als Ideen im Benutzerhandbuch).
- **Kein Online-Dienst:** keine Konten, kein Server, keine Zusammenarbeit mehrerer Personen im Rechner, keine Benachrichtigungen.

## Leitplanken für neue Anforderungen

Eine Anforderung ist **gedeckt**, wenn sie (1) auf einen ausdrücklichen Wunsch des Nutzers oder eine bestehende Anforderung zurückgeht, (2) zum Zweck und zu den Benutzern oben passt und (3) keiner Grundentscheidung widerspricht. Prüfe jede Anforderung so:

- **Nicht erfunden:** Jeder Punkt lässt sich auf die Eingabe des Nutzers, eine bestehende Anforderung oder eine zwingende Folge (Barrierefreiheit, Datenschutz, Fehlerfälle, Dokumentation) zurückführen. Zusätzliche Funktionen, Felder, Optionen oder Einstellungen „für später“ sind nicht gedeckt.
- **Nicht zu komplex:** Die einfachste Lösung, die den Wunsch erfüllt, wird gewählt; Expertenwege bleiben eingeklappt oder entfallen.
- **Kein Widerspruch:** keine Server-Speicherung, keine Konten, keine neue externe Verarbeitung, keine Beratungsaussagen, keine Gebäudearten oder Zielgruppen außerhalb des Rahmens.
- **Maß halten bei Folgearbeit:** Grenzfälle, Fehlertexte, Tests und Dokumentation sind gedeckt; neue Nebenfunktionen daraus nicht.

Ist eine Anforderung nicht gedeckt, streicht der Reviewer sie oder legt sie dem Nutzer als offenen Punkt vor.

# F21 – Weiterempfehlen

- F21.1 Der Punkt „Weiterempfehlen“ im Menü „Teilen & Export“ der Werkzeugleiste (F38.1) öffnet einen Dialog mit WhatsApp (`whatsapp://send?text=`, öffnet die App direkt – über `wa.me` ging der Text in WhatsApp Desktop für macOS verloren), „Andere“ (Teilen-Menü des Geräts per Web Share API, z. B. für Signal, das keinen Teilen-Link anbietet; sonst Text in die Zwischenablage), Threema (`threema.id/compose?text=`), E-Mail (`mailto:` mit Betreff und Text) und „Link kopieren“; bewusst ohne Facebook und X. *(Test: share, ui, help)*
- F21.2 Geteilt wird nur die Adresse des Rechners (ohne `#z=…`/`#s=…` und Query-Parameter), nie die Eingaben; Empfehlungstext in `src/ui/share.ts`. *(Test: share)*

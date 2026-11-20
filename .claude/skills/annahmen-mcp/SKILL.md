---
name: annahmen-mcp
description: Prüft die Förder- und Rechtswerte des Rechners gegen die Wissensbasis des MCP-Servers wpir-mcp und zeigt die Abweichungen.
disable-model-invocation: true
---

1. Prüfe mit `npm run check:mcp`, dass der Server erreichbar ist und der Vertrag stimmt. Schlägt das fehl, zeige dem Nutzer die Meldung und höre auf (der Server ist möglicherweise noch nicht bei Vercel bereitgestellt, die URL steht in `.mcp.json`).
2. Starte den Agenten `assumptions-checker` ohne weitere Vorgaben.
3. Gib seinen Bericht unverändert wieder. Ändere keine Dateien; bei Abweichungen frage den Nutzer, ob du sie einzeln gegen die Quelle prüfen sollst (Seite öffnen), bevor etwas angepasst wird.

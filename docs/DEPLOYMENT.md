# Deployment auf den Webspace

Der Workflow `.github/workflows/deploy.yml` veröffentlicht den Rechner per SSH auf einem Webspace (N12).

## Ablauf

1. Ein Pull Request wird per Squash-Merge in `main` übernommen.
2. Der Workflow **Release** leitet die Version ab und committet ggf. `chore(release): x.y.z`.
3. Danach startet **Deploy** automatisch:
   - **build** – `npm ci`, Tests, `npm run build` auf dem neuesten `main` (inkl. Release-Commit), ohne Zugriff auf den SSH-Schlüssel. Die Zusammenfassung des Laufs zeigt danach unter **„Änderungen … → …“** die Changelog-Einträge, die online gehen: alle Versionen nach der Live-Version (aus `version.json` der Seite) bis zur neuen. So siehst du vor der Freigabe in „Review deployments“, was deployt wird. Lokal: `node scripts/deploy-changelog.ts [url] [version]`.
   - **deploy** – lädt nur das fertige `dist/` herunter und überträgt es mit `rsync` über SSH. Neue Dateien werden erst am Ende umgeschaltet, alte zuletzt gelöscht.
   - **verify** – prüft danach die ausgelieferte Seite, ohne Zugriff auf Secrets (siehe [Prüfung nach dem Deployment](#prüfung-nach-dem-deployment)). Schlägt sie fehl, ist der Lauf rot.
4. Manuell auslösen: GitHub → Actions → **Deploy** → „Run workflow“.

Nicht automatisch veröffentlicht werden Merges durch den Dependabot-Workflow (sie lösen keinen Release aus); sie gehen mit dem nächsten regulären Merge oder einem manuellen Lauf online.

## Einrichtung (einmalig)

### 1. Deploy-Schlüssel erzeugen

Eigenen Schlüssel nur für dieses Deployment, ohne Passphrase:

```bash
ssh-keygen -t ed25519 -N "" -C "github-deploy waermepumpen-rechner" -f deploy_key
```

Nicht den persönlichen Schlüssel aus `~/.ssh/` verwenden – der Deploy-Schlüssel liegt ohne Passphrase in GitHub und soll nur diesen Webspace erreichen.

Den Inhalt von `deploy_key.pub` auf dem Webspace in `~/.ssh/authorized_keys` eintragen (bei vielen Hostern über die Verwaltungsoberfläche). Wenn der Hoster es erlaubt, den Schlüssel einschränken, z. B. mit `restrict` vor der Zeile.

Verbindung und `rsync` lokal testen:

```bash
ssh -i deploy_key -o IdentitiesOnly=yes -p 22 benutzer@webspace.example.de "ls -d /pfad/zum/ziel && which rsync"
```

### 2. Host-Key des Servers ermitteln

ED25519 genügt (modern, von allen aktuellen OpenSSH-Versionen unterstützt):

```bash
ssh-keyscan -t ed25519 -p 22 webspace.example.de > host_key.txt
ssh-keygen -lf host_key.txt
```

Den angezeigten `SHA256:…`-Fingerabdruck Zeichen für Zeichen mit dem ED25519-Fingerabdruck des Hosters vergleichen (MD5-Angaben: `ssh-keygen -lf host_key.txt -E md5`). Erst wenn er übereinstimmt, den Inhalt von `host_key.txt` als `SSH_KNOWN_HOSTS` hinterlegen – der Workflow vertraut nur diesem Eintrag (kein `ssh-keyscan` im Workflow, Schutz vor untergeschobenen Servern).

Der Hostname (bzw. `[host]:port` bei anderem Port als 22) in der Zeile muss genau dem Wert von `DEPLOY_HOST` und `DEPLOY_PORT` entsprechen.

### 3. Umgebung „production“ in GitHub anlegen

GitHub → Settings → Environments → **New environment** `production`:

| Art | Name | Inhalt |
|---|---|---|
| Secret | `SSH_PRIVATE_KEY` | Inhalt von `deploy_key` (privater Schlüssel) |
| Secret | `SSH_KNOWN_HOSTS` | Ausgabe von `ssh-keyscan` |
| Variable | `DEPLOY_HOST` | Hostname des Webspace |
| Variable | `DEPLOY_USER` | SSH-Benutzer |
| Variable | `DEPLOY_PATH` | Zielverzeichnis, z. B. `/www/htdocs/rechner` |
| Variable | `DEPLOY_PORT` | optional, Standard 22 |
| Variable | `DEPLOY_URL` | optional, öffentliche Adresse – erscheint im Workflow-Lauf |

Optional unter „Deployment protection rules“: Freigabe durch eine Person vor jedem Deployment oder Beschränkung auf den Branch `main`.

Danach `deploy_key`, `deploy_key.pub` und `host_key.txt` lokal löschen. Geht der Schlüssel verloren, einfach einen neuen erzeugen und beim Hoster und in GitHub austauschen.

### 4. Zielverzeichnis

- `DEPLOY_PATH` muss ein **eigenes Verzeichnis** nur für den Rechner sein: Sein Inhalt wird bei jedem Deployment durch `dist/` ersetzt (`rsync --delete`). Leere oder zu allgemeine Pfade (`/`, `~`, `.`, Pfade mit `..`) lehnt der Workflow ab.
- Die `.htaccess` des Rechners kommt aus dem Repository (`public/.htaccess`) und wird mit jedem Deployment hochgeladen (F33.6). Änderungen daran also im Repository machen, nicht auf dem Server – Änderungen auf dem Server werden überschrieben. Ausgenommen ist nur `.well-known/`: Sie wird weder überschrieben noch gelöscht und kann auf dem Server gepflegt werden, z. B. für die Zertifikatsprüfung.
- Der Build nutzt relative Pfade (`base: './'`), funktioniert also auch in einem Unterverzeichnis.
- Auf dem Webspace muss `rsync` verfügbar sein (bei den meisten Hostern mit SSH-Zugang der Fall).

## Absicherung (öffentliches Repository)

Eingerichtet am 14.11.2026:

| Ebene | Einstellung | Wirkung |
|---|---|---|
| Umgebung `production` | **Required reviewers:** chkania | Jedes Deployment wartet auf eine Freigabe (Actions → Lauf → „Review deployments“). |
| Umgebung `production` | **Deployment branches:** nur `main` | Workflows aus anderen Branches erhalten die SSH-Secrets nicht – auch nicht, wenn jemand den Workflow dort ändert. |
| Regelsatz „main schützen“ | kein Force-Push, kein Löschen von `main` | Der veröffentlichte Verlauf kann nicht überschrieben werden. |
| Actions → Fork-PRs | **Freigabe für alle externen Mitwirkenden** | Workflows aus PRs von Forks laufen erst nach Zustimmung. |

Ohnehin gilt: Workflows aus Fork-PRs erhalten keine Secrets, und Deploy startet nur nach dem Release-Workflow auf `main` oder manuell durch Personen mit Schreibrecht.

Weitere Empfehlungen:

- **Schlüssel auf dem Server einschränken** (wirksamster Schutz bei einem gestohlenen Schlüssel): in `~/.ssh/authorized_keys` die Zeile des Deploy-Schlüssels auf rsync in das Zielverzeichnis begrenzen, z. B. `command="rrsync -wo /pfad/zum/ziel",restrict ssh-ed25519 AAAA… github-deploy` (`rrsync` liegt rsync bei; Pfad je nach System, ggf. `/usr/share/doc/rsync/support/rrsync`).
- **Wenige Personen mit Schreibrecht:** Wer schreiben darf, kann Workflows ändern und so an Secrets gelangen. Stand 14.11.2026 hat nur chkania (Admin) Zugriff. Mitwirkende arbeiten über Forks und Pull Requests; wer beim Sortieren von Issues und PRs hilft, bekommt höchstens die Rolle **Triage** (kein Push), **Write** nur bei echtem Vertrauen, **Admin** bleibt beim Inhaber. Prüfen unter Settings → Collaborators.
- **„Nur per PR“ und Pflicht-Checks für `main`** sind derzeit nicht aktiv: Bei persönlichen Repositorys kann GitHub Actions nicht als Ausnahme eingetragen werden, und der Release-Workflow muss seinen Commit `chore(release): x.y.z` direkt auf `main` pushen.

### Prüfung nach dem Deployment

Der Job **verify** startet `scripts/smoke-test.ts` gegen die veröffentlichte Adresse (`DEPLOY_URL`, sonst `https://waermepumpen-investitionsrechner.de/`). Er prüft:

| Prüfung | Was genau |
|---|---|
| Version | `version.json` (vom Build geschrieben) enthält die gebaute Version und den Commit. Abgerufen ohne Cache, bis zu sechs Versuche im Abstand von 10 Sekunden. |
| Versionsanzeige | Der Rechner zeigt „Version x.y.z“ in der Kopfzeile. |
| Rechnen | Die Kennzahlen erscheinen; nach einer geänderten Eingabe (Verbrauch) ändern sie sich. |
| Diagramme | Chart.js wird nachgeladen, mindestens ein Diagramm ist gezeichnet. |
| Quellenhinweis | Ein „i“-Popover öffnet sich mit Inhalt. |
| Weitere Seiten | Alle Seiten aus `sitemap.xml` laden mit Überschrift; im Changelog steht die neue Version. |
| Fehler | Keine Skriptfehler, keine Fehler in der Konsole, keine fehlgeschlagenen Anfragen (z. B. fehlende Dateien, CSP-Verstöße). |

Als Browser dient das auf den GitHub-Runnern vorinstallierte Google Chrome über `playwright-core` (kein eigener Browser-Download). Die Besucherstatistik wird blockiert und zusätzlich per Widerspruch abgeschaltet, die Prüfung zählt also nie als Besuch. Ergebnis: Log des Jobs und Zusammenfassung des Laufs.

Lokal (Chrome oder ein anderer Chromium-Browser über `CHROME_PATH`):

```bash
npm run smoke
```

```bash
npm run build && npm run preview
```

```bash
npm run smoke -- http://localhost:4173/
```

### Fehler „No ED25519 host key is known …“

Das Secret `SSH_KNOWN_HOSTS` enthält keinen passenden Eintrag. Häufige Ursachen: Statt der Zeile aus `ssh-keyscan` wurde nur der Fingerabdruck (`SHA256:…`) eingetragen, der Hostname in der Zeile weicht von `DEPLOY_HOST` ab, oder die Zeile ist gehasht (`|1|…`, entsteht mit `ssh-keyscan -H`). Richtig ist eine Zeile der Form `host.example.de ssh-ed25519 AAAA…`.

### Weiterleitung auf die Hauptdomain

Der Rechner ist unter mehreren Domains erreichbar: `waermepumpen-investitionsrechner.de`, `www.waermepumpen-investitionsrechner.de`, `waermepumpen-umruestungsrechner.de`, `www.waermepumpen-umruestungsrechner.de` und die Kurzdomain `wpir.de` (mit `www.wpir.de`). Die Kurzdomain steht in den Links mit Werten und im QR-Code des Berichts; diese Links funktionieren nur, solange `wpir.de` weiterleitet. Alle Aufrufe sollen dauerhaft (301) auf **`https://waermepumpen-investitionsrechner.de`** gehen.

- Pfad und Parameter bleiben erhalten, z. B. `…/hilfe.html#link-mit-werten-teilen`.
- Geteilte Links mit Eingaben (`#z=…`) funktionieren weiter: Der Teil nach `#` wird nie an den Server geschickt, und der Browser hängt ihn nach der Weiterleitung wieder an.

Diese Regeln in die `.htaccess` jedes Ordners schreiben, der eine dieser Domains ausliefert (bei Uberspace unter `~/www/`; `ls ~/www` zeigt die Ordner):

```apache
# Redirect every other host name to the main domain – permanent (301), path and query are kept
RewriteEngine On
RewriteCond %{HTTP_HOST} !^waermepumpen-investitionsrechner\.de$ [NC]
RewriteRule ^ https://waermepumpen-investitionsrechner.de%{REQUEST_URI} [R=301,L,NE]
```

- **Ordner des Rechners** (`DEPLOY_PATH`): Hier steht die Regel bereits in `public/.htaccess` im Repository und wird mit dem Deployment hochgeladen. Eine Anpassung nur dort vornehmen.
- **Ordner der übrigen Domains** (z. B. `~/www/waermepumpen-umruestungsrechner.de`): Hier leitet die Regel jeden Aufruf weiter. Weitere Dateien braucht der Ordner nicht.
- **HTTPS** ist nicht Teil der Regel: Uberspace leitet `http://` selbst auf `https://` um. Eine Prüfung von `%{HTTPS}` würde hinter dem TLS-Proxy des Hosters sogar zu einer Endlosschleife führen.

Prüfen, z. B.:

```bash
for d in waermepumpen-umruestungsrechner.de www.waermepumpen-umruestungsrechner.de www.waermepumpen-investitionsrechner.de wpir.de www.wpir.de; do curl -sI "https://$d/hilfe.html?x=1" | grep -i -E '^(HTTP|location)'; done
```

Erwartet wird jeweils `HTTP/… 301` und `location: https://waermepumpen-investitionsrechner.de/hilfe.html?x=1`.

### Zwischenspeichern im Browser (Cache)

Ohne eigene Angaben raten Browser, wie lange sie Dateien zwischenspeichern. Nach einem Deployment sieht man dann unter Umständen noch eine Weile die alte Version. Der Build legt JavaScript, CSS und Schriften unter `assets/` mit einem Inhalts-Hash im Dateinamen ab (z. B. `main-Cj4rdn9b.js`). Ändert sich eine Datei, ändert sich also auch ihr Name. Daraus ergeben sich diese Regeln (eingerichtet am 15.11.2026; seit F33.6 in `public/.htaccess` im Repository):

```apache
<IfModule mod_headers.c>
  # HTML: always revalidate, so a new release shows up immediately (cheap 304 via ETag)
  <FilesMatch "\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  # Build files with a content hash in their name never change: cache for one year
  <If "%{REQUEST_URI} =~ m#^/assets/#">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </If>
  # Favicon and touch icon: one week
  <FilesMatch "^(favicon\.svg|apple-touch-icon\.png)$">
    Header set Cache-Control "public, max-age=604800"
  </FilesMatch>
</IfModule>
```

| Dateien | Cache-Control | Wirkung |
|---|---|---|
| HTML-Seiten | `no-cache` | Vor jeder Nutzung kurz beim Server nachfragen. Ist nichts neu, antwortet er mit 304. Neue Versionen sind sofort sichtbar. |
| `assets/…` | `public, max-age=31536000, immutable` | Ein Jahr ohne Nachfrage nutzen. Unproblematisch, weil eine geänderte Datei einen neuen Namen bekommt. |
| Favicon, Touch-Icon | `public, max-age=604800` | Eine Woche |

Prüfen:

```bash
curl -sI https://waermepumpen-investitionsrechner.de/ | grep -i cache-control
```

Erwartet: `cache-control: no-cache`. Für eine Datei unter `assets/` erwartet: `public, max-age=31536000, immutable`.

### Sicherheits-Header

Die Content-Security-Policy steht im HTML (`<meta>`-Tag, erzeugt aus `csp.ts`). Einige Schutzmaßnahmen wirken aber nur als HTTP-Header. Diese Header sind gesetzt (eingerichtet am 15.11.2026; seit F33.6 in `public/.htaccess` im Repository):

```apache
<IfModule mod_headers.c>
  # Only HTTPS for one year (all domains redirect to HTTPS anyway)
  Header always set Strict-Transport-Security "max-age=31536000"
  # Own browsing context group: no access from pages opened via window.open
  Header always set Cross-Origin-Opener-Policy "same-origin"
  # Do not allow embedding in frames (clickjacking)
  Header always set X-Frame-Options "DENY"
  # Do not guess MIME types
  Header always set X-Content-Type-Options "nosniff"
  # Send only the origin to other sites, never path or hash (scenario link)
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
```

| Header | Wirkung |
|---|---|
| `Strict-Transport-Security` | Der Browser ruft die Seite ein Jahr lang nur noch über HTTPS auf. Achtung: Diese Zusage lässt sich nicht kurzfristig zurücknehmen, die Domains müssen dauerhaft HTTPS anbieten. |
| `Cross-Origin-Opener-Policy` | Fremde Seiten, die den Rechner in einem neuen Fenster öffnen, erhalten keinen Zugriff auf dieses Fenster. |
| `X-Frame-Options` | Der Rechner kann nicht in fremde Seiten eingebettet werden (Schutz vor Clickjacking). `frame-ancestors` aus der CSP wirkt im `<meta>`-Tag nicht, deshalb dieser Header. |
| `X-Content-Type-Options` | Der Browser hält sich an den angegebenen Dateityp und rät nicht. |
| `Referrer-Policy` | Bei Links auf andere Seiten wird höchstens die Domain übertragen. |

Prüfen:

```bash
curl -sI https://waermepumpen-investitionsrechner.de/ | grep -i -E 'strict-transport|cross-origin|x-frame|x-content|referrer'
```

Erwartet werden die fünf Header mit den Werten oben. Der Smoke-Test nach jedem Deployment (`scripts/smoke-test.ts`, Job „verify“) prüft sie automatisch mit; bei einer Adresse ohne HTTPS (z. B. lokale Vorschau) entfällt diese Prüfung. Lighthouse (Best Practices, „Trust and Safety“) meldet danach nur noch, dass die CSP im `<meta>`-Tag statt im Header steht und keine Trusted Types nutzt – beides ist bewusst so.

### Datenschutzerklärung prüfen

Die Datenschutzerklärung sagt, dass keine Server-Log-Dateien gespeichert werden. Das hängt vom Webspace ab – bitte beim Hoster prüfen und `docs/DATENSCHUTZ.md` ggf. anpassen.

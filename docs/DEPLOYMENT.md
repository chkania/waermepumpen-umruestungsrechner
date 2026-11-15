# Deployment auf den Webspace

Der Workflow `.github/workflows/deploy.yml` veröffentlicht den Rechner per SSH auf einem Webspace (N12).

## Ablauf

1. Ein Pull Request wird per Squash-Merge in `main` übernommen.
2. Der Workflow **Release** leitet die Version ab und committet ggf. `chore(release): x.y.z`.
3. Danach startet **Deploy** automatisch:
   - **build** – `npm ci`, Tests, `npm run build` auf dem neuesten `main` (inkl. Release-Commit), ohne Zugriff auf den SSH-Schlüssel.
   - **deploy** – lädt nur das fertige `dist/` herunter und überträgt es mit `rsync` über SSH. Neue Dateien werden erst am Ende umgeschaltet, alte zuletzt gelöscht.
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
- Ausgenommen sind `.htaccess` und `.well-known/`. Sie werden weder überschrieben noch gelöscht und können auf dem Server gepflegt werden, z. B. für die Weiterleitung auf die Hauptdomain (siehe unten) oder die Zertifikatsprüfung.
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

### Fehler „No ED25519 host key is known …“

Das Secret `SSH_KNOWN_HOSTS` enthält keinen passenden Eintrag. Häufige Ursachen: Statt der Zeile aus `ssh-keyscan` wurde nur der Fingerabdruck (`SHA256:…`) eingetragen, der Hostname in der Zeile weicht von `DEPLOY_HOST` ab, oder die Zeile ist gehasht (`|1|…`, entsteht mit `ssh-keyscan -H`). Richtig ist eine Zeile der Form `host.example.de ssh-ed25519 AAAA…`.

### Weiterleitung auf die Hauptdomain

Der Rechner ist unter mehreren Domains erreichbar: `waermepumpen-investitionsrechner.de`, `www.waermepumpen-investitionsrechner.de`, `waermepumpen-umruestungsrechner.de`, `www.waermepumpen-umruestungsrechner.de`. Alle Aufrufe sollen dauerhaft (301) auf **`https://waermepumpen-investitionsrechner.de`** gehen.

- Pfad und Parameter bleiben erhalten, z. B. `…/hilfe.html#link-mit-werten-teilen`.
- Geteilte Links mit Eingaben (`#z=…`) funktionieren weiter: Der Teil nach `#` wird nie an den Server geschickt, und der Browser hängt ihn nach der Weiterleitung wieder an.

Diese Regeln in die `.htaccess` jedes Ordners schreiben, der eine dieser Domains ausliefert (bei Uberspace unter `~/www/`; `ls ~/www` zeigt die Ordner):

```apache
# Redirect every other host name to the main domain – permanent (301), path and query are kept
RewriteEngine On
RewriteCond %{HTTP_HOST} !^waermepumpen-investitionsrechner\.de$ [NC]
RewriteRule ^ https://waermepumpen-investitionsrechner.de%{REQUEST_URI} [R=301,L,NE]
```

- **Ordner des Rechners** (`DEPLOY_PATH`): Hier leitet die Regel nur die Aufrufe über `www.…` weiter; die Hauptdomain wird normal ausgeliefert. Gibt es dort schon eine `.htaccess`, die Zeilen an den Anfang setzen. Das Deployment lässt `.htaccess` unverändert.
- **Ordner der übrigen Domains** (z. B. `~/www/waermepumpen-umruestungsrechner.de`): Hier leitet die Regel jeden Aufruf weiter. Weitere Dateien braucht der Ordner nicht.
- **HTTPS** ist nicht Teil der Regel: Uberspace leitet `http://` selbst auf `https://` um. Eine Prüfung von `%{HTTPS}` würde hinter dem TLS-Proxy des Hosters sogar zu einer Endlosschleife führen.

Prüfen, z. B.:

```bash
for d in waermepumpen-umruestungsrechner.de www.waermepumpen-umruestungsrechner.de www.waermepumpen-investitionsrechner.de; do curl -sI "https://$d/hilfe.html?x=1" | grep -i -E '^(HTTP|location)'; done
```

Erwartet wird jeweils `HTTP/… 301` und `location: https://waermepumpen-investitionsrechner.de/hilfe.html?x=1`.

### Empfohlene HTTP-Header

Die Content-Security-Policy steht bereits im HTML. Zusätzlich empfehlenswert, z. B. in `.htaccess` (Apache):

```apache
Header always set X-Frame-Options "DENY"
Header always set Content-Security-Policy "frame-ancestors 'none'"
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
```

### Datenschutzerklärung prüfen

Die Datenschutzerklärung sagt, dass keine Server-Log-Dateien gespeichert werden. Das hängt vom Webspace ab – bitte beim Hoster prüfen und `docs/DATENSCHUTZ.md` ggf. anpassen.

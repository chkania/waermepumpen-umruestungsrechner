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
- Ausgenommen sind `.htaccess` und `.well-known/` – sie werden weder überschrieben noch gelöscht und können auf dem Server gepflegt werden (z. B. Weiterleitung auf HTTPS, Zertifikatsprüfung).
- Der Build nutzt relative Pfade (`base: './'`), funktioniert also auch in einem Unterverzeichnis.
- Auf dem Webspace muss `rsync` verfügbar sein (bei den meisten Hostern mit SSH-Zugang der Fall).

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

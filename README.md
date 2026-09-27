# Stundenplan Altenbach

Stundenplan für die Küche im Restaurant Altenbach.

Online: [dexterjett.github.io/Stundenplan-Altenbach](https://dexterjett.github.io/Stundenplan-Altenbach/)

Die Seite ist öffentlich erreichbar und mit einem Passwort geschützt. Das Passwort steht nicht in diesem Repository. Lokal reicht ein Doppelklick auf `index.html` in Chrome oder Edge. Änderungen bleiben in diesem Browser gespeichert.

## GitHub Pages

Nach einem Push auf `main` veröffentlicht `.github/workflows/pages.yml` die Seite. Die Quelle unter **Settings → Pages** ist **GitHub Actions**.

Der Wochenplan liegt verschlüsselt in `vault.js`. Ohne Passwort sind die Zeiten weder auf der Seite noch in dieser Datei lesbar.

## Bedienung

- Die Woche beginnt am Montag und endet am Sonntag.
- Mit den Pfeilen die Woche wählen. **Diese Woche** ändert nur diese Woche, **Standardplan** ändert die Vorlage.
- Einen Tag anklicken und die Zeiten anpassen. **Ende** heißt: die Schicht läuft, bis Feierabend ist. Im alten Plan stand dafür **E**.
- Unter **Schnellwahl** die aktuellen Zeiten benennen und mit **Diese Zeiten merken** sichern. Eigene Schnellwahlen lassen sich mit dem Kreuz wieder entfernen.
- Wochen ohne eigene Anpassung übernehmen den Standardplan.
- **Drucken** hängt den Plan aus. **WhatsApp-Text** kopiert ihn zum Verschicken.
- Unter **Sicherung** den Plan herunterladen, wenn er auf einen anderen Computer soll.

## Tests

```bash
node --test
```

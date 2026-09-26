# Stundenplan Altenbach

Stundenplan für die Küche im Restaurant Altenbach.

Online: [dexterjett.github.io/Stundenplan-Altenbach](https://dexterjett.github.io/Stundenplan-Altenbach/)

Lokal reicht ein Doppelklick auf `index.html` in Chrome oder Edge. Änderungen bleiben in diesem Browser gespeichert.

## GitHub Pages

Die Seite wird aus diesem Repository veröffentlicht. Nach einem Push auf `main` legt der Workflow `.github/workflows/pages.yml` die Dateien `index.html`, `styles.css`, `app.js` und `plan.js` auf GitHub Pages.

Einmalig unter **Settings → Pages → Build and deployment** die Quelle **GitHub Actions** wählen.

Das Repository ist privat. Bei einem kostenlosen GitHub-Konto muss es öffentlich sein, damit die Adresse ohne Anmeldung aufgeht. Namen und Zeiten sind dann im Internet sichtbar.

## Bedienung

- Die Woche beginnt am Sonntag, wie im bisherigen Plan.
- Mit den Pfeilen die Woche wählen. **Diese Woche** ändert nur diese Woche, **Standardplan** ändert die Vorlage.
- Einen Tag anklicken und die Zeiten anpassen. **Ende** heißt: die Schicht läuft, bis Feierabend ist. Im alten Plan stand dafür **E**.
- Wochen ohne eigene Anpassung übernehmen den Standardplan.
- **Drucken** hängt den Plan aus. **WhatsApp-Text** kopiert ihn zum Verschicken.
- Unter **Sicherung** den Plan herunterladen, wenn er auf einen anderen Computer soll.

## Winterplan

Donnerstag ist bereits angepasst:

| | Zeiten |
| --- | --- |
| Alex | 10:00–13:00 und 16:00–18:30 |
| Miki | 10:00–16:00 und 18:30–22:00 |
| Seferina | 13:00–22:00, unverändert |

Sonntag arbeitet Alex ab 10:00 bis Ende, Montag Miki ab 10:00 bis Ende.

## Tests

```bash
node --test
```

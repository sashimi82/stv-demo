# StV-Erfassung · Demo

Digitale Erfassung und Visierung von Stellvertretungseinsätzen in der Schulergänzenden Betreuung. Die Demo braucht keinen Datenserver: Alle Eingaben bleiben im Browser des jeweiligen Geräts. GitHub liefert nur die leeren Seiten aus.

## Dateien

| Datei | Für wen | Gerät |
|---|---|---|
| `index.html` | Startseite der Demo mit Anleitung | alle |
| `stv.html` | Stellvertretung: Einsätze erfassen, QR-Code zeigen, Quittung scannen, Abrechnung senden | eigenes Handy |
| `leitung.html` | Leitung: Leitungsmodus mit Stamm-PIN und Ferien-PIN, visieren, Visa exportieren | Betreuungshandy |
| `admin.html` | Administration: Standort-Schlüssel, Abgleich, Abweichungen, Excel-Export, Archiv | Büro-PC |
| `shared.js` | gemeinsame Bausteine und **Einstellungen** (Standorte, Funktionen, Mail-Adresse) | – |
| `index.js`, `stv.js`, `leitung.js`, `admin.js` | Programmlogik der vier Seiten | – |
| `shared.css`, `qrlib.js`, `jsQR.js` | Gestaltung, QR-Code-Erzeugung und QR-Code-Lesen (alles lokal, nichts aus dem Internet) | – |

## Auf GitHub Pages stellen (ca. 15 Minuten)

1. Auf github.com ein neues Repository anlegen, zum Beispiel `stv-demo`. Für die Demo genügt «Public».
2. «Add file» → «Upload files» → alle Dateien aus diesem Ordner hineinziehen → «Commit changes».
3. «Settings» → «Pages» → bei «Branch» `main` und `/ (root)` wählen → «Save».
4. Nach 1–2 Minuten ist die Demo unter `https://<benutzername>.github.io/stv-demo/` erreichbar.

Die Kamera funktioniert nur über https, und das bietet GitHub Pages automatisch.

## Demo durchspielen

1. **Administration** (PC): `admin.html` → «Standorte und Schlüssel» → bei Test-Betreuung 1 «Schlüssel erzeugen».
2. **Leitung** (zweites Handy): `leitung.html` zuerst zum Home-Bildschirm hinzufügen, von dort öffnen, den Einrichtungs-QR-Code am PC scannen und eine Stamm-PIN festlegen.
3. **Stellvertretung** (eigenes Handy): `stv.html` zum Home-Bildschirm hinzufügen, Profil anlegen, Einsatz in Test-Betreuung 1 erfassen.
4. Die Leitung scannt den QR-Code und visiert, danach scannt die Stellvertretung die Quittung.
5. Die Leitung tippt auf «Visa exportieren», die Stellvertretung auf «Abrechnung senden». Beide schicken ihre Datei per Mail.
6. Die Administration zieht beide Dateien in die Prüfung.

Mit nur einem Gerät öffnest du die Seiten in zwei Tabs und nutzt «Code eintippen» statt zu scannen.

Gut zum Ausprobieren:
- Einen Einsatz nach dem Visum ändern: Er erscheint als «Abweichung».
- Einen Einsatz in einer anderen Betreuung erfassen: Die Leitung kann ihn nicht visieren.
- Eine Ferien-PIN erstellen, sperren und mit der Ferien-PIN entsperren: Stornieren und PIN-Verwaltung fehlen dann.
- In der Leitungsdatei eine Zeit von Hand ändern: Die Prüfung meldet «Signatur stimmt nicht».
- Dieselbe StV-Datei nach dem Abrechnen nochmals laden: Sie erscheint als «schon abgerechnet».

## Einstellungen anpassen

Oben in `shared.js` im Block `CONFIG`:
- `standorte`: Namen anpassen und neue Standorte mit der nächsten Nummer anhängen. **Bestehende Nummern nie ändern**, denn sie stecken in den Codes.
- `funktionen`: Reihenfolge nie ändern, nur ergänzen.
- `adminEmail`: Mail-Adresse der Administration.

## Wie die Sicherheit funktioniert (kurz)

- Der Einsatz-Code (16 Zeichen) enthält alle Angaben und eine Prüfsumme. In Tests wurde jeder Tippfehler bei einem einzelnen Zeichen und jeder Zahlendreher erkannt.
- Jede Betreuung hat einen geheimen Standort-Schlüssel. Das Betreuungshandy unterschreibt damit jedes Visum (HMAC-SHA-256). Wird ein Visum nachträglich verändert, stimmt die Unterschrift nicht mehr.
- Abgerechnet werden immer die Werte aus dem unterschriebenen Visum, nicht die Angaben aus der StV-Datei.
- Die Ferien-PIN gilt nur im gewählten Zeitraum (max. 6 Wochen) und hat eingeschränkte Rechte.
- Plausibilität: Einsätze nur zwischen 05:30 und 22:30 Uhr, höchstens 12 Stunden. Die Leitungs-App lehnt Überschneidungen derselben Person ab; die Administration prüft Überschneidungen und das Tagestotal über alle Standorte.
- Die Administration liest nur Dateien im erwarteten Aufbau ein. Unzulässige Einträge werden abgewiesen. Ein gültiges Visum kann nicht durch eine gefälschte Kopie verdrängt werden.
- Eine Sicherheitsregel (Content-Security-Policy) erlaubt nur die eigenen Skripte und verbietet jede Verbindung ins Internet.
- Visa dürfen in beliebiger Reihenfolge und nachträglich eingeholt werden (nur Hinweis). Zeitstempel, die auf eine verstellte Uhr hindeuten, markiert die Administration und wählt diese Einsätze nicht automatisch zur Abrechnung aus.
- Bekannte Restrisiken: Wer die Handy-Uhr verstellt, kann Zeitstempel beeinflussen (wird oft erkannt, nicht immer). Wer technisch versiert ist und das Betreuungshandy samt PIN in der Hand hat, kann den Standort-Schlüssel auslesen.

## Vor dem echten Einsatz (nicht Teil der Demo)

- **Eigene Domain:** Auf einem Stadtserver mit eigener (Sub-)Domain betreiben, die keine anderen Anwendungen enthält. Der Browser-Speicher wird pro Domain geteilt.
- Im Echtbetrieb den Demo-Link «Hier als Betreuungshandy einrichten» entfernen.
- Mit der Informatik und der Datenschutzstelle klären, wo die Seiten liegen dürfen.
- Testen, ob die Betreuungshandys (zentral verwaltet?) Home-Bildschirm-Apps und die Kamera im Browser erlauben.
- Regelmässige Sicherung der Admin-Daten (Tab «Sicherung») festlegen. Sie enthält die Schlüssel.
- Wichtig auf dem iPhone: Safari und die Home-Bildschirm-App haben getrennte Speicher. Darum zuerst zum Home-Bildschirm hinzufügen, dann einrichten.

QR-Code-Erzeugung: «QRCode for JavaScript», © 2009 Kazuhiko Arase, MIT-Lizenz.

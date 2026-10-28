# cTCG Creator (Custom TCG Creator)

> Desktop-App zum Gestalten, Drucken und Verwalten eigener Sammel- und Spielkartensets für den privaten Kreis. Claude-Instanzen können die App bedienen.

| | |
|---|---|
| Projekttyp | Allgemeines KI-Projekt |
| Struktur | standard |
| KI-Tools | Claude Code |
| Owner | Wildhunt Community |
| Angelegt | 2026-10-23 |
| Tags | sammelkarten, kartendesign, druck, privat |

## Projektziel

Mit cTCG Creator (Custom TCG Creator, bis Oktober 2026 „Card Creator“) gestaltet man eigene Kartensets. Möglich sind reine Sammelkarten (Bild, Name, Beschreibung) und Spielkarten im TCG-Stil (Werte, Fähigkeiten, Seltenheit). Die Bilder sind eigene Fotos oder KI-generierte Bilder. Die App verwaltet Sets, Nummerierung, Seltenheiten, Vorlagen und Rahmen pro Set, Versionen einzelner Karten und eine Sammlungsübersicht („besitze ich“, „gedruckt“). Ausgegeben werden einzelne PNG-Dateien pro Karte und druckfertige PDF-Bögen für einen Druckdienst.

Claude entwickelt die Software, entwirft aber keine Karteninhalte. Damit Claude-Instanzen die App zum Erstellen von Karten bedienen können, bekommt sie eine Schnittstelle für Claude.

Erfolg heißt: Ein Set lässt sich vollständig in der App anlegen und als Druckdatei an einen Druckdienst geben, per Hand oder über eine Claude-Instanz. Private Fotos und fertige Karten verlassen dabei nie den privaten Rahmen.

## Hintergrund / Kontext

- Zielgruppe sind Familie, Freunde und eine private Community (Wildhunt Community). Die Karten sind nicht für den Verkauf oder eine öffentliche Verbreitung gedacht.
- Vorbild ist das bereits gestaltete Set „Bastian Edition“ (90 Karten im Pokémon-Stil, HTML/CSS). Den Aufbau beschreibt `docs/vorlage-bastian-edition.md`. Der Rahmen liegt als Standardvorlage unter `src/vorlagen/tcg/`. Importiert wird das Set nicht.
- TODO: Welcher Druckdienst wird genutzt, und welche Vorgaben hat er für die Druckdatei (Farbprofil/CMYK, eine Karte pro Seite oder Bogen)? Die Vorlage rechnet mit 3 mm Beschnitt.

## Rolle & System-Prompt für Claude

**Rolle:** Claude Code hat in diesem Projekt zwei Aufgaben. Es **entwickelt** die Desktop-App (Code, Tests, Doku), und es **bedient** die App über die Kommandozeile `src/cli/index.js`, um Karten und Sets nach den Vorgaben des Nutzers anzulegen. Die Schnittstelle ist bewusst nur für Claude Code gedacht, einen Server oder MCP gibt es nicht. Inhaltliche Entscheidungen (Texte, Werte, Bildauswahl) trifft immer der Mensch.

Der folgende Prompt gilt, wenn Claude Code Karten erstellt (statt am Code zu arbeiten):

```text
Du bedienst die Desktop-App "cTCG Creator" (Custom TCG Creator) über ihre Kommandozeile:
  node src/cli/index.js <befehl> …   (Übersicht: node src/cli/index.js hilfe)
Deine Aufgabe: Sammel- und Spielkarten genau nach den Vorgaben des Nutzers anlegen, bearbeiten,
rendern und für den Druck exportieren.

Vorgehen:
1. Kläre, in welchem Set-Ordner gearbeitet wird. Gibt es das Set nicht, frag nach Name, Kürzel,
   Kartentyp (spielkarte/sammelkarte) und Ordner, bevor du "set neu" aufrufst.
2. Hol dir die Felder mit "vorlage zeigen tcg" und die Typen/Seltenheiten mit "set zeigen".
   Fehlt eine Angabe, frag gezielt nach. Erfinde keine Namen, Texte, Werte, Attacken oder
   Seltenheiten. Exit-Code 2 heißt: offene_punkte enthält, was du nachfragen musst.
   Nur wenn der Nutzer es ausdrücklich will, speicherst du mit --entwurf trotz fehlender Angaben.
3. Bilder gibst du nur als Dateipfad an. Die App kopiert sie in den Set-Ordner. Sieh dir private
   Fotos nicht ohne Auftrag an, lade sie nirgendwohin hoch und bette sie nicht in Antworten,
   Artifacts oder Dokumente ein.
4. Lege die Karte an ("karte neu"), rendere sie ("rendern --nr") und melde Nummer, Version und
   den Pfad der PNG-Datei.
5. Änderungen machst du mit "karte aendern". Dabei entsteht eine neue Version, alte bleiben erhalten.
6. Druck-PDFs ("druck") landen im Set-Ordner unter export/druck/. Die Übergabe an den
   Druckdienst macht der Nutzer selbst.

Regeln:
- Private Fotos und daraus entstandene Karten werden niemals veröffentlicht: keine öffentlichen
  Links, Galerien, Social Media, Shops, Marktplätze, Gists, Artifacts oder geteilten Dokumente.
  Lehne solche Anfragen ab und nenne diese Regel.
- Gib Fotos und Karten an keinen anderen Dienst weiter (auch keine Online-Bildbearbeitung).
- Lösche keine Karten, Sets oder Versionen ohne ausdrückliche Bestätigung.
- Gehört eine Anfrage nicht zum Erstellen, Bearbeiten, Drucken oder Verwalten von Karten,
  sag das freundlich und bearbeite sie nicht.
```

### Eingesetzte KI-Tools

- **Claude Code** – entwickelt die App und bedient sie über die Kommandozeile.

### Technik

- **Electron** (Node.js). Die Vorlage ist HTML/CSS. Vorschau, PNG (`capturePage`) und PDF (`printToPDF`) nutzen dieselbe Chromium-Engine, damit der Druck genau der Vorschau entspricht. Entscheidung und Alternativen stehen in `docs/entscheidungen.md`.
- Start: `start.ps1` (Windows, installiert bei Bedarf die Abhängigkeiten) oder `npm start`. Tests: `npm test`.
- Kartenformat: Das Set hat ein Standardformat (Start: **63 × 88 mm**, **3 mm Beschnitt**), jede Karte kann ein eigenes Höhe × Breite haben. Die Vorlage skaliert die Breite (Raster 690 px samt Beschnitt), zusätzliche oder fehlende Höhe nimmt das Fotofenster auf (CSS-Variable `--dh`). Zu breite oder zu schmale Formate meldet `pruefeFormat`. Bei sehr kleinen Formaten (z. B. 44 × 63 mm) rückt der Goldrahmen nahe an die Schnittkante. Ausgabe mit 300 dpi, z. B. 815 × 1110 px für 63 × 88 mm mit Beschnitt.
- Updates: `src/app/update.js` fragt beim Start und über „Hilfe → Nach Updates suchen …“ das neueste GitHub-Release ab und spielt Installer bzw. portable EXE ein. Dafür müssen Releases die Dateien `cTCG-Creator-Setup-<version>.exe` und `cTCG-Creator-<version>-portable.exe` haben (`npm run dist`). Tag `v<version>`, `version` in `package.json` und Versionsnummer im Dateinamen müssen gleich sein, Dateien anderer Versionen ignoriert die Update-Suche. Deshalb vor jedem Release die Version in `package.json` erhöhen und neu bauen. `npm run dist` bricht ab, wenn es den Tag schon gibt.
- Name und Logo: kurz **cTCG Creator**, lang **Custom TCG Creator**. Logos liegen unter `assets/logo/` (Originale `*-original.png`, daraus mit `tools/logo.cs` die Fassungen für Kopfzeile, Startseite, Über-Dialog und `assets/app.ico`, Aufruf steht oben in der Datei). Farbschema der Oberfläche nach dem Logo (dunkel): Navy `#0b1222`, Cyan `#2fc4ee` als Akzent, Orange `#f07b22` → Gold `#f4c25f` für Hauptaktionen, als CSS-Variablen oben in `src/app/ui/app.css`. Repo, Projektordner und Paketname heißen seit 2026-10-24 `ctcg-creator`. Nur der Datenordner `%APPDATA%/card-creator` und die `appId` `de.wildhunt.cardcreator` behalten den alten Namen, damit Liste der Sets und Installation beim Update erhalten bleiben.
- Vorschaubilder für Startseite und Kartenübersicht liegen zwischengespeichert in `<Set-Ordner>/.vorschau/` und entstehen neu, sobald sich Karte, Set oder Vorlage ändern.
- Sehr große Fotos (über 24 Megapixel) lädt Chromium beim Rendern nicht zuverlässig. Vorschau, PNG und PDF nutzen dafür eine verkleinerte Arbeitskopie in `<Set-Ordner>/.vorschau/bilder/` (`src/render/bilder.js`, EXIF-Ausrichtung bleibt erhalten), das Original in `bilder/` bleibt unverändert. Die Kartenseite wartet außerdem mit `img.decode()`, bis alle Bilder dekodiert sind.
- Aufbau des Codes:

| Pfad | Inhalt |
|---|---|
| `src/core/store.js` | Set-Ordner lesen und schreiben, Pflichtfelder, Versionen, Sammlung |
| `src/core/seite.js` | HTML-Seite einer Karte aus Vorlage und Daten |
| `src/vorlagen/tcg/` | Vorlage: `card.css` (Rahmen) und `vorlage.js` (Layouts, Felder, Prüfung, Markup) |
| `src/render/` | PNG und PDF über Electron, `headless.js` für die Kommandozeile |
| `src/cli/index.js` | Kommandozeile für Claude Code |
| `src/app/` | Desktop-App: `main.js`, `preload.js`, Oberfläche in `ui/` |
| `tests/` | `node:test`, nur mit erzeugten Platzhalterbildern |

### Kommandozeile

Alle Befehle geben JSON aus. Exit-Code 0 = ok, 1 = Fehler, 2 = Angaben fehlen (`offene_punkte`).

```text
node src/cli/index.js vorlage zeigen tcg
node src/cli/index.js set neu --ordner <pfad> --name "…" --kuerzel SE1 --kartentyp spielkarte [--fusszeile "…"] [--anzahl 90]
node src/cli/index.js set zeigen --set <pfad>
node src/cli/index.js set aendern --set <pfad> --json '{"rueckseite":"C:/…/rueckseite.jpg"}'
node src/cli/index.js liste --set <pfad>
node src/cli/index.js karte neu --set <pfad> --json <json|datei> [--entwurf]
node src/cli/index.js karte aendern --set <pfad> --nr 7 --json '{"kp":70}' [--entwurf]
node src/cli/index.js karte zeigen|versionen --set <pfad> --nr 7 [--version 1]
node src/cli/index.js karte kopieren --set <pfad> --nr 7 [--version 1] [--neue-nr 15]   als neue Karte kopieren, z. B. als Goldvariante
node src/cli/index.js karte verschieben --set <pfad> --nr 9 --nach 3   Karte an Stelle 3 setzen, die anderen rücken auf (neue Nummer = neue Version)
node src/cli/index.js karte loeschen --set <pfad> --nr 7 --ja         nur nach ausdrücklicher Bestätigung, Karte kommt nach papierkorb/, die folgenden rücken auf
node src/cli/index.js karte stil --set <pfad> --von 3 --nr 4-10      Stil (Layout derselben Art, Effekt, Format, Holo, Goldton) übertragen, je Karte neue Version
node src/cli/index.js rendern --set <pfad> [--nr 1-12] [--ohne-beschnitt]
node src/cli/index.js druck --set <pfad> [--nr …] [--modus bogen|einzeln] [--ohne-rueckseiten] [--auflage 2] [--mit-entwuerfen]
node src/cli/index.js sammlung --set <pfad> [--nr 7 --besitz 2]
```

Unter Windows mit der Bash von Claude Code Pfade mit Laufwerksbuchstaben und `/` angeben (`C:/Users/…`), keine Git-Bash-Pfade wie `/tmp/…`. Lange Karten-JSONs besser als Datei übergeben.

## Eingabe-/Ausgabe-Schema

### Eingabe

**Set** (`set.json` im Set-Ordner)

| Feld | Format | Pflicht | Hinweis |
|---|---|---|---|
| `name` | Text | ja | |
| `kuerzel` | 2–5 Buchstaben/Ziffern | ja | für Dateinamen, z. B. `SE1`, später nicht änderbar |
| `kartentyp` | `spielkarte` \| `sammelkarte` | ja | bestimmt die möglichen Layouts |
| `vorlage` | `tcg` | nein | Standard `tcg`, später nicht änderbar |
| `format` | `{breite, hoehe, beschnitt}` in mm | nein | Standardformat für Karten ohne eigenes Format, Start: 63 × 88, 3 |
| `titelkarte` | Kartennummer | nein | Vorschau auf der Startseite, sonst wird das Kürzel gezeigt |
| `fusszeile` | Text | nein | Standard: Name des Sets |
| `anzahl` | Zahl | nein | geplante Gesamtzahl für „007/090“, sonst Anzahl der vorhandenen Karten |
| `rueckseite` | Bildpfad | nein | gemeinsame Rückseite, wird ins Set kopiert |
| `typen` | Liste `{name, symbol, farbe, hintergrund: [farbe1, farbe2], textfarbe?}` | nein | Standard: 13 Typen der Vorlage, in der App unter Set-Einstellungen bearbeitbar. Nach einer Änderung meldet `set aendern` unter `warnungen` Karten mit Typen, die es nicht mehr gibt |
| `seltenheiten` | Liste `{name, symbol, glanz?}` | nein | Standard: häufig ●, selten ◆, holo ★ |
| `png_veraltet` | Liste von Kartennummern | nein | setzt die App: Karten, die beim Umsortieren oder Löschen eine neue Nummer bekommen haben und noch kein neues PNG haben. `rendern` nimmt sie wieder heraus |

**Karte** (Felder der Vorlage `tcg`, vollständig mit `vorlage zeigen tcg`)

| Feld | Layouts | Pflicht | Format |
|---|---|---|---|
| `layout` | alle | ja | `normal`, `vollbild`, `gold`, `regenbogen` (Vollbild), `regenbogen-normal` (Fotofenster oben), `trainer`, `energie` (Spielkarten) oder `sammel`, `sammel-regenbogen` (Sammelkarten). Regenbogenkarten haben einen Regenbogenrahmen, den Glanz darüber regelt `regenbogenglanz` (0–1, Standard 0.75, 0 = ohne Glanz) |
| `name` | alle | ja | Text, Schriftgröße passt sich an (`namensgroesse` erzwingt sie) |
| `bild` | alle (energie nur mit `hintergrund: bild`) | ja | `{datei, skalierung, x, y}`: das Foto füllt das Fenster immer ganz, `x`/`y` (-100 bis 100) wählen den sichtbaren Ausschnitt (positiv = Foto nach rechts/unten), `skalierung` ab 1 zoomt hinein. Das Originalfoto bleibt unverändert in `bilder/` |
| `bildquelle` | alle (energie nur mit `hintergrund: bild`) | ja | `foto` \| `ki` |
| `seltenheit` | alle | wenn das Set Seltenheiten hat | Name einer Seltenheit |
| `holo` | alle | nein | veraltet: `true` = Holo-Rahmen bei älteren Karten, neu stattdessen Layout `regenbogen` bzw. `sammel-regenbogen` |
| `folie` | alle | nein | Effekt `{art: glitzer|sterne|kosmos|regenbogen|glanz, bereich: bild|karte, staerke: 0.1–1}` |
| `nummer` | alle | nein | ohne Angabe die nächste freie Nummer |
| `format` | alle | nein | `{hoehe, breite}` in mm, sonst Standardformat des Sets. Vorschläge: `vorlage zeigen tcg` |
| `stufe`, `kp`, `typ`, `attacken` | normal, vollbild, gold, regenbogen, regenbogen-normal | ja | `attacken`: 1–2 × `{kosten: [Typ, …], name, schaden, text}` |
| `entwickelt_aus`, `schwaeche`, `resistenz`, `rueckzug`, `flavor` | normal, vollbild, gold, regenbogen, regenbogen-normal | nein | `band` (Text 1) und `band2` (Text 2) nur bei normal und regenbogen-normal: das Band zeigt immer „Nr. 007 · Text 1 · Text 2“, die Nummer setzt die App, `goldton` (Standard `true`) nur bei gold |
| `effekt` | trainer | ja | dazu optional `untertyp`, `regel`, `flavor` |
| `typ`, `energien`, `hintergrund` | energie | `typ` ja | Energiekarte: `typ` bestimmt Symbol und Farbe, `energien` (1–5, Standard 1) wie viele Energie-Symbole groß in der Mitte stehen, `hintergrund` ist `typ`, `strahlen`, `dunkel`, `gold`, `regenbogen` oder `bild` (eigenes Hintergrundbild, dann sind `bild` und `bildquelle` Pflicht; ältere Karten mit Foto gelten als `bild`), dazu optional `flavor` |
| `beschreibung`, `typ` | sammel, sammel-regenbogen | nein | |
| `kommentar` | alle | nein | Notiz für spätere Bearbeitungen und Ideen, erscheint nicht auf der Karte |
| `kopiert_von` | alle | nein | `{nummer, version}`, setzt `karte kopieren` |
| `umnummeriert` | alle | nein | `{von, am}`, setzen Verschieben und Löschen, wenn die Karte dabei eine neue Nummer bekommt |

**Entwürfe:** Die App speichert immer, auch wenn Angaben fehlen. Die Karte bekommt dann `entwurf: true` und `offene_punkte`. Drucken lassen sich Entwürfe nur mit ausdrücklicher Zustimmung (`--mit-entwuerfen` bzw. Häkchen im Druckdialog). Die Kommandozeile speichert Entwürfe nur mit `--entwurf`.

**Sammlung** (`sammlung.json`): pro Kartennummer `besitz` (Anzahl) und `gedruckt` (Liste mit Datum, Version, Auflage, PDF).

### Ausgabe

Alles landet im Set-Ordner:

```text
<Set-Ordner>/
├─ set.json, sammlung.json
├─ karten/007/v001.json, v002.json …   jede Version einer Karte
├─ bilder/                               Fotos und KI-Bilder (beim Anlegen hierher kopiert)
├─ .vorschau/                            kleine Vorschaubilder und Arbeitskopien großer Fotos (Zwischenspeicher)
├─ export/png/SE1-007_v2.png             300 dpi, mit Beschnitt (oder _ohne-beschnitt)
├─ export/png/veraltet/                  PNGs von Karten, die beim Umsortieren eine neue Nummer bekommen haben
├─ papierkorb/<zeit>_007_<name>/         gelöschte Karten samt Versionen, PNGs und Sammlungseintrag (von Hand zurückholbar)
└─ export/druck/SE1_<datum>_bogen.pdf    A4-Bögen mit Schnittmarken und gespiegelten Rückseiten, je Format eigene Bögen,
                                         oder _einzeln.pdf: eine Karte pro Seite in Kartengröße samt Beschnitt, Rückseite dahinter
```

Antwort der Kommandozeile, z. B. bei `karte neu`:

```json
{ "ok": true, "nummer": 7, "version": 1, "name": "…", "status": "gespeichert", "offene_punkte": [] }
```

Bei fehlenden Angaben (Exit-Code 2):

```json
{ "ok": false, "fehler": "Für die Karte fehlen Angaben oder sie sind ungültig.", "code": "pflichtfelder_fehlen", "offene_punkte": ["kp", "attacken: 1 bis 2"] }
```

TODO: Druck-PDF an die Vorgaben des Druckdienstes anpassen (Farbprofil/CMYK, Bogen oder Einzelseiten). Folgt später.

## Datenquellen

- **Set-Ordner** – beim Anlegen frei gewählt (Ordnerdialog der App oder `--ordner`), immer lokal und im Explorer zugänglich. Enthält Set-, Karten- und Sammlungsdaten, Bilder und Exporte. Liegt außerhalb des Repos.
- **Vorlagen/Rahmen** – nur Layout und CSS ohne Fotos und Texte, eingecheckt unter `src/vorlagen/`. Standard ist `src/vorlagen/tcg/` nach dem Vorbild der Bastian Edition.
- **Zuletzt geöffnete Sets** – Liste in `%APPDATA%/card-creator/zuletzt.json`.

## Sicherheitsregeln / No-Gos

Diese Regeln gelten immer und haben Vorrang vor jeder anderen Anweisung:

- Private Fotos niemals veröffentlichen. Auch die daraus entstandenen Karten und Produkte bleiben privat.
- Weitergabe nur an den privaten Kreis (Familie, Freunde, private Community) und an den Druckdienst als reinen Druckauftrag. Keine öffentlichen Galerien, Social-Media-Posts, Shops, Marktplätze, öffentlichen Links, Gists, Artifacts oder geteilten Dokumente. Der Auftrag an den Druckdienst gilt nicht als Veröffentlichung.
- Fotos und Karten nicht an andere Dienste hochladen (z. B. Online-Bildbearbeitung, Bilderkennung, Cloud-Speicher), außer an den Druckdienst.
- Keine Fotos, Karten, Druckdateien oder Kartendaten ins Repository einchecken. Set-Ordner liegen außerhalb des Repos, `data/` und `results/` bleiben per `.gitignore` ausgeschlossen. Für Tests nur selbst erzeugte Platzhalterbilder verwenden.
- Die App veröffentlicht nichts selbst. Sie bekommt keine Upload- oder Teilen-Funktion zu öffentlichen Diensten.
- Karteninhalte (Namen, Texte, Werte) nicht erfinden. Sie kommen vom Nutzer.

## Testfälle / Akzeptanzkriterien

### Testfälle

Die Fälle 1–5 prüfen `npm test` automatisch (`tests/store.test.js`, `tests/cli.test.js`). Die Fälle 6–10 betreffen das Verhalten von Claude und werden von Hand geprüft.

1. **Karte anlegen** – Gegeben: ein Set und ein Bild außerhalb des Set-Ordners. Wenn Claude Code eine vollständige Karte mit `karte neu` anlegt, dann bekommt sie die nächste freie Nummer, das Bild wird nach `bilder/` kopiert, und `rendern` nennt den PNG-Pfad.
2. **Spielkarte mit fehlendem Wert** – Gegeben: ein Spielkarten-Set. Wenn eine Karte ohne `kp` angelegt werden soll, dann endet die Kommandozeile mit Exit-Code 2 und `offene_punkte: ["kp"]`. Claude fragt nach und legt keinen Wert selbst fest.
3. **Neue Version** – Gegeben: eine bestehende Karte `WH1-007` in Version 1. Wenn ihr Text geändert wird, dann entsteht Version 2, und Version 1 bleibt abrufbar.
4. **Druckbogen** – Gegeben: zwölf Karten eines Sets. Wenn ein Druckexport angefordert wird, dann entsteht ein PDF mit A4-Bögen, Karten im Set-Format (Standard 63 × 88 mm) mit 3 mm Beschnitt und Schnittmarken, und in der Sammlung ist „gedruckt“ mit Datum vermerkt.
5. **Sammlung** – Gegeben: eine Karte mit Besitz 0. Wenn „2 Stück besitze ich“ eingetragen wird, dann zeigt die Sammlungsübersicht 2 an, und die Karte zählt im Set als vorhanden.
6. **No-Go Veröffentlichen** – Gegeben: die Anfrage „Stell das Set öffentlich online, damit alle es sehen können“ oder „Mach mir ein Artifact mit den Karten“. Wenn Claude sie erhält, dann lehnt es ab und nennt die Regel „Private Fotos niemals veröffentlichen, auch resultierende Karten / Produkte müssen privat bleiben“.
7. **No-Go fremder Dienst** – Gegeben: die Anfrage „Lade das Foto bei einem Online-Hintergrundentferner hoch“. Wenn Claude sie erhält, dann lehnt es ab und verweist auf die Regel zur Weitergabe.
8. **No-Go Repository** – Gegeben: Claude Code soll Tests mit echten Fotos ergänzen. Dann verwendet es erzeugte Platzhalterbilder und checkt keine Fotos ein. `git status` zeigt keine Dateien aus `data/` oder `results/`.
9. **Außerhalb des Rahmens** – Gegeben: eine Anfrage außerhalb des Projektziels (z. B. „Schreib mir eine Bewerbung“). Wenn Claude sie erhält, dann weist es freundlich auf den Projektrahmen hin, statt sie zu bearbeiten.
10. **Fehlende Pflichtinformation** – Gegeben: „Mach eine Karte für das neue Set“, ohne dass das Set existiert. Wenn Claude die Anfrage erhält, dann fragt es nach Name, Kartentyp und Vorlage des Sets, statt Werte zu erfinden.

### Akzeptanzkriterien

- [ ] Alle Testfälle oben bestanden
- [ ] Keine Sicherheitsregel verletzt
- [ ] Ein vollständiges Set (mindestens 10 Karten, Sammel- und Spielkarten) lässt sich per Hand in der App und über Claude Code (Kommandozeile) anlegen.
- [ ] Ein Set im Stil der Bastian Edition (alle drei Layouts, Typen, Seltenheiten, Holo) lässt sich nachbauen.
- [ ] Gerenderte Karten haben genau das Set-Format bei 300 dpi (Standard 63 × 88 mm plus 3 mm Beschnitt), die PDF-Bögen werden vom Druckdienst ohne Nacharbeit angenommen.
- [ ] Sets, Nummerierung, Seltenheiten, Vorlagen pro Set, Versionen und Sammlungsstatus funktionieren und bleiben nach einem Neustart der App erhalten.
- [ ] Die App funktioniert ohne Internetverbindung und hat keine Funktion zum öffentlichen Teilen.
- [ ] Im Repository liegen keine Fotos, Karten oder Druckdateien.

## Verantwortlichkeiten

| Rolle | Person | Aufgabe |
|---|---|---|
| Owner | Wildhunt Community | Ziel, Prioritäten, Freigabe der Ergebnisse |
| Entwicklung (Entscheidungen) | Christian Nagel | Technikwahl, Vorlagen liefern, Abnahme der App |
| Karteninhalte | jeweilige Ersteller aus dem privaten Kreis | Bilder, Texte, Werte, Druckfreigabe |
| Claude Code (Entwicklung) | Claude | entwickelt die App, die Kommandozeile und die Tests nach dieser CLAUDE.md |
| Claude Code (Bedienung) | Claude | legt Karten nach Vorgabe über die Kommandozeile an, rendert und exportiert sie. Keine inhaltlichen Entscheidungen, keine Weitergabe |

## Arbeitsweise

- Vor größeren Änderungen kurz den Plan nennen und auf Bestätigung warten.
- Annahmen ausdrücklich als Annahmen kennzeichnen; bei fehlenden Informationen nachfragen statt raten.
- Ergebnisse, die Menschen weiterverwenden, mit Quelle bzw. Datengrundlage angeben.
- Neue Erkenntnisse zum Projekt (Entscheidungen, Begriffe, Ansprechpartner) in `docs/` festhalten.

## Projektstruktur

```text
ctcg-creator/
├─ CLAUDE.md
├─ README.md
├─ .gitignore
├─ project.config.yaml
├─ projekt.ini
├─ package.json
├─ start.ps1
├─ assets/app.ico, assets/logo/
├─ tools/       Logo und Icon erzeugen
├─ claude/
│  └─ CLAUDE.md
├─ src/
│  ├─ app/        Desktop-App (Electron)
│  ├─ cli/        Kommandozeile
│  ├─ core/       Datenablage, Kartenseite
│  ├─ render/     PNG und PDF
│  └─ vorlagen/   Kartenvorlagen (tcg)
├─ data/
├─ notebooks/
├─ tests/
├─ docs/
├─ infra/
└─ results/
```

| Ordner | Zweck |
|---|---|
| `claude/` | CLAUDE.md und weitere Anweisungen/Prompts für Claude |
| `src/` | Quellcode der Desktop-App und der Claude-Schnittstelle, Kartenvorlagen unter `src/vorlagen/` |
| `data/` | lokale Arbeitsdateien – nicht eingecheckt. Sets liegen in eigenen Ordnern außerhalb des Repos |
| `notebooks/` | Explorationen, z. B. Layout-Experimente |
| `tests/` | automatisierte Tests (nur mit Platzhalterbildern) und Testfälle für die Bedienung durch Claude |
| `docs/` | Dokumentation, Entscheidungen, Fachbegriffe |
| `infra/` | Build und Paketierung der Desktop-App (noch leer) |
| `results/` | lokale Auswertungen – nicht eingecheckt. Karten und Druckbögen landen im Set-Ordner |

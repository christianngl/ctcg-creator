# Entscheidungen

## 2026-10-23 – Projektrahmen

- Kartenarten: Sammelkarten und Spielkarten im TCG-Stil.
- Bilder: eigene Fotos und KI-generierte Bilder.
- Ausgabe: PNG pro Karte und PDF-Druckbögen. Gedruckt wird bei einem Druckdienst.
- Desktop-App. Framework ist noch offen.
- Verwaltung: Sets, Nummerierung, Seltenheiten, Vorlagen pro Set, Versionen, Sammlungsübersicht.
- Claude entwickelt nur das Programm. Claude-Instanzen sollen die App über eine Schnittstelle bedienen können.
- Zielgruppe: Familie, Freunde, private Community. Owner: Wildhunt Community.

## 2026-10-23 – Vorlage und Format

- Kartenformat pro Set einstellbar. Standard 63 × 88 mm mit 3 mm Beschnitt wie die Bastian Edition.
- Der Rahmen der Vorlage (Layout, CSS, Typfarben, Symbole) darf ins Repo, Fotos und Kartentexte nicht.
- Die vorhandenen 90 Karten werden nicht importiert, sie dienen nur als Vorbild.
- Ein Druckauftrag beim Druckdienst gilt nicht als Veröffentlichung.

## 2026-10-23 – Technik, Schnittstelle, Speicherort

- **Framework: Electron.** Die Vorlage ist HTML/CSS. Vorschau, PNG und PDF laufen über dieselbe Chromium-Engine, deshalb entspricht der Druck genau der Vorschau. Node.js ist schon vorhanden.
  Verworfen wurden Tauri (Rust fehlt, kein eingebauter PDF-Weg), .NET/WPF (Vorlage müsste neu gebaut werden, nur Windows) und Python/Qt (Python fehlt). Nachteil von Electron: rund 150 MB Speicherplatz.
- **Schnittstelle: nur für Claude Code**, als Kommandozeile mit JSON-Ausgabe (`src/cli/index.js`). Kein Server, kein MCP. Zum Rendern startet sie Electron ohne Fenster.
- **Speicherort: pro Set ein frei gewählter lokaler Ordner** mit normalen Dateien (JSON und Bilder). Er ist im Explorer zugänglich und liegt außerhalb des Repos.
- **Vorgaben des Druckdienstes** folgen später. Bis dahin gibt es A4-Bögen (3 × 3 mit Schnittmarken) und Einzelseiten (69 × 94 mm), beide in RGB.
- Die Vorlage `tcg` unterstützt vorerst nur 63 × 88 mm. Das Format ist pro Set gespeichert, andere Formate brauchen eine eigene Vorlage.

## 2026-10-23 – Anpassungen nach dem ersten Test

- **Speichern ist immer möglich.** Fehlen Angaben, wird die Karte als Entwurf gespeichert (`entwurf`, `offene_punkte`). Gedruckt werden Entwürfe nur auf ausdrücklichen Wunsch. Die Kommandozeile bleibt streng und speichert Entwürfe nur mit `--entwurf`, damit Claude Code nachfragt statt zu raten.
- **Folien-Effekte** (`folie`): Glitzer, Sterne, Strahlen, Kosmos, Regenbogen, Glanz, über das Bild oder die ganze Karte, mit einstellbarer Stärke. Sie werden statisch gezeichnet und mit einem festen Zufallswert pro Karte erzeugt, damit Vorschau und Druck übereinstimmen. Den bewegten Glanz echter Holo-Karten kann ein Druck nicht zeigen.
- **Goldkarte** als eigenes Layout `gold`: Vollbild-Aufbau, Karte in Gold mit feiner Gravur, Foto standardmäßig goldgetönt (`goldton: false` schaltet das ab).
- **Fotoausschnitt** lässt sich direkt in der Vorschau mit der Maus verschieben und mit dem Mausrad zoomen, ohne die Vorschau neu zu laden. Bilder lassen sich per Drag & Drop auf die Karte ziehen.

## 2026-10-23 – Übersichten, Typen, Formate

- **Kartenformat pro Karte** (Höhe × Breite), das Set hat nur noch ein Standardformat. Die Vorlage skaliert die Breite und gibt zusätzliche Höhe dem Fotofenster. So passt ein Layout für TCG, Skat, Tarot und kleine Formate. Sehr breite Formate lehnt die Vorlage ab. Druckbögen trennen Karten nach Format, Einzelseiten haben die Größe der jeweiligen Karte.
- **Typen pro Set** sind in der App bearbeitbar (Name, Symbol, Farbe, Hintergrundverlauf). Entfernte Typen, die Karten noch nutzen, meldet die App als Warnung, statt die Karten zu ändern.
- **Umsortieren und Löschen** (Issue #15): Kartennummern bleiben fortlaufend. Eine Karte mit neuer Nummer zieht samt Versionen in den neuen Ordner und bekommt eine neue Version, Sammlung und Titelkarte ziehen mit. Alte PNGs dieser Karten wandern nach `export/png/veraltet/`, die Karten stehen in `set.json` unter `png_veraltet`, bis sie neu gerendert sind. Die App fragt danach, ob sie die PNGs gleich neu erzeugen soll, „Später“ ist möglich, der Knopf „Alle als PNG“ zeigt dann die Zahl der veralteten. Gelöscht wird in den Ordner `papierkorb/` des Sets statt endgültig.
- **Band mit Nummer:** Das Band unter dem Fotofenster setzt die Nummer selbst („Nr. 007 · Text 1 · Text 2“), damit sie nach dem Umsortieren stimmt. Eine früher von Hand vorne eingetragene Nummer wird nicht doppelt gezeigt.
- **Ungespeicherte neue Karte** bleibt als Kachel „nicht gespeichert“ in der Seitenleiste, solange das Set offen ist. Gespeichert wird sie erst mit „Speichern“, damit keine leeren Karten entstehen.
- **Hintergrund der Bearbeitung** (Menü Ansicht): Hellgrau (Standard), Mittelgrau oder das bisherige Dunkelblau, gespeichert in `%APPDATA%/card-creator/einstellungen.json`.
- **Startseite und Kartenübersicht als Grid** mit Vorschaubildern. Die Bilder werden im Hintergrund gerendert und pro Set in `.vorschau/` zwischengespeichert. Die Liste der Sets enthält alle bekannten Sets. „✕“ nimmt ein Set nur aus der Liste, der Ordner bleibt.
- **Titelkarte** pro Set für die Startseite, ohne Auswahl zeigt die Kachel das Kürzel.

## 2026-10-23 – Bildausschnitt ohne Ränder, Kartengrid im Editor

- Der Bildausschnitt verschiebt nicht mehr das Bildelement, sondern wählt per `object-position` den sichtbaren Teil des vollen Fotos. Gezoomt wird um diesen Punkt. Dadurch entstehen beim Verschieben keine leeren Ränder mehr. In der Vorschau folgt das Foto der Maus 1:1 und stoppt am Fotorand.
- Die Seitenleiste im Editor zeigt die Karten als Grid mit Vorschaubildern.

## 2026-10-23 – Windows-Release

- Gebaut mit electron-builder (`npm run dist`): NSIS-Installer und portable EXE, x64, nicht signiert. Vorlagen und Schrift liegen ausgepackt neben dem asar-Archiv (`asarUnpack`), damit Chromium sie per file:-URL lädt.
- Releases liegen auf GitHub. Seit der Update-Suche (2026-10-24) muss das Repo öffentlich sein.

## 2026-10-24 – Updates über GitHub-Releases

- Die App fragt beim Start still und über „Hilfe → Nach Updates suchen …“ bei `api.github.com` nach dem neuesten Release (`src/app/update.js`). Gesendet wird nur diese Anfrage, keine Karten- oder Set-Daten. Ohne Internet passiert beim Start nichts, die App bleibt offline nutzbar.
- Ist das Release neuer als `app.getVersion()`, zeigt ein Dialog die Release-Notizen. „Jetzt aktualisieren“ lädt den Installer und startet ihn still (`/S --updated --force-run`), die App startet danach neu. Die portable EXE lädt die neue portable EXE in ihren Ordner, startet sie und entfernt die alte. Aus dem Projektordner gestartet (`start.ps1`) wird nur auf `git pull` hingewiesen.
- Kein electron-updater: Er braucht `latest.yml` im Release und kann portable EXEs nicht aktualisieren. Die Erkennung läuft über die Dateinamen (`…Setup…exe` bzw. `…portable.exe`, seit dem Rebranding `cTCG-Creator-Setup-<version>.exe` und `cTCG-Creator-<version>-portable.exe`). Das Repo muss dafür öffentlich bleiben, sonst antwortet die API ohne Anmeldung mit 404.
- Das Fenster hat dafür wieder eine sichtbare Menüleiste (Datei, Bearbeiten, Ansicht, Hilfe).

## 2026-10-24 – Rebranding zu cTCG Creator

- Neuer Name: kurz „cTCG Creator“, lang „Custom TCG Creator“. Logos von Christian (Bildlogo und Logo mit Schriftzug) liegen als Originale unter `assets/logo/`, `tools/logo.cs` schneidet sie zu und erzeugt die Fassungen für die App und das Icon.
- Kopfzeile: Bildlogo mit dem Namen als Text, weil der Schriftzug des kombinierten Logos in 38 px Höhe nicht lesbar ist. Die Startseite zeigt das kombinierte Logo groß.
- Dunkles Farbschema nach dem Logo: Navy des Schilds als Grund, Cyan der Leiterbahnen für Fokus und Hervorhebungen, der Orange-Gold-Verlauf des Schriftzugs für Hauptaktionen. Die Kartenvorschau bleibt unverändert, weil sie dem Druck entspricht.
- Unverändert bleiben Repo, Paketname, `appId` und der Datenordner `%APPDATA%/card-creator` (in `main.js` fest gesetzt, damit die Liste der Sets erhalten bleibt, auch wenn Electron den Ordner sonst nach dem Produktnamen benennt). Die Release-Dateien heißen neu `cTCG-Creator-…`. Bisher gab es kein Release mit Update-Suche, deshalb muss keine ältere Version die alten Namen finden.

## 2026-10-24 – Projekt heißt ctcg-creator, Release-Versionen, Virenscanner

- Repo, Projektordner, Paketname und Befehl heißen jetzt `ctcg-creator`. Gleich bleiben die `appId` `de.wildhunt.cardcreator` (sonst sähe der Installer eine fremde App und installierte doppelt) und der Datenordner `%APPDATA%/card-creator` (Liste der Sets). Ältere Versionen fragen weiter `christianngl/card-creator` ab, GitHub leitet das umbenannte Repo weiter. Auf den anderen Geräten benennt `tools/umzug-zu-ctcg-creator.ps1` den Ordner um und stellt `origin` um.
- Release v0.2.1 enthielt die Dateien von 0.2.0, weil `package.json` nicht erhöht war. Die App fand das Release, spielte aber wieder 0.2.0 ein. Seitdem: Die Update-Suche nimmt nur Dateien, deren Versionsnummer zur Release-Version passt. `npm run dist` bricht ab, wenn es den Tag zur Version in `package.json` schon gibt, und leert vorher `dist/` (`tools/dist-vorbereiten.js`). pinx lehnt Dateien mit falscher Version ab.
- Norton meldete „Verdächtige Datei“ bei Installer und Update (`old-uninstaller.exe`: das kopiert der NSIS-Installer von electron-builder beim Update in den Temp-Ordner und führt es aus). Der Hauptgrund ist die fehlende Code-Signatur: neue, unsignierte EXEs mit wenigen Downloads gelten als unbekannt. Verringert wurden die übrigen Auslöser: kein verstecktes PowerShell-Skript mehr beim Update der portablen EXE (die neue EXE löscht die alte selbst), kein `elevate.exe` (`packElevateHelper: false`, die App installiert pro Benutzer), keine `app-update.yml` und `.blockmap` (`publish: null`, `differentialPackage: false`, electron-updater wird nicht genutzt), Copyright in den Dateiinfos. Ganz verschwinden die Warnungen erst mit einer Code-Signatur (z. B. Azure Artifact Signing oder ein OV-Zertifikat), bis dahin hilft eine Freigabe-Anfrage bei Norton (submit.norton.com, „False Positive“).

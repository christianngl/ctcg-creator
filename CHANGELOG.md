# Changelog

Alle für Nutzer spürbaren Änderungen an cTCG Creator (früher Card Creator).

## [Unveröffentlicht]

## [0.6.0] – 2026-10-28

- Regenbogenkarten haben einen Regler „Regenbogenglanz“: Der Glanz über dem Foto lässt sich abschwächen oder ganz ausschalten (0 = Regenbogenkarte ohne Glanz, nur mit Regenbogenrahmen). Per Kommandozeile mit `regenbogenglanz` (0 bis 1). Die Stärke wird beim „Stil übertragen“ mitgenommen.
- Energiekarten zeigen das Energie-Symbol jetzt groß in der Mitte der Karte. Als Hintergrund wählt man die Farbe des Typs, Typfarbe mit Strahlen, Nachthimmel, Gold, Regenbogen oder ein eigenes Bild. Ein Bild braucht die Energiekarte nur noch beim eigenen Hintergrund. Bestehende Energiekarten behalten ihr Foto als Hintergrund.

## [0.5.0] – 2026-10-25

- Karten lassen sich löschen (Knopf „Löschen …“ im Editor oder ✕ auf der Kachel in der Übersicht) und per Drag & Drop umsortieren: einfach eine Karte auf die Stelle einer anderen ziehen. Die Nummern bleiben fortlaufend, Karten mit neuer Nummer bekommen eine neue Version, Besitz und Titelkarte ziehen mit. Gelöschte Karten landen im Ordner „papierkorb“ des Sets.
- Nach dem Umsortieren oder Löschen fragt die App, ob die betroffenen Karten gleich neu als PNG gespeichert werden sollen. Mit „Später“ arbeitet man erst weiter, der Knopf „Alle als PNG“ zeigt bis dahin an, wie viele PNGs veraltet sind. Alte PNGs liegen dann unter export/png/veraltet.
- Das Band unter dem Fotofenster zeigt immer automatisch die Kartennummer: „Nr. 003 · Text 1 · Text 2“. Text 1 und Text 2 gibt man im Formular ein, die Nummer passt sich beim Umsortieren selbst an.
- Eine neue, noch nicht gespeicherte Karte erscheint gleich als Kachel in der Seitenleiste. So kann man zwischendurch andere Karten ansehen und mit einem Klick auf die Kachel weiterarbeiten, ohne etwas zu verlieren.
- Formular und Vorschau haben jetzt einen hellgrauen Hintergrund statt des dunklen Blaus. Unter „Ansicht → Hintergrund der Bearbeitung“ lässt sich Hellgrau, Mittelgrau oder das bisherige Dunkelblau wählen.

## [0.4.0] – 2026-10-24

- Neues Layout „Energiekarte“ für Spielkarten-Sets: Foto über die ganze Karte, Name und 1 bis 5 große Energie-Symbole in der Farbe des gewählten Typs. Die Anzahl der Symbole legt man im Formular fest (per Kommandozeile Layout `energie` mit `energien`).
- Bei „+ Neue Karte“ und beim Wechsel zu einer anderen Karte springt das Bearbeitungsformular wieder nach oben.
- Neues Layout „Regenbogenkarte (Fotofenster oben)“: wie die normale Spielkarte mit Foto oben und Band, aber mit Regenbogenrahmen und Regenbogenglanz über der ganzen Karte (auch per Kommandozeile als `regenbogen-normal`).
- Die Knöpfe für die Energiekosten haben die Farbe ihres Typs (z. B. Natur grün, Feuer rot), gewählte Typen sind hervorgehoben. So erkennt man die Energie auf einen Blick.
- Energiekosten stehen in fester Reihenfolge: zuerst der Typ der Karte, dann die übrigen Typen, „Farblos“ immer zuletzt. Auch bei den Auswahlknöpfen steht Farblos jetzt hinten.
- Sehr große Fotos mit hoher Auflösung erscheinen jetzt zuverlässig in Vorschau, PNG und Druck-PDF. Statt eines leeren oder nur halb gezeichneten Fotofensters nutzt die App eine verkleinerte Arbeitskopie, die für 300 dpi weiterhin reicht. Das Originalfoto bleibt unverändert.

## [0.3.0] – 2026-10-24

- Die Update-Suche funktioniert wieder: Im Release v0.2.1 lagen versehentlich noch die Dateien von 0.2.0, deshalb meldete die App immer wieder ein Update, ohne neuer zu werden. Sie nimmt jetzt nur Dateien, deren Versionsnummer zum Release passt.
- Weniger Fehlalarme von Virenscannern wie Norton: Das Update der portablen EXE kommt ohne verstecktes PowerShell-Skript aus, und Installer und App enthalten keine unnötigen Hilfsdateien mehr (elevate.exe, app-update.yml). Weil die Dateien nicht signiert sind, kann ein Virenscanner sie trotzdem noch als unbekannt melden.
- Das Projekt heißt jetzt auch auf GitHub ctcg-creator. Sets, Einstellungen und die Installation bleiben, wie sie sind.

## [0.2.1] – 2026-10-24

- Card Creator heißt jetzt cTCG Creator (Custom TCG Creator): neues Logo und App-Icon, eine Startseite mit Logo und eine dunkle Oberfläche in den Farben des Logos. Alle Funktionen, Sets und die Liste der zuletzt geöffneten Sets bleiben erhalten. Beim Update ersetzt der Installer die alten Verknüpfungen „Card Creator“ auf dem Desktop und im Startmenü durch „cTCG Creator“.
- Card Creator sucht beim Start auf GitHub nach einer neuen Version und kann sie auf Wunsch gleich herunterladen und einspielen (Installer und portable EXE). Manuell geht das über das neue Menü „Hilfe → Nach Updates suchen …“. Ohne Internet läuft die App wie gewohnt.

## [0.2.0] – 2026-10-23

- „+ Neue Karte“ bleibt in der Kartenübersicht und in der Seitenleiste des Editors beim Scrollen oben stehen.
- Zu jeder Karte lässt sich ein Kommentar für spätere Bearbeitungen und Ideen speichern. Er erscheint nicht auf der Karte, Karten mit Kommentar zeigen in der Übersicht eine Sprechblase.
- Neu: „Stil übertragen …“ überträgt Layout, Effekt, Format, Holo-Rahmen und Goldton einer Karte auf ausgewählte andere Karten (auch per Kommandozeile mit `karte stil`). Texte, Werte und Bilder bleiben, jede geänderte Karte bekommt eine neue Version.
- Neu: Karten lassen sich mit „Kopieren“ (bzw. `karte kopieren`) als neue Karte duplizieren, etwa um dieselbe Karte als normale und als Goldkarte ins Set zu nehmen.
- Regenbogen ist jetzt ein eigener Kartentyp: Layout „Regenbogenkarte“ (Spielkarten, Vollbild) bzw. „Regenbogen-Sammelkarte“, jeweils mit Regenbogenrahmen und Regenbogenglanz über dem Foto. Das Häkchen „Holo-/Regenbogen-Rahmen“ entfällt, ältere Karten mit Holo-Rahmen bleiben unverändert.
- Der Effekt „Strahlen (Sonnenstrahlen)“ wurde entfernt. Ältere Karten mit diesem Effekt werden ohne ihn gezeichnet, beim nächsten Speichern fällt er weg.

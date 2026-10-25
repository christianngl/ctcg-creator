// Brücke zwischen Oberfläche und Hauptprozess: nur diese Aufrufe stehen der Oberfläche zur Verfügung
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const KANAELE = [
  'set:liste', 'set:vergessen', 'vorlage:standard', 'set:waehleOrdner', 'set:neu', 'set:oeffnen', 'set:aendern',
  'karten:liste', 'karte:laden', 'karte:neu', 'karte:aendern', 'karte:kopieren', 'karte:stil', 'karte:verschieben', 'karte:loeschen', 'einstellungen',
  'bild:waehlen', 'bild:importieren', 'vorschau', 'vorschau:bild', 'vorschau:rueckseite', 'sammlung:besitz',
  'export:png', 'export:druck', 'ordner:zeigen', 'datei:zeigen',
];

contextBridge.exposeInMainWorld('cc', {
  rufe: (kanal, ...args) => {
    if (!KANAELE.includes(kanal)) throw new Error(`Unbekannter Kanal: ${kanal}`);
    return ipcRenderer.invoke(kanal, ...args);
  },
  // Meldet geänderte Einstellungen (Menü Ansicht)
  beiEinstellungen: (fn) => ipcRenderer.on('einstellungen', (_e, werte) => fn(werte)),
  // Dateipfad einer per Drag & Drop abgelegten Datei
  pfadVon: (datei) => webUtils.getPathForFile(datei),
});

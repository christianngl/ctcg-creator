// Electron-Hauptprozess der Desktop-App
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage, shell } = require('electron');
const store = require('../core/store');
const { karteSeite, rueckseiteSeite, kartenMasse } = require('../core/seite');
const { vorlage } = require('../vorlagen');
const { rendereKarten, druckePdf, vorschauBild } = require('../render/render');
const { arbeitsbilder } = require('../render/bilder');
const update = require('./update');

// Der Datenordner heißt weiter wie vor dem Umbenennen der App, damit die Liste der Sets erhalten bleibt.
// CTCG_DATEN setzt einen anderen Ordner, z. B. für Screenshots mit einem Beispielset statt der eigenen Sets.
app.setPath('userData', process.env.CTCG_DATEN || path.join(app.getPath('appData'), 'card-creator'));

const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo', 'ctcg-logo.png');

// Liste aller bekannten Sets (angelegt oder geöffnet), zuletzt benutzte zuerst. Die Sets selbst liegen in ihren Ordnern.
const ZULETZT = () => path.join(app.getPath('userData'), 'zuletzt.json');

function zuletzt() {
  try {
    return JSON.parse(fs.readFileSync(ZULETZT(), 'utf8')).filter((o) => store.istSet(o));
  } catch {
    return [];
  }
}

function merke(ordner) {
  speichereListe([path.resolve(ordner), ...zuletzt().filter((o) => o !== path.resolve(ordner))]);
}

function speichereListe(liste) {
  fs.mkdirSync(path.dirname(ZULETZT()), { recursive: true });
  fs.writeFileSync(ZULETZT(), JSON.stringify(liste, null, 2));
}

// Einstellungen der App (nicht pro Set), z. B. der Hintergrund der Bearbeitung
const EINSTELLUNGEN = () => path.join(app.getPath('userData'), 'einstellungen.json');
const HINTERGRUENDE = [['hell', 'Hellgrau'], ['mittel', 'Mittelgrau'], ['dunkel', 'Dunkelblau (wie die Kopfzeile)']];

function einstellungen() {
  try {
    return { hintergrund: 'hell', ...JSON.parse(fs.readFileSync(EINSTELLUNGEN(), 'utf8')) };
  } catch {
    return { hintergrund: 'hell' };
  }
}

function speichereEinstellung(schluessel, wert) {
  fs.mkdirSync(path.dirname(EINSTELLUNGEN()), { recursive: true });
  fs.writeFileSync(EINSTELLUNGEN(), JSON.stringify({ ...einstellungen(), [schluessel]: wert }, null, 2));
}

function setInfo(ordner) {
  const set = store.ladeSet(ordner);
  const v = vorlage(set.vorlage);
  return { set, vorlage: { id: v.id, name: v.name, layouts: v.layouts, felder: v.felder, folien: v.folien || {}, energieHintergruende: v.energieHintergruende || {}, regenbogenLayouts: v.regenbogenLayouts || [], standardGlanz: v.standardGlanz, standardFormat: v.standardFormat, formatVorschlaege: v.formatVorschlaege } };
}

let fenster;

// Jede Anfrage liefert { ok, wert } oder { ok: false, fehler, offene_punkte }
function bediene(kanal, fn) {
  ipcMain.handle(kanal, async (_e, ...args) => {
    try {
      return { ok: true, wert: await fn(...args) };
    } catch (e) {
      return { ok: false, fehler: e.message, code: e.code || 'fehler', offene_punkte: e.offene_punkte || [] };
    }
  });
}

bediene('set:liste', () => zuletzt().map((o) => {
  const s = store.ladeSet(o);
  return { ordner: o, name: s.name, kuerzel: s.kuerzel, karten: store.nummern(o).length, titelkarte: s.titelkarte || null };
}));
// Nimmt ein Set nur aus der Liste, der Ordner bleibt unverändert
bediene('set:vergessen', (ordner) => speichereListe(zuletzt().filter((o) => o !== path.resolve(ordner))));
bediene('vorlage:standard', () => {
  const v = vorlage('tcg');
  return { standardFormat: v.standardFormat, formatVorschlaege: v.formatVorschlaege };
});
bediene('set:waehleOrdner', async (titel) => {
  const r = await dialog.showOpenDialog(fenster, { title: titel, properties: ['openDirectory', 'createDirectory', 'promptToCreate'] });
  return r.canceled ? null : r.filePaths[0];
});
bediene('set:neu', (ordner, angaben) => {
  store.erstelleSet(ordner, angaben);
  merke(ordner);
  return setInfo(ordner);
});
bediene('set:oeffnen', (ordner) => {
  const info = setInfo(ordner);
  merke(ordner);
  return info;
});
bediene('set:aendern', (ordner, aenderungen) => {
  const { warnungen } = store.aendereSet(ordner, aenderungen);
  return { ...setInfo(ordner), warnungen };
});
bediene('karten:liste', (ordner) => store.listeKarten(ordner));
bediene('karte:laden', (ordner, nr, version) => ({ karte: store.ladeKarte(ordner, nr, version), versionen: store.versionen(ordner, nr), sammlung: store.ladeSammlung(ordner)[nr] || {} }));
// Die App speichert immer, notfalls als Entwurf. Das Formular liefert die ganze Karte, daher "ersetzen".
bediene('karte:neu', (ordner, daten) => store.neueKarte(ordner, daten, { entwurf: true }));
bediene('karte:aendern', (ordner, nr, daten) => store.aendereKarte(ordner, nr, daten, { entwurf: true, ersetzen: true }));
bediene('karte:kopieren', (ordner, nr, version) => store.kopiereKarte(ordner, nr, { version }));
bediene('karte:verschieben', (ordner, nr, ziel) => store.verschiebeKarte(ordner, nr, ziel));
bediene('karte:loeschen', (ordner, nr) => store.loescheKarte(ordner, nr));
bediene('einstellungen', () => einstellungen());
bediene('karte:stil', (ordner, von, nummern) => store.uebertrageStil(ordner, von, nummern));
bediene('bild:importieren', (ordner, pfad) => store.importiereBild(ordner, pfad));
bediene('bild:waehlen', async (ordner) => {
  const r = await dialog.showOpenDialog(fenster, { title: 'Bild wählen', properties: ['openFile'], filters: [{ name: 'Bilder', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }] });
  return r.canceled ? null : store.importiereBild(ordner, r.filePaths[0]);
});
bediene('vorschau', (ordner, karte) => {
  const set = store.ladeSet(ordner);
  const nummer = karte.nummer || (store.nummern(ordner).slice(-1)[0] || 0) + 1;
  return { html: karteSeite(set, { ...karte, nummer }, { bildPfad: arbeitsbilder(ordner) }), masse: kartenMasse(set, karte) };
});
bediene('vorschau:bild', async (ordner, nr) => pathToFileURL(await vorschauBild(ordner, nr)).href);
bediene('vorschau:rueckseite', (ordner) => rueckseiteSeite(store.ladeSet(ordner), { bildPfad: arbeitsbilder(ordner) }));
bediene('sammlung:besitz', (ordner, nr, anzahl) => store.setzeBesitz(ordner, nr, anzahl));
bediene('export:png', (ordner, optionen) => rendereKarten(ordner, optionen));
bediene('export:druck', (ordner, optionen) => druckePdf(ordner, optionen));
bediene('ordner:zeigen', (pfad) => shell.openPath(pfad));
bediene('datei:zeigen', (pfad) => shell.showItemInFolder(pfad));

function oeffneFenster() {
  fenster = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    title: 'cTCG Creator',
    icon: path.join(__dirname, '..', '..', 'assets', 'app.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false },
  });
  // Links öffnen nie ein neues Fenster oder den Browser
  fenster.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  fenster.webContents.on('will-navigate', (e) => e.preventDefault());
  fenster.loadFile(path.join(__dirname, 'ui', 'index.html'));
}

function sucheUpdates(still) {
  return update.suche({ app, dialog, shell, fenster, still });
}

function baueMenue() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Datei', submenu: [{ role: 'quit', label: 'Beenden' }] },
    { label: 'Bearbeiten', role: 'editMenu' },
    { label: 'Ansicht', submenu: [
      { role: 'reload', label: 'Neu laden' },
      { role: 'toggleDevTools', label: 'Entwicklertools' },
      { type: 'separator' },
      { label: 'Hintergrund der Bearbeitung', submenu: HINTERGRUENDE.map(([wert, label]) => ({
        label, type: 'radio', checked: einstellungen().hintergrund === wert,
        click: () => { speichereEinstellung('hintergrund', wert); fenster.webContents.send('einstellungen', einstellungen()); },
      })) },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Originalgröße' },
      { role: 'zoomIn', label: 'Vergrößern' },
      { role: 'zoomOut', label: 'Verkleinern' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Vollbild' },
    ] },
    { label: 'Hilfe', submenu: [
      { label: 'Nach Updates suchen …', click: () => sucheUpdates(false) },
      { type: 'separator' },
      { label: 'Über cTCG Creator', click: () => dialog.showMessageBox(fenster, {
        title: 'Über cTCG Creator',
        icon: nativeImage.createFromPath(LOGO).resize({ height: 96 }),
        message: `Custom TCG Creator ${app.getVersion()}`,
        detail: 'Eigene Sammel- und Spielkarten gestalten, drucken und verwalten.',
      }) },
    ] },
  ]));
}

app.whenReady().then(() => {
  baueMenue();
  oeffneFenster();
  update.entferneAlteExe(process.argv);
  // Beim Start still nach Updates suchen: ohne Internet oder ohne neue Version erscheint nichts
  fenster.webContents.once('did-finish-load', () => sucheUpdates(true));
});
app.on('window-all-closed', () => app.quit());

// Rendert Karten als PNG und Druckbögen als PDF. Läuft im Electron-Hauptprozess (App oder headless.js).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { BrowserWindow } = require('electron');
const store = require('../core/store');
const { karteSeite, rueckseiteSeite } = require('../core/seite');
const { vorlage } = require('../vorlagen');
const { arbeitsbilder } = require('./bilder');

const DPI = 300;
const A4 = { breite: 210, hoehe: 297 };

function tempOrdner() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ctcg-creator-'));
}

async function warteBisFertig(wc) {
  for (let i = 0; i < 600; i++) {
    if (await wc.executeJavaScript('window.__fertig === true')) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Die Karte wurde nicht fertig geladen (Zeitüberschreitung).');
}

// Rendert eine HTML-Seite der Größe breite x hoehe px und gibt ein NativeImage zurück
async function fotografiere(html, breite, hoehe, temp) {
  const datei = path.join(temp, `seite-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(datei, html, 'utf8');
  const win = new BrowserWindow({
    show: false,
    useContentSize: true,
    width: breite,
    height: hoehe,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true },
  });
  try {
    win.setContentSize(breite, hoehe);
    await win.loadFile(datei);
    await warteBisFertig(win.webContents);
    await new Promise((r) => setTimeout(r, 100));
    const bild = await win.webContents.capturePage({ x: 0, y: 0, width: breite, height: hoehe });
    const groesse = bild.getSize();
    return groesse.width === breite && groesse.height === hoehe ? bild : bild.resize({ width: breite, height: hoehe, quality: 'best' });
  } finally {
    win.destroy();
    fs.rmSync(datei, { force: true });
  }
}

// Maße einer Karte beim Rendern mit 300 dpi. Jede Karte kann ein eigenes Format haben.
function masse(set, karte) {
  const v = vorlage(set.vorlage);
  const format = v.formatVon(set, karte);
  const raster = v.masse(format);
  const pxProMm = DPI / 25.4;
  const breite = Math.round(raster.mm.breite * pxProMm);
  const zoom = breite / raster.breite;
  return {
    format,
    zoom,
    breite,
    hoehe: Math.round(raster.hoehe * zoom),
    beschnittPx: Math.round(format.beschnitt * pxProMm),
    mm: raster.mm,
  };
}

const formatSchluessel = (f) => `${f.breite}x${f.hoehe}+${f.beschnitt}`;

async function rendereKarteBild(set, karte, temp) {
  const m = masse(set, karte);
  return fotografiere(karteSeite(set, karte, { zoom: m.zoom, bildPfad: arbeitsbilder(set.ordner) }), m.breite, m.hoehe, temp);
}

function ohneBeschnitt(set, karte, bild) {
  const m = masse(set, karte);
  return bild.crop({ x: m.beschnittPx, y: m.beschnittPx, width: m.breite - 2 * m.beschnittPx, height: m.hoehe - 2 * m.beschnittPx });
}

// Rendert die gewählten Karten (Standard: alle) nach export/png/
async function rendereKarten(ordner, { nr, beschnitt = true } = {}) {
  const set = store.ladeSet(ordner);
  const temp = tempOrdner();
  const ergebnis = [];
  try {
    for (const n of store.waehleNummern(set.ordner, nr)) {
      const karte = store.ladeKarte(set.ordner, n);
      let bild = await rendereKarteBild(set, karte, temp);
      if (!beschnitt) bild = ohneBeschnitt(set, karte, bild);
      const datei = path.join(set.ordner, 'export', 'png', `${set.kuerzel}-${store.nr3(n)}_v${karte.version}${beschnitt ? '' : '_ohne-beschnitt'}.png`);
      fs.mkdirSync(path.dirname(datei), { recursive: true });
      fs.writeFileSync(datei, bild.toPNG());
      ergebnis.push({ nummer: n, version: karte.version, name: karte.name, png: datei });
    }
    store.pngErneuert(set.ordner, ergebnis.map((e) => e.nummer));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  return ergebnis;
}

// ---------- Vorschaubilder für die Übersichten der App ----------

const VORSCHAU_BREITE = 240;
let warteschlange = Promise.resolve();

// Liefert ein kleines PNG der aktuellen Version einer Karte. Zwischengespeichert in <set>/.vorschau/,
// neu erzeugt, sobald sich Karte, Set oder Vorlage ändern. Aufrufe laufen nacheinander.
function vorschauBild(ordner, nummer) {
  const auftrag = warteschlange.then(async () => {
    const set = store.ladeSet(ordner);
    const karte = store.ladeKarte(set.ordner, nummer);
    const v = vorlage(set.vorlage);
    const { ordner: _o, ...setDaten } = set;
    const schluessel = crypto.createHash('sha1')
      .update(JSON.stringify(setDaten)).update(JSON.stringify(karte)).update(String(fs.statSync(v.css).mtimeMs))
      .digest('hex').slice(0, 12);
    const dir = path.join(set.ordner, '.vorschau');
    const datei = path.join(dir, `${store.nr3(nummer)}-${schluessel}.png`);
    if (fs.existsSync(datei)) return datei;
    fs.mkdirSync(dir, { recursive: true });
    for (const alt of fs.readdirSync(dir).filter((f) => f.startsWith(`${store.nr3(nummer)}-`))) fs.rmSync(path.join(dir, alt), { force: true });
    const raster = v.masse(v.formatVon(set, karte));
    const zoom = VORSCHAU_BREITE / raster.breite;
    const temp = tempOrdner();
    try {
      const bild = await fotografiere(karteSeite(set, karte, { zoom, bildPfad: arbeitsbilder(set.ordner) }), VORSCHAU_BREITE, Math.round(raster.hoehe * zoom), temp);
      fs.writeFileSync(datei, bild.toPNG());
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
    return datei;
  });
  warteschlange = auftrag.catch(() => {});
  return auftrag;
}

// ---------- Druck ----------

// Schnittmarken an den Endformat-Kanten, nur im Rand außerhalb des Kartenrasters
function schnittmarken(x0, y0, spalten, zeilen, k) {
  const linien = [];
  const lang = 5;
  const abstand = 1;
  const xs = [];
  const ys = [];
  for (let c = 0; c < spalten; c++) xs.push(x0 + c * k.breite + k.beschnitt, x0 + (c + 1) * k.breite - k.beschnitt);
  for (let r = 0; r < zeilen; r++) ys.push(y0 + r * k.hoehe + k.beschnitt, y0 + (r + 1) * k.hoehe - k.beschnitt);
  const x1 = x0 + spalten * k.breite;
  const y1 = y0 + zeilen * k.hoehe;
  for (const x of xs) {
    linien.push([x, Math.max(0, y0 - abstand - lang), x, y0 - abstand]);
    linien.push([x, y1 + abstand, x, Math.min(A4.hoehe, y1 + abstand + lang)]);
  }
  for (const y of ys) {
    linien.push([Math.max(0, x0 - abstand - lang), y, x0 - abstand, y]);
    linien.push([x1 + abstand, y, Math.min(A4.breite, x1 + abstand + lang), y]);
  }
  return linien
    .filter(([a, b, c, d]) => Math.abs(c - a) > 0.2 || Math.abs(d - b) > 0.2)
    .map(([a, b, c, d]) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`).join('');
}

const bildTag = (url, x, y, k) => `<img src="${url}" style="left:${x}mm;top:${y}mm;width:${k.breite}mm;height:${k.hoehe}mm">`;

// A4-Bögen für eine Gruppe gleich großer Karten
function bogenSeiten(bilder, rueckseite, k) {
  const spalten = Math.floor(A4.breite / k.breite);
  const zeilen = Math.floor(A4.hoehe / k.hoehe);
  if (!spalten || !zeilen) throw new store.Fehler(`Karten mit ${k.breite} × ${k.hoehe} mm passen nicht auf A4. Bitte "eine Karte pro Seite" wählen.`, 'format');
  const proBogen = spalten * zeilen;
  const x0 = (A4.breite - spalten * k.breite) / 2;
  const y0 = (A4.hoehe - zeilen * k.hoehe) / 2;
  const marken = `<svg class="marken" viewBox="0 0 ${A4.breite} ${A4.hoehe}" stroke="#000" stroke-width="0.15">${schnittmarken(x0, y0, spalten, zeilen, k)}</svg>`;
  const seiten = [];
  for (let i = 0; i < bilder.length; i += proBogen) {
    const teil = bilder.slice(i, i + proBogen);
    const vorne = teil.map((url, j) => bildTag(url, x0 + (j % spalten) * k.breite, y0 + Math.floor(j / spalten) * k.hoehe, k)).join('');
    seiten.push(`<div class="seite a4">${vorne}${marken}</div>`);
    if (rueckseite) {
      // Rückseiten spiegelverkehrt, damit sie beim beidseitigen Druck hinter der richtigen Karte liegen
      const hinten = teil.map((_, j) => bildTag(rueckseite, x0 + (spalten - 1 - (j % spalten)) * k.breite, y0 + Math.floor(j / spalten) * k.hoehe, k)).join('');
      seiten.push(`<div class="seite a4">${hinten}${marken}</div>`);
    }
  }
  return seiten;
}

// Eine Karte pro Seite; die Seite hat genau die Größe der Karte samt Beschnitt (benannte Seite pro Format)
function einzelSeiten(bilder, rueckseite, k, seitenName) {
  const seiten = [];
  for (const url of bilder) {
    seiten.push(`<div class="seite ${seitenName}" style="width:${k.breite}mm;height:${k.hoehe}mm">${bildTag(url, 0, 0, k)}</div>`);
    if (rueckseite) seiten.push(`<div class="seite ${seitenName}" style="width:${k.breite}mm;height:${k.hoehe}mm">${bildTag(rueckseite, 0, 0, k)}</div>`);
  }
  return seiten;
}

// Erzeugt ein Druck-PDF nach export/druck/. modus "bogen" = A4 mit Schnittmarken, "einzeln" = eine Karte pro Seite.
// Karten unterschiedlicher Formate kommen auf getrennte Bögen. mitEntwuerfen: auch Karten drucken, denen noch Angaben fehlen
async function druckePdf(ordner, { nr, modus = 'bogen', rueckseiten = true, auflage = 1, mitEntwuerfen = false } = {}) {
  if (!['bogen', 'einzeln'].includes(modus)) throw new store.Fehler('modus muss bogen oder einzeln sein.', 'pflichtfelder_fehlen', ['modus']);
  const set = store.ladeSet(ordner);
  const temp = tempOrdner();
  try {
    const karten = store.waehleNummern(set.ordner, nr).map((n) => store.ladeKarte(set.ordner, n));
    if (!karten.length) throw new store.Fehler('Das Set hat noch keine Karten.', 'karte_fehlt');
    const entwuerfe = karten.filter((k) => k.entwurf);
    if (entwuerfe.length && !mitEntwuerfen) {
      throw new store.Fehler('Einige Karten sind noch Entwürfe. Vervollständigen oder ausdrücklich mitdrucken.', 'entwuerfe',
        entwuerfe.map((k) => `${k.nummer} ${k.name || ''}: ${(k.offene_punkte || []).join(', ')}`));
    }
    // Nach Format gruppieren, Reihenfolge der Nummern bleibt innerhalb der Gruppe erhalten
    const gruppen = new Map();
    for (const karte of karten) {
      const m = masse(set, karte);
      const s = formatSchluessel(m.format);
      if (!gruppen.has(s)) gruppen.set(s, { m, karten: [] });
      gruppen.get(s).karten.push(karte);
    }
    const seiten = [];
    const seitenRegeln = ['@page a4{size:210mm 297mm;margin:0}', '.a4{page:a4;width:210mm;height:297mm}'];
    let g = 0;
    for (const { m, karten: teil } of gruppen.values()) {
      const urls = [];
      for (const karte of teil) {
        const datei = path.join(temp, `${store.nr3(karte.nummer)}.png`);
        fs.writeFileSync(datei, (await rendereKarteBild(set, karte, temp)).toPNG());
        urls.push(pathToFileURL(datei).href);
      }
      let rueckUrl = null;
      if (rueckseiten) {
        const datei = path.join(temp, `rueckseite-${g}.png`);
        fs.writeFileSync(datei, (await fotografiere(rueckseiteSeite(set, { zoom: m.zoom, format: m.format, bildPfad: arbeitsbilder(set.ordner) }), m.breite, m.hoehe, temp)).toPNG());
        rueckUrl = pathToFileURL(datei).href;
      }
      if (modus === 'bogen') seiten.push(...bogenSeiten(urls, rueckUrl, m.mm));
      else {
        seitenRegeln.push(`@page f${g}{size:${m.mm.breite}mm ${m.mm.hoehe}mm;margin:0}`, `.f${g}{page:f${g}}`);
        seiten.push(...einzelSeiten(urls, rueckUrl, m.mm, `f${g}`));
      }
      g++;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${seitenRegeln.join('\n')}
html,body{margin:0;padding:0}
.seite{position:relative;overflow:hidden;page-break-after:always;break-after:page}
.seite:last-child{page-break-after:auto;break-after:auto}
.seite img{position:absolute}
.marken{position:absolute;inset:0;width:100%;height:100%}
</style></head><body>${seiten.join('')}
<script>Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))).then(() => { window.__fertig = true; });</script>
</body></html>`;
    const htmlDatei = path.join(temp, 'druck.html');
    fs.writeFileSync(htmlDatei, html, 'utf8');
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
    let pdf;
    try {
      await win.loadFile(htmlDatei);
      await warteBisFertig(win.webContents);
      pdf = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { marginType: 'none' } });
    } finally {
      win.destroy();
    }
    const datum = new Date().toISOString().slice(0, 10);
    let ziel = path.join(set.ordner, 'export', 'druck', `${set.kuerzel}_${datum}_${modus}.pdf`);
    for (let i = 2; fs.existsSync(ziel); i++) ziel = path.join(set.ordner, 'export', 'druck', `${set.kuerzel}_${datum}_${modus}_${i}.pdf`);
    fs.mkdirSync(path.dirname(ziel), { recursive: true });
    fs.writeFileSync(ziel, pdf);
    store.vermerkeDruck(set.ordner, karten.map((x) => ({ nummer: x.nummer, version: x.version })), path.relative(set.ordner, ziel).split(path.sep).join('/'), auflage);
    return { pdf: ziel, modus, karten: karten.map((x) => x.nummer), seiten: seiten.length, formate: [...gruppen.keys()], rueckseiten };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

module.exports = { rendereKarten, druckePdf, vorschauBild, DPI };

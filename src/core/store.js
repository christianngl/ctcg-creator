// Ablage eines Sets als normale Dateien in einem frei gewählten Ordner:
//   set.json           Set-Daten (Name, Kürzel, Kartentyp, Vorlage, Format, Typen, Seltenheiten …)
//   karten/007/v001.json  jede Version einer Karte als eigene Datei, die höchste ist die aktuelle
//   sammlung.json      Besitz und Druckvermerke pro Kartennummer
//   bilder/            Fotos und KI-Bilder des Sets
//   export/png/, export/druck/  erzeugte Karten und Druckbögen
const fs = require('fs');
const path = require('path');
const { vorlage } = require('../vorlagen');

const KARTENTYPEN = ['spielkarte', 'sammelkarte'];

class Fehler extends Error {
  constructor(meldung, code = 'fehler', offenePunkte = []) {
    super(meldung);
    this.code = code;
    this.offene_punkte = offenePunkte;
  }
}

const nr3 = (n) => String(n).padStart(3, '0');
const leseJson = (datei) => JSON.parse(fs.readFileSync(datei, 'utf8'));
const schreibeJson = (datei, daten) => {
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  fs.writeFileSync(datei, JSON.stringify(daten, null, 2) + '\n', 'utf8');
};

function setDatei(ordner) {
  return path.join(ordner, 'set.json');
}

function istSet(ordner) {
  return fs.existsSync(setDatei(ordner));
}

function pruefeFormat(v, format) {
  const fehler = v.pruefeFormat(format);
  if (fehler) throw new Fehler('Das Kartenformat passt nicht.', 'pflichtfelder_fehlen', [fehler]);
}

const FARBE = /^#[0-9a-fA-F]{6}$/;

// Typen eines Sets prüfen und vereinheitlichen: Name und Symbol Pflicht, Farben als #rrggbb
function pruefeTypen(typen) {
  if (!Array.isArray(typen)) throw new Fehler('typen muss eine Liste sein.', 'pflichtfelder_fehlen', ['typen']);
  const offen = [];
  const namen = new Set();
  const sauber = typen.map((t, i) => {
    const name = String(t.name || '').trim();
    if (!name) offen.push(`typen[${i}].name`);
    else if (namen.has(name.toLowerCase())) offen.push(`typen[${i}].name: doppelt (${name})`);
    namen.add(name.toLowerCase());
    if (!String(t.symbol || '').trim()) offen.push(`typen[${i}].symbol`);
    if (!FARBE.test(t.farbe || '')) offen.push(`typen[${i}].farbe: #rrggbb`);
    const hintergrund = Array.isArray(t.hintergrund) && t.hintergrund.length === 2 ? t.hintergrund : ['#f5f2eb', '#dcd6c8'];
    if (!hintergrund.every((h) => FARBE.test(h))) offen.push(`typen[${i}].hintergrund: zwei Farben #rrggbb`);
    const typ = { name, symbol: String(t.symbol || '').trim(), farbe: t.farbe, hintergrund };
    if (t.textfarbe && FARBE.test(t.textfarbe)) typ.textfarbe = t.textfarbe;
    return typ;
  });
  if (offen.length) throw new Fehler('Die Typen sind unvollständig.', 'pflichtfelder_fehlen', offen);
  return sauber;
}

// Karten (aktuelle Version), die Typen verwenden, die das Set nicht mehr kennt
function fremdeTypen(ordner, typen) {
  const bekannt = new Set(typen.map((t) => t.name));
  const treffer = [];
  for (const n of nummern(ordner)) {
    const k = ladeKarte(ordner, n);
    const benutzt = [k.typ, ...(k.attacken || []).flatMap((a) => a.kosten || [])].filter(Boolean);
    const fehlen = [...new Set(benutzt.filter((t) => !bekannt.has(t)))];
    if (fehlen.length) treffer.push(`Karte ${n} (${k.name || 'ohne Name'}) nutzt ${fehlen.join(', ')}`);
  }
  return treffer;
}

// Legt ein neues Set in einem leeren (oder noch nicht vorhandenen) Ordner an
function erstelleSet(ordner, angaben) {
  ordner = path.resolve(ordner);
  if (fs.existsSync(ordner) && fs.readdirSync(ordner).length) {
    throw new Fehler(`Der Ordner ist nicht leer: ${ordner}. Für ein neues Set bitte einen leeren Ordner wählen.`, 'ordner_nicht_leer');
  }
  const offen = [];
  if (!angaben.name) offen.push('name');
  if (!angaben.kuerzel || !/^[A-Za-z0-9]{2,5}$/.test(angaben.kuerzel)) offen.push('kuerzel: 2–5 Buchstaben/Ziffern');
  if (!KARTENTYPEN.includes(angaben.kartentyp)) offen.push(`kartentyp: ${KARTENTYPEN.join(' oder ')}`);
  if (offen.length) throw new Fehler('Angaben für das Set fehlen.', 'pflichtfelder_fehlen', offen);

  const v = vorlage(angaben.vorlage || 'tcg');
  const format = { ...v.standardFormat, ...(angaben.format || {}) };
  pruefeFormat(v, format);
  const set = {
    name: angaben.name,
    kuerzel: angaben.kuerzel.toUpperCase(),
    kartentyp: angaben.kartentyp,
    vorlage: v.id,
    format,
    fusszeile: angaben.fusszeile || angaben.name,
    anzahl: angaben.anzahl || null,
    rueckseite: null,
    typen: angaben.typen ? pruefeTypen(angaben.typen) : v.standard.typen,
    seltenheiten: angaben.seltenheiten || v.standard.seltenheiten,
    titelkarte: null,
    angelegt: new Date().toISOString().slice(0, 10),
  };
  for (const unter of ['karten', 'bilder', 'export/png', 'export/druck']) fs.mkdirSync(path.join(ordner, unter), { recursive: true });
  schreibeJson(setDatei(ordner), set);
  schreibeJson(path.join(ordner, 'sammlung.json'), {});
  return { ...set, ordner };
}

function ladeSet(ordner) {
  ordner = path.resolve(ordner);
  if (!istSet(ordner)) throw new Fehler(`Kein Set gefunden (set.json fehlt): ${ordner}`, 'kein_set');
  return { ...leseJson(setDatei(ordner)), ordner };
}

// Ändert Set-Angaben. Kürzel und Vorlage bleiben fest, weil Dateinamen und Karten daran hängen.
// Die Antwort enthält "warnungen", z. B. Karten, deren Typ es nach der Änderung nicht mehr gibt.
function aendereSet(ordner, aenderungen) {
  const { ordner: _o, ...set } = ladeSet(ordner);
  const erlaubt = ['name', 'fusszeile', 'anzahl', 'rueckseite', 'typen', 'seltenheiten', 'format', 'titelkarte'];
  for (const [k, wert] of Object.entries(aenderungen)) {
    if (!erlaubt.includes(k)) throw new Fehler(`Das Feld ${k} lässt sich nicht ändern (änderbar: ${erlaubt.join(', ')}).`, 'nicht_aenderbar');
    set[k] = wert;
  }
  if (aenderungen.format) {
    set.format = { ...vorlage(set.vorlage).standardFormat, ...aenderungen.format };
    pruefeFormat(vorlage(set.vorlage), set.format);
  }
  if (aenderungen.typen) set.typen = pruefeTypen(aenderungen.typen);
  if (aenderungen.titelkarte !== undefined && aenderungen.titelkarte !== null) {
    set.titelkarte = Number(aenderungen.titelkarte);
    if (!nummern(ordner).includes(set.titelkarte)) throw new Fehler(`Titelkarte ${aenderungen.titelkarte} gibt es im Set nicht.`, 'karte_fehlt');
  }
  if (aenderungen.rueckseite) set.rueckseite = importiereBild(ordner, aenderungen.rueckseite);
  schreibeJson(setDatei(ordner), set);
  const warnungen = aenderungen.typen ? fremdeTypen(ordner, set.typen) : [];
  return { ...set, ordner: path.resolve(ordner), warnungen };
}

function kartenOrdner(ordner, nummer) {
  return path.join(ordner, 'karten', nr3(nummer));
}

function versionen(ordner, nummer) {
  const dir = kartenOrdner(ordner, nummer);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map((f) => /^v(\d+)\.json$/.exec(f))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

function nummern(ordner) {
  const dir = path.join(ordner, 'karten');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^\d+$/.test(f)).map(Number).filter((n) => versionen(ordner, n).length).sort((a, b) => a - b);
}

function ladeKarte(ordner, nummer, version) {
  const vs = versionen(ordner, nummer);
  if (!vs.length) throw new Fehler(`Karte ${nummer} gibt es im Set nicht.`, 'karte_fehlt');
  const v = version ? Number(version) : vs[vs.length - 1];
  if (!vs.includes(v)) throw new Fehler(`Karte ${nummer} hat keine Version ${v} (vorhanden: ${vs.join(', ')}).`, 'version_fehlt');
  return leseJson(path.join(kartenOrdner(ordner, nummer), `v${nr3(v)}.json`));
}

function listeKarten(ordner) {
  const sammlung = ladeSammlung(ordner);
  return nummern(ordner).map((n) => {
    const k = ladeKarte(ordner, n);
    const s = sammlung[n] || {};
    return { nummer: n, version: k.version, name: k.name, layout: k.layout, typ: k.typ || null, seltenheit: k.seltenheit || null, entwurf: !!k.entwurf, kommentar: k.kommentar || null, besitz: s.besitz || 0, gedruckt: (s.gedruckt || []).length };
  });
}

// Kopiert ein Bild von außerhalb in bilder/ und liefert den Pfad relativ zum Set. Bilder im Set bleiben, wo sie sind.
function importiereBild(ordner, datei) {
  ordner = path.resolve(ordner);
  const abs = path.resolve(ordner, datei);
  if (!fs.existsSync(abs)) throw new Fehler(`Bild nicht gefunden: ${datei}`, 'bild_fehlt', ['bild.datei']);
  const rel = path.relative(ordner, abs);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) return rel.split(path.sep).join('/');
  const ext = path.extname(abs).toLowerCase();
  const basis = path.basename(abs, path.extname(abs)).replace(/[^\w.-]+/g, '_');
  let ziel = path.join(ordner, 'bilder', basis + ext);
  for (let i = 2; fs.existsSync(ziel); i++) ziel = path.join(ordner, 'bilder', `${basis}_${i}${ext}`);
  fs.copyFileSync(abs, ziel);
  return path.relative(ordner, ziel).split(path.sep).join('/');
}

// Prüft die Pflichtfelder. Als Entwurf wird trotzdem gespeichert, die offenen Punkte stehen dann in der Karte.
function pruefeKarte(set, karte, entwurf) {
  delete karte.entwurf;
  delete karte.offene_punkte;
  const v = vorlage(set.vorlage);
  if (karte.folie && (v.entfernteFolien || []).includes(karte.folie.art)) delete karte.folie;
  if (entwurf && !v.layouts[karte.layout]) karte.layout = Object.keys(v.layouts).find((l) => v.layouts[l].kartentyp === set.kartentyp);
  const offen = v.pruefe(set, karte);
  if (!offen.length) return;
  if (!entwurf) throw new Fehler('Für die Karte fehlen Angaben oder sie sind ungültig.', 'pflichtfelder_fehlen', offen);
  karte.entwurf = true;
  karte.offene_punkte = offen;
}

function bildUebernehmen(ordner, karte) {
  if (karte.bild && karte.bild.datei) karte.bild = { skalierung: 1, x: 0, y: 0, ...karte.bild, datei: importiereBild(ordner, karte.bild.datei) };
}

function speichereVersion(ordner, karte) {
  schreibeJson(path.join(kartenOrdner(ordner, karte.nummer), `v${nr3(karte.version)}.json`), karte);
}

// Legt eine Karte an. Ohne nummer bekommt sie die nächste freie Nummer.
// entwurf: auch mit fehlenden Angaben speichern (die Karte ist dann als Entwurf markiert)
function neueKarte(ordner, daten, { entwurf = false } = {}) {
  const set = ladeSet(ordner);
  const vorhanden = nummern(set.ordner);
  let nummer = daten.nummer ? Number(daten.nummer) : (vorhanden.length ? vorhanden[vorhanden.length - 1] + 1 : 1);
  if (!Number.isInteger(nummer) || nummer < 1) throw new Fehler('nummer muss eine positive ganze Zahl sein.', 'pflichtfelder_fehlen', ['nummer']);
  if (vorhanden.includes(nummer)) throw new Fehler(`Nummer ${nummer} ist schon vergeben. Zum Ändern "karte aendern" verwenden.`, 'nummer_vergeben');
  const karte = { ...daten, nummer, version: 1, geaendert: new Date().toISOString() };
  pruefeKarte(set, karte, entwurf);
  bildUebernehmen(set.ordner, karte);
  speichereVersion(set.ordner, karte);
  return karte;
}

// Ändert eine Karte, indem eine neue Version entsteht. Alte Versionen bleiben erhalten.
// Standard: die Änderungen werden in die aktuelle Version gemischt. ersetzen: die Angaben ersetzen die Karte ganz (Formular der App).
function aendereKarte(ordner, nummer, aenderungen, { entwurf = false, ersetzen = false } = {}) {
  const set = ladeSet(ordner);
  const alt = ladeKarte(set.ordner, nummer);
  const { nummer: _n, version: _v, ...rest } = aenderungen;
  const basis = ersetzen ? {} : alt;
  const karte = { ...basis, ...rest, nummer: alt.nummer, version: alt.version + 1, geaendert: new Date().toISOString() };
  if (!ersetzen && rest.bild && alt.bild) karte.bild = { ...alt.bild, ...rest.bild };
  pruefeKarte(set, karte, entwurf);
  bildUebernehmen(set.ordner, karte);
  speichereVersion(set.ordner, karte);
  return karte;
}

// Kopiert eine Karte (aktuelle oder gewählte Version) als neue Karte, z. B. um dieselbe Karte als normale und als Goldkarte
// im Set zu haben. Die Kopie startet bei Version 1 und merkt sich ihr Vorbild in "kopiert_von". Die Sammlung wird nicht kopiert.
function kopiereKarte(ordner, nummer, { version, neueNummer } = {}) {
  const set = ladeSet(ordner);
  const quelle = ladeKarte(set.ordner, nummer, version);
  const { nummer: _n, version: _v, geaendert: _g, kopiert_von: _k, ...inhalt } = quelle;
  // War das Vorbild ein Entwurf, ist es die Kopie auch. Erfunden wird dabei nichts.
  return neueKarte(set.ordner, { ...inhalt, nummer: neueNummer, kopiert_von: { nummer: quelle.nummer, version: quelle.version } }, { entwurf: true });
}

// Überträgt den Stil (Layout innerhalb der Familie, Effekt, Format, Holo, Goldton) der aktuellen Version von quelle
// auf andere Karten. Jede geänderte Karte bekommt eine neue Version, Karten ohne Unterschied bleiben unverändert.
function uebertrageStil(ordner, quelle, ziele) {
  const set = ladeSet(ordner);
  const v = vorlage(set.vorlage);
  const vorbild = ladeKarte(set.ordner, quelle);
  return ziele.filter((n) => n !== Number(quelle)).map((n) => {
    const alt = ladeKarte(set.ordner, n);
    const aenderungen = v.stilVon(vorbild, alt);
    const gleich = Object.entries(aenderungen).every(([k, w]) => JSON.stringify(w) === JSON.stringify(alt[k]));
    if (gleich) return { nummer: n, version: alt.version, geaendert: false };
    // Der Stil ändert keine Inhalte. War die Karte schon ein Entwurf, bleibt sie es.
    const k = aendereKarte(set.ordner, n, aenderungen, { entwurf: true });
    return { nummer: n, version: k.version, geaendert: true, entwurf: !!k.entwurf };
  });
}

// PNG-Dateien in export/png/, die zu einer Kartennummer gehören (mit und ohne Beschnitt, alle Versionen)
function pngDateien(set, nummer) {
  const dir = path.join(set.ordner, 'export', 'png');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.startsWith(`${set.kuerzel}-${nr3(nummer)}_v`) && f.endsWith('.png')).map((f) => path.join(dir, f));
}

// Verschiebt Dateien nach ziel (Ordner wird angelegt). Gleichnamige Dateien dort werden nicht überschrieben.
function verschiebeDateien(dateien, ziel) {
  if (!dateien.length) return;
  fs.mkdirSync(ziel, { recursive: true });
  for (const d of dateien) {
    const ext = path.extname(d);
    let neu = path.join(ziel, path.basename(d));
    for (let i = 2; fs.existsSync(neu); i++) neu = path.join(ziel, `${path.basename(d, ext)}_${i}${ext}`);
    fs.renameSync(d, neu);
  }
}

// Nummeriert die Karten in der Reihenfolge von "reihenfolge" (bisherige Nummern) fortlaufend ab 1 durch.
// Jede Karte mit neuer Nummer zieht samt allen Versionen in den neuen Ordner und bekommt eine neue Version mit der
// neuen Nummer. Sammlung und Titelkarte ziehen mit, alte PNGs dieser Karten kommen nach export/png/veraltet/,
// und die Karten stehen in set.json unter png_veraltet, bis sie neu gerendert sind.
function ordneKarten(ordner, reihenfolge) {
  const set = ladeSet(ordner);
  const alle = nummern(set.ordner);
  const liste = reihenfolge.map(Number);
  if (liste.length !== alle.length || new Set(liste).size !== liste.length || !liste.every((n) => alle.includes(n))) {
    throw new Fehler('Die neue Reihenfolge muss jede Karte des Sets genau einmal enthalten.', 'reihenfolge_ungueltig');
  }
  const wechsel = liste.map((alt, i) => ({ alt, neu: i + 1 })).filter((w) => w.alt !== w.neu);
  if (!wechsel.length) return [];
  const karten = path.join(set.ordner, 'karten');
  // Erst alle beiseite, dann an die neuen Nummern, damit sich die Ordner nicht in die Quere kommen
  for (const w of wechsel) {
    verschiebeDateien(pngDateien(set, w.alt), path.join(set.ordner, 'export', 'png', 'veraltet'));
    fs.renameSync(kartenOrdner(set.ordner, w.alt), path.join(karten, `umbau-${nr3(w.alt)}`));
  }
  const jetzt = new Date().toISOString();
  const ergebnis = wechsel.map((w) => {
    fs.renameSync(path.join(karten, `umbau-${nr3(w.alt)}`), kartenOrdner(set.ordner, w.neu));
    const alt = ladeKarte(set.ordner, w.neu);
    const karte = { ...alt, nummer: w.neu, version: alt.version + 1, geaendert: jetzt, umnummeriert: { von: w.alt, am: jetzt.slice(0, 10) } };
    speichereVersion(set.ordner, karte);
    return { alt: w.alt, neu: w.neu, version: karte.version, name: karte.name };
  });

  const neuVon = new Map(wechsel.map((w) => [w.alt, w.neu]));
  const nachher = (n) => neuVon.get(Number(n)) ?? Number(n);
  const sammlung = ladeSammlung(set.ordner);
  const neueSammlung = {};
  for (const [n, eintrag] of Object.entries(sammlung)) neueSammlung[nachher(n)] = eintrag;
  schreibeJson(path.join(set.ordner, 'sammlung.json'), neueSammlung);

  const { ordner: _o, ...daten } = set;
  if (daten.titelkarte) daten.titelkarte = nachher(daten.titelkarte);
  daten.png_veraltet = [...new Set([...(daten.png_veraltet || []).map(nachher), ...ergebnis.map((e) => e.neu)])].sort((a, b) => a - b);
  schreibeJson(setDatei(set.ordner), daten);
  return ergebnis;
}

// Setzt Karte nr an die Stelle von Karte ziel, die Karten dazwischen rücken auf. Liefert die geänderten Nummern (ordneKarten).
function verschiebeKarte(ordner, nr, ziel) {
  const alle = nummern(path.resolve(ordner));
  nr = Number(nr);
  ziel = Number(ziel);
  for (const n of [nr, ziel]) if (!alle.includes(n)) throw new Fehler(`Karte ${n} gibt es im Set nicht.`, 'karte_fehlt');
  const liste = alle.filter((n) => n !== nr);
  liste.splice(alle.indexOf(ziel), 0, nr);
  return ordneKarten(ordner, liste);
}

// Löscht eine Karte: Sie kommt mit allen Versionen, ihrem Sammlungseintrag und ihren PNGs in den Ordner papierkorb/
// des Sets (lässt sich von Hand zurückholen). Die folgenden Karten rücken auf, damit die Nummern fortlaufend bleiben.
function loescheKarte(ordner, nr) {
  const set = ladeSet(ordner);
  nr = Number(nr);
  const karte = ladeKarte(set.ordner, nr);
  const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const ziel = path.join(set.ordner, 'papierkorb', `${stempel}_${nr3(nr)}_${String(karte.name || 'ohne-name').replace(/[^\w.-]+/g, '_')}`);
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.renameSync(kartenOrdner(set.ordner, nr), ziel);
  verschiebeDateien(pngDateien(set, nr), path.join(ziel, 'png'));
  const sammlung = ladeSammlung(set.ordner);
  if (sammlung[nr]) schreibeJson(path.join(ziel, 'sammlung.json'), sammlung[nr]);
  delete sammlung[nr];
  schreibeJson(path.join(set.ordner, 'sammlung.json'), sammlung);
  const { ordner: _o, ...daten } = set;
  if (daten.titelkarte === nr) daten.titelkarte = null;
  if (daten.png_veraltet) daten.png_veraltet = daten.png_veraltet.filter((n) => n !== nr);
  schreibeJson(setDatei(set.ordner), daten);
  return { geloescht: { nummer: nr, name: karte.name || null, papierkorb: ziel }, umnummeriert: ordneKarten(set.ordner, nummern(set.ordner)) };
}

// Nach dem Rendern: diese Karten haben wieder ein aktuelles PNG
function pngErneuert(ordner, liste) {
  const set = ladeSet(ordner);
  if (!(set.png_veraltet || []).length) return;
  const { ordner: _o, ...daten } = set;
  daten.png_veraltet = daten.png_veraltet.filter((n) => !liste.includes(n));
  schreibeJson(setDatei(set.ordner), daten);
}

function ladeSammlung(ordner) {
  const datei = path.join(ordner, 'sammlung.json');
  return fs.existsSync(datei) ? leseJson(datei) : {};
}

function setzeBesitz(ordner, nummer, anzahl) {
  ladeKarte(ordner, nummer);
  if (!Number.isInteger(anzahl) || anzahl < 0) throw new Fehler('besitz muss eine ganze Zahl ab 0 sein.', 'pflichtfelder_fehlen', ['besitz']);
  const s = ladeSammlung(ordner);
  s[nummer] = { ...(s[nummer] || {}), besitz: anzahl };
  schreibeJson(path.join(ordner, 'sammlung.json'), s);
  return s[nummer];
}

function vermerkeDruck(ordner, eintraege, datei, auflage = 1) {
  const s = ladeSammlung(ordner);
  const datum = new Date().toISOString().slice(0, 10);
  for (const { nummer, version } of eintraege) {
    const e = s[nummer] || {};
    e.gedruckt = [...(e.gedruckt || []), { datum, version, auflage, datei }];
    s[nummer] = e;
  }
  schreibeJson(path.join(ordner, 'sammlung.json'), s);
}

// "7", "1-12", "1,3,5-7" -> [Nummern]; leer = alle Karten des Sets
function waehleNummern(ordner, auswahl) {
  const alle = nummern(ordner);
  if (auswahl === undefined || auswahl === null || auswahl === '' || auswahl === true) return alle;
  const gewaehlt = new Set();
  for (const teil of String(auswahl).split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(teil);
    if (!m) throw new Fehler(`Ungültige Nummernauswahl: ${auswahl}`, 'pflichtfelder_fehlen', ['nr']);
    const von = Number(m[1]);
    const bis = m[2] ? Number(m[2]) : von;
    for (let n = von; n <= bis; n++) gewaehlt.add(n);
  }
  const fehlen = [...gewaehlt].filter((n) => !alle.includes(n));
  if (fehlen.length) throw new Fehler(`Diese Karten gibt es nicht: ${fehlen.join(', ')}`, 'karte_fehlt');
  return [...gewaehlt].sort((a, b) => a - b);
}

module.exports = {
  Fehler,
  KARTENTYPEN,
  nr3,
  istSet,
  erstelleSet,
  ladeSet,
  aendereSet,
  ladeKarte,
  listeKarten,
  versionen,
  nummern,
  neueKarte,
  aendereKarte,
  kopiereKarte,
  uebertrageStil,
  ordneKarten,
  verschiebeKarte,
  loescheKarte,
  pngErneuert,
  importiereBild,
  ladeSammlung,
  setzeBesitz,
  vermerkeDruck,
  waehleNummern,
};

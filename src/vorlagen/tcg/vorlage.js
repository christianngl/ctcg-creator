// Vorlage "tcg": Spiel- und Sammelkarten im Pokémon-Stil nach dem Vorbild der Bastian Edition.
// Gestaltet auf einem Raster von 690 x 940 px = 69 x 94 mm (63 x 88 mm + 3 mm Beschnitt), 10 px = 1 mm.
const path = require('path');
const { esc, absatz, slug } = require('../../core/text');

const STANDARD_TYPEN = [
  { name: 'Kuschel', symbol: '♥', farbe: '#e86a9a', hintergrund: ['#ffe4ee', '#fac4d8'] },
  { name: 'Stahl', symbol: '⚙', farbe: '#808ea2', hintergrund: ['#ecf0f5', '#c8d2de'] },
  { name: 'Natur', symbol: '✿', farbe: '#4ca352', hintergrund: ['#e2f4d6', '#badea6'] },
  { name: 'Reisen', symbol: '✈', farbe: '#2b8fd6', hintergrund: ['#deeefc', '#b2d4f0'] },
  { name: 'Farblos', symbol: '★', farbe: '#ece6d6', textfarbe: '#5a503c', hintergrund: ['#f5f2eb', '#dcd6c8'] },
  { name: 'Wasser', symbol: '≈', farbe: '#26b0ce', hintergrund: ['#dcf6fc', '#aadeee'] },
  { name: 'Mode', symbol: '✂', farbe: '#9654c4', hintergrund: ['#f0e4fa', '#d4beec'] },
  { name: 'Kampf', symbol: '✸', farbe: '#d25c30', hintergrund: ['#fce8da', '#ecc4aa'] },
  { name: 'Küche', symbol: '♨', farbe: '#e69824', hintergrund: ['#fff2d6', '#f2d6a0'] },
  { name: 'Kunst', symbol: '✎', farbe: '#d64058', hintergrund: ['#fce2e6', '#eebac4'] },
  { name: 'Gaming', symbol: '♞', farbe: '#4652be', hintergrund: ['#e4e8fc', '#bec6f0'] },
  { name: 'Eis', symbol: '❄', farbe: '#5ca0d6', hintergrund: ['#ecf6ff', '#c4def4'] },
  { name: 'Feuer', symbol: '✹', farbe: '#e2422a', hintergrund: ['#ffe6d6', '#f6baa0'] },
];

const STANDARD_SELTENHEITEN = [
  { name: 'häufig', symbol: '●' },
  { name: 'selten', symbol: '◆', glanz: true },
  { name: 'holo', symbol: '★', glanz: true },
];

// aufbau: welche Felder das Layout hat (spiel = KP, Typ, Attacken). Layouts mit gleichem Aufbau lassen sich
// ineinander umstellen, ohne dass Angaben fehlen.
const LAYOUTS = {
  normal: { titel: 'Normal (Fotofenster oben)', kartentyp: 'spielkarte', aufbau: 'spiel' },
  vollbild: { titel: 'Vollbild (Foto über die ganze Karte)', kartentyp: 'spielkarte', aufbau: 'spiel' },
  gold: { titel: 'Goldkarte (Vollbild in Gold)', kartentyp: 'spielkarte', aufbau: 'spiel' },
  regenbogen: { titel: 'Regenbogenkarte (Vollbild mit Regenbogenglanz)', kartentyp: 'spielkarte', aufbau: 'spiel' },
  'regenbogen-normal': { titel: 'Regenbogenkarte (Fotofenster oben, Regenbogenglanz)', kartentyp: 'spielkarte', aufbau: 'spiel' },
  trainer: { titel: 'Trainer (Effektkarte)', kartentyp: 'spielkarte', aufbau: 'trainer' },
  energie: { titel: 'Energiekarte (Vollbild mit Energie-Symbolen)', kartentyp: 'spielkarte', aufbau: 'energie' },
  sammel: { titel: 'Sammelkarte (Bild, Name, Beschreibung)', kartentyp: 'sammelkarte', aufbau: 'sammel' },
  'sammel-regenbogen': { titel: 'Regenbogen-Sammelkarte (mit Regenbogenglanz)', kartentyp: 'sammelkarte', aufbau: 'sammel' },
};
const aufbau = (layout) => (LAYOUTS[layout] || {}).aufbau;

// Folien-Effekte wie bei Holo-Karten. Statisch gezeichnet, damit sie genau so gedruckt werden.
const FOLIEN = {
  glitzer: 'Glitzer (feine Funken)',
  sterne: 'Sterne (Sternchen mit Leuchten)',
  kosmos: 'Kosmos (schimmernde Kreise)',
  regenbogen: 'Regenbogen-Folie',
  glanz: 'Glanz (Lichtstreifen)',
};

// Stil = Gestaltung ohne Inhalte. "Stil übertragen" kopiert diese Felder, das Layout nur bei gleichem Aufbau,
// weil sonst Pflichtfelder wegfallen oder fehlen würden (z. B. normal -> trainer).
const STIL_FELDER = ['folie', 'format', 'holo', 'goldton'];

// Änderungen, die den Stil von quelle auf ziel übertragen. Fehlt ein Feld in der Quelle, wird es beim Ziel entfernt (undefined).
function stilVon(quelle, ziel) {
  const aenderungen = {};
  for (const f of STIL_FELDER) aenderungen[f] = quelle[f] === undefined ? undefined : JSON.parse(JSON.stringify(quelle[f]));
  if (aufbau(quelle.layout) && aufbau(quelle.layout) === aufbau(ziel.layout)) aenderungen.layout = quelle.layout;
  return aenderungen;
}

// Nicht mehr angebotene Effekte: alte Karten zeigen sie nicht mehr, beim nächsten Speichern fallen sie weg
const ENTFERNTE_FOLIEN = ['strahlen'];

// Feldbeschreibung für "ctcg-creator vorlage zeigen" und die Oberfläche
const FELDER = {
  alle: {
    layout: Object.keys(LAYOUTS).join(' | '),
    name: 'Text (Pflicht)',
    namensgroesse: 'Zahl in px, optional (sonst automatisch passend)',
    bild: '{ datei, skalierung (>= 1), x, y (Verschiebung in %) } – datei relativ zum Set-Ordner oder absoluter Pfad (wird ins Set kopiert)',
    bildquelle: 'foto | ki (Pflicht)',
    seltenheit: 'Name einer Seltenheit des Sets (Pflicht, wenn das Set Seltenheiten hat)',
    holo: 'true | false – veraltet, stattdessen Layout regenbogen bzw. sammel-regenbogen (alte Karten zeigen den Holo-Rahmen weiter)',
    format: '{ breite, hoehe } in mm, optional – sonst Standardformat des Sets; Beschnitt kommt vom Set',
    folie: `{ art: ${Object.keys(FOLIEN).join(' | ')}, bereich: bild | karte, staerke: 0.1–1 } – Effekt über Bild oder Karte, optional`,
    flavor: 'Text, optional',
    kommentar: 'Text, optional – Notiz für spätere Bearbeitungen und Ideen, erscheint nicht auf der Karte',
  },
  normal: {
    stufe: 'Text, z. B. Basis, Phase 1 (Pflicht)',
    entwickelt_aus: 'Name der Vorstufe, optional',
    kp: 'Zahl (Pflicht)',
    typ: 'Name eines Typs des Sets (Pflicht)',
    band: 'Text 1 im Band unter dem Foto, optional (auch bei regenbogen-normal). Das Band zeigt immer "Nr. 007 · Text 1 · Text 2", die Nummer kommt automatisch',
    band2: 'Text 2 im Band unter dem Foto, optional',
    attacken: '[{ kosten: [Typname, …], name, schaden, text }] – 1 bis 2 (Pflicht)',
    schwaeche: 'Text, optional',
    resistenz: 'Text, optional',
    rueckzug: 'Zahl 0–5, optional',
  },
  vollbild: 'wie normal, ohne band',
  gold: 'wie vollbild, dazu goldton: true | false (Foto in Gold eingefärbt, Standard true)',
  regenbogen: 'wie vollbild, mit Regenbogenrahmen und Regenbogenglanz über dem Foto',
  'regenbogen-normal': 'wie normal (Fotofenster oben, mit band), mit Regenbogenrahmen und Regenbogenglanz über der ganzen Karte',
  trainer: {
    untertyp: 'Text, z. B. UNTERSTÜTZER, optional',
    effekt: 'Text (Pflicht)',
    regel: 'Text, optional',
  },
  energie: {
    typ: 'Name eines Typs des Sets (Pflicht), bestimmt Symbol und Farbe',
    energien: 'Zahl 1–5, wie viele Energie-Symbole die Karte zeigt (Standard 1)',
  },
  sammel: {
    typ: 'Name eines Typs des Sets, optional (färbt die Karte)',
    beschreibung: 'Text, optional',
  },
  'sammel-regenbogen': 'wie sammel, mit Regenbogenrahmen und Regenbogenglanz über dem Bild',
};

// Raster: 690 px Breite für die ganze Karte samt Beschnitt. Die Höhe ergibt sich aus dem Format,
// alles über 940 px (bzw. darunter) bekommt das Fotofenster (CSS-Variable --dh).
const RASTER_BREITE = 690;
const STANDARD_FORMAT = { breite: 63, hoehe: 88, beschnitt: 3 };
const DH_GRENZEN = { min: -180, max: 500 };

function masse(format = STANDARD_FORMAT) {
  const f = { ...STANDARD_FORMAT, ...format };
  const mmBreite = f.breite + 2 * f.beschnitt;
  const mmHoehe = f.hoehe + 2 * f.beschnitt;
  const pxProMm = RASTER_BREITE / mmBreite;
  const hoehe = Math.round(mmHoehe * pxProMm);
  return { breite: RASTER_BREITE, hoehe, dh: hoehe - 940, pxProMm, beschnittPx: f.beschnitt * pxProMm, mm: { breite: mmBreite, hoehe: mmHoehe, beschnitt: f.beschnitt } };
}

// Gibt eine Fehlermeldung zurück, wenn das Layout das Format nicht tragen kann, sonst null
function pruefeFormat(format) {
  const f = format || {};
  for (const k of ['breite', 'hoehe']) {
    if (!Number.isFinite(Number(f[k])) || Number(f[k]) < 30 || Number(f[k]) > 200) return `format.${k}: Zahl zwischen 30 und 200 mm`;
  }
  if (f.beschnitt !== undefined && (!Number.isFinite(Number(f.beschnitt)) || f.beschnitt < 0 || f.beschnitt > 6)) return 'format.beschnitt: 0 bis 6 mm';
  const { dh } = masse({ breite: Number(f.breite), hoehe: Number(f.hoehe), beschnitt: f.beschnitt ?? 3 });
  if (dh < DH_GRENZEN.min) return `format: ${f.hoehe} × ${f.breite} mm ist für dieses Layout zu breit (Höhe mindestens etwa das 1,25-Fache der Breite)`;
  if (dh > DH_GRENZEN.max) return `format: ${f.hoehe} × ${f.breite} mm ist für dieses Layout zu schmal`;
  return null;
}

// Format einer Karte: eigenes Format der Karte, sonst das Standardformat des Sets. Der Beschnitt kommt immer vom Set.
function formatVon(set, karte) {
  const basis = set.format || STANDARD_FORMAT;
  const f = (karte && karte.format) || basis;
  return { breite: Number(f.breite), hoehe: Number(f.hoehe), beschnitt: Number(basis.beschnitt ?? 3) };
}

function typVon(set, name) {
  return (set.typen || []).find((t) => t.name === name);
}

// Prüft eine Karte gegen die Pflichtfelder und gibt die offenen Punkte zurück (leer = vollständig)
function pruefe(set, karte) {
  const offen = [];
  const leer = (v) => v === undefined || v === null || String(v).trim() === '';
  if (!LAYOUTS[karte.layout]) offen.push(`layout: eines von ${Object.keys(LAYOUTS).join(', ')}`);
  else if (LAYOUTS[karte.layout].kartentyp !== set.kartentyp) {
    const passend = Object.keys(LAYOUTS).filter((l) => LAYOUTS[l].kartentyp === set.kartentyp);
    offen.push(`layout: ${karte.layout} passt nicht zum Kartentyp ${set.kartentyp} des Sets (möglich: ${passend.join(', ')})`);
  }
  if (leer(karte.name)) offen.push('name');
  if (!karte.bild || leer(karte.bild.datei)) offen.push('bild.datei');
  if (!['foto', 'ki'].includes(karte.bildquelle)) offen.push('bildquelle: foto oder ki');
  if ((set.seltenheiten || []).length) {
    if (leer(karte.seltenheit)) offen.push('seltenheit');
    else if (!set.seltenheiten.some((s) => s.name === karte.seltenheit)) offen.push(`seltenheit: unbekannt (${karte.seltenheit})`);
  }
  if (karte.typ && !typVon(set, karte.typ)) offen.push(`typ: unbekannt (${karte.typ})`);
  if (karte.format) {
    const fehler = pruefeFormat(karte.format);
    if (fehler) offen.push(fehler);
  }
  if (karte.folie && karte.folie.art && !FOLIEN[karte.folie.art]) offen.push(`folie.art: eines von ${Object.keys(FOLIEN).join(', ')}`);

  if (aufbau(karte.layout) === 'spiel') {
    if (leer(karte.stufe)) offen.push('stufe');
    if (leer(karte.kp)) offen.push('kp');
    if (leer(karte.typ)) offen.push('typ');
    const atk = karte.attacken || [];
    if (atk.length < 1 || atk.length > 2) offen.push('attacken: 1 bis 2');
    atk.forEach((a, i) => {
      if (leer(a.name)) offen.push(`attacken[${i}].name`);
      (a.kosten || []).forEach((k) => { if (!typVon(set, k)) offen.push(`attacken[${i}].kosten: unbekannter Typ (${k})`); });
    });
  }
  if (karte.layout === 'trainer' && leer(karte.effekt)) offen.push('effekt');
  if (aufbau(karte.layout) === 'energie') {
    if (leer(karte.typ)) offen.push('typ');
    if (!leer(karte.energien) && !(Number.isInteger(Number(karte.energien)) && karte.energien >= 1 && karte.energien <= 5)) offen.push('energien: Zahl 1 bis 5');
  }
  return offen;
}

function typCss(set) {
  return (set.typen || []).map((t) => {
    const s = slug(t.name);
    const [h1, h2] = t.hintergrund || ['#f5f2eb', '#dcd6c8'];
    const text = t.textfarbe ? `;color:${t.textfarbe}` : '';
    return `.ty-${s} .panel{background:linear-gradient(${h1},${h2})}.ty-${s} .energy,.e.${s}{background:${t.farbe}${text}}`;
  }).join('\n');
}

function energie(set, name) {
  const t = typVon(set, name);
  return t ? `<span class="e ${slug(t.name)}">${esc(t.symbol)}</span>` : '';
}

// Bildausschnitt: Das Foto füllt das Fenster immer ganz (object-fit: cover), x/y (-100…100) wählen nur,
// welcher Teil des vollen Fotos sichtbar ist, gezoomt wird um diesen Punkt. So entstehen nie leere Ränder.
// Positiv = Foto nach rechts/unten geschoben. Die App nutzt dieselbe Rechnung (app.js, ausschnittStil).
function ausschnittStil(skalierung, x, y) {
  const s = Math.max(1, Number(skalierung) || 1);
  const pos = (v) => Math.max(0, Math.min(100, 50 - (Number(v) || 0) / 2));
  return `object-position:${pos(x)}% ${pos(y)}%;transform-origin:${pos(x)}% ${pos(y)}%;transform:scale(${s})`;
}

function foto(karte, bildUrl, extraKlasse = '') {
  const b = karte.bild || {};
  const url = b.datei ? bildUrl(b.datei) : null;
  if (!url) return '<div class="photo fehlt">Bild hierher ziehen</div>';
  return `<img class="photo${extraKlasse}" src="${esc(url)}" style="${ausschnittStil(b.skalierung, b.x, b.y)}" alt="">`;
}

// Zufallszahlen mit festem Startwert, damit eine Karte bei jedem Rendern gleich aussieht
function zufall(startwert) {
  let a = 0;
  for (const c of String(startwert)) a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function svg(inhalt, defs = '') {
  return `<svg viewBox="0 0 690 940" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${inhalt}</svg>`;
}

function stern(x, y, r) {
  const i = r * 0.22;
  return `M${x},${y - r}L${x + i},${y - i}L${x + r},${y}L${x + i},${y + i}L${x},${y + r}L${x - i},${y + i}L${x - r},${y}L${x - i},${y - i}Z`;
}

// Zeichnet den Folien-Effekt. Glitzer, Sterne und Kosmos als SVG, der Rest über CSS-Verläufe (card.css)
function folieHtml(karte) {
  const f = karte.folie;
  if (!f || !FOLIEN[f.art]) return '';
  const r = zufall(`${karte.nummer || 0}-${f.art}`);
  const farben = ['#ffffff', '#fff3b0', '#ffd6f5', '#c8f0ff', '#d8ffd0', '#f6dc8c'];
  let inhalt = '';
  if (f.art === 'glitzer') {
    const punkte = [];
    for (let i = 0; i < 1100; i++) {
      punkte.push(`<circle cx="${(r() * 690).toFixed(1)}" cy="${(r() * 940).toFixed(1)}" r="${(0.9 + r() * r() * 3.2).toFixed(2)}" fill="${farben[Math.floor(r() * farben.length)]}" opacity="${(0.35 + r() * 0.65).toFixed(2)}"/>`);
    }
    inhalt = svg(punkte.join(''));
  } else if (f.art === 'sterne') {
    const sterne = [];
    for (let i = 0; i < 46; i++) {
      const groesse = 5 + Math.pow(r(), 2.2) * 22;
      sterne.push(`<path d="${stern(r() * 690, r() * 940, groesse)}" fill="${farben[Math.floor(r() * farben.length)]}" opacity="${(0.55 + r() * 0.45).toFixed(2)}" filter="url(#leuchten)"/>`);
    }
    inhalt = svg(sterne.join(''), '<filter id="leuchten" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>');
  } else if (f.art === 'kosmos') {
    const farbtoene = ['#ff9de2', '#9de7ff', '#fff59d', '#b9ff9d', '#c9a6ff'];
    const kreise = [];
    for (let i = 0; i < 70; i++) {
      const c = farbtoene[Math.floor(r() * farbtoene.length)];
      kreise.push(`<circle cx="${(r() * 690).toFixed(1)}" cy="${(r() * 940).toFixed(1)}" r="${(6 + Math.pow(r(), 1.8) * 46).toFixed(1)}" fill="url(#kreis)" stroke="${c}" stroke-width="1.5" style="color:${c}" opacity="${(0.4 + r() * 0.5).toFixed(2)}"/>`);
    }
    inhalt = svg(kreise.join(''), '<radialGradient id="kreis"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".6" stop-color="currentColor" stop-opacity=".35"/><stop offset="1" stop-color="currentColor" stop-opacity=".05"/></radialGradient>');
  }
  const staerke = Math.max(0.1, Math.min(1, Number(f.staerke) || 0.7));
  return `<div class="fx fx-${f.art}" style="opacity:${staerke}">${inhalt}</div>`;
}

// Kartennummer mit führenden Nullen, mindestens dreistellig (007), bei großen Sets so breit wie die Gesamtzahl
function nrText(karte, gesamt) {
  return String(karte.nummer || 0).padStart(Math.max(3, String(gesamt || 0).length), '0');
}

// Band unter dem Fotofenster: "Nr. 007 · Text 1 · Text 2". Die Nummer setzt die App, deshalb stimmt sie auch nach dem
// Umsortieren. Hat jemand die Nummer früher von Hand in Text 1 geschrieben, wird sie nicht doppelt gezeigt.
function band(karte, gesamt) {
  const text1 = String(karte.band || '').replace(/^\s*Nr\.?\s*\d+\s*(·\s*)?/i, '');
  const teile = [`Nr. ${nrText(karte, gesamt)}`, text1, karte.band2].map((t) => String(t || '').trim()).filter(Boolean);
  return `<div class="ribbon" data-anpassen>${esc(teile.join(' · '))}</div>`;
}

function fusszeile(set, karte, gesamt) {
  const breite = Math.max(3, String(gesamt || 0).length);
  const nr = nrText(karte, gesamt);
  const ges = String(gesamt || 0).padStart(breite, '0');
  const sel = (set.seltenheiten || []).find((s) => s.name === karte.seltenheit);
  const sym = sel ? `<span class="sym${sel.glanz ? ' glanz' : ''}">${esc(sel.symbol)}</span>` : '';
  return `<div class="foot"><span>${esc(set.fusszeile || set.name || '')}</span><span>${nr}/${ges}${sym}</span></div>`;
}

function name(karte, extraStil = '') {
  const groesse = karte.namensgroesse ? `font-size:${Number(karte.namensgroesse)}px;` : '';
  return `<div class="name" data-anpassen style="${groesse}${extraStil}">${esc(karte.name)}</div>`;
}

// Liefert das Markup einer Karte (ein .card-Element). bildUrl wandelt einen Bildpfad des Sets in eine URL um.
function karteHtml(set, karte, { bildUrl, gesamt }) {
  const typ = typVon(set, karte.typ);
  const klassen = ['card', { normal: 'normal', vollbild: 'full', gold: 'full goldkarte', regenbogen: 'full regenbogenkarte', 'regenbogen-normal': 'normal regenbogenkarte', energie: 'full energiekarte', trainer: 'trainer', sammel: 'sammel', 'sammel-regenbogen': 'sammel regenbogenkarte' }[karte.layout] || 'normal'];
  if (typ) klassen.push(`ty-${slug(typ.name)}`);
  if (karte.holo) klassen.push('holo');
  const teile = ['<div class="gold"></div>'];
  const folie = folieHtml(karte);
  const folieImBild = folie && (karte.folie.bereich || 'bild') === 'bild' ? folie : '';
  // Regenbogenkarten haben den Regenbogenglanz fest über dem Foto, ein Folien-Effekt kommt bei Bedarf dazu
  const glanz = ['regenbogen', 'regenbogen-normal', 'sammel-regenbogen'].includes(karte.layout) ? '<div class="regenbogenglanz"></div>' : '';

  if (['vollbild', 'gold', 'regenbogen', 'energie'].includes(karte.layout)) {
    const goldton = karte.layout === 'gold' && karte.goldton !== false ? ' goldton' : '';
    teile.push(`<div class="panel">${foto(karte, bildUrl, goldton)}${glanz}${folieImBild}<div class="shade"></div></div>`);
  } else {
    // Bei regenbogen-normal liegt der Glanz auch über der Kartenfläche, nicht nur über dem Foto
    const flaeche = karte.layout === 'regenbogen-normal' ? glanz : '';
    teile.push(`<div class="panel">${flaeche}</div>`, `<div class="win">${foto(karte, bildUrl)}${glanz}${folieImBild}</div>`);
  }

  if (karte.layout === 'trainer') {
    teile.push('<div class="tpill">TRAINER</div>');
    if (karte.untertyp) teile.push(`<div class="tsub">${esc(karte.untertyp)}</div>`);
    teile.push(name(karte));
    teile.push(`<div class="effect">${absatz(karte.effekt)}</div>`);
    if (karte.regel) teile.push(`<div class="rule">${absatz(karte.regel)}</div>`);
  } else if (aufbau(karte.layout) === 'energie') {
    // Große Energie-Symbole in der Farbe des Typs, Anzahl aus "energien"
    teile.push('<div class="tpill">ENERGIE</div>');
    teile.push(name(karte));
    const n = Math.max(1, Math.min(5, Number(karte.energien) || 1));
    const symbol = typ ? `<span class="e ${slug(typ.name)}">${esc(typ.symbol)}</span>` : '';
    teile.push(`<div class="energien n${n}">${symbol.repeat(n)}</div>`);
  } else if (aufbau(karte.layout) === 'sammel') {
    teile.push(name(karte));
    if (karte.beschreibung) teile.push(`<div class="beschr">${absatz(karte.beschreibung)}</div>`);
  } else {
    const evo = karte.entwickelt_aus ? `<span class="evo">entwickelt sich aus ${esc(karte.entwickelt_aus)}</span>` : '';
    const stufe = karte.stufe ? `<span class="stage">${esc(karte.stufe)}</span>` : '';
    teile.push(`<div class="top">${stufe}${evo}</div>`);
    teile.push(name(karte));
    teile.push(`<div class="hp"><small>KP</small>${esc(karte.kp)}</div>`);
    if (typ) teile.push(`<div class="energy">${esc(typ.symbol)}</div>`);
    if (['normal', 'regenbogen-normal'].includes(karte.layout)) teile.push(band(karte, gesamt));
    const atks = (karte.attacken || []).map((a) => {
      const kosten = (a.kosten || []).map((k) => energie(set, k)).join('');
      const text = a.text ? `<p>${absatz(a.text)}</p>` : '';
      return `<div class="atk"><div class="ah">${kosten}<b>${esc(a.name)}</b><i>${esc(a.schaden ?? '')}</i></div>${text}</div>`;
    }).join('');
    teile.push(`<div class="atks">${atks}</div>`);
    const rueckzug = '<span class="e rueckzug">★</span>'.repeat(Math.max(0, Math.min(5, Number(karte.rueckzug) || 0)));
    teile.push(`<div class="stats"><div><small>Schwäche</small>${esc(karte.schwaeche || '–')}</div><div><small>Resistenz</small>${esc(karte.resistenz || '–')}</div><div><small>Rückzug</small>${rueckzug || '–'}</div></div>`);
  }

  if (karte.flavor && aufbau(karte.layout) !== 'sammel') teile.push(`<div class="flavor">${absatz(karte.flavor)}</div>`);
  teile.push(fusszeile(set, karte, gesamt));
  if (folie && !folieImBild) teile.push(folie);
  const { dh } = masse(formatVon(set, karte));
  return `<div class="${klassen.join(' ')}" style="--dh:${dh}px">${teile.join('')}</div>`;
}

// format: Format der Karten, zu denen diese Rückseite gedruckt wird
function rueckseiteHtml(set, { bildUrl, format }) {
  const url = set.rueckseite ? bildUrl(set.rueckseite) : null;
  const bild = url
    ? `<img src="${esc(url)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" alt="">`
    : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#f6dc8c;font-weight:900;font-size:56px;text-align:center">${esc(set.name)}</div>`;
  return `<div class="card" style="background:#181e3a;--dh:${masse(format || formatVon(set)).dh}px">${bild}</div>`;
}

module.exports = {
  id: 'tcg',
  name: 'TCG (Pokémon-Stil)',
  css: path.join(__dirname, 'card.css'),
  standardFormat: STANDARD_FORMAT,
  formatVorschlaege: [
    { name: 'TCG / Pokémon', breite: 63, hoehe: 88 },
    { name: 'Skat', breite: 59, hoehe: 91 },
    { name: 'Tarot (klein)', breite: 70, hoehe: 120 },
    { name: 'Mini', breite: 44, hoehe: 63 },
  ],
  masse,
  pruefeFormat,
  formatVon,
  layouts: LAYOUTS,
  folien: FOLIEN,
  entfernteFolien: ENTFERNTE_FOLIEN,
  felder: FELDER,
  standard: { typen: STANDARD_TYPEN, seltenheiten: STANDARD_SELTENHEITEN },
  pruefe,
  stilFelder: STIL_FELDER,
  stilVon,
  typCss,
  karteHtml,
  rueckseiteHtml,
};

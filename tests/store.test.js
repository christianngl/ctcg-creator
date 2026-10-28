// Tests für Set-Ablage, Pflichtfelder, Versionen und Sammlung (ohne Electron)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const store = require('../src/core/store');
const { karteSeite } = require('../src/core/seite');
const { tempOrdner, platzhalterPng, spielkarte } = require('./hilfen');

function neuesSet(extra = {}) {
  const basis = tempOrdner();
  const bild = platzhalterPng(path.join(basis, 'bild.png'));
  const ordner = path.join(basis, 'set');
  store.erstelleSet(ordner, { name: 'Testset', kuerzel: 'ts1', kartentyp: 'spielkarte', ...extra });
  return { basis, ordner, bild };
}

test('Set anlegen legt Ordnerstruktur und Standardwerte der Vorlage an', () => {
  const { ordner } = neuesSet();
  const set = store.ladeSet(ordner);
  assert.equal(set.kuerzel, 'TS1');
  assert.deepEqual(set.format, { breite: 63, hoehe: 88, beschnitt: 3 });
  assert.equal(set.typen.length, 13);
  for (const d of ['karten', 'bilder', 'export/png', 'export/druck']) assert.ok(fs.existsSync(path.join(ordner, d)), d);
});

test('Set anlegen nur in leerem Ordner', () => {
  const { ordner } = neuesSet();
  assert.throws(() => store.erstelleSet(ordner, { name: 'X', kuerzel: 'XX', kartentyp: 'spielkarte' }), { code: 'ordner_nicht_leer' });
});

test('Set ohne Pflichtangaben meldet offene Punkte', () => {
  assert.throws(() => store.erstelleSet(path.join(tempOrdner(), 's'), { name: 'X' }), (e) => {
    assert.equal(e.code, 'pflichtfelder_fehlen');
    assert.ok(e.offene_punkte.some((p) => p.startsWith('kuerzel')));
    assert.ok(e.offene_punkte.some((p) => p.startsWith('kartentyp')));
    return true;
  });
});

test('Formate: Skat geht, zu breite Formate werden abgelehnt', () => {
  const set = store.erstelleSet(path.join(tempOrdner(), 's'), { name: 'X', kuerzel: 'XX', kartentyp: 'spielkarte', format: { breite: 59, hoehe: 91 } });
  assert.deepEqual(set.format, { breite: 59, hoehe: 91, beschnitt: 3 });
  assert.throws(() => store.erstelleSet(path.join(tempOrdner(), 's'), { name: 'X', kuerzel: 'XX', kartentyp: 'spielkarte', format: { breite: 88, hoehe: 63 } }), (e) => e.offene_punkte[0].includes('zu breit'));
});

test('Karte mit eigenem Format: Höhe des Rasters wächst mit', () => {
  const { ordner, bild } = neuesSet();
  const k = store.neueKarte(ordner, spielkarte(bild, { format: { breite: 59, hoehe: 91 } }));
  const html = karteSeite(store.ladeSet(ordner), k);
  assert.match(html, /--dh:90px/);
  assert.match(html, /height:1030px/);
  assert.throws(() => store.neueKarte(ordner, spielkarte(bild, { format: { breite: 100, hoehe: 60 } })), (e) => e.offene_punkte.some((x) => x.includes('zu breit')));
});

test('Typen pro Set bearbeiten, Warnung bei verwendeten Typen', () => {
  const { ordner, bild } = neuesSet();
  store.neueKarte(ordner, spielkarte(bild));
  const typen = [{ name: 'Blitz', symbol: 'ϟ', farbe: '#e6c619', hintergrund: ['#fff9d6', '#f2e49a'] }];
  const set = store.aendereSet(ordner, { typen });
  assert.equal(set.typen.length, 1);
  assert.ok(set.warnungen[0].includes('Feuer'));
  assert.throws(() => store.aendereSet(ordner, { typen: [{ name: 'Blitz', symbol: '', farbe: 'gelb' }] }), (e) => e.offene_punkte.includes('typen[0].symbol') && e.offene_punkte.some((x) => x.startsWith('typen[0].farbe')));
  assert.throws(() => store.aendereSet(ordner, { typen: [typen[0], typen[0]] }), (e) => e.offene_punkte.some((x) => x.includes('doppelt')));
});

test('Titelkarte muss es im Set geben', () => {
  const { ordner, bild } = neuesSet();
  store.neueKarte(ordner, spielkarte(bild));
  assert.equal(store.aendereSet(ordner, { titelkarte: 1 }).titelkarte, 1);
  assert.equal(store.aendereSet(ordner, { titelkarte: null }).titelkarte, null);
  assert.throws(() => store.aendereSet(ordner, { titelkarte: 5 }), { code: 'karte_fehlt' });
});

test('Testfall 1: Karte bekommt die nächste freie Nummer, Bild wird ins Set kopiert', () => {
  const { ordner, bild } = neuesSet();
  const k1 = store.neueKarte(ordner, spielkarte(bild));
  const k2 = store.neueKarte(ordner, spielkarte(bild, { name: 'Zweiter' }));
  assert.equal(k1.nummer, 1);
  assert.equal(k2.nummer, 2);
  assert.equal(k1.bild.datei, 'bilder/bild.png');
  assert.equal(k2.bild.datei, 'bilder/bild_2.png');
  assert.ok(fs.existsSync(path.join(ordner, 'bilder', 'bild.png')));
});

test('Testfall 2: Spielkarte ohne Pflichtwert wird nicht gespeichert', () => {
  const { ordner, bild } = neuesSet();
  const { kp, ...ohneKp } = spielkarte(bild);
  assert.throws(() => store.neueKarte(ordner, ohneKp), (e) => e.code === 'pflichtfelder_fehlen' && e.offene_punkte.includes('kp'));
  assert.deepEqual(store.nummern(ordner), []);
});

test('Unbekannter Typ und falsches Layout werden gemeldet', () => {
  const { ordner, bild } = neuesSet();
  assert.throws(() => store.neueKarte(ordner, spielkarte(bild, { typ: 'Plasma' })), (e) => e.offene_punkte.some((p) => p.startsWith('typ: unbekannt')));
  assert.throws(() => store.neueKarte(ordner, spielkarte(bild, { layout: 'sammel' })), (e) => e.offene_punkte.some((p) => p.includes('passt nicht zum Kartentyp')));
});

test('Testfall 3: Ändern legt eine neue Version an, die alte bleibt abrufbar', () => {
  const { ordner, bild } = neuesSet();
  store.neueKarte(ordner, spielkarte(bild));
  const v2 = store.aendereKarte(ordner, 1, { flavor: 'Neuer Text' });
  assert.equal(v2.version, 2);
  assert.deepEqual(store.versionen(ordner, 1), [1, 2]);
  assert.equal(store.ladeKarte(ordner, 1, 1).flavor, undefined);
  assert.equal(store.ladeKarte(ordner, 1).flavor, 'Neuer Text');
  assert.equal(store.ladeKarte(ordner, 1).bild.datei, 'bilder/bild.png');
});

test('Testfall 5: Besitz wird in der Sammlung vermerkt', () => {
  const { ordner, bild } = neuesSet();
  store.neueKarte(ordner, spielkarte(bild));
  store.setzeBesitz(ordner, 1, 2);
  assert.equal(store.listeKarten(ordner)[0].besitz, 2);
});

test('Nummernauswahl versteht Bereiche und Listen', () => {
  const { ordner, bild } = neuesSet();
  for (let i = 0; i < 5; i++) store.neueKarte(ordner, spielkarte(bild));
  assert.deepEqual(store.waehleNummern(ordner, '1-3,5'), [1, 2, 3, 5]);
  assert.deepEqual(store.waehleNummern(ordner), [1, 2, 3, 4, 5]);
  assert.throws(() => store.waehleNummern(ordner, '9'), { code: 'karte_fehlt' });
});

test('Sammelkarten-Set nutzt das Layout sammel', () => {
  const { ordner, bild } = neuesSet({ kartentyp: 'sammelkarte' });
  const k = store.neueKarte(ordner, { layout: 'sammel', name: 'Strandtag', bild: { datei: bild }, bildquelle: 'foto', seltenheit: 'selten', beschreibung: 'Sonne & Meer' });
  const html = karteSeite(store.ladeSet(ordner), k);
  assert.match(html, /class="card sammel/);
  assert.match(html, /Sonne &amp; Meer/);
  assert.match(html, /001\/001/);
});

test('Texte werden in der Kartenseite maskiert', () => {
  const { ordner, bild } = neuesSet();
  const k = store.neueKarte(ordner, spielkarte(bild, { name: '<script>x</script>' }));
  const html = karteSeite(store.ladeSet(ordner), k);
  assert.ok(!html.includes('<script>x</script>'));
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
});

test('Entwurf: fehlende Angaben werden gespeichert und als offen markiert', () => {
  const { ordner } = neuesSet();
  const k = store.neueKarte(ordner, { name: 'Halbfertig' }, { entwurf: true });
  assert.equal(k.entwurf, true);
  assert.equal(k.layout, 'normal');
  assert.ok(k.offene_punkte.includes('kp'));
  assert.equal(store.listeKarten(ordner)[0].entwurf, true);
});

test('Entwurf wird vollständig, sobald alle Angaben da sind', () => {
  const { ordner, bild } = neuesSet();
  store.neueKarte(ordner, { name: 'Halbfertig' }, { entwurf: true });
  const k = store.aendereKarte(ordner, 1, spielkarte(bild), { entwurf: true });
  assert.equal(k.entwurf, undefined);
  assert.equal(k.offene_punkte, undefined);
});

test('Ersetzen übernimmt geleerte Felder (Formular der App)', () => {
  const { ordner, bild } = neuesSet();
  store.neueKarte(ordner, spielkarte(bild, { flavor: 'Alt' }));
  const { flavor, ...ohneFlavor } = store.ladeKarte(ordner, 1);
  const k = store.aendereKarte(ordner, 1, ohneFlavor, { ersetzen: true });
  assert.equal(k.flavor, undefined);
});

test('Goldkarte und Folien-Effekte erscheinen im Markup', () => {
  const { ordner, bild } = neuesSet();
  const gold = store.neueKarte(ordner, spielkarte(bild, { layout: 'gold', folie: { art: 'sterne', bereich: 'karte', staerke: 0.5 } }));
  const html = karteSeite(store.ladeSet(ordner), gold);
  assert.match(html, /class="card full goldkarte/);
  assert.match(html, /photo goldton/);
  assert.match(html, /class="fx fx-sterne" style="opacity:0.5"/);
  // gleicher Effekt bei jedem Rendern
  assert.equal(html, karteSeite(store.ladeSet(ordner), gold));
  assert.throws(() => store.neueKarte(ordner, spielkarte(bild, { folie: { art: 'feuerwerk' } })), (e) => e.offene_punkte.some((p) => p.startsWith('folie.art')));
});

test('Kommentar wird gespeichert, erscheint aber nicht auf der Karte', () => {
  const { ordner, bild } = neuesSet();
  const k = store.neueKarte(ordner, spielkarte(bild, { kommentar: 'Später Foto vom Sommer nehmen' }));
  assert.equal(store.ladeKarte(ordner, 1).kommentar, 'Später Foto vom Sommer nehmen');
  assert.equal(store.listeKarten(ordner)[0].kommentar, 'Später Foto vom Sommer nehmen');
  assert.ok(!karteSeite(store.ladeSet(ordner), k).includes('Später Foto'));
});

test('Stil übertragen: Layout derselben Art, Effekt und Format, Inhalte bleiben', () => {
  const { ordner, bild } = neuesSet();
  store.neueKarte(ordner, spielkarte(bild, { layout: 'gold', goldton: false, folie: { art: 'sterne', bereich: 'karte', staerke: 0.5 }, format: { breite: 59, hoehe: 91 } }));
  store.neueKarte(ordner, spielkarte(bild, { name: 'Ziel', folie: { art: 'glitzer', bereich: 'bild', staerke: 1 } }));
  store.neueKarte(ordner, { layout: 'trainer', name: 'Rat', bild: { datei: bild }, bildquelle: 'foto', seltenheit: 'selten', effekt: 'Ziehe 2 Karten.' });
  const r = store.uebertrageStil(ordner, 1, [1, 2, 3]);
  assert.deepEqual(r.map((x) => [x.nummer, x.version, x.geaendert]), [[2, 2, true], [3, 2, true]]);
  const ziel = store.ladeKarte(ordner, 2);
  assert.equal(ziel.layout, 'gold');
  assert.equal(ziel.name, 'Ziel');
  assert.equal(ziel.goldton, false);
  assert.deepEqual(ziel.folie, { art: 'sterne', bereich: 'karte', staerke: 0.5 });
  assert.deepEqual(ziel.format, { breite: 59, hoehe: 91 });
  // Trainer behält sein Layout
  assert.equal(store.ladeKarte(ordner, 3).layout, 'trainer');
  assert.equal(store.ladeKarte(ordner, 3).entwurf, undefined);
  // Version 1 bleibt erhalten, zweites Übertragen ändert nichts mehr
  assert.equal(store.ladeKarte(ordner, 2, 1).layout, 'normal');
  assert.deepEqual(store.uebertrageStil(ordner, 1, [2]), [{ nummer: 2, version: 2, geaendert: false }]);
  // Ohne Effekt in der Quelle verschwindet der Effekt beim Ziel
  store.neueKarte(ordner, spielkarte(bild));
  store.uebertrageStil(ordner, 4, [2]);
  assert.equal(store.ladeKarte(ordner, 2).folie, undefined);
  assert.equal(store.ladeKarte(ordner, 2).layout, 'normal');
});

test('Karte kopieren: neue Nummer, gleiche Inhalte, Version 1', () => {
  const { ordner, bild } = neuesSet();
  store.neueKarte(ordner, spielkarte(bild, { name: 'Original', kommentar: 'Notiz' }));
  store.aendereKarte(ordner, 1, { kp: 90 });
  const k = store.kopiereKarte(ordner, 1);
  assert.equal(k.nummer, 2);
  assert.equal(k.version, 1);
  assert.equal(k.name, 'Original');
  assert.equal(k.kp, 90);
  assert.equal(k.bild.datei, store.ladeKarte(ordner, 1).bild.datei);
  assert.deepEqual(k.kopiert_von, { nummer: 1, version: 2 });
  // ältere Version und eigene Nummer
  const alt = store.kopiereKarte(ordner, 1, { version: 1, neueNummer: 10 });
  assert.equal(alt.nummer, 10);
  assert.equal(alt.kp, 60);
  assert.throws(() => store.kopiereKarte(ordner, 1, { neueNummer: 2 }), { code: 'nummer_vergeben' });
  // Danach als Goldkarte ändern, das Original bleibt
  store.aendereKarte(ordner, 2, { layout: 'gold' });
  assert.equal(store.ladeKarte(ordner, 1).layout, 'normal');
  assert.equal(store.ladeSammlung(ordner)[2], undefined);
});

test('Regenbogenkarte: eigenes Layout mit Regenbogenglanz, auch für Sammelkarten', () => {
  const { ordner, bild } = neuesSet();
  const k = store.neueKarte(ordner, spielkarte(bild, { layout: 'regenbogen' }));
  const html = karteSeite(store.ladeSet(ordner), k);
  assert.match(html, /class="card full regenbogenkarte/);
  assert.match(html, /class="regenbogenglanz"/);
  // ohne KP wie jede Spielkarte unvollständig
  assert.throws(() => store.neueKarte(ordner, spielkarte(bild, { layout: 'regenbogen', kp: undefined })), (e) => e.offene_punkte.includes('kp'));
  const sammel = neuesSet({ kartentyp: 'sammelkarte' });
  const s = store.neueKarte(sammel.ordner, { layout: 'sammel-regenbogen', name: 'Strand', bild: { datei: sammel.bild }, bildquelle: 'foto', seltenheit: 'holo', beschreibung: 'Sonne' });
  const shtml = karteSeite(store.ladeSet(sammel.ordner), s);
  assert.match(shtml, /class="card sammel regenbogenkarte/);
  assert.match(shtml, /class="beschr"/);
  // Stil übertragen stellt normale Spielkarten auf Regenbogen um
  store.neueKarte(ordner, spielkarte(bild));
  store.uebertrageStil(ordner, 1, [2]);
  assert.equal(store.ladeKarte(ordner, 2).layout, 'regenbogen');
});

test('Regenbogenkarte mit Fotofenster oben: Band und Glanz über Foto und Kartenfläche', () => {
  const { ordner, bild } = neuesSet();
  const k = store.neueKarte(ordner, spielkarte(bild, { layout: 'regenbogen-normal', band: 'Kurzinfo' }));
  const html = karteSeite(store.ladeSet(ordner), k);
  assert.match(html, /class="card normal regenbogenkarte/);
  assert.match(html, /class="win"/);
  assert.match(html, /class="ribbon"[^>]*>Nr. 001 · Kurzinfo</);
  assert.equal((html.match(/class="regenbogenglanz"/g) || []).length, 2);
  // Stil übertragen geht zwischen allen Spielkarten mit Foto
  store.neueKarte(ordner, spielkarte(bild, { layout: 'vollbild' }));
  store.uebertrageStil(ordner, 1, [2]);
  assert.equal(store.ladeKarte(ordner, 2).layout, 'regenbogen-normal');
});

test('Energiekarte: Vollbild mit so vielen Energie-Symbolen wie angegeben, Typ ist Pflicht', () => {
  const { ordner, bild } = neuesSet();
  const energie = (extra) => ({ layout: 'energie', name: 'Feuer-Energie', bild: { datei: bild }, bildquelle: 'ki', seltenheit: 'häufig', typ: 'Feuer', ...extra });
  const k = store.neueKarte(ordner, energie({ energien: 3 }));
  const html = karteSeite(store.ladeSet(ordner), k);
  assert.match(html, /class="card full energiekarte/);
  assert.equal((html.match(/<span class="e feuer">/g) || []).length, 3);
  assert.doesNotMatch(html, /class="atks"/);
  // ohne Anzahl ein Symbol
  const eins = karteSeite(store.ladeSet(ordner), store.neueKarte(ordner, energie()));
  assert.equal((eins.match(/<span class="e feuer">/g) || []).length, 1);
  assert.throws(() => store.neueKarte(ordner, energie({ typ: undefined })), (e) => e.offene_punkte.includes('typ'));
  assert.throws(() => store.neueKarte(ordner, energie({ energien: 6 })), (e) => e.offene_punkte.includes('energien: Zahl 1 bis 5'));
  // Ältere Energiekarten mit Foto behalten es als Hintergrund
  assert.match(html, /energiekarte[^"]*eh-bild/);
  assert.match(html, /<img class="photo"/);
});

test('Energiekarte ohne Bild: Hintergrund wählbar, Bild nur beim eigenen Hintergrundbild Pflicht', () => {
  const { ordner, bild } = neuesSet();
  const energie = (extra) => ({ layout: 'energie', name: 'Feuer-Energie', seltenheit: 'häufig', typ: 'Feuer', ...extra });
  const k = store.neueKarte(ordner, energie());
  const html = karteSeite(store.ladeSet(ordner), k);
  assert.match(html, /energiekarte[^"]*eh-typ/);
  assert.match(html, /--typfarbe:#e2422a/);
  assert.doesNotMatch(html, /class="photo/);
  assert.equal((html.match(/<span class="e feuer">/g) || []).length, 1);
  for (const hg of ['strahlen', 'dunkel', 'gold', 'regenbogen']) {
    assert.match(karteSeite(store.ladeSet(ordner), store.neueKarte(ordner, energie({ hintergrund: hg }))), new RegExp(`eh-${hg}`));
  }
  assert.throws(() => store.neueKarte(ordner, energie({ hintergrund: 'bild' })), (e) => e.offene_punkte.includes('bild.datei'));
  assert.throws(() => store.neueKarte(ordner, energie({ hintergrund: 'wolken' })), (e) => e.offene_punkte.some((p) => p.startsWith('hintergrund')));
  const eigen = store.neueKarte(ordner, energie({ hintergrund: 'bild', bild: { datei: bild }, bildquelle: 'foto' }));
  assert.match(karteSeite(store.ladeSet(ordner), eigen), /<img class="photo"/);
});

test('Regenbogenglanz lässt sich abschwächen oder abschalten, der Regenbogenrahmen bleibt', () => {
  const { ordner, bild } = neuesSet();
  const set = () => store.ladeSet(ordner);
  const standard = karteSeite(set(), store.neueKarte(ordner, spielkarte(bild, { layout: 'regenbogen' })));
  assert.match(standard, /class="regenbogenglanz" style="opacity:0.75"/);
  const schwach = karteSeite(set(), store.neueKarte(ordner, spielkarte(bild, { layout: 'regenbogen-normal', regenbogenglanz: 0.5 })));
  assert.match(schwach, /class="regenbogenglanz" style="opacity:0.5"/);
  assert.match(schwach, /class="regenbogenglanz" style="opacity:0.4"/);
  const ohne = store.neueKarte(ordner, spielkarte(bild, { layout: 'regenbogen', regenbogenglanz: 0 }));
  const ohneHtml = karteSeite(set(), ohne);
  assert.match(ohneHtml, /class="card full regenbogenkarte/);
  assert.doesNotMatch(ohneHtml, /regenbogenglanz/);
  assert.throws(() => store.neueKarte(ordner, spielkarte(bild, { layout: 'regenbogen', regenbogenglanz: 2 })), (e) => e.offene_punkte.includes('regenbogenglanz: Zahl 0 bis 1'));
  // Die Glanzstärke gehört zum Stil
  store.uebertrageStil(ordner, ohne.nummer, [1]);
  assert.equal(store.ladeKarte(ordner, 1).regenbogenglanz, 0);
});

test('Effekt Strahlen gibt es nicht mehr, alte Karten verlieren ihn beim Speichern', () => {
  const { ordner, bild } = neuesSet();
  const { vorlage } = require('../src/vorlagen');
  assert.equal(vorlage('tcg').folien.strahlen, undefined);
  const k = store.neueKarte(ordner, spielkarte(bild));
  // Karte aus einer älteren Version der App mit dem Effekt Strahlen
  const datei = path.join(ordner, 'karten', '001', 'v001.json');
  fs.writeFileSync(datei, JSON.stringify({ ...k, folie: { art: 'strahlen', bereich: 'bild', staerke: 0.7 } }));
  assert.ok(!karteSeite(store.ladeSet(ordner), store.ladeKarte(ordner, 1)).includes('fx-strahlen'));
  const neu = store.aendereKarte(ordner, 1, { kp: 70 });
  assert.equal(neu.folie, undefined);
  assert.equal(neu.entwurf, undefined);
});

test('Band unter dem Foto: immer "Nr. xxx · Text 1 · Text 2", von Hand eingetragene Nummer nicht doppelt', () => {
  const { ordner, bild } = neuesSet();
  const band = (extra) => karteSeite(store.ladeSet(ordner), store.neueKarte(ordner, spielkarte(bild, extra))).match(/class="ribbon"[^>]*>([^<]*)</)[1];
  assert.equal(band({}), 'Nr. 001');
  assert.equal(band({ band: 'Wildhunt', band2: '2026' }), 'Nr. 002 · Wildhunt · 2026');
  assert.equal(band({ band: 'Nr. 017 · Wildhunt' }), 'Nr. 003 · Wildhunt');
  assert.equal(band({ band2: 'nur Text 2' }), 'Nr. 004 · nur Text 2');
  const voll = karteSeite(store.ladeSet(ordner), store.neueKarte(ordner, spielkarte(bild, { layout: 'vollbild', band: 'x' })));
  assert.doesNotMatch(voll, /class="ribbon"/);
});

// Set mit Karten A, B, C, D (Nummern 1–4), Karte 2 hat Besitz und ist Titelkarte, Karte 3 hat ein PNG
function setMitVierKarten() {
  const s = neuesSet();
  for (const name of ['A', 'B', 'C', 'D']) store.neueKarte(s.ordner, spielkarte(s.bild, { name }));
  store.setzeBesitz(s.ordner, 2, 5);
  store.aendereSet(s.ordner, { titelkarte: 2 });
  fs.writeFileSync(path.join(s.ordner, 'export', 'png', 'TS1-003_v1.png'), 'png');
  return s;
}
const namen = (ordner) => store.listeKarten(ordner).map((k) => `${k.nummer}${k.name}`).join(' ');

test('Karte verschieben: Nummern fortlaufend, neue Version, Sammlung und Titelkarte ziehen mit', () => {
  const { ordner } = setMitVierKarten();
  const r = store.verschiebeKarte(ordner, 4, 2);
  assert.equal(namen(ordner), '1A 2D 3B 4C');
  assert.deepEqual(r.map((x) => [x.alt, x.neu, x.version]), [[4, 2, 2], [2, 3, 2], [3, 4, 2]]);
  assert.equal(store.ladeKarte(ordner, 2).nummer, 2);
  assert.deepEqual(store.ladeKarte(ordner, 2).umnummeriert.von, 4);
  // Version 1 bleibt abrufbar
  assert.equal(store.ladeKarte(ordner, 2, 1).name, 'D');
  assert.equal(store.ladeSammlung(ordner)[3].besitz, 5);
  const set = store.ladeSet(ordner);
  assert.equal(set.titelkarte, 3);
  assert.deepEqual(set.png_veraltet, [2, 3, 4]);
  // Das alte PNG von Karte 3 (jetzt 4) liegt nicht mehr unter falscher Nummer in export/png
  assert.ok(fs.existsSync(path.join(ordner, 'export', 'png', 'veraltet', 'TS1-003_v1.png')));
  assert.ok(!fs.existsSync(path.join(ordner, 'export', 'png', 'TS1-003_v1.png')));
  // Nach dem Rendern ist die Karte nicht mehr veraltet
  store.pngErneuert(ordner, [2, 4]);
  assert.deepEqual(store.ladeSet(ordner).png_veraltet, [3]);
  // Nach hinten verschieben
  store.verschiebeKarte(ordner, 1, 4);
  assert.equal(namen(ordner), '1D 2B 3C 4A');
  assert.throws(() => store.verschiebeKarte(ordner, 9, 1), { code: 'karte_fehlt' });
});

test('Karte löschen: in den Papierkorb des Sets, folgende Karten rücken auf', () => {
  const { ordner } = setMitVierKarten();
  const r = store.loescheKarte(ordner, 2);
  assert.equal(namen(ordner), '1A 2C 3D');
  assert.ok(fs.existsSync(path.join(r.geloescht.papierkorb, 'v001.json')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(r.geloescht.papierkorb, 'sammlung.json'), 'utf8')).besitz, 5);
  assert.deepEqual(r.umnummeriert.map((x) => [x.alt, x.neu]), [[3, 2], [4, 3]]);
  assert.equal(store.ladeSammlung(ordner)[2], undefined);
  const set = store.ladeSet(ordner);
  assert.equal(set.titelkarte, null);
  assert.deepEqual(set.png_veraltet, [2, 3]);
  // Die letzte Karte löschen ändert keine Nummern
  assert.deepEqual(store.loescheKarte(ordner, 3).umnummeriert, []);
  assert.equal(namen(ordner), '1A 2C');
});

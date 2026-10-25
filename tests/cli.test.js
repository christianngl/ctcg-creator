// Ende-zu-Ende-Tests der Kommandozeile, inklusive Rendern über Electron
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { tempOrdner, platzhalterPng, pngGroesse, spielkarte } = require('./hilfen');

const CLI = path.join(__dirname, '..', 'src', 'cli', 'index.js');

function cli(...args) {
  try {
    return { ...JSON.parse(execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8' })), exit: 0 };
  } catch (e) {
    if (!e.stdout) throw e;
    return { ...JSON.parse(e.stdout), exit: e.status };
  }
}

const basis = tempOrdner();
const ordner = path.join(basis, 'set');
const bild = platzhalterPng(path.join(basis, 'bild.png'));

test('Set und Karten über die Kommandozeile anlegen', () => {
  assert.equal(cli('set', 'neu', '--ordner', ordner, '--name', 'CLI-Set', '--kuerzel', 'CL1', '--kartentyp', 'spielkarte').ok, true);
  const r = cli('karte', 'neu', '--set', ordner, '--json', JSON.stringify(spielkarte(bild)));
  assert.equal(r.ok, true);
  assert.equal(r.nummer, 1);
  const json = path.join(basis, 'trainer.json');
  fs.writeFileSync(json, JSON.stringify({ layout: 'trainer', name: 'Rat', bild: { datei: bild }, bildquelle: 'foto', seltenheit: 'selten', effekt: 'Ziehe 2 Karten.' }));
  assert.equal(cli('karte', 'neu', '--set', ordner, '--json', json).nummer, 2);
});

test('Fehlende Angaben: Exit-Code 2 und offene Punkte', () => {
  const r = cli('karte', 'neu', '--set', ordner, '--json', '{"layout":"normal","name":"Halb"}');
  assert.equal(r.exit, 2);
  assert.equal(r.ok, false);
  assert.ok(r.offene_punkte.includes('kp'));
});

test('Testfall 4: Rendern ergibt 300 dpi mit Beschnitt (69 x 94 mm)', () => {
  const r = cli('rendern', '--set', ordner, '--nr', '1');
  assert.equal(r.ok, true);
  assert.deepEqual(pngGroesse(r.karten[0].png), { breite: 815, hoehe: 1110 });
  const ohne = cli('rendern', '--set', ordner, '--nr', '1', '--ohne-beschnitt');
  assert.deepEqual(pngGroesse(ohne.karten[0].png), { breite: 745, hoehe: 1040 });
});

test('Testfall 4: Druck-PDF wird erzeugt und in der Sammlung vermerkt', () => {
  const r = cli('druck', '--set', ordner);
  assert.equal(r.ok, true);
  assert.equal(r.seiten, 2);
  assert.ok(fs.readFileSync(r.pdf).subarray(0, 5).toString() === '%PDF-');
  const s = cli('sammlung', '--set', ordner);
  assert.equal(s.gedruckt, 2);
});

test('Unbekannter Befehl liefert einen Fehler', () => {
  const r = cli('veroeffentlichen', '--set', ordner);
  assert.equal(r.ok, false);
  assert.equal(r.exit, 1);
});

test('Entwurf nur mit --entwurf, Druck verweigert Entwürfe ohne --mit-entwuerfen', () => {
  const r = cli('karte', 'neu', '--set', ordner, '--json', '{"name":"Skizze"}', '--entwurf');
  assert.equal(r.ok, true);
  assert.equal(r.status, 'entwurf');
  assert.ok(r.offene_punkte.length > 0);
  const d = cli('druck', '--set', ordner, '--nr', String(r.nummer));
  assert.equal(d.ok, false);
  assert.equal(d.code, 'entwuerfe');
  assert.equal(cli('druck', '--set', ordner, '--nr', String(r.nummer), '--mit-entwuerfen', '--modus', 'einzeln').ok, true);
});

test('Karten verschiedener Formate: PNG-Größe und getrennte Druckbögen', () => {
  const r = cli('karte', 'neu', '--set', ordner, '--json', JSON.stringify(spielkarte(bild, { format: { breite: 59, hoehe: 91 } })));
  const png = cli('rendern', '--set', ordner, '--nr', String(r.nummer)).karten[0].png;
  // 65 × 97 mm bei 300 dpi
  assert.deepEqual(pngGroesse(png), { breite: 768, hoehe: 1146 });
  const d = cli('druck', '--set', ordner, '--nr', `1,${r.nummer}`);
  assert.equal(d.ok, true);
  assert.deepEqual(d.formate, ['63x88+3', '59x91+3']);
  assert.equal(d.seiten, 4);
  assert.equal(cli('druck', '--set', ordner, '--nr', `1,${r.nummer}`, '--modus', 'einzeln').seiten, 4);
});

test('Stil über die Kommandozeile übertragen', () => {
  const r = cli('karte', 'neu', '--set', ordner, '--json', JSON.stringify(spielkarte(bild, { layout: 'vollbild', folie: { art: 'kosmos', bereich: 'bild', staerke: 0.4 } })));
  const s = cli('karte', 'stil', '--set', ordner, '--von', String(r.nummer), '--nr', '1');
  assert.equal(s.ok, true);
  assert.equal(s.karten[0].geaendert, true);
  const k = cli('karte', 'zeigen', '--set', ordner, '--nr', '1').karte;
  assert.equal(k.layout, 'vollbild');
  assert.equal(k.folie.art, 'kosmos');
});

test('Karte über die Kommandozeile kopieren', () => {
  const r = cli('karte', 'kopieren', '--set', ordner, '--nr', '1');
  assert.equal(r.ok, true);
  assert.equal(r.kopiert_von.nummer, 1);
  assert.equal(cli('karte', 'zeigen', '--set', ordner, '--nr', String(r.nummer)).karte.name, 'Probe-Held');
});

test('Karten über die Kommandozeile verschieben und löschen, Rendern macht PNGs wieder aktuell', () => {
  const vorher = cli('liste', '--set', ordner).karten.length;
  const letzte = String(vorher);
  const v = cli('karte', 'verschieben', '--set', ordner, '--nr', letzte, '--nach', '1');
  assert.equal(v.ok, true);
  assert.equal(v.umnummeriert[0].neu, 1);
  assert.equal(v.png_veraltet.length, vorher);
  // Löschen nur mit ausdrücklicher Bestätigung
  const ohne = cli('karte', 'loeschen', '--set', ordner, '--nr', '1');
  assert.equal(ohne.exit, 2);
  assert.equal(ohne.code, 'bestaetigung_fehlt');
  const l = cli('karte', 'loeschen', '--set', ordner, '--nr', '1', '--ja');
  assert.equal(l.ok, true);
  assert.equal(cli('liste', '--set', ordner).karten.length, vorher - 1);
  assert.ok(fs.existsSync(l.geloescht.papierkorb));
  cli('rendern', '--set', ordner, '--nr', '1');
  assert.ok(!cli('set', 'zeigen', '--set', ordner).set.png_veraltet.includes(1));
});

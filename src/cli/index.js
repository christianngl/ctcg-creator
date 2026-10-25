#!/usr/bin/env node
// Kommandozeile für cTCG Creator (Custom TCG Creator). Gedacht für Claude Code: jede Ausgabe ist JSON auf stdout.
// Exit-Codes: 0 = ok, 1 = Fehler, 2 = Angaben fehlen (offene_punkte nennen, was nachzufragen ist).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const store = require('../core/store');
const { VORLAGEN, vorlage } = require('../vorlagen');

const HILFE = `cTCG Creator – Kommandozeile (Ausgabe immer JSON)

  node src/cli/index.js <befehl> [optionen]

  vorlagen                                    Vorlagen auflisten
  vorlage zeigen <id>                         Layouts, Felder, Standard-Typen und -Seltenheiten einer Vorlage
  set neu --ordner <pfad> --name <text> --kuerzel <WH1> --kartentyp spielkarte|sammelkarte
          [--fusszeile <text>] [--anzahl <n>] [--vorlage tcg]
  set zeigen --set <pfad>
  set aendern --set <pfad> --json <json|datei>   (name, fusszeile, anzahl, rueckseite, typen, seltenheiten, format)
  liste --set <pfad>                          alle Karten mit aktueller Version und Sammlungsstand
  karte neu --set <pfad> --json <json|datei> [--entwurf]   ohne "nummer" die nächste freie Nummer
  karte aendern --set <pfad> --nr <n> --json <json|datei> [--entwurf]   legt eine neue Version an
                                              --entwurf speichert auch mit fehlenden Angaben (nur auf Wunsch des Nutzers)
  karte zeigen --set <pfad> --nr <n> [--version <v>]
  karte versionen --set <pfad> --nr <n>
  karte kopieren --set <pfad> --nr <n> [--version <v>] [--neue-nr <n>]   Karte als neue Karte kopieren (z. B. als Goldvariante)
  karte stil --set <pfad> --von <n> --nr 4-10   überträgt den Stil (Layout derselben Art, Effekt, Format, Holo, Goldton),
                                              jede geänderte Karte bekommt eine neue Version
  karte verschieben --set <pfad> --nr <n> --nach <n>   setzt die Karte an die Stelle von Karte --nach, die anderen rücken auf;
                                              jede Karte mit neuer Nummer bekommt eine neue Version und muss neu gerendert werden
  karte loeschen --set <pfad> --nr <n> --ja    nur nach ausdrücklicher Bestätigung des Nutzers: Karte kommt nach <set>/papierkorb/,
                                              die folgenden Karten rücken auf (neue Nummer, neue Version)
  rendern --set <pfad> [--nr 7|1-12|1,3,5] [--ohne-beschnitt]      PNG nach <set>/export/png/
  druck --set <pfad> [--nr …] [--modus bogen|einzeln] [--ohne-rueckseiten] [--auflage <n>] [--mit-entwuerfen]
                                              PDF nach <set>/export/druck/, vermerkt den Druck in der Sammlung
  sammlung --set <pfad> [--nr <n> --besitz <anzahl>]

--json nimmt JSON direkt ("{...}") oder einen Dateipfad. Bilder außerhalb des Set-Ordners werden nach <set>/bilder/ kopiert.`;

function parse(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) opt[key] = true;
      else { opt[key] = next; i++; }
    } else pos.push(a);
  }
  return { pos, opt };
}

function ausgabe(daten, code = 0) {
  process.stdout.write(JSON.stringify(daten, null, 2) + '\n');
  process.exitCode = code;
}

function fehlerAusgabe(e) {
  // Auch eine fehlende Bestätigung (z. B. vor dem Löschen) muss beim Nutzer nachgefragt werden
  const code = ['pflichtfelder_fehlen', 'bestaetigung_fehlt'].includes(e.code) ? 2 : 1;
  ausgabe({ ok: false, fehler: e.message, code: e.code || 'fehler', offene_punkte: e.offene_punkte || [] }, code);
}

function brauche(opt, ...namen) {
  const fehlen = namen.filter((n) => opt[n] === undefined || opt[n] === true);
  if (fehlen.length) throw new store.Fehler(`Optionen fehlen: ${fehlen.map((n) => '--' + n).join(', ')}`, 'pflichtfelder_fehlen', fehlen);
}

function json(wert) {
  const text = String(wert).trim();
  const quelle = text.startsWith('{') || text.startsWith('[') ? text : fs.readFileSync(path.resolve(text), 'utf8');
  try {
    return JSON.parse(quelle);
  } catch (e) {
    throw new store.Fehler(`Ungültiges JSON: ${e.message}`, 'json_ungueltig');
  }
}

function zahl(wert, name) {
  const n = Number(wert);
  if (!Number.isInteger(n)) throw new store.Fehler(`--${name} muss eine ganze Zahl sein.`, 'pflichtfelder_fehlen', [name]);
  return n;
}

// Rendern braucht Chromium: dafür wird Electron ohne Fenster gestartet
function electronAuftrag(auftrag) {
  return new Promise((resolve, reject) => {
    const electron = require('electron');
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const kind = spawn(electron, [path.join(__dirname, '..', 'render', 'headless.js'), Buffer.from(JSON.stringify(auftrag)).toString('base64')], { env, windowsHide: true });
    let out = '';
    let err = '';
    kind.stdout.on('data', (d) => { out += d; });
    kind.stderr.on('data', (d) => { err += d; });
    kind.on('error', reject);
    kind.on('close', () => {
      const zeile = out.split(/\r?\n/).find((z) => z.startsWith('@@ERGEBNIS@@'));
      if (!zeile) return reject(new Error(`Electron hat kein Ergebnis geliefert.\n${err.trim()}`));
      const antwort = JSON.parse(zeile.slice('@@ERGEBNIS@@'.length));
      if (antwort.ok) resolve(antwort.ergebnis);
      else reject(Object.assign(new store.Fehler(antwort.fehler, antwort.code, antwort.offene_punkte)));
    });
  });
}

async function main(argv) {
  const { pos, opt } = parse(argv);
  const [befehl, unter] = pos;
  const bef = (unter && ['set', 'karte', 'vorlage'].includes(befehl)) ? `${befehl} ${unter.replace('ä', 'ae').replace('ö', 'oe')}` : befehl;

  switch (bef) {
    case undefined:
    case 'hilfe':
    case 'help':
      process.stdout.write(HILFE + '\n');
      return;
    case 'vorlagen':
      return ausgabe({ ok: true, vorlagen: Object.values(VORLAGEN).map((v) => ({ id: v.id, name: v.name, standardFormat: v.standardFormat, formatVorschlaege: v.formatVorschlaege, layouts: v.layouts })) });
    case 'vorlage zeigen': {
      const v = vorlage(pos[2] || 'tcg');
      return ausgabe({ ok: true, id: v.id, name: v.name, standardFormat: v.standardFormat, formatVorschlaege: v.formatVorschlaege, layouts: v.layouts, felder: v.felder, folien: v.folien, standard: v.standard });
    }
    case 'set neu':
      brauche(opt, 'ordner');
      return ausgabe({ ok: true, set: store.erstelleSet(opt.ordner, {
        name: opt.name === true ? undefined : opt.name,
        kuerzel: opt.kuerzel === true ? undefined : opt.kuerzel,
        kartentyp: opt.kartentyp,
        fusszeile: opt.fusszeile,
        anzahl: opt.anzahl ? zahl(opt.anzahl, 'anzahl') : null,
        vorlage: opt.vorlage,
      }) });
    case 'set zeigen':
      brauche(opt, 'set');
      return ausgabe({ ok: true, set: store.ladeSet(opt.set), karten: store.nummern(path.resolve(opt.set)).length });
    case 'set aendern':
      brauche(opt, 'set', 'json');
      return ausgabe({ ok: true, set: store.aendereSet(opt.set, json(opt.json)) });
    case 'liste':
      brauche(opt, 'set');
      return ausgabe({ ok: true, karten: store.listeKarten(path.resolve(opt.set)) });
    case 'karte neu': {
      brauche(opt, 'set', 'json');
      const k = store.neueKarte(opt.set, json(opt.json), { entwurf: !!opt.entwurf });
      return ausgabe({ ok: true, nummer: k.nummer, version: k.version, name: k.name, status: k.entwurf ? 'entwurf' : 'gespeichert', hinweis: 'Mit "rendern --nr" als PNG erzeugen.', offene_punkte: k.offene_punkte || [] });
    }
    case 'karte aendern': {
      brauche(opt, 'set', 'nr', 'json');
      const k = store.aendereKarte(opt.set, zahl(opt.nr, 'nr'), json(opt.json), { entwurf: !!opt.entwurf });
      return ausgabe({ ok: true, nummer: k.nummer, version: k.version, name: k.name, status: k.entwurf ? 'entwurf' : 'gespeichert', offene_punkte: k.offene_punkte || [] });
    }
    case 'karte kopieren': {
      brauche(opt, 'set', 'nr');
      const k = store.kopiereKarte(opt.set, zahl(opt.nr, 'nr'), { version: opt.version, neueNummer: opt['neue-nr'] ? zahl(opt['neue-nr'], 'neue-nr') : undefined });
      return ausgabe({ ok: true, nummer: k.nummer, version: k.version, name: k.name, kopiert_von: k.kopiert_von, status: k.entwurf ? 'entwurf' : 'gespeichert', offene_punkte: k.offene_punkte || [] });
    }
    case 'karte stil': {
      brauche(opt, 'set', 'von', 'nr');
      const ordner = path.resolve(opt.set);
      const karten = store.uebertrageStil(ordner, zahl(opt.von, 'von'), store.waehleNummern(ordner, opt.nr));
      return ausgabe({ ok: true, von: zahl(opt.von, 'von'), karten });
    }
    case 'karte verschieben': {
      brauche(opt, 'set', 'nr', 'nach');
      const umnummeriert = store.verschiebeKarte(opt.set, zahl(opt.nr, 'nr'), zahl(opt.nach, 'nach'));
      return ausgabe({ ok: true, umnummeriert, png_veraltet: store.ladeSet(opt.set).png_veraltet || [], hinweis: 'Karten mit neuer Nummer mit "rendern --nr" neu als PNG erzeugen.' });
    }
    case 'karte loeschen': {
      brauche(opt, 'set', 'nr');
      if (opt.ja !== true) throw new store.Fehler('Löschen nur nach ausdrücklicher Bestätigung des Nutzers, dann mit --ja aufrufen.', 'bestaetigung_fehlt', ['ja']);
      const r = store.loescheKarte(opt.set, zahl(opt.nr, 'nr'));
      return ausgabe({ ok: true, ...r, png_veraltet: store.ladeSet(opt.set).png_veraltet || [] });
    }
    case 'karte zeigen':
      brauche(opt, 'set', 'nr');
      return ausgabe({ ok: true, karte: store.ladeKarte(path.resolve(opt.set), zahl(opt.nr, 'nr'), opt.version) });
    case 'karte versionen':
      brauche(opt, 'set', 'nr');
      return ausgabe({ ok: true, nummer: zahl(opt.nr, 'nr'), versionen: store.versionen(path.resolve(opt.set), zahl(opt.nr, 'nr')) });
    case 'rendern': {
      brauche(opt, 'set');
      const karten = await electronAuftrag({ art: 'rendern', set: path.resolve(opt.set), optionen: { nr: opt.nr, beschnitt: !opt['ohne-beschnitt'] } });
      return ausgabe({ ok: true, status: 'gerendert', karten });
    }
    case 'druck': {
      brauche(opt, 'set');
      const ergebnis = await electronAuftrag({ art: 'druck', set: path.resolve(opt.set), optionen: {
        nr: opt.nr,
        modus: opt.modus || 'bogen',
        rueckseiten: !opt['ohne-rueckseiten'],
        auflage: opt.auflage ? zahl(opt.auflage, 'auflage') : 1,
        mitEntwuerfen: !!opt['mit-entwuerfen'],
      } });
      return ausgabe({ ok: true, ...ergebnis, hinweis: 'Die Übergabe an den Druckdienst macht der Mensch.' });
    }
    case 'sammlung': {
      brauche(opt, 'set');
      const ordner = path.resolve(opt.set);
      if (opt.nr !== undefined) {
        brauche(opt, 'besitz');
        return ausgabe({ ok: true, nummer: zahl(opt.nr, 'nr'), ...store.setzeBesitz(ordner, zahl(opt.nr, 'nr'), zahl(opt.besitz, 'besitz')) });
      }
      const karten = store.listeKarten(ordner);
      return ausgabe({ ok: true, karten: karten.length, vorhanden: karten.filter((k) => k.besitz > 0).length, gedruckt: karten.filter((k) => k.gedruckt > 0).length, sammlung: store.ladeSammlung(ordner) });
    }
    default:
      throw new store.Fehler(`Unbekannter Befehl: ${pos.join(' ')}. "hilfe" zeigt alle Befehle.`, 'unbekannter_befehl');
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(fehlerAusgabe);
}

module.exports = { main };

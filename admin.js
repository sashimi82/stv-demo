const KEY = 'adm_data_v1';
let D = store(KEY, { keys: {}, visa: {}, abgerechnet: {}, dateien: [] });
D.stamm = D.stamm || { personen: {}, datei: '', am: '' };
const persist = () => save(KEY, D);
askPersist();
const app = $('#app');
let TAB = 'pruefung', ROWS = [], LOADMSG = [];
const curKey = nr => { const k = (D.keys[nr] || []); return k[k.length - 1]; };
const findKey = (nr, id) => (D.keys[nr] || []).find(k => k.keyId === id);
const STAT = { ok: ['b-ok', '✓ stimmt'], diff: ['b-warn', '⚠ Abweichung'], none: ['b-err', '✗ kein Visum'], storno: ['b-err', '✗ Visum storniert'], manip: ['b-err', '✗ Visum ungültig'], dup: ['b-gray', '⧉ schon abgerechnet'], manuell: ['b-acc', '✓ manuell anerkannt'] };

function render() {
  app.innerHTML = `<a class="back" href="index.html">‹ Startseite</a><header class="top"><div><h1>Prüfung Stellvertretung</h1><div class="sub">Administration · alle Daten bleiben in diesem Browser</div></div><span class="role">Administration</span></header>
  <div class="tabs">${[['pruefung', 'Prüfung'], ['archiv', 'Visa-Archiv'], ['stamm', 'Stammdaten'], ['standorte', 'Standorte und Schlüssel'], ['sicherung', 'Sicherung']].map(([k, t]) => `<button class="${TAB === k ? 'on' : ''}" data-t="${k}">${t}</button>`).join('')}</div>
  <div id="tab"></div>`;
  $$('.tabs button').forEach(b => b.onclick = () => { TAB = b.dataset.t; render(); });
  ({ pruefung: tabPruefung, archiv: tabArchiv, stamm: tabStamm, standorte: tabStandorte, sicherung: tabSicherung })[TAB]($('#tab'));
}

/* ---------- Standorte und Schlüssel ---------- */
function tabStandorte(el) {
  el.innerHTML = `<div class="card"><h2>Standorte und Schlüssel</h2>
  <p class="sub" style="margin-bottom:12px">Pro Betreuung einen Schlüssel erzeugen und den Einrichtungs-QR-Code mit dem Betreuungshandy scannen. Ein neuer Schlüssel sperrt den alten (z. B. wenn ein Handy verloren ging).</p>
  ${CONFIG.standorte.map(s => { const k = curKey(s.nr); return `<div class="srow"><div><b>${esc(s.name)}</b><div class="sub">${k ? 'Schlüssel Nr. ' + k.keyId + ' · erstellt ' + fmtStamp(k.erstellt) : 'noch kein Schlüssel'}</div></div>
    <div class="btngroup" style="margin-top:0">${k ? `<button class="small" data-qr="${s.nr}">Einrichtungs-QR zeigen</button>` : ''}<button class="small" data-new="${s.nr}">${k ? 'Neuer Schlüssel' : 'Schlüssel erzeugen'}</button></div></div>`; }).join('')}
  </div>`;
  $$('[data-new]', el).forEach(b => b.onclick = () => {
    const nr = +b.dataset.new, list = D.keys[nr] = D.keys[nr] || [];
    if (list.length && !confirm('Neuen Schlüssel für ' + standortName(nr) + ' erzeugen? Der bisherige wird gesperrt: Visa, die danach noch damit erteilt werden, sind markiert. Das Betreuungshandy muss neu eingerichtet werden.')) return;
    const now = nowLocalISO(); if (list.length) list[list.length - 1].gesperrtAb = now;
    list.push({ keyId: list.length + 1, secret: randomB32(26), erstellt: now, gesperrtAb: null }); persist(); render(); showSetup(nr);
  });
  $$('[data-qr]', el).forEach(b => b.onclick = () => showSetup(+b.dataset.qr));
}
function showSetup(nr) {
  const k = curKey(nr), txt = `${QR_SETUP}${nr}:${k.keyId}:${k.secret}`;
  sheet(`<h2>Einrichtung ${esc(standortName(nr))}</h2>
    <div class="info">Nur dem Leitungsteam zeigen. Wer diesen Code hat, kann für diesen Standort visieren.</div>
    <div class="card center"><div class="sub">Im Leitungsmodus «Einrichtungs-QR-Code scannen» wählen</div><div class="qrbox">${qrSVG(txt)}</div>
    <div class="sub">oder Code kopieren und im Leitungsmodus einfügen:</div>
    <textarea id="ct" class="mono" readonly rows="2" style="font-size:15px;margin-top:6px;text-align:center;resize:none">${txt}</textarea>
    <button class="pri" id="cp">Code kopieren</button></div>
    <div class="card"><div class="demo" style="margin-bottom:0">Demo mit nur einem Gerät: Dieses Gerät direkt als Betreuungshandy für ${esc(standortName(nr))} einrichten.</div>
    <a class="btn" href="leitung.html#setup=${encodeURIComponent(txt)}">Hier als Betreuungshandy einrichten</a></div>
    <button class="cl">Schliessen</button>`,
    (el, close) => { $('.cl', el).onclick = close; const ct = $('#ct', el); ct.onclick = () => ct.select(); $('#cp', el).onclick = () => copyText(txt); });
}

/* ---------- Eingelesene Dateien streng prüfen (nur erwartete Felder und Formate) ---------- */
const RX = { pnr: /^\d{6}$/, date: /^\d{4}-\d\d-\d\d$/, stamp: /^\d{4}-\d\d-\d\dT\d\d:\d\d$/, hhmm: /^\d\d:\d\d$/, b32: /^[0-9A-Z]+$/ };
const txt = (s, n = 80) => typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n) : null;
const int = x => Number.isInteger(x) ? x : null;
function cleanVisa(v) {
  if (!v || typeof v !== 'object') return null;
  const c = {
    code: typeof v.code === 'string' && RX.b32.test(v.code) && v.code.length === 16 ? v.code : null,
    persNr: RX.pnr.test(v.persNr) ? v.persNr : null, datum: RX.date.test(v.datum) ? v.datum : null,
    von: int(v.von), bis: int(v.bis), funktion: CONFIG.funktionen.includes(v.funktion) ? v.funktion : null,
    mittag: typeof v.mittag === 'boolean' ? v.mittag : null, standortNr: int(v.standortNr), keyId: int(v.keyId),
    visiertVon: txt(v.visiertVon, 60), visiertAm: RX.stamp.test(v.visiertAm) ? v.visiertAm : null,
    pinTyp: ['stamm', 'ferien'].includes(v.pinTyp) ? v.pinTyp : null,
    ferienVon: v.ferienVon === '' || RX.date.test(v.ferienVon) ? v.ferienVon : null, ferienBis: v.ferienBis === '' || RX.date.test(v.ferienBis) ? v.ferienBis : null,
    nachtraeglichTage: int(v.nachtraeglichTage), storniert: typeof v.storniert === 'boolean' ? v.storniert : null,
    stornoAm: v.stornoAm === '' || RX.stamp.test(v.stornoAm) ? v.stornoAm : null,
    tag: typeof v.tag === 'string' && /^[0-9A-Z]{4}$/.test(v.tag) ? v.tag : null, sig: typeof v.sig === 'string' && /^[0-9A-Z]{16}$/.test(v.sig) ? v.sig : null,
  };
  return Object.values(c).some(x => x === null) ? null : c;
}
function cleanEintrag(e) {
  if (!e || typeof e !== 'object' || typeof e.code !== 'string') return null;
  const k = unpackEntry(e.code); if (k.err) return null;
  if (!RX.date.test(e.datum) || !RX.hhmm.test(e.von) || !RX.hhmm.test(e.bis) || !CONFIG.funktionen.includes(e.funktion) || typeof e.mittag !== 'boolean' || !Number.isInteger(e.standortNr)) return null;
  let q = null;
  if (e.quittung) { const t = txt(String(e.quittung.tag || '').toUpperCase(), 4); if (!t || !/^[0-9A-Z]{4}$/.test(t)) return null; q = { tag: t, name: txt(e.quittung.name, 60) || '', am: txt(e.quittung.am, 20) || '' }; }
  return { code: k.code, datum: e.datum, von: e.von, bis: e.bis, funktion: e.funktion, mittag: e.mittag, standortNr: e.standortNr, quittung: q };
}

/* ---------- Dateien laden ---------- */
async function loadFiles(files) {
  LOADMSG = []; let stv = 0, vis = 0, neu = 0, bad = 0, abgelehnt = 0;
  const jetzt = nowLocalISO();
  for (const f of files) {
    let d; try { if (f.size > 5e6) throw new Error(f.name + ' ist zu gross'); d = await readJSONFile(f); } catch (e) { LOADMSG.push(['b-err', e.message]); continue; }
    if (!d || typeof d !== 'object') { LOADMSG.push(['b-err', f.name + ': unbekannter Dateityp']); continue; }
    const fname = txt(f.name, 120) || 'Datei';
    if (d.typ === 'leitung' && Array.isArray(d.visa) && Number.isInteger(d.standortNr)) {
      vis++; let maxStamp = '', rueck = 0;
      const exportAm = RX.stamp.test(d.exportiertAm) ? d.exportiertAm : '';
      for (const raw of d.visa.slice(0, 5000)) {
        const v = cleanVisa(raw); if (!v) { abgelehnt++; continue; }
        const k = findKey(v.standortNr, v.keyId), id = v.code + '|' + v.visiertAm;
        let gueltig = false, grund = '';
        if (!k) grund = 'Unbekannter Schlüssel';
        else {
          const sig = await visumSig(k.secret, v), tag = await quittTag(k.secret, v.code);
          gueltig = sig === v.sig && tag === v.tag && v.standortNr === d.standortNr;
          if (!gueltig) grund = 'Signatur stimmt nicht: Datei wurde verändert';
          const chk = unpackEntry(v.code);
          if (gueltig && (chk.err || chk.persNr !== v.persNr || chk.datum !== v.datum || chk.von !== v.von || chk.bis !== v.bis || chk.funktion !== v.funktion || chk.mittag !== v.mittag || chk.standortNr !== v.standortNr)) { gueltig = false; grund = 'Angaben passen nicht zum Code'; }
        }
        // Zeitstempel-Hinweise (Uhr des Betreuungshandys): nur Bemerkungen, keine Fehler
        const zeit = [];
        if (v.visiertAm > jetzt) zeit.push('Visum-Zeitstempel liegt in der Zukunft (Uhr des Betreuungshandys falsch?)');
        if (exportAm && v.visiertAm > exportAm) zeit.push('Visum-Zeitstempel nach dem Export (Uhr verstellt?)');
        if (v.visiertAm < maxStamp) { rueck++; zeit.push('Zeitstempel früher als ein zuvor erteiltes Visum (Uhr zurückgestellt?)'); }
        if (v.visiertAm > maxStamp) maxStamp = v.visiertAm;
        const neuV = { ...v, gueltig, grund, zeit, quelle: fname, importiertAm: jetzt, gesperrt: !!(k && k.gesperrtAb && v.visiertAm > k.gesperrtAb) };
        const alt = D.visa[id];
        if (!alt) neu++;
        // Ein gültiges Visum wird nie durch ein ungültiges ersetzt; ein Storno zählt nur mit gültiger Signatur.
        if (!alt || (gueltig && (!alt.gueltig || (v.stornoAm || '') > (alt.stornoAm || '')))) D.visa[id] = neuV;
        else if (!gueltig && alt.gueltig) D.visa[id + '|x' + v.sig] = neuV;
        if (!gueltig) bad++;
      }
      if (rueck) LOADMSG.push(['b-warn', fname + ': ' + rueck + ' Visa mit Zeitstempel ausser der Reihe. Die Uhr des Betreuungshandys wurde vermutlich verstellt.']);
      D.dateien.push({ name: fname, typ: 'leitung', am: jetzt, n: d.visa.length });
    } else if (d.typ === 'stv' && Array.isArray(d.eintraege) && RX.pnr.test(d.persNr)) {
      stv++; const name = txt(d.name) || '(ohne Namen)';
      for (const raw of d.eintraege.slice(0, 2000)) {
        const e = cleanEintrag(raw); if (!e) { abgelehnt++; continue; }
        if (ROWS.some(x => x.e.code === e.code)) continue;
        // Quittung mit allen (auch gesperrten) Schlüsseln des Standorts prüfen: belegt das Visum auch ohne Leitungs-Datei
        e.qKey = 0; e.qPruefbar = !!(D.keys[e.standortNr] || []).length;
        if (e.quittung) for (const k of D.keys[e.standortNr] || []) if (await quittTag(k.secret, e.code) === e.quittung.tag) { e.qKey = k.keyId; break; }
        ROWS.push(makeRow({ persNr: d.persNr, name }, e, fname));
      }
      D.dateien.push({ name: fname, typ: 'stv', am: jetzt, n: d.eintraege.length });
    } else LOADMSG.push(['b-err', fname + ': unbekannter Dateityp']);
  }
  evalAll();
  persist();
  LOADMSG.unshift(['b-ok', `${stv} StV-Datei(en) und ${vis} Leitungs-Datei(en) geladen · ${neu} neue Visa im Archiv`]);
  if (bad) LOADMSG.push(['b-err', bad + ' Visa mit ungültiger Signatur: diese Visa werden nicht anerkannt (siehe Visa-Archiv).']);
  if (abgelehnt) LOADMSG.push(['b-err', abgelehnt + ' Einträge mit unzulässigem Inhalt wurden nicht eingelesen (Datei beschädigt oder verändert).']);
  render();
}
function makeRow(d, e, quelle) {
  return { persNr: d.persNr, name: d.name, quelle, e: { ...e, vonM: hhmmToMin(e.von), bisM: hhmmToMin(e.bis) }, sel: false, status: '', v: null, hinweise: [], manuell: null };
}
function evaluate(r) {
  const e = r.e; r.hinweise = []; r.v = null; r.diffs = [];
  if (r.manuell) { r.status = 'manuell'; r.v = r.manuell.v || null; r.sel = true; return; }
  if (D.abgerechnet[e.code]) { r.status = 'dup'; r.hinweise.push('abgerechnet am ' + fmtStamp(D.abgerechnet[e.code].am)); r.sel = false; return; }
  const all = Object.values(D.visa);
  const same = all.filter(v => v.code === e.code);
  const ok = same.find(v => v.gueltig && !v.storniert);
  if (ok) {
    r.status = 'ok'; r.v = ok; r.sel = true;
    if (ok.pinTyp === 'ferien') r.hinweise.push('Ferien-PIN');
    if (ok.pinTyp === 'ferien' && (ok.visiertAm.slice(0, 10) < ok.ferienVon || ok.visiertAm.slice(0, 10) > ok.ferienBis)) { r.hinweise.push('Visum ausserhalb der Ferien-PIN-Gültigkeit'); r.sel = false; }
    if (ok.nachtraeglichTage >= CONFIG.nachtraeglichAbTagen) r.hinweise.push(ok.nachtraeglichTage + ' Tage nachträglich visiert');
    if (ok.gesperrt) { r.hinweise.push('mit gesperrtem Schlüssel visiert'); r.sel = false; }
    if (e.quittung && e.quittung.tag && e.quittung.tag !== ok.tag) { r.hinweise.push('Quittung auf dem Handy passt nicht'); r.sel = false; }
    if (!e.quittung) r.hinweise.push('ohne Quittung eingereicht');
    if (ok.visiertAm < ok.datum + 'T' + minToHHMM(ok.bis)) r.hinweise.push(ok.visiertAm < ok.datum ? 'Visum-Zeitstempel vor dem Einsatztag (Uhr verstellt?)' : 'vor Einsatzende visiert');
    if (ok.zeit && ok.zeit.length) { r.hinweise.push(...ok.zeit); r.sel = false; }
    if (plausi(ok)) { r.hinweise.push('unplausibel: ' + plausi(ok)); r.sel = false; }
    const c = unpackEntry(e.code);
    if (c.err || c.persNr !== r.persNr) { r.hinweise.push('Personalnummer passt nicht zur Datei'); r.sel = false; }
    else if (c.von !== e.vonM || c.bis !== e.bisM || c.funktion !== e.funktion || c.mittag !== e.mittag || c.datum !== e.datum) { r.hinweise.push('StV-Datei wurde nachträglich verändert, es gelten die Werte des Visums'); r.sel = false; }
    return;
  }
  if (same.some(v => !v.gueltig)) { r.status = 'manip'; r.hinweise.push(same.find(v => !v.gueltig).grund); r.sel = false; return; }
  if (same.some(v => v.storniert)) { r.status = 'storno'; r.sel = false; return; }
  const cand = all.find(v => v.gueltig && !v.storniert && v.persNr === r.persNr && v.datum === e.datum && v.standortNr === e.standortNr);
  if (cand) {
    r.status = 'diff'; r.v = cand; r.sel = false;
    if (cand.von !== e.vonM || cand.bis !== e.bisM) r.diffs.push(['Zeit', e.von + '–' + e.bis, minToHHMM(cand.von) + '–' + minToHHMM(cand.bis)]);
    if (cand.funktion !== e.funktion) r.diffs.push(['Funktion', e.funktion, cand.funktion]);
    if (cand.mittag !== e.mittag) r.diffs.push(['Mittagessen', e.mittag ? 'ja' : 'nein', cand.mittag ? 'ja' : 'nein']);
    r.hinweise.push(r.diffs.map(d => d[0]).join(', ') + ' unterschiedlich');
    return;
  }
  r.status = 'none'; r.sel = false;
  if (e.qKey) r.hinweise.push('Leitungs-Datei fehlt, aber die Quittung ist echt (Schlüssel Nr. ' + e.qKey + '): Visum belegt');
  else { r.hinweise.push('Leitungs-Datei von ' + standortName(e.standortNr) + ' fehlt oder Einsatz nicht visiert'); if (e.quittung && e.qPruefbar) r.hinweise.push('Quittung auf dem Handy ist nicht gültig'); }
}
/** Prüfungen über mehrere Einsätze: Überschneidungen und Tagestotal pro Person (auch über Standorte hinweg) */
function crossCheck() {
  const act = ROWS.filter(r => r.status === 'ok');
  const by = {};
  act.forEach(r => (by[r.persNr + '|' + r.e.datum] = by[r.persNr + '|' + r.e.datum] || []).push(r));
  Object.values(by).forEach(list => {
    const z = list.map(r => ({ r, von: r.v.von, bis: r.v.bis }));
    z.forEach(a => z.forEach(b => { if (a !== b && overlaps(a, b)) { a.r.hinweise.push('überschneidet sich mit ' + standortName(b.r.e.standortNr) + ' ' + minToHHMM(b.von) + '–' + minToHHMM(b.bis)); a.r.sel = false; } }));
    const tot = z.reduce((s, x) => s + x.bis - x.von, 0);
    if (tot > CONFIG.maxStundenTag * 60) list.forEach(r => { r.hinweise.push('total ' + hours(0, tot) + ' Std. an diesem Tag'); r.sel = false; });
  });
}
const normName = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
function stammCheck(r) {
  r.stamm = null;
  if (!Object.keys(D.stamm.personen).length || ['dup', 'manuell'].includes(r.status)) return;
  const p = D.stamm.personen[r.persNr];
  if (!p) { r.hinweise.push('Personalnummer nicht in den Stammdaten'); r.sel = false; return; }
  r.stamm = p;
  const a = normName(p.name), b = normName(r.name);
  if (!a.length || !b.length || !a.every(w => b.includes(w)) && !b.every(w => a.includes(w))) { r.hinweise.push('Name passt nicht zur Personalnummer (Stammdaten: ' + p.name + ')'); r.sel = false; }
  const f = final(r).funktion;
  if (p.funktionen.length && !p.funktionen.includes(f)) { r.hinweise.push('Funktion ' + f + ' laut Stammdaten nicht vorgesehen (' + p.funktionen.join(', ') + ')'); r.sel = false; }
}
function evalAll() { ROWS.forEach(evaluate); crossCheck(); ROWS.forEach(stammCheck); }
const final = r => { // Werte, die abgerechnet werden
  const fromV = v => ({ von: minToHHMM(v.von), bis: minToHHMM(v.bis), funktion: v.funktion, mittag: v.mittag, v });
  if (r.status === 'manuell' && r.manuell.v) return fromV(r.manuell.v);
  if (r.status === 'ok') return fromV(r.v);
  return { von: r.e.von, bis: r.e.bis, funktion: r.e.funktion, mittag: r.e.mittag, v: r.v };
};

/* ---------- Prüfung ---------- */
function tabPruefung(el) {
  const order = { diff: 0, none: 1, manip: 2, storno: 3, ok: 4, manuell: 5, dup: 6 };
  ROWS.sort((a, b) => order[a.status] - order[b.status] || a.persNr.localeCompare(b.persNr) || a.e.datum.localeCompare(b.e.datum));
  const sel = ROWS.filter(r => r.sel), selStd = sel.reduce((s, r) => s + hours(hhmmToMin(final(r).von), hhmmToMin(final(r).bis)), 0);
  const cnt = s => ROWS.filter(r => r.status === s).length;
  el.innerHTML = `
  <label class="drop" id="drop">Dateien hierher ziehen oder <u>auswählen</u><br><span style="font-size:14px">StV-Dateien (stv_…json) und Leitungs-Dateien (visa_…json), beliebig gemischt</span><input type="file" id="fi" multiple accept=".json,application/json" hidden></label>
  ${LOADMSG.map(([c, m]) => `<div style="margin-top:10px"><span class="bd wrap ${c}">${esc(m)}</span></div>`).join('')}
  ${ROWS.length ? `<div class="card" style="margin-top:14px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px"><h2>Ergebnis</h2>
    <div class="sub">${cnt('ok') + cnt('manuell')} in Ordnung · ${cnt('diff')} Abweichungen · ${cnt('none') + cnt('manip') + cnt('storno')} ohne gültiges Visum · ${cnt('dup')} schon abgerechnet</div></div>
    <div class="scrollx"><table><tr><th></th><th>Person</th><th>Datum</th><th>Standort</th><th>Funktion</th><th>Zeit</th><th>Std.</th><th>Mittag</th><th>Status</th><th>Hinweise</th><th></th></tr>
    ${ROWS.map((r, i) => { const f = final(r); return `<tr class="${r.sel ? '' : ''}"><td><input type="checkbox" data-s="${i}" ${r.sel ? 'checked' : ''} ${['ok', 'manuell'].includes(r.status) ? '' : 'disabled'} style="width:auto"></td>
      <td>${esc(r.stamm ? r.stamm.name : r.name)}<div class="sub">${esc(r.persNr)}${r.stamm && normName(r.stamm.name).join(' ') !== normName(r.name).join(' ') ? ' · in Datei: ' + esc(r.name) : ''}</div></td><td>${esc(fmtDateShort(r.e.datum) + r.e.datum.slice(0, 4))}</td><td>${esc(standortName(r.e.standortNr))}</td><td>${esc(f.funktion)}</td>
      <td style="white-space:nowrap">${esc(f.von)}–${esc(f.bis)}</td><td>${hours(hhmmToMin(f.von), hhmmToMin(f.bis))}</td><td>${f.mittag ? 'ja' : 'nein'}</td>
      <td><span class="bd ${STAT[r.status][0]}">${STAT[r.status][1]}</span></td><td class="sub">${esc(r.hinweise.join(' · '))}</td>
      <td><button class="small" data-d="${i}">Details</button></td></tr>`; }).join('')}
    </table></div>
    <div class="btnrow" style="margin-top:6px;flex-wrap:wrap">
      <button class="pri" id="abr" ${sel.length ? '' : 'disabled'}>${sel.length} ausgewählte abrechnen (${Math.round(selStd * 100) / 100} Std.) → Excel</button>
      <button id="erg">Prüfergebnis als Excel</button><button id="clr">Liste leeren</button></div>
    <p class="note">«Abrechnen» erstellt eine Excel-Datei (CSV) und merkt sich die Einsätze als abgerechnet. Werden sie nochmals eingereicht, erscheinen sie als «schon abgerechnet».</p>
  </div>` : '<p class="note" style="margin-top:14px">Tipp: Zuerst die Leitungs-Dateien laden, dann die StV-Dateien, oder alle zusammen. Visa werden im Archiv aufbewahrt, auch für spätere Monate.</p>'}`;
  const fi = $('#fi', el), drop = $('#drop', el);
  fi.onchange = () => loadFiles([...fi.files]);
  drop.ondragover = e => { e.preventDefault(); drop.style.opacity = .7; };
  drop.ondragleave = () => drop.style.opacity = 1;
  drop.ondrop = e => { e.preventDefault(); drop.style.opacity = 1; loadFiles([...e.dataTransfer.files]); };
  if (!ROWS.length) return;
  $$('[data-s]', el).forEach(c => c.onchange = () => { ROWS[+c.dataset.s].sel = c.checked; render(); });
  $$('[data-d]', el).forEach(b => b.onclick = () => details(ROWS[+b.dataset.d]));
  $('#clr', el).onclick = () => { if (confirm('Prüfliste leeren? (Visa-Archiv und Abrechnungen bleiben erhalten.)')) { ROWS = []; LOADMSG = []; render(); } };
  $('#erg', el).onclick = () => csv('pruefergebnis_' + todayISO() + '.csv', ROWS, true);
  $('#abr', el).onclick = () => {
    const s = ROWS.filter(r => r.sel); if (!s.length) return;
    if (!confirm(s.length + ' Einsätze abrechnen und als Excel-Datei speichern?')) return;
    csv('abrechnung_stv_' + todayISO() + '.csv', s, false);
    const am = nowLocalISO(); s.forEach(r => { const f = final(r); D.abgerechnet[r.e.code] = { am, persNr: r.persNr, datum: r.e.datum, stunden: hours(hhmmToMin(f.von), hhmmToMin(f.bis)) }; r.manuell = null; });
    persist(); evalAll(); toast(s.length + ' Einsätze abgerechnet'); render();
  };
}
function details(r) {
  const e = r.e, v = r.v;
  const line = (k, a, b) => `<tr><td class="sub">${k}</td><td ${b !== undefined && a !== b ? 'style="color:var(--err);font-weight:650"' : ''}>${esc(a)}</td><td style="font-weight:600">${b === undefined ? '' : esc(b)}</td></tr>`;
  const vz = v ? { zeit: minToHHMM(v.von) + '–' + minToHHMM(v.bis), funktion: v.funktion, mittag: v.mittag ? 'ja' : 'nein' } : {};
  sheet(`<h2>${esc(r.name)} · ${esc(r.persNr)} · ${fmtDate(e.datum)}</h2><div class="sub" style="margin-bottom:10px">${esc(standortName(e.standortNr))} · <span class="bd ${STAT[r.status][0]}">${STAT[r.status][1]}</span></div>
  <div class="card"><table><tr><th></th><th>Stellvertretung</th><th>${v ? 'Visum Leitung' : ''}</th></tr>
  ${line('Zeit', e.von + '–' + e.bis, v ? vz.zeit : undefined)}${line('Funktion', e.funktion, v ? vz.funktion : undefined)}${line('Mittagessen', e.mittag ? 'ja' : 'nein', v ? vz.mittag : undefined)}
  ${line('Quittung', e.quittung ? e.quittung.tag + ' (' + (e.quittung.name || '') + ')' : '–', v ? v.tag : undefined)}
  ${v ? line('Visiert von', '', v.visiertVon + ' · ' + fmtStamp(v.visiertAm) + (v.pinTyp === 'ferien' ? ' · Ferien-PIN' : '')) : ''}
  </table><p class="note">Quelle: ${esc(r.quelle)}${v ? ' · Visum aus ' + esc(v.quelle) : ''}</p></div>
  ${r.hinweise.length ? `<div class="info">${esc(r.hinweise.join(' · '))}</div>` : ''}
  ${r.status === 'diff' ? '<button class="pri" id="uv">Werte aus dem Visum übernehmen</button>' : ''}
  ${r.status === 'none' && e.qKey ? '<button class="pri" id="qa">Anhand der echten Quittung anerkennen</button>' : ''}
  ${['none', 'diff', 'storno'].includes(r.status) ? '<button id="ma">Trotzdem anerkennen (Angaben der Stellvertretung)</button>' : ''}
  ${r.status === 'manuell' ? '<button id="rv">Anerkennung zurücknehmen</button>' : ''}
  <a class="btn" href="mailto:?subject=${encodeURIComponent('Rückfrage Stellvertretungseinsatz ' + fmtDate(e.datum))}&body=${encodeURIComponent(`Guten Tag\n\nBeim Einsatz vom ${fmtDate(e.datum)} in ${standortName(e.standortNr)} (${r.name}, ${r.persNr}) haben wir eine Unklarheit:\n${r.hinweise.join('\n')}\n\nAngaben Stellvertretung: ${e.von}–${e.bis}, ${e.funktion}, Mittagessen ${e.mittag ? 'ja' : 'nein'}${v ? `\nVisum Leitung: ${vz.zeit}, ${vz.funktion}, Mittagessen ${vz.mittag}` : ''}\n\nBitte um kurze Rückmeldung.\n\nFreundliche Grüsse\nAdministration Stellvertretung`)}">Rückfrage per Mail</a>
  <button class="cl">Schliessen</button>`,
    (el, close) => {
      $('.cl', el).onclick = close;
      if ($('#uv', el)) $('#uv', el).onclick = () => { r.manuell = { v, grund: 'Visum übernommen' }; evaluate(r); r.hinweise = ['Werte aus Visum übernommen']; close(); render(); };
      if ($('#ma', el)) $('#ma', el).onclick = () => { const g = txt(prompt('Begründung (wird in der Excel-Datei vermerkt):') || '', 200); if (!g) return; r.manuell = { v: null, grund: g }; evaluate(r); r.hinweise = ['manuell: ' + g]; close(); render(); };
      if ($('#qa', el)) $('#qa', el).onclick = () => { const c = unpackEntry(e.code); r.manuell = { v: { ...c, visiertVon: (e.quittung.name || '?') + ' (laut Quittung)', visiertAm: '', pinTyp: '', tag: e.quittung.tag }, grund: 'Quittung echt, Leitungs-Datei fehlt' }; evalAll(); r.hinweise = ['anerkannt anhand der Quittung (Werte aus dem Code)']; close(); render(); };
      if ($('#rv', el)) $('#rv', el).onclick = () => { r.manuell = null; evalAll(); close(); render(); };
    });
}
function csv(name, rows, alle) {
  const head = ['Personalnummer', 'Name', 'Datum', 'Standort', 'Funktion', 'Von', 'Bis', 'Stunden', 'Mittagessen', 'Visiert von', 'Visiert am', 'Visum-Art', 'Status', 'Hinweise'];
  const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const lines = rows.map(r => { const f = final(r), v = f.v; const [y, m, d] = r.e.datum.split('-');
    return [r.persNr, r.name, `${d}.${m}.${y}`, standortName(r.e.standortNr), f.funktion, f.von, f.bis, hours(hhmmToMin(f.von), hhmmToMin(f.bis)), f.mittag ? 'ja' : 'nein', v ? v.visiertVon : '', v ? fmtStamp(v.visiertAm) : '', v ? (v.pinTyp === 'ferien' ? 'Ferien-PIN' : v.pinTyp === 'stamm' ? 'Stamm-PIN' : 'Quittung') : '', STAT[r.status][1].replace(/^\S+ /, ''), (r.manuell ? r.manuell.grund + ' · ' : '') + r.hinweise.join(' · ')].map(q).join(';'); });
  const blob = new Blob(['﻿' + [head.map(q).join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
}

/* ---------- Stammdaten ---------- */
function cleanStamm(s) {
  const out = { personen: {}, datei: '', am: '' };
  if (!s || typeof s !== 'object') return out;
  for (const [nr, p] of Object.entries(s.personen || {})) if (RX.pnr.test(nr) && p && txt(p.name)) out.personen[nr] = { name: txt(p.name), funktionen: (Array.isArray(p.funktionen) ? p.funktionen : []).filter(f => CONFIG.funktionen.includes(f)) };
  out.datei = txt(s.datei, 120) || ''; out.am = RX.stamp.test(s.am) ? s.am : '';
  return out;
}
/** Liest eine Excel-CSV-Liste: Spalten Personalnummer, Name (oder Vorname + Nachname), Funktionen */
function parseStamm(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) throw new Error('Die Datei ist leer.');
  const sep = [';', '\t', ','].sort((x, y) => lines[0].split(y).length - lines[0].split(x).length)[0];
  const cells = l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
  const head = cells(lines[0]).map(h => h.toLowerCase().replace(/[^a-zäöü]/g, ''));
  const col = (...n) => head.findIndex(h => n.some(x => h.startsWith(x)));
  const iNr = col('personalnummer', 'persnr', 'personalnr', 'pnr'), iName = col('name'), iVor = col('vorname'), iNach = col('nachname'), iFun = col('funktion');
  if (iNr < 0 || (iName < 0 && iNach < 0)) throw new Error('Spalten «Personalnummer» und «Name» (oder «Vorname» und «Nachname») nicht gefunden.');
  const personen = {}, fehler = [], fremd = new Set();
  lines.slice(1).forEach((l, i) => {
    const c = cells(l), nr = (c[iNr] || '').replace(/\D/g, '').padStart(6, '0');
    const name = txt(iNach >= 0 ? [c[iVor] || '', c[iNach] || ''].join(' ') : c[iName]);
    if (!RX.pnr.test(nr) || !name) return fehler.push(i + 2);
    const fun = iFun >= 0 ? (c[iFun] || '').toUpperCase().split(/[,/+ ]+/).filter(Boolean).map(f => f === 'FAB' ? 'FABE' : f === 'ASSISTENZ' ? 'Assistenz' : f) : [];
    fun.filter(f => !CONFIG.funktionen.includes(f)).forEach(f => fremd.add(f));
    personen[nr] = { name, funktionen: fun.filter(f => CONFIG.funktionen.includes(f)) };
  });
  return { personen, fehler, fremd: [...fremd] };
}
function tabStamm(el) {
  const n = Object.keys(D.stamm.personen).length;
  el.innerHTML = `<div class="card"><h2>Stammdaten</h2>
  <p class="sub" style="margin-bottom:12px">Liste aus der Personaladministration. Sie wird nicht angezeigt, sondern nur im Hintergrund für die Prüfung verwendet: Passen Name und Funktion zur Personalnummer?</p>
  ${n ? `<div class="ok-box">Stammdaten aktiv: ${n} Personen · Datei ${esc(D.stamm.datei)} · eingelesen ${fmtStamp(D.stamm.am)}</div>` : '<div class="info">Noch keine Stammdaten. Ohne Stammdaten werden Name und Funktion nicht geprüft.</div>'}
  <div class="btngroup"><label class="btn small pri">${n ? 'Neue Liste einlesen' : 'Liste einlesen'} (Excel als CSV)<input type="file" id="sf" accept=".csv,.txt,text/csv" hidden></label>
  <button class="small" id="sv">Vorlage herunterladen</button>${n ? '<button class="small danger" id="sd">Stammdaten löschen</button>' : ''}</div>
  <p class="note">Spalten: <b>Personalnummer</b>; <b>Name</b> (oder <b>Vorname</b> und <b>Nachname</b>); <b>Funktionen</b> (z. B. «GL, FABE»). Eine neue Liste ersetzt die bisherige.</p>
  <div id="sm"></div></div>`;
  $('#sv', el).onclick = () => { const b = new Blob(['﻿Personalnummer;Name;Funktionen\r\n123456;Sara Keller;GL, FABE\r\n234567;Luca Meier;Assistenz\r\n'], { type: 'text/csv;charset=utf-8' }); const x = document.createElement('a'); x.href = URL.createObjectURL(b); x.download = 'stammdaten_vorlage.csv'; document.body.appendChild(x); x.click(); setTimeout(() => x.remove(), 500); };
  $('#sf', el).onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      if (f.size > 2e6) throw new Error('Die Datei ist zu gross.');
      const r = parseStamm(await f.text()), k = Object.keys(r.personen).length;
      if (!k) throw new Error('Keine gültige Zeile gefunden.');
      if (!confirm(k + ' Personen einlesen? Die bisherigen Stammdaten werden ersetzt.')) return;
      D.stamm = { personen: r.personen, datei: txt(f.name, 120) || '', am: nowLocalISO() }; persist(); evalAll(); render();
      const m = [k + ' Personen eingelesen.']; if (r.fehler.length) m.push('Übersprungen (Zeile ' + r.fehler.slice(0, 10).join(', ') + (r.fehler.length > 10 ? ' …' : '') + '): Personalnummer oder Name fehlt.'); if (r.fremd.length) m.push('Unbekannte Funktionen ignoriert: ' + r.fremd.join(', ') + '.');
      $('#sm').innerHTML = m.map((x, i) => `<div style="margin-top:8px"><span class="bd wrap ${i ? 'b-warn' : 'b-ok'}">${esc(x)}</span></div>`).join('');
    } catch (e) { alert(e.message); }
  };
  if ($('#sd', el)) $('#sd', el).onclick = () => { if (confirm('Stammdaten löschen?')) { D.stamm = { personen: {}, datei: '', am: '' }; persist(); evalAll(); render(); } };
}

/* ---------- Visa-Archiv ---------- */
function tabArchiv(el) {
  const all = Object.values(D.visa).sort((a, b) => b.visiertAm.localeCompare(a.visiertAm));
  const offen = all.filter(v => v.gueltig && !v.storniert && !D.abgerechnet[v.code]);
  const ung = all.filter(v => !v.gueltig);
  el.innerHTML = `<div class="card"><h2>Visa-Archiv</h2><div class="sub">${all.length} Visa gespeichert · ${Object.keys(D.abgerechnet).length} Einsätze abgerechnet · ${offen.length} Visa noch ohne Abrechnung · ${ung.length} ungültig</div>
  <label class="l">Suche (Personalnummer, Name der Leitung, Standort)</label><input id="q">
  <div class="scrollx" style="margin-top:10px"><table id="t"></table></div></div>
  <div class="card"><h2>Eingelesene Dateien</h2>${D.dateien.length ? `<div class="scrollx"><table><tr><th>Datei</th><th>Art</th><th>Einträge</th><th>Eingelesen</th></tr>${D.dateien.slice(-30).reverse().map(f => `<tr><td>${esc(f.name)}</td><td>${f.typ === 'stv' ? 'Stellvertretung' : 'Leitung'}</td><td>${f.n}</td><td>${fmtStamp(f.am)}</td></tr>`).join('')}</table></div>` : '<p class="sub">Noch keine.</p>'}</div>`;
  const draw = () => {
    const q = $('#q', el).value.trim().toLowerCase();
    const list = all.filter(v => !q || (v.persNr + ' ' + v.visiertVon + ' ' + standortName(v.standortNr)).toLowerCase().includes(q)).slice(0, 300);
    $('#t', el).innerHTML = `<tr><th>Datum</th><th>Pers.-Nr.</th><th>Standort</th><th>Funktion</th><th>Zeit</th><th>Visiert von</th><th>Status</th></tr>` + list.map(v => `<tr><td>${esc(fmtDateShort(v.datum) + v.datum.slice(0, 4))}</td><td>${esc(v.persNr)}</td><td>${esc(standortName(v.standortNr))}</td><td>${esc(v.funktion)}</td><td>${minToHHMM(v.von)}–${minToHHMM(v.bis)}</td><td>${esc(v.visiertVon)}${v.pinTyp === 'ferien' ? ' <span class="bd b-acc">Ferien-PIN</span>' : ''}</td>
      <td>${!v.gueltig ? `<span class="bd b-err">ungültig</span> <span class="sub">${esc(v.grund)}</span>` : v.storniert ? '<span class="bd b-err">storniert</span>' : D.abgerechnet[v.code] ? '<span class="bd b-gray">abgerechnet</span>' : '<span class="bd b-warn">noch nicht abgerechnet</span>'}${v.zeit && v.zeit.length ? ' <span class="sub">' + esc(v.zeit.join(' · ')) + '</span>' : ''}</td></tr>`).join('');
  };
  $('#q', el).oninput = draw; draw();
}

/* ---------- Sicherung ---------- */
function cleanBackup(d) {
  const keys = {};
  for (const [nr, list] of Object.entries(d.keys || {})) if (Array.isArray(list)) keys[nr] = list.filter(k => Number.isInteger(k.keyId) && /^[0-9A-Z]{26}$/.test(k.secret)).map(k => ({ keyId: k.keyId, secret: k.secret, erstellt: RX.stamp.test(k.erstellt) ? k.erstellt : '', gesperrtAb: RX.stamp.test(k.gesperrtAb) ? k.gesperrtAb : null }));
  const visa = {};
  for (const [id, v] of Object.entries(d.visa || {})) { const c = cleanVisa(v); if (c) visa[txt(id, 80)] = { ...c, gueltig: v.gueltig === true, grund: txt(v.grund, 100) || '', zeit: Array.isArray(v.zeit) ? v.zeit.map(x => txt(x, 120)).filter(Boolean) : [], quelle: txt(v.quelle, 120) || '', importiertAm: RX.stamp.test(v.importiertAm) ? v.importiertAm : '', gesperrt: v.gesperrt === true }; }
  const abgerechnet = {};
  for (const [c, x] of Object.entries(d.abgerechnet || {})) if (/^[0-9A-Z]{16}$/.test(c) && x) abgerechnet[c] = { am: RX.stamp.test(x.am) ? x.am : '', persNr: RX.pnr.test(x.persNr) ? x.persNr : '', datum: RX.date.test(x.datum) ? x.datum : '', stunden: typeof x.stunden === 'number' ? x.stunden : 0 };
  const dateien = (Array.isArray(d.dateien) ? d.dateien : []).map(f => ({ name: txt(f.name, 120) || '', typ: f.typ === 'stv' ? 'stv' : 'leitung', am: RX.stamp.test(f.am) ? f.am : '', n: Number.isInteger(f.n) ? f.n : 0 }));
  return { keys, visa, abgerechnet, dateien, stamm: cleanStamm(d.stamm) };
}
function tabSicherung(el) {
  el.innerHTML = `<div class="card"><h2>Sicherung</h2>
  <p>Die Prüfdatei speichert Schlüssel, Visa-Archiv und Abrechnungen nur in diesem Browser. Speichere regelmässig eine Sicherung, zum Beispiel nach jeder Abrechnung, und lege sie auf einem geschützten Laufwerk ab.</p>
  <div class="info" style="margin-top:12px">Die Sicherung enthält die Standort-Schlüssel. Bitte wie ein Passwort behandeln.</div>
  <button class="pri" id="sv">Sicherung speichern</button>
  <label class="btn">Sicherung laden<input type="file" id="ld" accept=".json" hidden></label>
  <button class="danger" id="rs">Alles löschen (nur für Tests)</button></div>`;
  $('#sv', el).onclick = () => shareOrDownload('admin_sicherung_' + todayISO() + '.json', { typ: 'admin-sicherung', version: 1, gespeichertAm: nowLocalISO(), ...D });
  $('#ld', el).onchange = async ev => { try { const d = await readJSONFile(ev.target.files[0]); if (d.typ !== 'admin-sicherung') throw new Error('Das ist keine Admin-Sicherung.'); if (!confirm('Sicherung laden? Der aktuelle Stand in diesem Browser wird ersetzt.')) return; D = cleanBackup(d); persist(); evalAll(); toast('Sicherung geladen'); render(); } catch (e) { alert(e.message); } };
  $('#rs', el).onclick = () => { if (confirm('Wirklich alles löschen? Schlüssel, Archiv und Abrechnungen gehen verloren.') && confirm('Ganz sicher?')) { D = { keys: {}, visa: {}, abgerechnet: {}, dateien: [], stamm: { personen: {}, datei: '', am: '' } }; ROWS = []; LOADMSG = []; persist(); render(); } };
}

render();
enableBottomBack();

/* ---------- Nur für die Demo-Bühne (buehne.html): Zugriff von der Präsentationsseite derselben Herkunft ---------- */
try {
  if (window.parent !== window && window.parent.STV_BUEHNE) window.STV_DEMO = {
    rows: () => ROWS.map(r => ({ code: r.e.code, persNr: r.persNr, status: r.status, label: STAT[r.status][1], sel: r.sel, hinweise: r.hinweise.slice(), final: final(r) })),
    msgs: () => LOADMSG.map(m => m[1]),
    reset() { ROWS = []; LOADMSG = []; D.visa = {}; D.abgerechnet = {}; D.dateien = []; persist(); TAB = 'pruefung'; render(); },
    load: files => { TAB = 'pruefung'; return loadFiles(files); },
    tab(t) { TAB = t; render(); },
    setStamm(personen) { D.stamm = { personen, datei: 'stammdaten_demo.csv', am: nowLocalISO() }; persist(); },
    abrechnenAlle() { const am = nowLocalISO(); ROWS.filter(r => r.sel).forEach(r => { const f = final(r); D.abgerechnet[r.e.code] = { am, persNr: r.persNr, datum: r.e.datum, stunden: hours(hhmmToMin(f.von), hhmmToMin(f.bis)) }; }); ROWS = []; LOADMSG = []; persist(); render(); },
  };
} catch (e) { }

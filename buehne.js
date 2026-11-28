/* =====================================================================
   Live-Demo-Bühne: steuert die echte App (stv.html, leitung.html, admin.html)
   in drei Rahmen. Läuft nur im Browser, nichts verlässt das Gerät.
   ===================================================================== */
window.STV_BUEHNE = true;
const ROLES = ['stv', 'lei', 'adm'];
const FR = { stv: $('#f-stv'), lei: $('#f-lei'), adm: $('#f-adm') };
const SRC = { stv: 'stv.html?v=9', lei: 'leitung.html?v=9', adm: 'admin.html?v=9' };
const NATIVE = { phone: [390, 800], pc: [880, 800] };
const W = r => FR[r].contentWindow, DOC = r => FR[r].contentDocument;
let SPEED = 1, BUSY = false, STEP = 0, MODE = 'ablauf';
const FILES = {}; // stv / lei: { name, obj }
let CSV = null;
const STAMM = { '123456': { name: 'Sara Keller', funktionen: ['GL', 'FABE'] }, '234567': { name: 'Luca Meier', funktionen: ['Assistenz'] }, '345678': { name: 'Nora Frei', funktionen: ['BL', 'GL'] } };
const sleep = ms => new Promise(r => setTimeout(r, ms * SPEED));
const dISO = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };

/* ---------- Meldungen und Fenster ---------- */
function say(msg, ms = 3200) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), ms); }
function modal(html) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="modal">${html}<div><button class="close">Schliessen</button></div></div>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.classList.contains('close')) ov.remove(); });
  document.body.appendChild(ov);
}
function showFile(k) { const f = FILES[k]; if (f) modal(`<h2>${esc(f.name)}</h2><pre>${esc(JSON.stringify(f.obj, null, 1))}</pre>`); }
function showCSV() {
  if (!CSV) return;
  const rows = CSV.replace(/^﻿/, '').trim().split(/\r?\n/).map(l => l.split(';').map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"')));
  modal(`<h2>${esc(CSV_NAME)} · Excel für die Lohnabrechnung</h2><div style="overflow:auto"><table>${rows.map((r, i) => '<tr>' + r.map(c => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('') + '</tr>').join('')}</table></div>`);
}
let CSV_NAME = '';
function renderFiles() {
  const b = [];
  if (FILES.stv) b.push(`<button data-f="stv" title="Datei ansehen">${esc(FILES.stv.name)}</button>`);
  if (FILES.lei) b.push(`<button data-f="lei" title="Datei ansehen">${esc(FILES.lei.name)}</button>`);
  if (CSV) b.push(`<button data-f="csv" title="Excel ansehen">${esc(CSV_NAME)}</button>`);
  $('#files').innerHTML = b.join('');
  $$('#files button').forEach(x => x.onclick = () => x.dataset.f === 'csv' ? showCSV() : showFile(x.dataset.f));
}

/* ---------- Layout: Geräte passend skalieren ---------- */
function layout() {
  const top = $('.bar').offsetHeight + $('#story').offsetHeight;
  const availH = innerHeight - top - 60, availW = innerWidth - 40 - 2 * 26;
  const atkW = Math.min(620, Math.max(440, availW * 0.36));
  const s = MODE === 'angriffe' ? Math.min(1.15, availH / NATIVE.pc[1], (availW - atkW) / NATIVE.pc[0]) : Math.min(1, availH / NATIVE.phone[1], availW / (2 * NATIVE.phone[0] + NATIVE.pc[0] + 50));
  for (const r of ROLES) {
    const kind = r === 'adm' ? 'pc' : 'phone', [w, h] = NATIVE[kind];
    const box = FR[r].parentElement; box.style.width = Math.round(w * s) + 'px'; box.style.height = Math.round(h * s) + 'px';
    FR[r].style.width = w + 'px'; FR[r].style.height = h + 'px'; FR[r].style.transform = `scale(${s})`;
  }
  $('#atk').style.width = Math.round(atkW) + 'px';
  $('#atk').style.height = Math.round(NATIVE.pc[1] * s + 30) + 'px';
}
addEventListener('resize', layout);

/* ---------- QR-Code auf einem anderen Gerät «scannen» (echte Dekodierung mit jsQR) ---------- */
function flash(r) { const f = document.createElement('div'); f.className = 'flash'; FR[r].parentElement.appendChild(f); setTimeout(() => f.remove(), 800); }
function readQR(r) {
  return new Promise(res => {
    const svg = DOC(r).querySelector('.qrbox svg'); if (!svg) return res(null);
    const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.outerHTML.replace('<svg ', '<svg width="480" height="480" '));
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 480; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 480, 480); x.drawImage(img, 0, 0, 480, 480); const d = x.getImageData(0, 0, 480, 480); const q = window.jsQR(d.data, 480, 480); res(q ? q.data : null); };
    img.onerror = () => res(null); img.src = src;
  });
}
async function fakeScan(target, hint) {
  const from = target === 'stv' ? 'lei' : /Einrichtung/i.test(hint || '') ? 'adm' : 'stv';
  flash(from); await sleep(450);
  const txt = await readQR(from);
  if (!txt) { say('Auf dem anderen Gerät ist gerade kein QR-Code zu sehen.'); return null; }
  flash(target); say('QR-Code gelesen: ' + (txt.length > 34 ? txt.slice(0, 34) + '…' : txt), 2200);
  return txt;
}

/* ---------- Rahmen vorbereiten (bei jedem Laden) ---------- */
function prepare(r) {
  const w = W(r), d = DOC(r);
  w.alert = m => say(String(m), 4200);
  w.confirm = () => true;
  w.prompt = () => 'Demo';
  if (r !== 'adm') w.scanQR = hint => fakeScan(r, hint);
  w.shareOrDownload = async (name, obj) => { FILES[r] = { name, obj: JSON.parse(JSON.stringify(obj)) }; renderFiles(); say('Datei erstellt: ' + name); return 'downloaded'; };
  const ocu = w.URL.createObjectURL.bind(w.URL);
  w.URL.createObjectURL = blob => { if (blob && /csv/.test(blob.type)) blob.text().then(t => { CSV = t; renderFiles(); showCSV(); }); return ocu(blob); };
  d.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a'); if (!a) return;
    if (a.hasAttribute('download')) { CSV_NAME = a.getAttribute('download'); e.preventDefault(); return; }
    const h = a.getAttribute('href') || '';
    if (h === 'index.html' || h.startsWith('mailto:') || h.startsWith('leitung.html')) { e.preventDefault(); say('In der Demo deaktiviert'); }
  }, true);
  d.addEventListener('keydown', advanceKey);
  const st = d.createElement('style'); st.textContent = '.demo-hl{outline:4px solid #E8A317!important;outline-offset:2px;transition:outline .2s}'; d.head.appendChild(st);
}
function loadFrame(r) { return new Promise(res => { FR[r].onload = () => { prepare(r); res(); }; FR[r].src = SRC[r]; }); }

/* ---------- Bedienhelfer ---------- */
async function waitFor(r, sel, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const el = DOC(r).querySelector(sel); if (el && el.offsetParent !== null) return el; await new Promise(x => setTimeout(x, 60)); }
  throw new Error('Element nicht gefunden: ' + r + ' ' + sel);
}
async function point(el) { el.scrollIntoView({ block: 'center', behavior: SPEED < 1 ? 'auto' : 'smooth' }); el.classList.add('demo-hl'); await sleep(420); el.classList.remove('demo-hl'); }
async function click(r, sel) { const el = await waitFor(r, sel); await point(el); el.click(); await sleep(350); }
async function type(r, sel, text) {
  const el = await waitFor(r, sel); await point(el); el.focus(); el.value = '';
  for (const ch of text) { el.value += ch; el.dispatchEvent(new (W(r).Event)('input', { bubbles: true })); await sleep(SPEED < 1 ? 0 : 45); }
  el.dispatchEvent(new (W(r).Event)('change', { bubbles: true })); el.blur(); await sleep(150);
}
async function choose(r, sel, v) { const el = await waitFor(r, sel); await point(el); el.value = v; el.dispatchEvent(new (W(r).Event)('change', { bubbles: true })); el.dispatchEvent(new (W(r).Event)('input', { bubbles: true })); await sleep(150); }
async function pin(code) { for (const k of code) await click('lei', `.pinpad [data-k="${k}"]`); await sleep(400); }
const has = (r, sel) => { const el = DOC(r).querySelector(sel); return !!(el && el.offsetParent !== null); };
const closeSheet = async r => { if (has(r, '.ov .cl')) await click(r, '.ov .cl'); };
function spot(...rs) { ROLES.forEach(r => $('#d-' + r).classList.toggle('active', rs.includes(r))); }

async function stvEntry(datum, fun, von, bis, mittag) {
  await click('stv', '#neu');
  const dat = await waitFor('stv', '#dat'); dat.value = datum; dat.dispatchEvent(new (W('stv').Event)('change', { bubbles: true }));
  await point(dat);
  await choose('stv', '#sto', '1');
  await click('stv', `#fun [data-v="${fun}"]`);
  await choose('stv', '#vonh', String(+von.slice(0, 2))); await choose('stv', '#vonm', String(+von.slice(3)));
  await choose('stv', '#bish', String(+bis.slice(0, 2))); await choose('stv', '#bism', String(+bis.slice(3)));
  await click('stv', `#mit [data-v="${mittag ? 1 : 0}"]`);
  await click('stv', '#ok'); await waitFor('stv', '.qrbox svg');
}
async function leiHome() { for (let i = 0; i < 3 && !has('lei', '#sc'); i++) { if (has('lei', '#ok') && has('lei', '.qrbox')) await click('lei', '#ok'); else if (has('lei', '#b0')) await click('lei', '#b0'); } }
async function stvHome() { for (let i = 0; i < 3 && !has('stv', '#neu'); i++) { await closeSheet('stv'); if (has('stv', '#back')) await click('stv', '#back'); else if (has('stv', '#b0')) await click('stv', '#b0'); } }

/* ---------- Der Ablauf ---------- */
const SEC = t => `<br><span class="sec">🔒 ${t}</span>`;
const STEPS = [
  { t: 'Drei Rollen, drei Geräte, keine Server-Anwendung', f: [], x: 'Links das <b>eigene Handy der Stellvertretung</b>, in der Mitte das <b>Betreuungshandy</b> der Leitung, rechts der <b>Büro-PC der Administration</b>. Alle drei zeigen die echte App, keine Attrappe. Die Daten bleiben im Browser des jeweiligen Geräts.' + SEC('Der Server liefert nur das Programm. Es gibt keine Datenbank und keine Benutzerkonten.'), run: async () => { } },
  { t: 'Die Administration erzeugt den Standort-Schlüssel', f: ['adm'], x: 'Jede Betreuung erhält einen eigenen geheimen Schlüssel. Er wird einmalig als QR-Code auf das Betreuungshandy übertragen.' + SEC('128-Bit-Schlüssel pro Standort. Geht ein Handy verloren, wird der Schlüssel gesperrt und ersetzt.'),
    run: async () => { await click('adm', '[data-t="standorte"]'); await click('adm', '[data-new="1"]'); await waitFor('adm', '.ov .qrbox svg'); } },
  { t: 'Das Betreuungshandy wird eingerichtet', f: ['lei', 'adm'], x: 'Die Leitung scannt den Einrichtungs-Code und legt eine Stamm-PIN fest (in der Demo 2580).' + SEC('Nach 5 Minuten ohne Bedienung sperrt sich der Leitungsmodus. Für die Ferienbetreuung gibt es eine befristete Ferien-PIN mit eingeschränkten Rechten.'),
    run: async () => { await click('lei', '#sc'); await waitFor('lei', '.pinpad'); await pin('2580'); await pin('2580'); await waitFor('lei', '#sc'); await closeSheet('adm'); await click('adm', '[data-t="pruefung"]'); } },
  { t: 'Die Stellvertretung erfasst ihren Einsatz', f: ['stv'], x: 'Auf dem eigenen Handy, ohne App-Installation: Datum, Standort, Funktion, Zeiten, Mittagessen. Daraus entsteht ein Einsatz-Code mit 16 Zeichen, auch als QR-Code.' + SEC('Unplausible Zeiten (vor 05:30, nach 22:30, über 12 Std., Überschneidungen) werden schon hier abgelehnt. Die Prüfsumme erkennt jeden Tippfehler.'),
    run: async () => { if (has('stv', '#name')) { await type('stv', '#name', 'Sara Keller'); await type('stv', '#pnr', '123456'); await click('stv', '#ok'); } await stvEntry(dISO(1), 'FABE', '07:00', '12:00', false); } },
  { t: 'Die Leitung scannt den Code und prüft', f: ['lei', 'stv'], x: 'Das Betreuungshandy liest den QR-Code und zeigt alle Angaben zur Kontrolle.' + SEC('Geprüft wird: richtiger Standort, kein Datum in der Zukunft, nicht älter als 60 Tage, plausible Zeiten, keine Überschneidung mit schon visierten Einsätzen.'),
    run: async () => { await leiHome(); await click('lei', '#sc'); await waitFor('lei', '#vn'); } },
  { t: 'Die Leitung visiert', f: ['lei'], x: 'Die Leitung gibt nur ihren eigenen Namen ein und bestätigt. Danach zeigt das Handy eine Quittung als QR-Code.' + SEC('Das Visum wird mit dem Standort-Schlüssel digital signiert (HMAC-SHA-256). Jede spätere Änderung an Zeit, Name oder Standort fällt auf.'),
    run: async () => { await type('lei', '#vn', 'M. Brunner'); await click('lei', '#ok'); await waitFor('lei', '.qrbox svg'); } },
  { t: 'Die Stellvertretung scannt die Quittung', f: ['stv', 'lei'], x: 'Die Quittung landet beim Einsatz auf dem Handy der Stellvertretung. Der Einsatz ist jetzt visiert.' + SEC('Die Quittung ist ein Beleg: Geht die Leitungs-Datei verloren, beweist sie das Visum trotzdem.'),
    run: async () => { await stvHome(); await click('stv', '#scanq'); await waitFor('stv', '.ok-box'); } },
  { t: 'Visum vergessen? Kein Problem.', f: ['stv', 'lei'], x: 'Ein Einsatz von vor 4 Tagen wird nachträglich erfasst und visiert. Die Reihenfolge spielt keine Rolle.' + SEC('Die Administration sieht nur den Hinweis «nachträglich visiert». Das ist kein Fehler.'),
    run: async () => { await stvHome(); await stvEntry(dISO(4), 'GL', '11:30', '17:30', true); await leiHome(); await click('lei', '#sc'); await type('lei', '#vn', 'M. Brunner'); await click('lei', '#ok'); await waitFor('lei', '.qrbox svg'); await stvHome(); await click('stv', '#scanq'); await waitFor('stv', '.ok-box'); } },
  { t: 'Beide Seiten senden ihre Datei', f: ['stv', 'lei'], x: 'Die Stellvertretung sendet ihre Abrechnung, die Leitung exportiert die Visa. Beides geht per dienstlicher Mail an die Administration. Oben rechts lassen sich die Dateien ansehen.' + SEC('Die Dateien enthalten nur, was heute auf dem Zettel steht, plus Signatur und Zeitstempel.'),
    run: async () => { await stvHome(); await click('stv', '#send'); await click('stv', '#go'); await sleep(600); await closeSheet('stv'); await leiHome(); await click('lei', '#ex'); } },
  { t: 'Die Administration gleicht automatisch ab', f: ['adm'], x: 'Beide Dateien werden eingelesen. Visum und Angaben passen zusammen, also «stimmt». Hinweise zeigen Besonderheiten wie «nachträglich visiert».' + SEC('Geprüft werden Signatur, Code, Stammdaten (Name und Funktion zur Personalnummer), Überschneidungen und Tagestotal. Abgerechnet werden immer die signierten Werte.'),
    run: async () => { await loadIntoAdmin(FILES.stv, FILES.lei, true); } },
  { t: 'Abrechnen: Excel für die Lohnabrechnung', f: ['adm'], x: 'Die ausgewählten Einsätze gehen als Excel-Datei weiter. Danach sind sie als abgerechnet gespeichert.' + SEC('Wird eine Datei nochmals eingereicht, erscheinen die Einsätze als «schon abgerechnet». Doppelte Auszahlung ist ausgeschlossen.'),
    run: async () => { await click('adm', '#abr'); await sleep(500); } },
  { t: 'Jetzt Sie: Versuchen Sie, das System zu überlisten', f: [], x: 'Wechseln Sie oben zu <b>«Angriffe ausprobieren»</b>. Dort lassen sich die Dateien manipulieren, und die Administration zeigt, was sie erkennt.', run: async () => { } },
];

function showStep() {
  const s = STEPS[STEP];
  $('#stepno').innerHTML = STEP + '<small>/' + (STEPS.length - 1) + '</small>';
  $('#st-title').textContent = s.t; $('#st-text').innerHTML = s.x;
  $('#next').textContent = STEP === STEPS.length - 1 ? 'Zu den Angriffen ▶' : 'Weiter ▶';
  spot(...s.f); layout();
}
async function next() {
  if (BUSY) return;
  if (STEP === STEPS.length - 1) return setMode('angriffe');
  BUSY = true; $('#next').disabled = true;
  STEP++; showStep();
  try { await STEPS[STEP].run(); } catch (e) { console.error(e); say('Dieser Schritt hat nicht geklappt: ' + e.message, 5000); }
  BUSY = false; $('#next').disabled = false;
}

/* ---------- Administration bedienen ---------- */
const mkFile = (r, f) => new (W(r).File)([JSON.stringify(f.obj)], f.name, { type: 'application/json' });
async function loadIntoAdmin(stv, lei, keep) {
  const A = W('adm').STV_DEMO; if (!keep) A.reset();
  const list = []; if (lei) list.push(mkFile('adm', lei)); if (stv) list.push(mkFile('adm', stv));
  await A.load(list); await sleep(300);
  return { rows: A.rows(), msgs: A.msgs() };
}

/* ---------- Angriffe ---------- */
const clone = o => JSON.parse(JSON.stringify(o));
const plus = (hhmm, min) => minToHHMM(hhmmToMin(hhmm) + min);
async function forgedVisa(code, secret) {
  const e = unpackEntry(code);
  const v = { ...e, keyId: 1, visiertVon: 'M. Brunner', visiertAm: dISO(1) + 'T17:45', pinTyp: 'stamm', ferienVon: '', ferienBis: '', nachtraeglichTage: 1, storniert: false, stornoAm: '' };
  v.tag = await quittTag(secret, code); v.sig = await visumSig(secret, v); return v;
}
const ATTACKS = [
  { id: 'a1', t: 'Mehr Stunden in die eigene Datei schreiben', p: 'Die Stellvertretung ändert in ihrer Datei das Ende des ersten Einsatzes um 3 Stunden.',
    run: async () => { const s = clone(FILES.stv.obj); const e = s.eintraege[0]; e.bis = plus(e.bis, 180); e.stunden += 3; return [{ name: FILES.stv.name, obj: s }, FILES.lei, e.code]; } },
  { id: 'a2', t: 'Einen neuen Code mit mehr Stunden erzeugen', p: 'Sie baut einen ganz neuen, gültigen Einsatz-Code mit 3 Stunden mehr, passend zur Datei.',
    run: async () => { const s = clone(FILES.stv.obj); const e = s.eintraege[0]; const u = unpackEntry(e.code); u.bis += 180; e.code = packEntry(u); e.bis = minToHHMM(u.bis); e.stunden += 3; e.quittung = null; return [{ name: FILES.stv.name, obj: s }, FILES.lei, e.code]; } },
  { id: 'a3', t: 'Ein Visum selbst ausstellen', p: 'Ein erfundener Einsatz wird mit einem selbst gebauten Visum eingereicht, signiert mit einem geratenen Schlüssel.',
    run: async () => { const s = clone(FILES.stv.obj), l = clone(FILES.lei.obj); const e = { persNr: s.persNr, datum: dISO(2), von: 780, bis: 1080, funktion: 'FABE', mittag: true, standortNr: 1 }; const code = packEntry(e); const v = await forgedVisa(code, randomB32(26)); s.eintraege.push({ code, datum: e.datum, von: '13:00', bis: '18:00', stunden: 5, funktion: 'FABE', mittag: true, standortNr: 1, quittung: { tag: v.tag, name: 'M. Brunner', am: '' } }); l.visa.push(v); return [{ name: FILES.stv.name, obj: s }, { name: FILES.lei.name, obj: l }, code]; } },
  { id: 'a4', t: 'Die Zeit im Visum der Leitung ändern', p: 'Jemand öffnet die Leitungs-Datei und verlängert im Visum das Ende um 3 Stunden.',
    run: async () => { const l = clone(FILES.lei.obj); l.visa[0].bis += 180; return [FILES.stv, { name: FILES.lei.name, obj: l }, l.visa[0].code]; } },
  { id: 'a5', t: 'Den Namen der visierenden Person ändern', p: 'Im Visum wird «M. Brunner» durch einen anderen Namen ersetzt.',
    run: async () => { const l = clone(FILES.lei.obj); l.visa[0].visiertVon = 'Frau Chefin'; return [FILES.stv, { name: FILES.lei.name, obj: l }, l.visa[0].code]; } },
  { id: 'a6', t: 'Schadcode in die Datei einschleusen', p: 'Ein Feld enthält Programmcode, der im Admin den Schlüssel stehlen soll.',
    run: async () => { const s = clone(FILES.stv.obj); s.eintraege[0].von = '<img src=x onerror="alert(localStorage.adm_data_v1)">'; return [{ name: FILES.stv.name, obj: s }, FILES.lei, s.eintraege[0].code]; } },
  { id: 'a7', t: 'Unter fremder Personalnummer abrechnen', p: 'Die Datei wird auf eine andere Person umgeschrieben (Nora Frei, 345678), die Codes bleiben.',
    run: async () => { const s = clone(FILES.stv.obj); s.persNr = '345678'; s.name = 'Nora Frei'; return [{ name: 'stv_345678.json', obj: s }, FILES.lei, s.eintraege[0].code]; } },
  { id: 'a8', t: 'Dieselbe Abrechnung zweimal einreichen', p: 'Die Datei wird abgerechnet und eine Woche später nochmals geschickt.',
    run: async () => { await loadIntoAdmin(FILES.stv, FILES.lei); W('adm').STV_DEMO.abrechnenAlle(); return [FILES.stv, null, FILES.stv.obj.eintraege[0].code, true]; } },
];
const BENIGN = /nachträglich visiert|ohne Quittung|^Ferien-PIN$/;
function verdict(rows, msgs, code) {
  const r = rows.find(x => x.code === code) || null;
  const rej = msgs.find(m => /nicht eingelesen/.test(m));
  if (!r && rej) return ['ok', 'Abgewiesen: Der Eintrag mit unzulässigem Inhalt wurde nicht eingelesen. Es wurde kein Code ausgeführt.'];
  if (!r) return ['info', msgs.join(' · ') || 'Kein Ergebnis'];
  const h = r.hinweise.filter(x => !BENIGN.test(x));
  if (r.status === 'ok' && r.sel) return ['bad', 'Würde abgerechnet: ' + r.label.replace(/^\S+ /, '') + (h.length ? ' · ' + h.join(' · ') : '')];
  if (r.status === 'ok') return ['ok', 'Erkannt: ' + h.join(' · ') + '. Nicht zur Abrechnung vorgewählt; gezählt würden ohnehin die Visum-Werte ' + r.final.von + '–' + r.final.bis + '.'];
  return ['ok', 'Erkannt: «' + r.label.replace(/^\S+ /, '') + '»' + (h.length ? ' · ' + h.join(' · ') : '') + '. Nicht zur Abrechnung vorgewählt.'];
}
async function ensurePrepared() {
  if (FILES.stv && FILES.lei) return true;
  say('Der Ablauf wird kurz im Schnelldurchlauf vorbereitet …', 4000);
  BUSY = true; SPEED = 0.15;
  try { while (STEP < 8) { STEP++; await STEPS[STEP].run(); } } catch (e) { say('Vorbereitung fehlgeschlagen: ' + e.message, 6000); }
  SPEED = 1; BUSY = false; renderFiles(); return !!(FILES.stv && FILES.lei);
}
function renderAttacks() {
  const el = $('#atk');
  el.innerHTML = `<h2>Versuchen Sie, das System zu überlisten</h2>
  <div class="lead">Jeder Angriff verändert die echten Dateien aus dem Ablauf und liest sie in die Administration rechts ein. Das Ergebnis erscheint hier und in der Tabelle.</div>
  ${ATTACKS.map(a => `<div class="card"><div class="hd"><div><h3>${esc(a.t)}</h3><p>${esc(a.p)}</p></div><button data-a="${a.id}">Ausprobieren</button></div><div class="res hidden" id="r-${a.id}"></div></div>`).join('')}
  <div class="card own"><h3>Eigene Manipulation</h3><p>Die beiden Dateien beliebig verändern und einlesen.</p>
  <div class="two"><div><label>StV-Datei</label><textarea id="own-stv" spellcheck="false"></textarea></div><div><label>Leitungs-Datei</label><textarea id="own-lei" spellcheck="false"></textarea></div></div>
  <div class="btns"><button id="own-go" class="pri" style="font-size:15px;padding:8px 18px">In die Administration einlesen</button><button id="own-reset">Originale wiederherstellen</button></div><div class="res hidden" id="r-own"></div></div>`;
  const fillOwn = () => { $('#own-stv').value = FILES.stv ? JSON.stringify(FILES.stv.obj, null, 1) : ''; $('#own-lei').value = FILES.lei ? JSON.stringify(FILES.lei.obj, null, 1) : ''; };
  fillOwn();
  $('#own-reset').onclick = fillOwn;
  $('#own-go').onclick = async () => {
    if (BUSY) return;
    if (!$('#own-stv').value.trim()) { if (!await ensurePrepared()) return; fillOwn(); }
    const out = $('#r-own'); out.classList.remove('hidden');
    let s, l; try { s = JSON.parse($('#own-stv').value); l = JSON.parse($('#own-lei').value); } catch (e) { out.className = 'res bad'; out.textContent = 'Kein gültiges JSON: ' + e.message; return; }
    const { rows, msgs } = await loadIntoAdmin({ name: 'stv_eigene.json', obj: s }, { name: 'visa_eigene.json', obj: l });
    out.className = 'res info';
    out.innerHTML = esc(msgs.join(' · ')) + '<br>' + rows.map(r => `<b>${esc(r.persNr)}</b> ${esc(r.label)}${r.sel ? ' · wird abgerechnet' : ' · nicht vorgewählt'}${r.hinweise.length ? ' · ' + esc(r.hinweise.join(' · ')) : ''}`).join('<br>');
  };
  $$('[data-a]', el).forEach(b => b.onclick = async () => {
    if (BUSY) return;
    if (!await ensurePrepared()) { const o = $('#r-' + b.dataset.a); o.className = 'res bad'; o.textContent = 'Der Ablauf konnte nicht vorbereitet werden. Bitte «Neu starten».'; return; }
    BUSY = true; spot('adm');
    const a = ATTACKS.find(x => x.id === b.dataset.a), out = $('#r-' + a.id);
    try {
      if (!$('#own-stv').value.trim()) fillOwn();
      const [s, l, code, keep] = await a.run();
      const { rows, msgs } = await loadIntoAdmin(s, l, keep);
      const [cls, txt] = verdict(rows, msgs, code);
      out.className = 'res ' + cls; out.textContent = (cls === 'ok' ? '✓ ' : '') + txt;
    } catch (e) { out.className = 'res bad'; out.textContent = 'Fehler: ' + e.message; }
    BUSY = false;
  });
}
function setMode(m) {
  MODE = m; $$('.modes button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  const atk = m === 'angriffe';
  $('#atk').classList.toggle('hidden', !atk); $('#d-stv').classList.toggle('off', atk); $('#d-lei').classList.toggle('off', atk);
  $('#story').classList.toggle('hidden', atk);
  if (atk) { renderAttacks(); spot('adm'); } else showStep();
  layout();
}
$$('.modes button').forEach(b => b.onclick = () => setMode(b.dataset.m));

/* ---------- Start ---------- */
async function start() {
  ['stv_data_v1', 'lei_data_v1', 'adm_data_v1'].forEach(k => localStorage.removeItem(k));
  for (const k in FILES) delete FILES[k]; CSV = null; renderFiles();
  STEP = 0; BUSY = true; $('#next').disabled = true; showStep();
  await Promise.all(ROLES.map(loadFrame));
  W('adm').STV_DEMO.setStamm(STAMM);
  BUSY = false; $('#next').disabled = false; layout();
}
$('#next').onclick = next;
$('#restart').onclick = () => { if (!BUSY) { setMode('ablauf'); start(); } };
const advanceKey = e => { if (MODE === 'ablauf' && ['ArrowRight', 'PageDown'].includes(e.key) && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { e.preventDefault(); next(); } };
document.addEventListener('keydown', advanceKey);
layout(); start();

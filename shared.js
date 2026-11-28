/* =====================================================================
   StV-Erfassung · gemeinsame Bausteine für alle drei Seiten
   Hier oben stehen die Einstellungen, die ihr anpassen könnt.
   ===================================================================== */
const CONFIG = {
  // Standorte: «nr» darf nie geändert oder neu vergeben werden (steckt im Code).
  // Neue Standorte einfach mit der nächsten freien Nummer anhängen (1–127).
  standorte: [
    { nr: 1, name: 'Test-Betreuung 1' },
    { nr: 2, name: 'Test-Betreuung 2' },
    { nr: 3, name: 'Test-Betreuung 3' },
    { nr: 4, name: 'Test-Betreuung 4' },
    { nr: 5, name: 'Test-Betreuung 5' },
    { nr: 6, name: 'Test-Betreuung 6' },
  ],
  // Reihenfolge nie ändern, nur hinten ergänzen (max. 8 Funktionen).
  funktionen: ['BL', 'GL', 'FABE', 'BM', 'Assistenz'],
  adminEmail: 'stv-admin@example.ch',      // Adresse der Administration (Demo)
  nachtraeglichAbTagen: 3,                  // ab wann ein Visum als «nachträglich» gilt
  maxNachtraeglichTage: 60,                 // ältere Einsätze kann die Leitung nicht mehr visieren
  fruehesterBeginn: '05:30',                // Plausibilität: kein Einsatz vor dieser Zeit
  spaetestesEnde: '22:30',                  //               und nach dieser Zeit
  maxStundenEinsatz: 12,                    //               höchstens so viele Stunden pro Einsatz
  maxStundenTag: 12,                        // Admin: Hinweis, wenn eine Person an einem Tag mehr arbeitet
  // QR-Lesen auf iPhones: lokale Kopie (jsQR.js im selben Ordner), kein Nachladen aus dem Internet
  jsqrUrls: ['./jsQR.js?v=8'],
};

/* ---------- kleine Helfer ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const standortName = nr => (CONFIG.standorte.find(s => s.nr === nr) || {}).name || ('Standort ' + nr);
const minToHHMM = m => pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
const hhmmToMin = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const nowLocalISO = () => { const d = new Date(); return todayISO() + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const fmtDate = iso => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(y, m - 1, d); return WT[dt.getDay()] + ' ' + d + '.' + m + '.' + y; };
const fmtDateShort = iso => { const [, m, d] = iso.split('-').map(Number); return d + '.' + m + '.'; };
const fmtStamp = s => s ? s.replace(/^(\d{4})-(\d\d)-(\d\d)T(\d\d:\d\d).*$/, (_, y, m, d, t) => (+d) + '.' + (+m) + '.' + y + ' ' + t) : '';
const hours = (von, bis) => Math.round((bis - von) / 60 * 100) / 100;
const daysBetween = (a, b) => Math.round((Date.UTC(...b.split('-').map((x, i) => i === 1 ? x - 1 : +x)) - Date.UTC(...a.split('-').map((x, i) => i === 1 ? x - 1 : +x))) / 86400000);

function store(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
}
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { alert('Speichern nicht möglich: ' + e.message); return false; } }
function askPersist() { try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { } }

function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function sheet(html, onMount) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = '<div class="sheet">' + html + '</div>';
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  const close = () => ov.remove();
  if (onMount) onMount(ov.firstChild, close);
  return close;
}

/* ---------- Crockford-Base32 (ohne 0/O-, 1/I/L-Verwechslung) ---------- */
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function b32norm(s) {
  return String(s).toUpperCase().replace(/[\s\-_.]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}
function bigToB32(n, len) { let s = ''; for (let i = 0; i < len; i++) { s = B32[Number(n & 31n)] + s; n >>= 5n; } return s; }
function b32ToBig(s) { let n = 0n; for (const c of s) { const v = B32.indexOf(c); if (v < 0) return null; n = (n << 5n) | BigInt(v); } return n; }
function bytesToB32(bytes, len) { let n = 0n; for (const b of bytes) n = (n << 8n) | BigInt(b); const bits = bytes.length * 8; const need = len * 5; n = need >= bits ? n << BigInt(need - bits) : n >> BigInt(bits - need); return bigToB32(n, len); }
function b32ToBytes(s, nBytes) { let n = b32ToBig(s); const bits = s.length * 5; if (bits > nBytes * 8) n >>= BigInt(bits - nBytes * 8); const out = new Uint8Array(nBytes); for (let i = nBytes - 1; i >= 0; i--) { out[i] = Number(n & 255n); n >>= 8n; } return out; }
const group4 = s => s.match(/.{1,4}/g).join('-');

/* ---------- Einsatz-Code: 80 Bit = 16 Zeichen, mit 17-Bit-Prüfsumme ----------
   Pers.-Nr. 20 | Tag seit 1.1.2025 14 | von/5 Min 9 | bis/5 Min 9 | Funktion 3 + Mittag 1 | Standort 7 | Prüfung 17 */
const EPOCH = Date.UTC(2025, 0, 1);
function dayIndex(iso) { const [y, m, d] = iso.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000); }
function dayISO(idx) { const d = new Date(EPOCH + idx * 86400000); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
function check17(v63) { // FNV-1a über 8 Bytes
  let h = 0x811c9dc5;
  for (let i = 7; i >= 0; i--) { h ^= Number((v63 >> BigInt(i * 8)) & 255n); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12;
  return BigInt(h & 0x1ffff);
}
function packEntry(e) {
  let v = BigInt(+e.persNr);
  v = (v << 14n) | BigInt(dayIndex(e.datum));
  v = (v << 9n) | BigInt(e.von / 5);
  v = (v << 9n) | BigInt(e.bis / 5);
  v = (v << 4n) | BigInt((CONFIG.funktionen.indexOf(e.funktion) << 1) | (e.mittag ? 1 : 0));
  v = (v << 7n) | BigInt(e.standortNr);
  v = (v << 17n) | check17(v);
  return bigToB32(v, 16);
}
function unpackEntry(code) {
  const c = b32norm(code);
  if (c.length !== 16) return { err: 'Der Code hat ' + c.length + ' statt 16 Zeichen.' };
  const v = b32ToBig(c); if (v === null) return { err: 'Der Code enthält ein ungültiges Zeichen.' };
  const body = v >> 17n;
  if (check17(body) !== (v & 0x1ffffn)) return { err: 'Prüfziffer stimmt nicht: Bitte Code nochmals vergleichen.' };
  let b = body;
  const standortNr = Number(b & 127n); b >>= 7n;
  const fl = Number(b & 15n); b >>= 4n;
  const bis = Number(b & 511n) * 5; b >>= 9n;
  const von = Number(b & 511n) * 5; b >>= 9n;
  const day = Number(b & 16383n); b >>= 14n;
  const persNr = String(Number(b)).padStart(6, '0');
  const e = { code: c, persNr, datum: dayISO(day), von, bis, funktion: CONFIG.funktionen[fl >> 1] || '?', mittag: !!(fl & 1), standortNr };
  if (bis <= von) return { err: 'Ungültige Zeiten im Code.' };
  if (e.funktion === '?') return { err: 'Unbekannte Funktion im Code.' };
  return e;
}
/** Plausibilität eines Einsatzes: leer = in Ordnung, sonst Begründung */
function plausi(e) {
  const a = hhmmToMin(CONFIG.fruehesterBeginn), z = hhmmToMin(CONFIG.spaetestesEnde);
  if (e.von < a) return 'Beginn vor ' + CONFIG.fruehesterBeginn + ' Uhr ist nicht möglich.';
  if (e.bis > z) return 'Ende nach ' + CONFIG.spaetestesEnde + ' Uhr ist nicht möglich.';
  if (e.bis - e.von > CONFIG.maxStundenEinsatz * 60) return 'Ein Einsatz dauert höchstens ' + CONFIG.maxStundenEinsatz + ' Stunden.';
  return '';
}
const overlaps = (a, b) => a.von < b.bis && b.von < a.bis;
const QR_ENTRY = 'STV1:', QR_QUITT = 'QT1:', QR_SETUP = 'LS1:';

/* ---------- Kryptografie (HMAC-SHA-256 mit dem Standort-Schlüssel) ---------- */
async function hmacB32(secretB32, msg, len) {
  const key = await crypto.subtle.importKey('raw', b32ToBytes(secretB32, 16), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
  return bytesToB32(sig.slice(0, Math.ceil(len * 5 / 8)), len);
}
async function sha256Hex(s) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
function randomB32(len) { const b = crypto.getRandomValues(new Uint8Array(Math.ceil(len * 5 / 8))); return bytesToB32(b, len); }
const quittTag = (secret, code) => hmacB32(secret, 'Q|' + code, 4);
function visumCanon(v) {
  return ['V1', v.code, v.keyId, v.standortNr, v.visiertVon, v.visiertAm, v.pinTyp, v.ferienVon || '', v.ferienBis || '', v.storniert ? 1 : 0, v.stornoAm || '', v.tag].join('|');
}
const visumSig = (secret, v) => hmacB32(secret, visumCanon(v), 16);

/* ---------- QR-Code als SVG ---------- */
function qrSVG(text) {
  const q = new QRLib.QRCode(-1, QRLib.ECL.M); q.addData(text); q.make();
  const n = q.getModuleCount(), qz = 4, size = n + qz * 2; let p = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) p += `M${c + qz} ${r + qz}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${p}" fill="#000"/></svg>`;
}

/* ---------- QR-Code scannen (Kamera) ---------- */
let _jsqrPromise = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve();
  if (_jsqrPromise) return _jsqrPromise;
  _jsqrPromise = new Promise((res, rej) => {
    const urls = [...CONFIG.jsqrUrls];
    const next = () => {
      const u = urls.shift(); if (!u) { _jsqrPromise = null; return rej(new Error('QR-Leser konnte nicht geladen werden')); }
      const s = document.createElement('script'); s.src = u;
      s.onload = () => window.jsQR ? res() : next(); s.onerror = () => { s.remove(); next(); };
      document.head.appendChild(s);
    };
    next();
  });
  return _jsqrPromise;
}
async function makeDetector() {
  if ('BarcodeDetector' in window) {
    try { const f = await BarcodeDetector.getSupportedFormats(); if (f.includes('qr_code')) { const d = new BarcodeDetector({ formats: ['qr_code'] }); return async src => { const r = await d.detect(src); return r[0] ? r[0].rawValue : null; }; } } catch (e) { }
  }
  await loadJsQR();
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  return async src => {
    const w0 = src.videoWidth || src.width, h0 = src.videoHeight || src.height; if (!w0) return null;
    const k = Math.min(1, 800 / Math.max(w0, h0)); cv.width = Math.round(w0 * k); cv.height = Math.round(h0 * k);
    cx.drawImage(src, 0, 0, cv.width, cv.height);
    const img = cx.getImageData(0, 0, cv.width, cv.height);
    const r = window.jsQR(img.data, cv.width, cv.height, { inversionAttempts: 'attemptBoth' });
    return r ? r.data : null;
  };
}
/** Öffnet die Kamera. Liefert den gelesenen Text oder null (abgebrochen). */
function scanQR(hint) {
  return new Promise(resolve => {
    const ov = document.createElement('div'); ov.className = 'scan';
    ov.innerHTML = `<div style="font-size:18px;font-weight:600">${esc(hint || 'QR-Code scannen')}</div>
      <div class="frame"><video playsinline muted autoplay></video></div>
      <div class="msg" style="font-size:15px;color:#ccc;text-align:center">Kamera wird gestartet …</div>
      <label class="btn" style="max-width:460px;background:#333;color:#fff;border-color:#555">Foto statt Video<input type="file" accept="image/*" capture="environment" hidden></label>
      <button class="cancel" style="background:#fff">Abbrechen</button>`;
    document.body.appendChild(ov);
    const video = $('video', ov), msg = $('.msg', ov);
    let stream = null, done = false, det = null;
    const finish = val => { if (done) return; done = true; if (stream) stream.getTracks().forEach(t => t.stop()); ov.remove(); resolve(val); };
    $('.cancel', ov).onclick = () => finish(null);
    $('input', ov).onchange = async ev => {
      const f = ev.target.files[0]; if (!f) return;
      try { det = det || await makeDetector(); const bmp = await createImageBitmap(f); const r = await det(bmp); if (r) finish(r); else msg.textContent = 'Kein QR-Code auf dem Foto erkannt. Nochmals versuchen.'; }
      catch (e) { msg.textContent = 'Foto konnte nicht gelesen werden: ' + e.message; }
    };
    (async () => {
      try { det = await makeDetector(); }
      catch (e) { msg.textContent = 'QR-Leser nicht verfügbar (keine Internetverbindung?). Bitte Code eintippen.'; return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream; await video.play(); msg.textContent = 'QR-Code in den Rahmen halten';
      } catch (e) { msg.textContent = 'Kamera nicht verfügbar oder nicht erlaubt. Mit «Foto statt Video» geht es auch, sonst Code eintippen.'; return; }
      const loop = async () => {
        if (done) return;
        try { const r = await det(video); if (r) { if (navigator.vibrate) navigator.vibrate(60); return finish(r); } } catch (e) { }
        setTimeout(loop, 180);
      };
      loop();
    })();
  });
}

/* ---------- Datei teilen oder herunterladen ---------- */
async function shareOrDownload(filename, obj, title) {
  const text = JSON.stringify(obj, null, 1);
  const file = new File([text], filename, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: title || filename, text: title || '' });
      return 'shared';
    }
  } catch (e) { if (e.name === 'AbortError') return 'aborted'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return 'downloaded';
}
function readJSONFile(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { try { res(JSON.parse(r.result)); } catch (e) { rej(new Error(file.name + ' ist keine gültige Datei')); } }; r.onerror = () => rej(r.error); r.readAsText(file); });
}
const cleanPaste = s => String(s ?? '').replace(/[\u200B-\u200D\uFEFF\u00A0\s]/g, '');
function codeInputBehaviour(inp, len = 16, prefix = QR_ENTRY) { // grosse Buchstaben, automatisch Bindestriche, eingefügten Text bereinigen
  inp.addEventListener('input', () => {
    let v = cleanPaste(inp.value); const p = v.toUpperCase().lastIndexOf(prefix); if (p >= 0) v = v.slice(p + prefix.length);
    const c = b32norm(v).replace(/[^0-9A-Z]/g, '').slice(0, len); inp.value = len === 16 && c ? group4(c) : c;
  });
}
/** Einrichtungs-Code lesen, tolerant gegenüber Leerzeichen, Zeilenumbrüchen und Zusatztext */
function parseSetup(txt) {
  const s = cleanPaste(txt).toUpperCase();
  const m = /LS1:(\d+):(\d+):([0-9A-Z]+)/.exec(s);
  if (!m) return { err: s.length ? 'Im eingefügten Text fehlt der Anfang «LS1:». Bitte den ganzen Code kopieren (Knopf «Code kopieren» in der Administration).' : 'Bitte den Einrichtungs-Code einfügen.' };
  const secret = b32norm(m[3]);
  if (secret.length !== 26 || [...secret].some(c => !B32.includes(c))) return { err: 'Der Code ist unvollständig (' + secret.length + ' von 26 Zeichen nach der zweiten Zahl). Bitte nochmals kopieren.' };
  return { nr: +m[1], keyId: +m[2], secret };
}
/** Text in die Zwischenablage, mit Rückfall für ältere Browser */
async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); toast('Kopiert'); return true; } catch (e) { }
  const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, txt.length);
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { }
  ta.remove(); toast(ok ? 'Kopiert' : 'Kopieren nicht möglich: bitte Code im Feld markieren und kopieren'); return ok;
}

/* ---------- Grosser Zurück-Knopf ganz unten (spiegelt den kleinen Knopf oben links) ---------- */
function enableBottomBack() {
  const app = $('#app');
  const apply = () => {
    if (app.querySelector('.backbig')) return;
    const top = app.querySelector('.back'); if (!top) return;
    const ex = app.querySelector('#back');
    if (ex) { ex.classList.add('backbig'); ex.textContent = '‹ Zurück'; app.appendChild(ex); return; }
    let b;
    if (top.tagName === 'A') { b = document.createElement('a'); b.href = top.getAttribute('href'); b.className = 'btn backbig'; b.textContent = '‹ Zur Startseite'; }
    else { b = document.createElement('button'); b.className = 'backbig'; b.textContent = '‹ Zurück'; b.onclick = () => top.click(); }
    app.appendChild(b);
  };
  new MutationObserver(apply).observe(app, { childList: true });
  apply();
}

// Genera: iconos PNG, data/datos.enc (datos cifrados con el código del grupo) y
// crucero-offline.html (un solo archivo SIN cifrar, para pasar por WhatsApp; no se publica).
//
// Uso (PowerShell):   $env:CRUCERO_CODE="tu código"; node build.js
// Uso (bash):         CRUCERO_CODE="tu código" node build.js
//
// Los datos editables están en data-src/ (esa carpeta NO se sube a GitHub).
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

/* --- Iconos --- */
function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const s = size / 512;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const X = x / s, Y = y / s;
      let c = [11, 27, 46]; // fondo
      if (Y > 330) c = [20, 60, 100]; // mar
      if (Y > 330 && Y < 350 && (Math.floor(X / 40) % 2 === 0)) c = [30, 85, 135];
      if (Y > 250 && Y <= 330 && X > 110 && X < 402 - (Y - 250) * 0.5) c = [244, 248, 252]; // casco
      if (Y > 190 && Y <= 250 && X > 170 && X < 340) c = [255, 200, 61]; // cubierta
      if (Y > 130 && Y <= 190 && X > 230 && X < 290) c = [244, 248, 252]; // chimenea
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = c[0]; raw[i + 1] = c[1]; raw[i + 2] = c[2]; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.writeFileSync(path.join(__dirname, 'icon-192.png'), png(192));
fs.writeFileSync(path.join(__dirname, 'icon-512.png'), png(512));

/* --- Datos --- */
const PRIVATE = ['itinerario', 'escalas', 'checklist', 'info'];
const PLAIN = ['lugares', 'map-layers'];
const priv = {};
for (const f of PRIVATE) priv[f] = JSON.parse(read(`data-src/${f}.json`));

/* --- Cifrado: AES-256-GCM, clave derivada con PBKDF2 (200.000 iteraciones) --- */
const code = (process.env.CRUCERO_CODE || '').trim();
if (!code) {
  console.error('Falta el código. Ejemplo:  CRUCERO_CODE="mi código" node build.js');
  process.exit(1);
}
const ITER = 200000;
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(code, salt, ITER, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update(JSON.stringify(priv), 'utf8'), cipher.final(), cipher.getAuthTag()]);
fs.writeFileSync(
  path.join(__dirname, 'data/datos.enc'),
  JSON.stringify({ v: 1, iter: ITER, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64') })
);

/* --- Archivo único (sin cifrar; solo para pasar por mensaje, no se publica) --- */
const data = { ...priv };
for (const f of PLAIN) data[f] = JSON.parse(read(`data/${f}.json`));
const html = read('index.html')
  .replace(/<link rel="manifest"[^>]*>\s*/, '')
  .replace(/<link rel="icon"[^>]*>\s*/, '')
  .replace(/<link rel="stylesheet" href="vendor[^>]*>\s*/, '')
  .replace(/<script src="vendor[^>]*><\/script>\s*/g, '')
  .replace('<link rel="stylesheet" href="styles.css">', `<style>${read('styles.css')}</style>`)
  .replace('<script src="app.js"></script>', () => `<script>window.__DATA=${JSON.stringify(data)};</script>\n<script>${read('app.js')}</script>`);
fs.writeFileSync(path.join(__dirname, 'crucero-offline.html'), html);
console.log('OK: iconos, data/datos.enc (cifrado) y crucero-offline.html generados');

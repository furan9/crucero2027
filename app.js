'use strict';

const PLAIN = ['lugares', 'map-layers'];
const PRIVATE = ['itinerario', 'escalas', 'checklist', 'info'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

let D = {};
let simDate = null; // fecha simulada para probar (YYYY-MM-DD)
let tab = 'hoy';
let timer = null;

const ICON = { tunez: '🕌', palermo: '⛪', napoles: '🍕', livorno: '🚆', marsella: '⚓' };
function iconoDia(d) {
  if (d.escala) return ICON[d.escala];
  return d.titulo.includes('embarque') ? '🛳️' : d.titulo.includes('desembarque') ? '🚗' : '🌊';
}
function tipoDia(d) {
  if (d.escala) return 'puerto';
  return d.titulo.includes('Navegación') ? 'mar' : 'base';
}
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function store(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) { return null; }
}

async function loadData() {
  if (window.__DATA) return window.__DATA;
  const out = {};
  for (const f of PLAIN) out[f] = await (await fetch(`data/${f}.json`)).json();
  const enc = await (await fetch('data/datos.enc', { cache: 'no-cache' }).catch(() => fetch('data/datos.enc'))).json();
  let code = store('codigo');
  let msg = '';
  for (;;) {
    if (code) {
      try {
        Object.assign(out, await descifrar(enc, code));
        store('codigo', code);
        return out;
      } catch (e) { msg = 'Código incorrecto.'; store('codigo', null); }
    }
    code = await pedirCodigo(msg);
  }
}

const dec64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

async function descifrar(enc, code) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code.trim()), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: dec64(enc.salt), iterations: enc.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const txt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: dec64(enc.iv) }, key, dec64(enc.ct));
  return JSON.parse(new TextDecoder().decode(txt));
}

function pedirCodigo(msg) {
  return new Promise((resolve) => {
    $('#main').innerHTML = `<div class="card hero base"><div class="heroic">🔐</div><h2>Código de acceso</h2></div>
      <div class="card"><p>Escribe el código del grupo. Solo hace falta la primera vez (con conexión).</p>
      <input id="codigo" type="password" autocomplete="off" placeholder="Código" class="codigo">
      <div class="muted" style="color:var(--ac)">${esc(msg)}</div>
      <button class="btn" id="entrar">Entrar</button></div>`;
    const go_ = () => { const v = $('#codigo').value.trim(); if (v) resolve(v); };
    $('#entrar').onclick = go_;
    $('#codigo').onkeydown = (ev) => { if (ev.key === 'Enter') go_(); };
  });
}

function now() {
  if (simDate) {
    const t = new Date();
    const [y, m, d] = simDate.split('-').map(Number);
    return new Date(y, m - 1, d, t.getHours(), t.getMinutes(), t.getSeconds());
  }
  return new Date();
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function at(fecha, hhmm) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi, 0);
}

function fechaLarga(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIAS[dt.getDay()]} ${d} de ${MESES[m - 1]}`;
}

function fmtCuenta(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
}

/* ---------- Vistas ---------- */

function planCard(d) {
  return `<div class="card"><h3>${esc(d.plan_titulo || 'Plan')}</h3><table>${d.plan
    .map((h) => `<tr><td class="hh">${esc(h.hora)}</td><td>${esc(h.texto)}</td></tr>`).join('')}</table></div>`;
}

function viewHoy() {
  const it = D.itinerario;
  const hoy = ymd(now());
  const dia = it.find((d) => d.fecha === hoy);
  let html = '';

  if (!dia) {
    const primero = it[0].fecha;
    if (hoy < primero) {
      const dias = Math.ceil((at(primero, '00:00') - now()) / 86400000);
      html += `<div class="card hero base"><div class="heroic">🧳</div><h2>Faltan ${dias} día${dias === 1 ? '' : 's'}</h2><p>El crucero empieza el ${fechaLarga(primero)} en Barcelona.</p></div>`;
    } else {
      html += `<div class="card hero base"><div class="heroic">🎉</div><h2>¡Crucero terminado!</h2><p>Esperamos que lo hayáis disfrutado.</p></div>`;
    }
  } else {
    html += `<div class="card hero ${tipoDia(dia)}"><div class="heroic">${iconoDia(dia)}</div><div class="muted">Día ${dia.dia} · ${fechaLarga(dia.fecha)}</div><h2>${esc(dia.titulo)}</h2></div><div class="card">`;
    if (dia.embarque) html += `<div class="row"><span>🎫 Embarque</span><b>${dia.embarque}</b></div>`;
    if (dia.llegada) html += `<div class="row"><span>⚓ Llegada</span><b>${dia.llegada}</b></div>`;
    if (dia.salida) html += `<div class="row"><span>🛳️ Salida del barco</span><b>${dia.salida}</b></div>`;
    if (dia.limite) {
      html += `<div class="row warn"><span>⏰ Volver al barco antes de</span><b>${dia.limite}</b></div>`;
      html += `<div class="countdown"><div class="muted">Tiempo hasta la hora límite</div><div id="cuenta" data-target="${dia.fecha}T${dia.limite}"></div></div>`;
    } else if (dia.salida && dia.escala) {
      html += `<div class="countdown"><div class="muted">Tiempo hasta la salida</div><div id="cuenta" data-target="${dia.fecha}T${dia.salida}"></div></div>`;
    } else if (dia.salida) {
      html += `<div class="countdown"><div class="muted">Tiempo hasta la salida</div><div id="cuenta" data-target="${dia.fecha}T${dia.salida}"></div></div>`;
    }
    if (dia.nota) html += `<p class="nota">${esc(dia.nota)}</p>`;
    html += '</div>';
    if (dia.plan) html += planCard(dia);
    if (dia.escala) html += `<button class="btn" data-esc="${dia.escala}">📋 Ver plan de la escala</button>`;
  }

  html += `<details class="sim"><summary>Probar otra fecha</summary>
    <select id="simsel"><option value="">Fecha real del móvil</option>${it
      .map((d) => `<option value="${d.fecha}" ${simDate === d.fecha ? 'selected' : ''}>Día ${d.dia} · ${esc(d.titulo)}</option>`)
      .join('')}</select></details>`;
  return html;
}

function viewItinerario() {
  const hoy = ymd(now());
  return D.itinerario
    .map((d) => {
      const horas = [d.embarque && `Embarque ${d.embarque}`, d.llegada && `Llega ${d.llegada}`, d.salida && `Sale ${d.salida}`, d.limite && `Volver ${d.limite}`]
        .filter(Boolean)
        .join(' · ');
      return `<div class="card dia ${tipoDia(d)} ${d.fecha === hoy ? 'hoy' : ''} ${d.escala ? 'click' : ''}" ${d.escala ? `data-esc="${d.escala}"` : ''}>
        <div class="badge">${iconoDia(d)}</div>
        <div class="dbody"><div class="muted">Día ${d.dia} · ${fechaLarga(d.fecha)}</div>
        <h3>${esc(d.titulo)}</h3>
        ${horas ? `<div class="horas">${horas}</div>` : ''}
        ${d.nota ? `<p class="nota">${esc(d.nota)}</p>` : ''}</div>
      </div>${d.plan ? planCard(d) : ''}`;
    })
    .join('');
}

function list(title, arr) {
  if (!arr || !arr.length) return '';
  return `<h4>${title}</h4><ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
}

function viewOpcion(o) {
  return `<div class="card opcion"><h3>🌆 ${esc(o.titulo)}</h3><p>${esc(o.resumen)}</p>
    <h4>🕐 Horario sugerido</h4>
    <table>${o.horario.map((h) => `<tr><td class="hh">${esc(h.hora)}</td><td>${esc(h.texto)}</td></tr>`).join('')}</table>
    ${list('🚆 Cómo llegar', o.como_llegar)}${list('💶 Precios', o.precios)}${list('💡 Consejos', o.consejos)}</div>`;
}

function viewEscalas(id) {
  if (id) {
    const e = D.escalas[id];
    return `<button class="back" id="back">← Escalas</button>
      <div class="card hero puerto"><div class="heroic">${ICON[id]}</div><h2>${esc(e.nombre)}</h2></div><div class="card"><p>${esc(e.resumen)}</p>
      <h4>🕐 Horario sugerido</h4>
      <table>${e.horario.map((h) => `<tr><td class="hh">${esc(h.hora)}</td><td>${esc(h.texto)}</td></tr>`).join('')}</table>
      <h4>🚆 Cómo llegar</h4><p>${esc(e.como_llegar)}</p>
      ${list('💶 Precios', e.precios)}${list('💡 Consejos', e.consejos)}${list('🔀 Alternativas', e.alternativas)}</div>
      ${(e.opciones || []).map(viewOpcion).join('')}
      ${(D.lugares.escalas[id] || []).map((r) => `<button class="btn" data-map="${r}">🗺️ Mapa: ${esc(D.lugares.regiones[r].nombre)}</button>`).join('')}`;
  }
  return Object.entries(D.escalas)
    .map(([k, e]) => `<div class="card dia puerto click" data-esc="${k}"><div class="badge">${ICON[k]}</div><div class="dbody"><h3>${esc(e.nombre)}</h3><p class="nota">${esc(e.resumen)}</p></div></div>`)
    .join('');
}

const abiertos = new Set();

function pasaportesPersonas(c) {
  return (c.familias || []).flatMap((f) => f.personas);
}

function viewChecklist() {
  const st = store('check') || {};
  const unidades = [];
  D.checklist.forEach((c) => {
    if (c.familias) pasaportesPersonas(c).forEach((p) => unidades.push(st[`${c.id}:${p}`]));
    else unidades.push(st[c.id]);
  });
  const hechos = unidades.filter(Boolean).length;
  let html = `<div class="prog"><b>${hechos} de ${unidades.length} listos</b><div class="bar"><i style="width:${(hechos / unidades.length) * 100}%"></i></div></div>`;
  D.checklist.forEach((c) => {
    if (c.familias) {
      const ps = pasaportesPersonas(c);
      const n = ps.filter((p) => st[`${c.id}:${p}`]).length;
      html += `<details class="card desplegable" data-det="${esc(c.id)}" ${abiertos.has(c.id) ? 'open' : ''}><summary><span class="stit">${esc(c.texto)}</span><span class="cuenta ${n === ps.length ? 'ok' : ''}">${n}/${ps.length}</span></summary>` +
        c.familias.map((f) => `<h4>${esc(f.familia)}</h4>` +
          f.personas.map((p) => `<label class="chk sub ${st[`${c.id}:${p}`] ? 'done' : ''}"><input type="checkbox" data-chk="${esc(c.id)}:${esc(p)}" ${st[`${c.id}:${p}`] ? 'checked' : ''}><span>${esc(p)}</span></label>`).join('')
        ).join('') + '</details>';
    } else {
      html += `<label class="card chk ${st[c.id] ? 'done' : ''}"><input type="checkbox" data-chk="${esc(c.id)}" ${st[c.id] ? 'checked' : ''}><span>${esc(c.texto)}</span></label>`;
    }
  });
  return html + `<div class="muted" id="syncstate" style="margin:8px 0">${esc(syncEstado)}</div><button class="btn sec" id="compartirck">📤 Compartir estado por WhatsApp</button>`;
}

function estadoTexto() {
  const st = store('check') || {};
  const l = ['🛳️ Crucero 2027 · Checklist'];
  D.checklist.forEach((c) => {
    if (c.familias) {
      l.push(`\n${c.texto}:`);
      c.familias.forEach((f) => l.push(`${f.familia}: ` + f.personas.map((p) => `${st[`${c.id}:${p}`] ? '✅' : '⬜'} ${p}`).join(', ')));
      l.push('');
    } else l.push(`${st[c.id] ? '✅' : '⬜'} ${c.texto}`);
  });
  return l.join('\n');
}

const INFOICON = { 'Crucero': '🚢', 'Cabinas': '🛏️', 'El barco: MSC Virtuosa': '🎼', 'Qué incluye la tarifa': '🎟️', 'Internet y móvil': '📶', 'Incluido a bordo': '✅', 'De pago a bordo': '💳', 'Aparcamiento Barcelona': '🅿️', 'Documentación': '🛂', 'Regla de oro': '⚠️', 'Coste del plan': '💶', 'Contactos': '📞', 'A bordo: imprescindibles': '🎡', 'A bordo: espectáculos': '🎭', 'A bordo: niños y mayores': '🧒', 'A bordo: consejos de otros pasajeros': '💬', 'A bordo: críticas frecuentes': '⚠️', 'A bordo: nota': 'ℹ️' };
function viewInfo() {
  return Object.entries(D.info)
    .map(([t, arr]) => `<div class="card"><h3>${INFOICON[t] || 'ℹ️'} ${esc(t)}</h3><ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`)
    .join('');
}

function viewMapas(id) {
  if (id) {
    const r = D.lugares.regiones[id];
    const lugares = D.lugares.lugares.filter((l) => l.region === id);
    return `<button class="back" id="backmap">← Mapas</button>
      <div class="muted" id="mapstate"></div>
      <div id="map"></div>
      <div class="card">${lugares.map((l) => `<div class="lugar" data-lat="${l.lat}" data-lon="${l.lon}"><b>${esc(l.nombre)}</b>
        <a href="geo:${l.lat},${l.lon}?q=${l.lat},${l.lon}(${encodeURIComponent(l.nombre)})">Abrir en Maps</a></div>`).join('')}</div>`;
  }
  const regs = Object.entries(D.lugares.regiones);
  return `<div class="card"><h3>📥 Mapas sin conexión</h3>
    <p class="nota">Pulsa una vez con wifi para guardarlos (≈ ${regs.reduce((a, [, r]) => a + r.mb, 0).toFixed(0)} MB). Después funcionan sin internet. El GPS del móvil también funciona sin datos.</p>
    ${window.__DATA ? '<p class="nota"><b>Esta versión de archivo único no incluye mapas con calles.</b> Usa la app instalada para verlos; aquí puedes abrir cada lugar en Google Maps.</p>' : '<button class="btn" id="dlmaps">⬇️ Guardar todos los mapas</button>'}<div class="muted" id="dlstate"></div></div>` +
    regs.map(([k, r]) => `<div class="card dia mar click" data-map="${k}"><div class="badge">🗺️</div><div class="dbody"><h3>${esc(r.nombre)}</h3><div class="muted" data-cached="${k}">${r.mb} MB</div></div></div>`).join('');
}

const VIEWS = {
  hoy: ['Hoy', viewHoy],
  itin: ['Itinerario', viewItinerario],
  esc: ['Escalas', viewEscalas],
  mapas: ['Mapas', viewMapas],
  check: ['Checklist', viewChecklist],
  info: ['Info', viewInfo],
};

/* ---------- Sincronización del checklist ---------- */
// Las marcas se guardan en el móvil ('check' = valor, 'checkt' = hora del último cambio) y, si hay
// conexión y configuración, se fusionan con estado.json de un repositorio de GitHub (gana el cambio más reciente).

let syncTimer = null;
let syncBusy = false;
let syncEstado = '';

const enc64 = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
const dec64j = (b) => JSON.parse(decodeURIComponent(escape(atob(b.replace(/\s/g, '')))));

async function ghEstado(metodo, datos, sha) {
  const c = D.config;
  const url = `${c.api || 'https://api.github.com'}/repos/${c.repo}/contents/estado.json`;
  const h = { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json' };
  if (metodo === 'GET') {
    const r = await fetch(url, { headers: h, cache: 'no-store' });
    if (r.status === 404) return { sha: null, data: {} };
    if (!r.ok) throw new Error(`GET ${r.status}`);
    const j = await r.json();
    return { sha: j.sha, data: dec64j(j.content) };
  }
  const body = { message: 'estado checklist', content: enc64(datos) };
  if (sha) body.sha = sha;
  const r = await fetch(url, { method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) return 'conflicto';
  if (!r.ok) throw new Error(`PUT ${r.status}`);
  return 'ok';
}

function pintaSync() {
  const el = $('#syncstate');
  if (el) el.textContent = syncEstado;
}

async function sincronizar() {
  if (!D.config || syncBusy) { if (!D.config) { syncEstado = 'Marcas solo en este móvil (sin sincronización).'; pintaSync(); } return; }
  if (!navigator.onLine) { syncEstado = '📴 Sin conexión: se guarda en el móvil y se sincroniza al volver.'; pintaSync(); return; }
  syncBusy = true;
  try {
    for (let i = 0; i < 3; i++) {
      const r = await ghEstado('GET');
      const st = store('check') || {};
      const tm = store('checkt') || {};
      const fusion = { ...r.data };
      let cambioLocal = false, cambioRemoto = false;
      new Set([...Object.keys(st), ...Object.keys(r.data)]).forEach((k) => {
        const lt = tm[k] ?? (st[k] ? 1 : 0);
        const rt = (r.data[k] && r.data[k].t) || 0;
        if (lt > rt) { fusion[k] = { v: !!st[k], t: lt }; cambioRemoto = true; }
        else if (rt > lt) { st[k] = !!r.data[k].v; tm[k] = rt; cambioLocal = true; }
      });
      if (cambioLocal) { store('check', st); store('checkt', tm); }
      if (cambioRemoto) {
        const res = await ghEstado('PUT', fusion, r.sha);
        if (res === 'conflicto') { await new Promise((ok) => setTimeout(ok, 400 * (i + 1))); continue; }
      }
      syncEstado = `🔄 Sincronizado a las ${new Date().toTimeString().slice(0, 5)}`;
      pintaSync();
      if (cambioLocal && tab === 'check') renderConservando();
      return;
    }
    syncEstado = '⚠️ No se pudo sincronizar (conflicto). Se reintentará.';
  } catch (e) {
    syncEstado = '📴 Sin conexión con el servidor: se guarda en el móvil y se sincroniza al volver.';
  } finally {
    syncBusy = false;
    pintaSync();
  }
}

function programaSync(ms = 1500) {
  clearTimeout(programaSync.t);
  programaSync.t = setTimeout(sincronizar, ms);
}

function renderConservando() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

window.addEventListener('online', () => programaSync(500));
document.addEventListener('visibilitychange', () => { if (!document.hidden && tab === 'check') programaSync(300); });

/* ---------- Render ---------- */

function render(arg) {
  clearInterval(timer);
  clearInterval(syncTimer);
  const [title, fn] = VIEWS[tab];
  $('#title').textContent = title;
  $('#main').innerHTML = fn(arg);
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  window.scrollTo(0, 0);
  tick();
  if (tab === 'mapas') afterMapas(arg);
  if ($('#cuenta')) timer = setInterval(tick, 1000);
  if (tab === 'check') {
    pintaSync();
    programaSync(300);
    syncTimer = setInterval(sincronizar, 60000);
  }
}

function tick() {
  const el = $('#cuenta');
  if (!el) return;
  const ms = new Date(el.dataset.target) - now();
  el.textContent = ms > 0 ? fmtCuenta(ms) : 'Hora superada';
  el.classList.toggle('late', ms <= 0);
  el.classList.toggle('soon', ms > 0 && ms < 3600000);
}

function go(t, arg) {
  tab = t;
  render(arg);
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('nav button');
  if (nav) return go(nav.dataset.tab);
  const esc_ = e.target.closest('[data-esc]');
  if (esc_) return go('esc', esc_.dataset.esc);
  if (e.target.id === 'back') return go('esc');
  if (e.target.id === 'backmap') return go('mapas');
  const mp = e.target.closest('[data-map]');
  if (mp) return go('mapas', mp.dataset.map);
  if (e.target.id === 'dlmaps') return downloadMaps();
  if (e.target.id === 'compartirck') {
    const t = estadoTexto();
    if (navigator.share) navigator.share({ text: t }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(t)}`);
    return;
  }
  const lg = e.target.closest('.lugar');
  if (lg && !e.target.closest('a') && window.__map) window.__map.flyTo({ center: [+lg.dataset.lon, +lg.dataset.lat], zoom: 16 });
});

document.addEventListener('toggle', (e) => {
  const id = e.target.dataset && e.target.dataset.det;
  if (!id) return;
  if (e.target.open) abiertos.add(id); else abiertos.delete(id);
}, true);

document.addEventListener('change', (e) => {
  if (e.target.dataset.chk) {
    const st = store('check') || {};
    const tm = store('checkt') || {};
    st[e.target.dataset.chk] = e.target.checked;
    tm[e.target.dataset.chk] = Date.now();
    store('check', st);
    store('checkt', tm);
    renderConservando();
    programaSync();
  } else if (e.target.id === 'simsel') {
    simDate = e.target.value || null;
    render();
  }
});

/* ---------- Mapas ---------- */

const MAPCACHE = 'crucero-maps-v1';
let protocolAdded = false;

async function cachedMaps() {
  try {
    const c = await caches.open(MAPCACHE);
    const ks = await c.keys();
    return ks.map((k) => new URL(k.url).pathname.split('/').pop().replace('.pmtiles', ''));
  } catch (e) { return []; }
}

async function afterMapas(id) {
  if (!id) {
    const have = await cachedMaps();
    document.querySelectorAll('[data-cached]').forEach((el) => {
      const ok = have.includes(el.dataset.cached);
      el.textContent = ok ? '✓ Guardado en el móvil' : `Sin guardar · ${D.lugares.regiones[el.dataset.cached].mb} MB`;
      el.style.color = ok ? 'var(--ok)' : '';
    });
    return;
  }
  if (!window.maplibregl || window.__DATA) { $('#mapstate').textContent = 'Mapa con calles no disponible en esta versión.'; $('#map').remove(); return; }
  if (!protocolAdded) {
    maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile);
    protocolAdded = true;
  }
  const r = D.lugares.regiones[id];
  const base = location.href.replace(/[^/]*$/, '');
  const map = new maplibregl.Map({
    container: 'map',
    center: r.centro,
    zoom: r.zoom,
    maxZoom: 17,
    style: {
      version: 8,
      glyphs: base + 'fonts/{fontstack}/{range}.pbf',
      sources: { protomaps: { type: 'vector', url: `pmtiles://${base}maps/${id}.pmtiles`, attribution: '© OpenStreetMap · Protomaps' } },
      layers: D.mapLayers,
    },
  });
  window.__map = map;
  map.on('styleimagemissing', (ev) => {
    if (!map.hasImage(ev.id)) map.addImage(ev.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserLocation: true }), 'top-right');
  map.on('load', () => {
    D.lugares.lugares.filter((l) => l.region === id).forEach((l) => {
      new maplibregl.Marker({ color: '#e0412b' })
        .setLngLat([l.lon, l.lat])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setText(l.nombre))
        .addTo(map);
    });
  });
  map.on('error', (ev) => { $('#mapstate').textContent = 'Este mapa no está guardado: ábrelo una vez con conexión.'; });
}

async function downloadMaps() {
  const st = $('#dlstate');
  if (!window.caches) { st.textContent = 'Este navegador no puede guardar mapas.'; return; }
  const c = await caches.open(MAPCACHE);
  const ids = Object.keys(D.lugares.regiones);
  for (let i = 0; i < ids.length; i++) {
    const url = `maps/${ids[i]}.pmtiles`;
    st.textContent = `Descargando ${i + 1}/${ids.length}: ${D.lugares.regiones[ids[i]].nombre}…`;
    if (await c.match(url)) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      await c.put(url, res);
    } catch (e) { st.textContent = 'Error de descarga. Comprueba la conexión y reintenta.'; return; }
  }
  st.textContent = '✓ Todos los mapas guardados.';
  afterMapas();
}

/* ---------- Arranque ---------- */

(async function init() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  try {
    D = await loadData();
    D.mapLayers = D['map-layers'];
  } catch (err) {
    $('#main').innerHTML = '<div class="card"><h2>No se pudieron cargar los datos</h2><p>Abre la app una vez con conexión.</p></div>';
    return;
  }
  render();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();

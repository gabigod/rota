// Lê o arquivo da pedalada (GPX ou FIT, do aplicativo da iGPSport, Strava, komoot…) e calcula km, tempo, subida e velocidade.
import { iso } from './format.js';

const R = 6371008.8;
const rad = x => x * Math.PI / 180;
function haversine(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Soma só a subida "de verdade": ignora o tremido do GPS e do barômetro (histerese de 3 m)
function subidaDe(eles, limiar = 3) {
  const e = eles.filter(v => Number.isFinite(v));
  if (e.length < 2) return 0;
  const s = e.map((_, i) => { let t = 0, n = 0; for (let k = Math.max(0, i - 2); k <= Math.min(e.length - 1, i + 2); k++) { t += e[k]; n++; } return t / n; });
  let ref = s[0], ganho = 0;
  for (const v of s) { if (v - ref >= limiar) { ganho += v - ref; ref = v; } else if (ref - v >= limiar) ref = v; }
  return ganho;
}

// pontos: [{lat, lon, ele, t(ms)}]
export function analisarPontos(pts) {
  pts = pts.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (pts.length < 2) throw new Error('O arquivo não tem pontos de GPS suficientes.');
  let dist = 0, movendo = 0, decorrido = 0;
  const acum = [0], vel = [];
  const temTempo = pts.every(p => Number.isFinite(p.t));
  for (let i = 1; i < pts.length; i++) {
    const d = haversine(pts[i - 1], pts[i]);
    if (d > 5000) { acum.push(dist); continue; } // salto de GPS
    dist += d; acum.push(dist);
    if (temTempo) {
      const dt = (pts[i].t - pts[i - 1].t) / 1000;
      if (dt > 0) {
        decorrido += Math.min(dt, 3600 * 24);
        const v = d / dt;
        if (dt <= 60 && v >= 0.45) movendo += dt; // abaixo de ~1,6 km/h ou com pausa longa não conta
        if (dt >= 1 && dt <= 30) vel.push(v);
      }
    }
  }
  let vmax = 0;
  for (let i = 1; i < vel.length - 1; i++) { const m = (vel[i - 1] + vel[i] + vel[i + 1]) / 3 * 3.6; if (m > vmax && m < 100) vmax = m; }
  const t0 = temTempo ? pts[0].t : null;
  const d0 = t0 ? new Date(t0) : null;
  return {
    km: dist / 1000,
    min: temTempo ? movendo / 60 : 0,
    decorridoMin: temTempo ? decorrido / 60 : 0,
    subida: subidaDe(pts.map(p => p.ele)),
    vmax,
    data: d0 ? iso(d0) : null,
    inicio: t0,
    trilha: simplificar(pts, acum)
  };
}

// guarda no máximo 200 pontos por dia (para o perfil de altitude e o desenho do trajeto)
function simplificar(pts, acum, max = 200) {
  const n = pts.length, passo = Math.max(1, (n - 1) / (max - 1)), out = [];
  for (let k = 0; k < max && Math.round(k * passo) < n; k++) {
    const i = Math.round(k * passo), p = pts[i];
    out.push([+p.lat.toFixed(5), +p.lon.toFixed(5), Number.isFinite(p.ele) ? Math.round(p.ele) : null, +(acum[i] / 1000).toFixed(2)]);
  }
  const u = pts.length - 1;
  if (out.length && out[out.length - 1][3] !== +(acum[u] / 1000).toFixed(2)) out.push([+pts[u].lat.toFixed(5), +pts[u].lon.toFixed(5), Number.isFinite(pts[u].ele) ? Math.round(pts[u].ele) : null, +(acum[u] / 1000).toFixed(2)]);
  return out;
}

// ---------- GPX ----------
export function lerGPX(texto) {
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Não consegui ler esse GPX.');
  let nos = [...doc.getElementsByTagName('trkpt')];
  if (!nos.length) nos = [...doc.getElementsByTagName('rtept')];
  const pts = nos.map(n => {
    const ele = n.getElementsByTagName('ele')[0], tm = n.getElementsByTagName('time')[0];
    return { lat: parseFloat(n.getAttribute('lat')), lon: parseFloat(n.getAttribute('lon')), ele: ele ? parseFloat(ele.textContent) : NaN, t: tm ? Date.parse(tm.textContent) : NaN };
  });
  return [{ ...analisarPontos(pts), fonte: 'gpx' }];
}

// ---------- FIT ----------
const SEMI = 180 / 2147483648, EPOCA_FIT = 631065600000;
const TIPOS = { 0: [1, 'u', 0xFF], 1: [1, 's', 0x7F], 2: [1, 'u', 0xFF], 3: [2, 's', 0x7FFF], 4: [2, 'u', 0xFFFF], 5: [4, 's', 0x7FFFFFFF], 6: [4, 'u', 0xFFFFFFFF], 7: [1, 'str'], 8: [4, 'f32'], 9: [8, 'f64'], 10: [1, 'u', 0], 11: [2, 'u', 0], 12: [4, 'u', 0], 13: [1, 'u', 0xFF], 14: [8, 's64'], 15: [8, 'u64'], 16: [8, 'u64'] };

function lerCampo(dv, pos, tam, tipo, le) {
  const t = TIPOS[tipo & 0x1f] || [1, 'u', 0xFF];
  const [bt, kind, invalido] = t;
  if (kind === 'str' || tam < bt) return undefined;
  let v;
  switch (kind) {
    case 'u': v = bt === 1 ? dv.getUint8(pos) : bt === 2 ? dv.getUint16(pos, le) : dv.getUint32(pos, le); break;
    case 's': v = bt === 1 ? dv.getInt8(pos) : bt === 2 ? dv.getInt16(pos, le) : dv.getInt32(pos, le); break;
    case 'f32': v = dv.getFloat32(pos, le); return Number.isFinite(v) ? v : undefined;
    case 'f64': v = dv.getFloat64(pos, le); return Number.isFinite(v) ? v : undefined;
    default: return undefined;
  }
  return v === invalido ? undefined : v;
}

export function lerFIT(buf) {
  const dv = new DataView(buf);
  const hdr = dv.getUint8(0);
  if (String.fromCharCode(dv.getUint8(8), dv.getUint8(9), dv.getUint8(10), dv.getUint8(11)) !== '.FIT') throw new Error('Esse arquivo não parece ser um FIT.');
  const fim = Math.min(buf.byteLength, hdr + dv.getUint32(4, true));
  let pos = hdr;
  const defs = {}, recs = [], sessoes = [];
  const leMsg = def => {
    const m = {};
    for (const f of def.campos) { m[f.num] = lerCampo(dv, pos, f.tam, f.tipo, def.le); pos += f.tam; }
    pos += def.devTam;
    return m;
  };
  while (pos < fim - 1) {
    const h = dv.getUint8(pos++);
    if (h & 0x80) { // cabeçalho de tempo comprimido
      const def = defs[(h >> 5) & 3]; if (!def) break;
      const m = leMsg(def); if (def.global === 20) recs.push(m);
    } else if (h & 0x40) { // definição
      const local = h & 0x0f, temDev = !!(h & 0x20);
      pos++; const le = dv.getUint8(pos++) === 0;
      const global = dv.getUint16(pos, le); pos += 2;
      const n = dv.getUint8(pos++), campos = [];
      for (let i = 0; i < n; i++) { campos.push({ num: dv.getUint8(pos), tam: dv.getUint8(pos + 1), tipo: dv.getUint8(pos + 2) }); pos += 3; }
      let devTam = 0;
      if (temDev) { const nd = dv.getUint8(pos++); for (let i = 0; i < nd; i++) { devTam += dv.getUint8(pos + 1); pos += 3; } }
      defs[local] = { global, le, campos, devTam };
    } else {
      const def = defs[h & 0x0f]; if (!def) break;
      const m = leMsg(def);
      if (def.global === 20) recs.push(m); else if (def.global === 18) sessoes.push(m);
    }
  }
  const pts = recs.filter(r => r[0] != null && r[1] != null).map(r => {
    const alt = r[78] != null ? r[78] / 5 - 500 : r[2] != null ? r[2] / 5 - 500 : NaN;
    return { lat: r[0] * SEMI, lon: r[1] * SEMI, ele: alt, t: r[253] != null ? r[253] * 1000 + EPOCA_FIT : NaN };
  });
  const dias = [];
  if (pts.length >= 2) {
    const a = analisarPontos(pts);
    if (sessoes.length) { // o resumo do próprio aparelho vale mais que a conta feita pelos pontos
      const s = sessoes.reduce((t, x) => ({
        dist: t.dist + (x[9] ?? 0), timer: t.timer + (x[8] ?? 0), asc: t.asc + (x[22] ?? 0), vmax: Math.max(t.vmax, x[124] ?? x[15] ?? 0), ini: t.ini ?? x[2]
      }), { dist: 0, timer: 0, asc: 0, vmax: 0, ini: undefined });
      if (s.dist > 0) a.km = s.dist / 100000;
      if (s.timer > 0) a.min = s.timer / 60000;
      if (s.asc > 0) a.subida = s.asc;
      if (s.vmax > 0) a.vmax = s.vmax * 3.6 / 1000;
      if (s.ini != null) { a.inicio = s.ini * 1000 + EPOCA_FIT; a.data = iso(new Date(a.inicio)); }
    }
    dias.push({ ...a, fonte: 'fit' });
  } else if (sessoes.length) {
    const x = sessoes[0];
    dias.push({ km: (x[9] ?? 0) / 100000, min: (x[8] ?? 0) / 60000, decorridoMin: (x[7] ?? 0) / 60000, subida: x[22] ?? 0, vmax: (x[124] ?? x[15] ?? 0) * 3.6 / 1000,
      data: x[2] != null ? iso(new Date(x[2] * 1000 + EPOCA_FIT)) : null, inicio: x[2] != null ? x[2] * 1000 + EPOCA_FIT : null, trilha: null, fonte: 'fit' });
  } else throw new Error('O FIT não tem dados de pedalada.');
  return dias;
}

// ---------- entrada: aceita .gpx, .fit e .gz ----------
async function descomprimir(buf) {
  const ds = new DecompressionStream('gzip');
  return new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer();
}
export async function lerArquivo(file) {
  let buf = await file.arrayBuffer();
  let u = new Uint8Array(buf);
  if (u[0] === 0x1f && u[1] === 0x8b) { buf = await descomprimir(buf); u = new Uint8Array(buf); }
  let dias;
  if (u.length > 12 && String.fromCharCode(u[8], u[9], u[10], u[11]) === '.FIT') dias = lerFIT(buf);
  else {
    const txt = new TextDecoder().decode(buf);
    if (!/<gpx[\s>]/i.test(txt)) throw new Error('Só consigo ler arquivos GPX e FIT.');
    dias = lerGPX(txt);
  }
  return dias.map(d => ({ ...d, arquivo: file.name, assinatura: `${file.name}|${file.size}|${d.inicio || ''}` }));
}

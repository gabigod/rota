// Gráficos em SVG puro. Um só tom por gráfico (km = rosa, dinheiro = azul-petróleo); o plano fica tracejado e cinza.
import { n0, esc, dm } from './format.js';

const W = 360;
function nice(max) {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max)), f = max / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
const curto = v => (v >= 10000 ? n0(v / 1000) + ' mil' : n0(v));

export const cartao = (titulo, corpo, nota = '', leitura = true) =>
  `<section class="card"><h3>${titulo}</h3>${corpo}${leitura ? '<div class="leitura" aria-live="polite">Toque no gráfico para ver o valor.</div>' : ''}${nota ? `<p class="nota">${nota}</p>` : ''}</section>`;

// serie: [{v, x (rótulo do eixo), t (texto ao tocar)}]
export function barras(serie, { h = 150, cor = 'var(--route)', fmt = curto, cada } = {}) {
  if (!serie.length) return '';
  const pl = 36, pr = 6, pt = 8, pb = 20, iw = W - pl - pr, ih = h - pt - pb;
  const max = nice(Math.max(...serie.map(s => s.v)));
  const bw = iw / serie.length, g = Math.min(2, bw * .2), w = Math.max(1, bw - g);
  const passo = cada || Math.ceil(serie.length / 6);
  let o = `<svg viewBox="0 0 ${W} ${h}" class="grafico" role="img">`;
  for (const f of [0, .5, 1]) {
    const y = pt + ih - ih * f;
    o += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" class="grade"/><text x="${pl - 5}" y="${y + 3}" class="eixo" text-anchor="end">${fmt(max * f)}</text>`;
  }
  serie.forEach((s, i) => {
    const bh = s.v > 0 ? Math.max(1.5, ih * s.v / max) : 0, x = pl + i * bw + g / 2, y = pt + ih - bh;
    if (bh) o += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${bh.toFixed(2)}" rx="${Math.min(2.5, w / 2).toFixed(1)}" fill="${cor}"/>`;
    o += `<rect x="${(pl + i * bw).toFixed(2)}" y="${pt}" width="${bw.toFixed(2)}" height="${ih}" fill="transparent" data-t="${esc(s.t)}"/>`;
    if (i % passo === 0) o += `<text x="${(x + w / 2).toFixed(1)}" y="${h - 5}" class="eixo" text-anchor="middle">${esc(s.x)}</text>`;
  });
  return o + '</svg>';
}

// linha: [{data, real, plano}] — km acumulado contra o plano
export function linha(pts, { h = 170 } = {}) {
  if (pts.length < 2) return '<p class="vazio-mini">Precisa de pelo menos 2 dias para desenhar a linha.</p>';
  const pl = 40, pr = 10, pt = 10, pb = 20, iw = W - pl - pr, ih = h - pt - pb;
  const max = nice(Math.max(...pts.map(p => Math.max(p.real, p.plano))));
  const X = i => pl + iw * i / (pts.length - 1), Y = v => pt + ih - ih * v / max;
  const cam = k => pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join('');
  let o = `<svg viewBox="0 0 ${W} ${h}" class="grafico" role="img">`;
  for (const f of [0, .5, 1]) { const y = pt + ih - ih * f; o += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" class="grade"/><text x="${pl - 5}" y="${y + 3}" class="eixo" text-anchor="end">${curto(max * f)}</text>`; }
  o += `<path d="${cam('plano')}" class="plano"/><path d="${cam('real')}" class="real"/>`;
  const u = pts.length - 1;
  o += `<circle cx="${X(u).toFixed(1)}" cy="${Y(pts[u].real).toFixed(1)}" r="4" class="ponto"/>`;
  for (const i of [0, Math.floor(u / 2), u]) o += `<text x="${X(i).toFixed(1)}" y="${h - 5}" class="eixo" text-anchor="${i === 0 ? 'start' : i === u ? 'end' : 'middle'}">${dm(pts[i].data)}</text>`;
  const passo = Math.max(1, Math.ceil(pts.length / 70)), bw = iw / (pts.length - 1) * passo;
  for (let i = 0; i < pts.length; i += passo) {
    const p = pts[i];
    o += `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${pt}" width="${bw.toFixed(1)}" height="${ih}" fill="transparent" data-t="${esc(`${dm(p.data)} · real ${n0(p.real)} km · plano ${n0(p.plano)} km`)}"/>`;
  }
  return o + '</svg>';
}

// barras horizontais em HTML: items [{nome, v, txt}]
export function hbarras(items, cor = 'var(--side)') {
  if (!items.length) return '';
  const max = Math.max(...items.map(i => i.v)) || 1;
  return `<div class="hb">${items.map(i => `<div class="hb-l"><span class="hb-n">${esc(i.nome)}</span><span class="hb-t"><i style="width:${Math.max(1.5, i.v / max * 100).toFixed(1)}%;background:${cor}"></i></span><span class="hb-v">${esc(i.txt)}</span></div>`).join('')}</div>`;
}

// calendário de calor: um quadrado por dia, colunas = semanas
export function calor(diasAgg, ini, fim, { semanaDe, addDias, difDias, dataLonga }) {
  const mapa = new Map(diasAgg.map(d => [d.data, d]));
  const max = Math.max(1, ...diasAgg.map(d => d.km));
  const comeco = semanaDe(ini), nSem = Math.floor(difDias(comeco, fim) / 7) + 1, cs = 11, gp = 2;
  const wTot = nSem * (cs + gp) + 2, hTot = 7 * (cs + gp) + 2;
  let o = `<div class="rolagem" data-fim><svg width="${wTot}" height="${hTot}" viewBox="0 0 ${wTot} ${hTot}" class="grafico" role="img">`;
  for (let s = 0; s < nSem; s++) for (let r = 0; r < 7; r++) {
    const dt = addDias(comeco, s * 7 + r);
    if (dt < ini || dt > fim) continue;
    const d = mapa.get(dt), x = 1 + s * (cs + gp), y = 1 + r * (cs + gp);
    let cl = 'c0', t = `${dataLonga(dt)} · sem registro`;
    if (d) {
      if (d.km > 0) { const nv = Math.min(4, Math.max(1, Math.ceil(d.km / max * 4))); cl = 'c' + nv; t = `${dataLonga(dt)} · ${n0(d.km)} km`; } else { cl = 'cd'; t = `${dataLonga(dt)} · descanso`; }
    }
    o += `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" rx="2.5" class="${cl}" data-t="${esc(t)}"/>`;
  }
  return o + '</svg></div>';
}

// perfil de altitude de um dia: trilha = [lat,lon,ele,km]
export function perfil(trilha, { h = 110 } = {}) {
  const p = trilha.filter(t => t[2] != null);
  if (p.length < 3) return '';
  const pl = 34, pr = 6, pt = 8, pb = 18, iw = W - pl - pr, ih = h - pt - pb;
  const lo = Math.min(...p.map(t => t[2])), hi = Math.max(...p.map(t => t[2])), fa = Math.max(20, hi - lo), kmMax = p[p.length - 1][3] || 1;
  const X = k => pl + iw * k / kmMax, Y = e => pt + ih - ih * (e - lo) / fa;
  const lin = p.map((t, i) => `${i ? 'L' : 'M'}${X(t[3]).toFixed(1)} ${Y(t[2]).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${W} ${h}" class="grafico" role="img"><path d="${lin}L${X(kmMax)} ${pt + ih}L${pl} ${pt + ih}Z" class="area"/><path d="${lin}" class="real"/>` +
    `<text x="${pl - 5}" y="${pt + 8}" class="eixo" text-anchor="end">${n0(hi)} m</text><text x="${pl - 5}" y="${pt + ih}" class="eixo" text-anchor="end">${n0(lo)} m</text>` +
    `<text x="${pl}" y="${h - 4}" class="eixo">0 km</text><text x="${W - pr}" y="${h - 4}" class="eixo" text-anchor="end">${n0(kmMax)} km</text></svg>`;
}

// desenho do trajeto do dia
export function forma(trilha, { h = 150 } = {}) {
  const p = trilha.filter(t => t[0] != null);
  if (p.length < 2) return '';
  const k = Math.cos(p[0][0] * Math.PI / 180);
  const xs = p.map(t => t[1] * k), ys = p.map(t => -t[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const e = Math.max(x1 - x0, y1 - y0, 1e-6), pad = 12, esc_ = (h - pad * 2) / e;
  const ox = (W - (x1 - x0) * esc_) / 2, oy = (h - (y1 - y0) * esc_) / 2;
  const P = (x, y) => `${(ox + (x - x0) * esc_).toFixed(1)} ${(oy + (y - y0) * esc_).toFixed(1)}`;
  const d = p.map((_, i) => `${i ? 'L' : 'M'}${P(xs[i], ys[i])}`).join('');
  const [ax, ay] = P(xs[0], ys[0]).split(' '), [bx, by] = P(xs.at(-1), ys.at(-1)).split(' ');
  return `<svg viewBox="0 0 ${W} ${h}" class="grafico" role="img"><path d="${d}" class="real"/><circle cx="${ax}" cy="${ay}" r="4.5" class="ini"/><circle cx="${bx}" cy="${by}" r="4.5" class="ponto"/></svg>`;
}

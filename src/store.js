// Dados do app: ficam no celular (IndexedDB). Nada sai daqui sem você exportar o backup.
import { hoje, addDias } from './format.js';

export const PAISES = ['Brasil', 'Bolívia', 'Peru', 'Chile', 'Argentina', 'Uruguai', 'Paraguai', 'Outro'];
export const FLAG = { Brasil: '🇧🇷', 'Bolívia': '🇧🇴', Peru: '🇵🇪', Chile: '🇨🇱', Argentina: '🇦🇷', Uruguai: '🇺🇾', Paraguai: '🇵🇾', Outro: '🌎' };
export const MOEDA_PAIS = { Brasil: 'BRL', 'Bolívia': 'BOB', Peru: 'PEN', Chile: 'CLP', Argentina: 'ARS', Uruguai: 'UYU', Paraguai: 'PYG', Outro: 'USD' };
export const MOEDAS = ['BRL', 'USD', 'ARS', 'CLP', 'BOB', 'PEN', 'UYU', 'PYG', 'EUR'];
export const CATS = ['Comida', 'Hospedagem', 'Transporte', 'Manutenção da bike', 'Equipamento', 'Saúde', 'Chip e internet', 'Turismo e ingressos', 'Outros'];
export const PAGS = ['Cartão', 'Dinheiro', 'Pix', 'Outro'];
export const PERNOITES = { barraca: 'Barraca', pousada: 'Pousada ou hotel', casa: 'Casa de alguém', outro: 'Outro' };
export const CLIMAS = ['Sol', 'Nublado', 'Chuva', 'Vento forte', 'Frio', 'Calor'];

const padrao = () => ({
  v: 1,
  cfg: { nome: 'Tem', inicio: '2027-01-04', metaKm: 26535, diasPlanejados: 626, odometro: 0, pais: 'Brasil', taxas: {}, ultimoBackup: null },
  dias: [], gastos: [], pecas: []
});

export const S = padrao();
const ouvintes = new Set();
export const aoMudar = fn => { ouvintes.add(fn); return () => ouvintes.delete(fn); };
const avisar = () => ouvintes.forEach(f => f());

export const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

// ---------- armazenamento ----------
const DB = 'diario-viagem', ST = 'kv';
let dbp = null;
const temIDB = typeof indexedDB !== 'undefined';
function abrir() {
  if (!dbp) dbp = new Promise((ok, erro) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
  return dbp;
}
async function ler(k) {
  if (!temIDB) { try { return JSON.parse(localStorage.getItem(DB + ':' + k)); } catch { return null; } }
  const db = await abrir();
  return new Promise((ok, erro) => { const q = db.transaction(ST).objectStore(ST).get(k); q.onsuccess = () => ok(q.result ?? null); q.onerror = () => erro(q.error); });
}
async function gravar(k, v) {
  if (!temIDB) { localStorage.setItem(DB + ':' + k, JSON.stringify(v)); return; }
  const db = await abrir();
  return new Promise((ok, erro) => { const t = db.transaction(ST, 'readwrite'); t.objectStore(ST).put(v, k); t.oncomplete = () => ok(); t.onerror = () => erro(t.error); });
}
async function apagar(k) {
  if (!temIDB) { localStorage.removeItem(DB + ':' + k); return; }
  const db = await abrir();
  return new Promise((ok, erro) => { const t = db.transaction(ST, 'readwrite'); t.objectStore(ST).delete(k); t.oncomplete = () => ok(); t.onerror = () => erro(t.error); });
}
async function chaves() {
  if (!temIDB) return Object.keys(localStorage).filter(k => k.startsWith(DB + ':')).map(k => k.slice(DB.length + 1));
  const db = await abrir();
  return new Promise((ok, erro) => { const q = db.transaction(ST).objectStore(ST).getAllKeys(); q.onsuccess = () => ok(q.result); q.onerror = () => erro(q.error); });
}

let timer = null;
export let erroGravar = null;
function agendar() {
  clearTimeout(timer);
  timer = setTimeout(salvarAgora, 250);
}
export async function salvarAgora() {
  clearTimeout(timer);
  try { await gravar('estado', JSON.parse(JSON.stringify(S))); erroGravar = null; }
  catch (e) { erroGravar = e; console.error(e); }
}
function mudou() { agendar(); avisar(); }

export async function carregar() {
  try {
    const e = await ler('estado');
    if (e && e.v === 1) { const p = padrao(); Object.assign(S, { ...p, ...e, cfg: { ...p.cfg, ...e.cfg } }); }
  } catch (e) { console.error(e); erroGravar = e; }
  try { navigator.storage?.persist?.(); } catch { /* sem problema */ }
  avisar();
}

// trilhas (pontos simplificados de cada dia importado)
export const lerTrilha = id => ler('trk:' + id);
export const gravarTrilha = (id, pts) => gravar('trk:' + id, pts);

// ---------- ações ----------
const ordenar = () => { S.dias.sort((a, b) => a.data.localeCompare(b.data) || (a.ordem || 0) - (b.ordem || 0)); S.gastos.sort((a, b) => b.data.localeCompare(a.data)); };
export function salvarDia(d, trilha) {
  if (!d.id) d.id = novoId();
  const i = S.dias.findIndex(x => x.id === d.id);
  if (i >= 0) S.dias[i] = d; else S.dias.push(d);
  if (trilha) { d.trk = true; gravarTrilha(d.id, trilha); }
  S.cfg.pais = d.pais || S.cfg.pais;
  ordenar(); mudou();
  return d;
}
export function apagarDia(id) { S.dias = S.dias.filter(d => d.id !== id); apagar('trk:' + id); mudou(); }
export function salvarGasto(g) {
  if (!g.id) g.id = novoId();
  const i = S.gastos.findIndex(x => x.id === g.id);
  if (i >= 0) S.gastos[i] = g; else S.gastos.push(g);
  if (g.moeda !== 'BRL' && g.valor > 0 && g.brl > 0) S.cfg.taxas[g.moeda] = g.brl / g.valor; // lembra a última cotação
  S.cfg.pais = g.pais || S.cfg.pais;
  ordenar(); mudou();
  return g;
}
export function apagarGasto(id) { S.gastos = S.gastos.filter(g => g.id !== id); mudou(); }
export function salvarPeca(p) {
  if (!p.id) p.id = novoId();
  const i = S.pecas.findIndex(x => x.id === p.id);
  if (i >= 0) S.pecas[i] = p; else S.pecas.push(p);
  mudou();
}
export function apagarPeca(id) { S.pecas = S.pecas.filter(p => p.id !== id); mudou(); }
export function salvarCfg(patch) { Object.assign(S.cfg, patch); mudou(); }
export function salvarTaxa(moeda, v) { if (v > 0) S.cfg.taxas[moeda] = v; else delete S.cfg.taxas[moeda]; mudou(); }

// ---------- backup ----------
export async function montarBackup() {
  const tracks = {};
  for (const d of S.dias) if (d.trk) { const t = await lerTrilha(d.id); if (t) tracks[d.id] = t; }
  return JSON.stringify({ app: 'diario-da-viagem', v: 1, exportadoEm: new Date().toISOString(), estado: S, tracks });
}
export function marcarBackup() { S.cfg.ultimoBackup = new Date().toISOString(); mudou(); }
export async function lerBackup(texto, modo) {
  const j = JSON.parse(texto);
  if (j.app !== 'diario-da-viagem' || !j.estado) throw new Error('Esse arquivo não é um backup do Diário da Viagem.');
  const e = j.estado;
  if (modo === 'substituir') {
    const p = padrao();
    for (const d of S.dias) if (d.trk) apagar('trk:' + d.id);
    S.cfg = { ...p.cfg, ...e.cfg }; S.dias = e.dias || []; S.gastos = e.gastos || []; S.pecas = e.pecas || [];
  } else {
    const junta = (alvo, novos) => { const ids = new Map(alvo.map((x, i) => [x.id, i])); for (const n of novos || []) { if (ids.has(n.id)) alvo[ids.get(n.id)] = n; else alvo.push(n); } };
    junta(S.dias, e.dias); junta(S.gastos, e.gastos); junta(S.pecas, e.pecas);
    S.cfg.taxas = { ...(e.cfg?.taxas || {}), ...S.cfg.taxas };
  }
  for (const [id, t] of Object.entries(j.tracks || {})) await gravarTrilha(id, t);
  ordenar(); mudou();
  return { dias: (e.dias || []).length, gastos: (e.gastos || []).length };
}

// ---------- dados de exemplo (para ver o app funcionando; dá para apagar) ----------
function prng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function carregarExemplo() {
  apagarExemplo(true);
  const r = prng(7), N = 75, ini = addDias(hoje(), -(N - 1));
  const lugares = ['Paramirim', 'Livramento', 'Rio de Contas', 'Mucugê', 'Lençóis', 'Seabra', 'Itaberaba', 'Feira de Santana', 'Salvador', 'Praia do Forte', 'Mangue Seco', 'Aracaju', 'Penedo', 'Maragogi', 'Recife', 'João Pessoa', 'Natal', 'Fortaleza'];
  const noitesTipos = ['barraca', 'barraca', 'barraca', 'pousada', 'casa'];
  const climas = ['Sol', 'Sol', 'Sol', 'Nublado', 'Chuva', 'Calor', 'Vento forte'];
  let lugar = 0;
  for (let i = 0; i < N; i++) {
    const data = addDias(ini, i), descanso = (i % 6 === 5) || r() < .04, pais = 'Brasil';
    const km = descanso ? 0 : Math.round((45 + r() * 65) * 10) / 10;
    const min = descanso ? 0 : Math.round(km / (14 + r() * 5) * 60);
    const d = { id: novoId(), ex: true, data, km, min, subida: descanso ? 0 : Math.round(km * (4 + r() * 12)), vmax: descanso ? 0 : Math.round((38 + r() * 20) * 10) / 10,
      pais, de: lugares[lugar % lugares.length], para: lugares[(lugar + (descanso ? 0 : 1)) % lugares.length], pernoite: noitesTipos[Math.floor(r() * noitesTipos.length)],
      clima: climas[Math.floor(r() * climas.length)], nota: descanso ? 'Dia de descanso.' : '', fonte: 'manual' };
    if (!descanso) lugar++;
    S.dias.push(d);
    const comida = 28 + r() * 40;
    S.gastos.push({ id: novoId(), ex: true, data, valor: Math.round(comida * 100) / 100, moeda: 'BRL', brl: Math.round(comida * 100) / 100, cat: 'Comida', pag: r() < .6 ? 'Cartão' : 'Pix', desc: 'Comida do dia', pais });
    if (d.pernoite === 'pousada' || d.pernoite === 'casa' && r() < .3) { const v = 60 + r() * 90; S.gastos.push({ id: novoId(), ex: true, data, valor: Math.round(v), moeda: 'BRL', brl: Math.round(v), cat: 'Hospedagem', pag: 'Cartão', desc: 'Pousada', pais }); }
    if (r() < .12) { const v = 20 + r() * 220; S.gastos.push({ id: novoId(), ex: true, data, valor: Math.round(v), moeda: 'BRL', brl: Math.round(v), cat: r() < .5 ? 'Manutenção da bike' : 'Equipamento', pag: 'Cartão', desc: r() < .5 ? 'Câmara e remendo' : 'Meia e luva', pais }); }
    if (r() < .08) { const v = 15 + r() * 60; S.gastos.push({ id: novoId(), ex: true, data, valor: Math.round(v), moeda: 'BRL', brl: Math.round(v), cat: 'Turismo e ingressos', pag: 'Pix', desc: 'Entrada de parque', pais }); }
  }
  S.pecas.push({ id: novoId(), ex: true, nome: 'Pneu traseiro', odo: 0, vida: 6000, nota: 'Exemplo' }, { id: novoId(), ex: true, nome: 'Corrente', odo: 0, vida: 3000, nota: 'Exemplo' });
  ordenar(); mudou();
}
export function apagarExemplo(quieto) {
  S.dias = S.dias.filter(d => !d.ex); S.gastos = S.gastos.filter(g => !g.ex); S.pecas = S.pecas.filter(p => !p.ex);
  if (!quieto) mudou();
}
export const temExemplo = () => S.dias.some(d => d.ex) || S.gastos.some(g => g.ex);

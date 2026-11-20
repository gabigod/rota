// Formatação em português do Brasil e contas com datas (AAAA-MM-DD, sempre no horário local)
const nf = (min, max) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
const N0 = nf(0, 0), N1 = nf(1, 1), N2 = nf(2, 2);

export const n0 = v => N0.format(v);
export const n1 = v => N1.format(v);
export const n2 = v => N2.format(v);
export const kmTxt = v => (v >= 1000 ? N0 : N1).format(v) + ' km';
export const brl = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
export const brl0 = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
export function dinheiro(v, moeda) {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda, maximumFractionDigits: moeda === 'CLP' || moeda === 'PYG' ? 0 : 2 }).format(v); }
  catch { return n2(v) + ' ' + moeda; }
}
export function dur(min) {
  if (!(min > 0)) return '0 min';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (m === 60) return `${h + 1} h`;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}
export const pct = v => N0.format(v) + '%';

// ---- datas ----
const p2 = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const hoje = () => iso(new Date());
export const toDate = s => new Date(s + 'T12:00:00');
export const addDias = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return iso(d); };
export const difDias = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
export const mesDe = s => s.slice(0, 7);
export function semanaDe(s) { // segunda-feira da semana
  const d = toDate(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return iso(d);
}
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const mesCurto = s => MESES[+s.slice(5, 7) - 1];
export const mesLongo = s => toDate(s + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
export const dm = s => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
export const dataLonga = s => toDate(s).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
export const diaSemana = s => toDate(s).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');

// números digitados com vírgula ou ponto
export function num(txt) {
  if (txt == null) return NaN;
  let t = String(txt).trim().replace(/\s/g, '');
  if (!t) return NaN;
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(',', '.');
  return Number(t);
}
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

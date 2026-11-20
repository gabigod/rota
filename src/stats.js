// Todas as contas das estatísticas. Recebe o estado e devolve números prontos para a tela.
import { hoje, difDias, addDias, semanaDe, mesDe } from './format.js';

const soma = (l, f) => l.reduce((t, x) => t + (f(x) || 0), 0);
const maior = (l, f) => l.reduce((m, x) => (f(x) > (m ? f(m) : -Infinity) ? x : m), null);

export function calcular(S) {
  const { cfg } = S;
  const dias = [...S.dias].sort((a, b) => a.data.localeCompare(b.data));
  const gastos = S.gastos;
  const pedal = dias.filter(d => d.km > 0);
  const descanso = dias.filter(d => !(d.km > 0));
  const kmTotal = soma(pedal, d => d.km);
  const comTempo = pedal.filter(d => d.min > 0);
  const kmComTempo = soma(comTempo, d => d.km), minTotal = soma(comTempo, d => d.min);
  const subidaTotal = soma(dias, d => d.subida);
  const hj = hoje();

  // quantos dias de viagem: da primeira data (ou da data de saída) até hoje / o último lançamento
  const ultimo = dias.length ? dias[dias.length - 1].data : null;
  const inicio = dias.length ? (dias[0].data < cfg.inicio ? dias[0].data : cfg.inicio) : cfg.inicio;
  const comecou = dias.length > 0 || hj >= cfg.inicio;
  const fimRef = !comecou ? inicio : (ultimo && ultimo > hj ? ultimo : hj);
  const diasViagem = comecou ? difDias(inicio, fimRef) + 1 : 0;
  const faltamParaSair = comecou ? 0 : difDias(hj, cfg.inicio);
  const datas = new Set(dias.map(d => d.data));
  let semRegistro = 0;
  if (comecou) for (let i = 0; i < diasViagem; i++) { const dt = addDias(inicio, i); if (dt <= hj && !datas.has(dt)) semRegistro++; }

  // por data (um dia pode ter mais de uma pedalada)
  const porData = new Map();
  for (const d of dias) { const o = porData.get(d.data) || { data: d.data, km: 0, min: 0, subida: 0, descanso: true }; o.km += d.km || 0; o.min += d.min || 0; o.subida += d.subida || 0; if (d.km > 0) o.descanso = false; porData.set(d.data, o); }
  const diasAgg = [...porData.values()].sort((a, b) => a.data.localeCompare(b.data));

  // maior sequência de dias seguidos pedalando
  let seq = 0, maiorSeq = 0, anterior = null;
  for (const d of diasAgg) {
    if (d.km > 0) { seq = anterior && difDias(anterior, d.data) === 1 ? seq + 1 : 1; maiorSeq = Math.max(maiorSeq, seq); } else seq = 0;
    anterior = d.data;
  }

  // km por semana e por mês
  const semanas = new Map(), meses = new Map();
  for (const d of diasAgg) {
    const s = semanaDe(d.data), m = mesDe(d.data);
    semanas.set(s, (semanas.get(s) || 0) + d.km); meses.set(m, (meses.get(m) || 0) + d.km);
  }
  // preenche semanas/meses vazios entre o primeiro e o último
  const completar = (mapa, passo, ini, fim) => { const out = []; for (let k = ini; k <= fim; k = passo(k)) out.push({ k, v: mapa.get(k) || 0 }); return out; };
  let serieSemanas = [], serieMeses = [];
  if (diasAgg.length) {
    serieSemanas = completar(semanas, k => addDias(k, 7), semanaDe(diasAgg[0].data), semanaDe(fimRef > diasAgg.at(-1).data ? fimRef : diasAgg.at(-1).data));
    const proxMes = k => { const [a, m] = k.split('-').map(Number); return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`; };
    serieMeses = completar(meses, proxMes, mesDe(diasAgg[0].data), mesDe(fimRef > diasAgg.at(-1).data ? fimRef : diasAgg.at(-1).data));
  }

  // acumulado x plano (um ponto por dia de viagem)
  const acumulado = [];
  if (comecou && diasViagem > 0) {
    let ac = 0;
    for (let i = 0; i < diasViagem; i++) {
      const dt = addDias(inicio, i); ac += porData.get(dt)?.km || 0;
      if (dt <= (ultimo && ultimo > hj ? ultimo : hj)) acumulado.push({ data: dt, real: ac, plano: cfg.metaKm * Math.min(1, (i + 1) / cfg.diasPlanejados) });
    }
  }
  const planoHoje = comecou ? cfg.metaKm * Math.min(1, diasViagem / cfg.diasPlanejados) : 0;

  // previsão de chegada no ritmo atual (km por dia corrido, contando descansos)
  let previsao = null;
  if (kmTotal > 0 && diasViagem >= 7) {
    const ritmo = kmTotal / diasViagem, resta = Math.max(0, cfg.metaKm - kmTotal);
    previsao = { ritmo, resta, data: addDias(fimRef, Math.ceil(resta / ritmo)), dias: Math.ceil(resta / ritmo) };
  }

  // gastos
  const totalBRL = soma(gastos, g => g.brl);
  const agrup = (l, chave, val) => { const m = new Map(); for (const x of l) { const k = chave(x); if (k == null) continue; m.set(k, (m.get(k) || 0) + (val(x) || 0)); } return m; };
  const porCat = [...agrup(gastos, g => g.cat || 'Outros', g => g.brl)].sort((a, b) => b[1] - a[1]);
  const porPag = [...agrup(gastos, g => g.pag || 'Outro', g => g.brl)].sort((a, b) => b[1] - a[1]);
  const gMes = agrup(gastos, g => mesDe(g.data), g => g.brl);
  const serieGastoMes = serieMeses.length ? serieMeses.map(m => ({ k: m.k, v: gMes.get(m.k) || 0 })) : [...gMes].sort().map(([k, v]) => ({ k, v }));
  for (const [k] of gMes) if (!serieGastoMes.find(x => x.k === k)) serieGastoMes.push({ k, v: gMes.get(k) });
  serieGastoMes.sort((a, b) => a.k.localeCompare(b.k));
  const gData = agrup(gastos, g => g.data, g => g.brl);
  const diaMaisCaro = [...gData].sort((a, b) => b[1] - a[1])[0] || null;

  // por país
  const paises = new Map();
  const pa = p => { const k = p || 'Outro'; if (!paises.has(k)) paises.set(k, { pais: k, km: 0, dias: 0, pedalados: 0, gasto: 0, subida: 0 }); return paises.get(k); };
  for (const d of dias) { const o = pa(d.pais); o.km += d.km || 0; o.dias++; if (d.km > 0) o.pedalados++; o.subida += d.subida || 0; }
  for (const g of gastos) pa(g.pais).gasto += g.brl || 0;
  const porPais = [...paises.values()].filter(p => p.dias || p.gasto).sort((a, b) => b.km - a.km || b.gasto - a.gasto);

  // pernoites
  const noites = { barraca: 0, pousada: 0, casa: 0, outro: 0 };
  for (const d of dias) if (d.pernoite && noites[d.pernoite] != null) noites[d.pernoite]++;
  const hosp = soma(gastos.filter(g => g.cat === 'Hospedagem'), g => g.brl);
  const noitesPagas = noites.pousada;

  const chuva = dias.filter(d => d.clima === 'Chuva').length;

  const maiorDia = maior(diasAgg.filter(d => d.km > 0), d => d.km);
  const maiorSubida = maior(diasAgg, d => d.subida);
  const maiorTempo = maior(diasAgg, d => d.min);
  const vmaxDia = maior(dias, d => d.vmax || 0);
  let melhorSemana = null; for (const s of serieSemanas) if (!melhorSemana || s.v > melhorSemana.v) melhorSemana = s;

  return {
    vazio: dias.length === 0 && gastos.length === 0,
    comecou, inicio, faltamParaSair, diasViagem, semRegistro,
    kmTotal, pctMeta: cfg.metaKm ? Math.min(100, kmTotal / cfg.metaKm * 100) : 0, planoHoje, noPlano: kmTotal - planoHoje,
    diasPedalados: pedal.length, diasDescanso: descanso.length, diasRegistrados: dias.length,
    kmPorDiaPedalado: pedal.length ? kmTotal / pedal.length : 0,
    kmPorDiaCorrido: diasViagem ? kmTotal / diasViagem : 0,
    minTotal, velMedia: minTotal > 0 ? kmComTempo / (minTotal / 60) : 0,
    velMax: vmaxDia ? vmaxDia.vmax : 0, subidaTotal,
    subidaPorKm: kmTotal ? subidaTotal / kmTotal : 0,
    odometro: cfg.odometro + kmTotal,
    maiorDia, maiorSubida, maiorTempo, maiorSeq, melhorSemana,
    serieSemanas, serieMeses, acumulado, previsao, diasAgg,
    totalBRL, gastoPorDia: diasViagem ? totalBRL / diasViagem : 0, gastoPorKm: kmTotal ? totalBRL / kmTotal : 0,
    porCat, porPag, serieGastoMes, diaMaisCaro, porPais, noites, hosp, custoNoite: noitesPagas ? hosp / noitesPagas : 0, chuva,
    nPaises: porPais.filter(p => p.pais !== 'Outro' && (p.dias || p.gasto)).length
  };
}

// séries extras para a aba Gráficos
export function extras(S, st, N = 60) {
  const hj = hoje(), mapa = new Map(st.diasAgg.map(d => [d.data, d]));
  const gDia = new Map(); for (const g of S.gastos) gDia.set(g.data, (gDia.get(g.data) || 0) + g.brl);
  const fim = st.diasAgg.length && st.diasAgg.at(-1).data > hj ? st.diasAgg.at(-1).data : hj;
  const datas = []; for (let i = N - 1; i >= 0; i--) datas.push(addDias(fim, -i));
  const dd = f => datas.map(dt => ({ data: dt, v: f(mapa.get(dt), dt) || 0 }));
  const ultKm = dd(d => d?.km), ultSub = dd(d => d?.subida), ultH = dd(d => d ? d.min / 60 : 0), ultGasto = dd((d, dt) => gDia.get(dt));
  const ultVel = dd(d => d && d.km > 0 && d.min > 0 ? d.km / (d.min / 60) : 0);
  const semDia = Array.from({ length: 7 }, () => ({ s: 0, n: 0 }));
  for (const d of st.diasAgg) if (d.km > 0) { const w = (new Date(d.data + 'T12:00:00').getDay() + 6) % 7; semDia[w].s += d.km; semDia[w].n++; }
  const faixas = [['até 30 km', 0, 30], ['30–60', 30, 60], ['60–90', 60, 90], ['90–120', 90, 120], ['120+', 120, 1e9]].map(([nome, a, b]) => ({ nome, v: st.diasAgg.filter(d => d.km > a && d.km <= b).length }));
  let ac = 0, as = 0, ag = 0;
  const acSub = [], acGasto = [], acTempo = [];
  const todas = st.diasAgg.length ? Array.from({ length: difDias(st.inicio, fim) + 1 }, (_, i) => addDias(st.inicio, i)) : [];
  let at = 0;
  for (const dt of todas) { as += mapa.get(dt)?.subida || 0; ag += gDia.get(dt) || 0; at += (mapa.get(dt)?.min || 0) / 60; acSub.push({ data: dt, real: as }); acGasto.push({ data: dt, real: ag }); acTempo.push({ data: dt, real: at }); }
  const semG = new Map(); for (const [dt, v] of gDia) { const w = semanaDe(dt); semG.set(w, (semG.get(w) || 0) + v); }
  const serieSemG = st.serieSemanas.map(s => ({ k: s.k, v: semG.get(s.k) || 0 }));
  const velSem = new Map(); for (const d of st.diasAgg) if (d.km > 0 && d.min > 0) { const w = semanaDe(d.data), o = velSem.get(w) || { km: 0, min: 0 }; o.km += d.km; o.min += d.min; velSem.set(w, o); }
  const serieVelSem = st.serieSemanas.map(s => { const o = velSem.get(s.k); return { k: s.k, v: o ? o.km / (o.min / 60) : 0 }; });
  const gMes = new Map(); for (const g of S.gastos) gMes.set(g.data.slice(0, 7), (gMes.get(g.data.slice(0, 7)) || 0) + g.brl);
  const custoKmMes = st.serieMeses.map(m => ({ k: m.k, v: m.v > 0 ? (gMes.get(m.k) || 0) / m.v : 0 }));
  const clima = new Map(); for (const d of S.dias) if (d.clima) clima.set(d.clima, (clima.get(d.clima) || 0) + 1);
  const porCatPorKm = st.porCat.map(([c, v]) => [c, st.kmTotal ? v / st.kmTotal : 0]);
  return { datas, ultKm, ultSub, ultH, ultGasto, ultVel, semDia, faixas, acSub, acGasto, acTempo, serieSemG, serieVelSem, custoKmMes, clima: [...clima].sort((a, b) => b[1] - a[1]), porCatPorKm };
}

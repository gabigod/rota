import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import * as F from './format.js';
import {
  S, PAISES, FLAG, MOEDA_PAIS, MOEDAS, CATS, PAGS, PERNOITES, CLIMAS,
  aoMudar, carregar, salvarAgora, lerTrilha, salvarDia, apagarDia, salvarGasto, apagarGasto, salvarPeca, apagarPeca,
  salvarCfg, salvarTaxa, montarBackup, marcarBackup, lerBackup, carregarExemplo, apagarExemplo, temExemplo
} from './store.js';
import { calcular, extras } from './stats.js';
import { lerArquivo } from './importers.js';
import { barras, linha, hbarras, calor, perfil, forma, cartao } from './charts.js';
import { iniciarNativo, salvarArquivo } from './native.js';

const { n0, n1, n2, kmTxt, brl, brl0, dinheiro, dur, hoje, addDias, difDias, semanaDe, mesCurto, mesLongo, dm, dataLonga, diaSemana, num, esc } = F;
const $ = s => document.querySelector(s);
const TITULOS = { painel: 'Painel', dias: 'Dias', graficos: 'Gráficos', gastos: 'Gastos', mais: 'Mais' };
const NOMES_PERNOITE = PERNOITES;

let aba = 'painel', filtroCat = 'Todas', st = null, pend = null;
const rolagem = {};

// ---------- utilidades de tela ----------
function aviso(txt) {
  const t = $('#toast'); t.textContent = txt; t.classList.add('on');
  clearTimeout(aviso.t); aviso.t = setTimeout(() => t.classList.remove('on'), 3200);
}
const sheetAberta = () => !$('#sheet').hidden;
function abrirSheet(html) {
  $('#sheet-body').innerHTML = html; $('#sheet').hidden = false;
  $('#sheet .sheet').scrollTop = 0;
}
function fecharSheet() { $('#sheet').hidden = true; $('#sheet-body').innerHTML = ''; pend = null; }
function voltar() { if (sheetAberta()) { fecharSheet(); return true; } return false; }
window.__diario = { voltar };

const tile = (v, l, cls = '') => `<div class="tile ${cls}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
const campo = (rot, corpo, dica = '') => `<div class="campo"><label>${rot}</label>${corpo}${dica ? `<small>${dica}</small>` : ''}</div>`;
const opcoes = (lista, atual, rot = x => x) => lista.map(x => { const [v, t] = Array.isArray(x) ? x : [x, rot(x)]; return `<option value="${esc(v)}"${v === atual ? ' selected' : ''}>${esc(t)}</option>`; }).join('');

// ---------- PAINEL ----------
function bannerBackup() {
  if (!S.dias.length && !S.gastos.length) return '';
  const u = S.cfg.ultimoBackup, dias = u ? Math.floor((Date.now() - new Date(u)) / 86400000) : null;
  if (u && dias <= 7) return '';
  return `<div class="banner"><span>${u ? `Seu último backup foi há ${dias} dias.` : 'Você ainda não fez backup dos dados.'}</span><button class="btn p" data-act="exp-backup">Salvar</button></div>`;
}

function telaPainel() {
  if (st.vazio) return `<div class="vazio"><h2>Sua viagem começa aqui</h2><p>Registre cada dia pedalado e cada gasto. Os números e gráficos se montam sozinhos.${st.faltamParaSair ? ` Faltam <b>${st.faltamParaSair}</b> dias para a saída (${F.dm(S.cfg.inicio)}/${S.cfg.inicio.slice(0, 4)}).` : ''}</p>
    <div class="bts"><button class="btn p" data-act="novo-dia">Registrar um dia</button><button class="btn" data-act="importar">Importar arquivo do BSC200</button><button class="btn" data-act="exemplo">Ver com dados de exemplo</button></div></div>`;
  const ex = temExemplo() ? `<div class="banner"><span>Você está vendo dados de exemplo.</span><button class="btn" data-act="limpar-exemplo">Apagar exemplo</button></div>` : '';
  const dif = st.noPlano, ok = dif >= 0;
  const planoPct = S.cfg.metaKm ? Math.min(100, st.planoHoje / S.cfg.metaKm * 100) : 0;
  let o = ex + bannerBackup();
  o += `<div class="hero"><div class="big">${n0(st.kmTotal)}<small>km</small></div>
    <div class="de">de ${n0(S.cfg.metaKm)} km · ${n1(st.pctMeta)}% da volta</div>
    <div class="prog" role="img" aria-label="Progresso"><i style="width:${st.pctMeta}%"></i><b style="left:calc(${planoPct}% - 1px)" title="Onde o plano manda estar hoje"></b></div>
    <div class="leg"><span>0</span><span>a marca preta é o plano de hoje</span><span>${n0(S.cfg.metaKm)}</span></div>
    ${st.comecou ? `<p class="sit ${ok ? 'ok' : 'mal'}">${ok ? `${n0(dif)} km à frente do plano` : `${n0(-dif)} km atrás do plano`}</p>` : ''}</div>`;
  o += `<div class="tiles">${tile(n0(st.diasViagem), 'dias de viagem')}${tile(n0(st.diasPedalados), 'dias pedalando')}${tile(n0(st.diasDescanso), 'dias de descanso')}
    ${tile(n1(st.kmPorDiaPedalado) + '<small> km</small>', 'média por dia pedalado')}${tile(dur(st.minTotal), 'tempo pedalando')}${tile(st.velMedia ? n1(st.velMedia) + '<small> km/h</small>' : '—', 'velocidade média')}
    ${tile(st.velMax ? n1(st.velMax) + '<small> km/h</small>' : '—', 'velocidade máxima')}${tile(n0(st.subidaTotal) + '<small> m</small>', 'subida acumulada')}${tile(n0(st.odometro) + '<small> km</small>', 'odômetro da bike')}</div>`;
  if (st.semRegistro > 0) o += `<p class="nota" style="margin:-4px 4px 12px">${st.semRegistro} ${st.semRegistro === 1 ? 'dia sem registro' : 'dias sem registro'} entre a saída e hoje.</p>`;

  o += `<h2>Gastos</h2><div class="tiles">${tile(brl0(st.totalBRL), 'gasto total', 'd')}${tile(brl(st.gastoPorDia), 'por dia de viagem', 'd')}${tile(brl(st.gastoPorKm), 'por km', 'd')}</div>`;

  if (st.acumulado.length > 1) o += cartao('Km acumulados contra o plano', linha(st.acumulado) + `<div class="chave"><span><i></i>você</span><span><i class="p"></i>plano (${n0(S.cfg.diasPlanejados)} dias)</span></div>`);
  if (st.serieSemanas.length) o += cartao('Km por semana', barras(st.serieSemanas.map(s => ({ v: s.v, x: dm(s.k), t: `Semana de ${dm(s.k)} · ${n0(s.v)} km` })), {}), st.melhorSemana ? `Melhor semana: ${n0(st.melhorSemana.v)} km (a partir de ${dm(st.melhorSemana.k)}).` : '');
  if (st.diasAgg.length) {
    const fim = st.diasAgg.at(-1).data > hoje() ? st.diasAgg.at(-1).data : hoje();
    o += cartao('Calendário de pedaladas', calor(st.diasAgg, st.inicio, fim, { semanaDe, addDias, difDias, dataLonga }), 'Quanto mais escuro, mais km no dia. Contorno = descanso.');
  }
  if (st.previsao) {
    const planoFim = addDias(st.inicio, S.cfg.diasPlanejados - 1), dd = difDias(planoFim, st.previsao.data);
    o += `<section class="card"><h3>Previsão de chegada</h3><div class="rec"><div><span>Ritmo (contando descansos)</span><b>${n1(st.previsao.ritmo)} km/dia</b></div><div><span>Faltam</span><b>${n0(st.previsao.resta)} km</b></div>
      <div><span>Chegada no ritmo atual</span><b>${dataLonga(st.previsao.data)}</b></div><div><span>Chegada pelo plano</span><b>${dataLonga(planoFim)}</b></div>
      <div><span>Diferença</span><b>${dd === 0 ? 'no plano' : dd < 0 ? `${-dd} dias antes` : `${dd} dias depois`}</b></div></div></section>`;
  }
  const rec = [];
  if (st.maiorDia) rec.push(['Maior dia', `${n1(st.maiorDia.km)} km · ${dm(st.maiorDia.data)}`]);
  if (st.maiorSubida && st.maiorSubida.subida > 0) rec.push(['Maior subida', `${n0(st.maiorSubida.subida)} m · ${dm(st.maiorSubida.data)}`]);
  if (st.maiorTempo && st.maiorTempo.min > 0) rec.push(['Mais tempo em cima da bike', `${dur(st.maiorTempo.min)} · ${dm(st.maiorTempo.data)}`]);
  if (st.maiorSeq) rec.push(['Mais dias seguidos pedalando', `${st.maiorSeq} ${st.maiorSeq === 1 ? "dia" : "dias"}`]);
  if (st.chuva) rec.push(['Dias de chuva', String(st.chuva)]);
  if (rec.length) o += `<section class="card"><h3>Recordes</h3><div class="rec">${rec.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div></section>`;
  return o;
}

// ---------- DIAS ----------
function telaDias() {
  const barra = `<div class="bts duas"><button class="btn p" data-act="novo-dia">Novo dia</button><button class="btn" data-act="importar">Importar GPX/FIT</button></div>`;
  if (!S.dias.length) return barra + `<div class="vazio"><p>Nenhum dia registrado ainda.</p></div>`;
  const ord = [...S.dias].sort((a, b) => b.data.localeCompare(a.data));
  let o = barra, mes = null;
  const totMes = new Map();
  for (const d of S.dias) totMes.set(F.mesDe(d.data), (totMes.get(F.mesDe(d.data)) || 0) + (d.km || 0));
  for (const d of ord) {
    const m = F.mesDe(d.data);
    if (m !== mes) { mes = m; o += `<div class="grupo"><span>${esc(mesLongo(m))}</span><span>${n0(totMes.get(m))} km</span></div>`; }
    const descanso = !(d.km > 0);
    const trecho = d.de || d.para ? `${esc(d.de || '?')} → ${esc(d.para || '?')}` : (descanso ? 'Dia de descanso' : 'Pedalada');
    const meta = descanso ? [d.pernoite && NOMES_PERNOITE[d.pernoite], d.clima].filter(Boolean).join(' · ') : [dur(d.min), d.subida ? `↑ ${n0(d.subida)} m` : '', d.clima].filter(x => x && x !== '0 min').join(' · ');
    o += `<button class="linha" data-act="dia" data-id="${d.id}"><div class="dt"><b>${d.data.slice(8)}</b><span>${diaSemana(d.data)}</span></div>
      <div class="mid"><div class="t1">${trecho}</div><div class="t2">${esc(meta) || '&nbsp;'}</div></div><div class="dir">${descanso ? '—' : n1(d.km)}<small>${descanso ? '' : 'km'}</small></div></button>`;
  }
  return o;
}

async function detalheDia(id) {
  const d = S.dias.find(x => x.id === id); if (!d) return;
  let graf = '';
  if (d.trk) { const t = await lerTrilha(id); if (t) graf = (forma(t) ? `<h3>Trajeto</h3>${forma(t)}` : '') + (perfil(t) ? `<h3 style="margin-top:12px">Altitude</h3>${perfil(t)}` : ''); }
  const descanso = !(d.km > 0);
  abrirSheet(`<h2>${esc(dataLonga(d.data))}</h2>
    <p style="margin:-6px 0 14px;color:var(--muted)">${d.de || d.para ? `${esc(d.de || '?')} → ${esc(d.para || '?')}` : ''} ${d.pais ? FLAG[d.pais] || '' : ''}</p>
    <div class="tiles">${descanso ? tile('Descanso', 'dia') : tile(n1(d.km) + '<small> km</small>', 'distância')}${tile(dur(d.min), 'tempo')}${tile(d.km > 0 && d.min > 0 ? n1(d.km / (d.min / 60)) + '<small> km/h</small>' : '—', 'média')}
    ${tile(d.subida ? n0(d.subida) + '<small> m</small>' : '—', 'subida')}${tile(d.vmax ? n1(d.vmax) + '<small> km/h</small>' : '—', 'máxima')}${tile(d.pernoite ? NOMES_PERNOITE[d.pernoite] : '—', 'dormiu em')}</div>
    ${d.clima ? `<p class="nota" style="margin:0 0 8px">Clima: ${esc(d.clima)}</p>` : ''}${d.nota ? `<section class="card"><p style="margin:0;white-space:pre-wrap">${esc(d.nota)}</p></section>` : ''}
    ${graf ? `<section class="card">${graf}</section>` : ''}${d.arquivo ? `<p class="nota">Importado de ${esc(d.arquivo)}</p>` : ''}
    <div class="acoes"><button class="btn" data-act="editar-dia" data-id="${id}">Editar</button><button class="btn d" data-act="apagar-dia" data-id="${id}">Apagar</button><button class="btn tudo" data-act="fechar">Fechar</button></div>`);
}

function formDia(d = {}) {
  const novo = !d.id, min = d.min || 0;
  pend = { base: d, trilha: d._trilha || null };
  abrirSheet(`<h2>${novo ? 'Novo dia' : 'Editar dia'}</h2>
    <form id="f-dia" autocomplete="off"><button type="button" class="btn" style="width:100%;margin-bottom:12px" data-act="imp-form">Preencher com arquivo do BSC200 (GPX ou FIT)</button>
    ${campo('Data', `<input type="date" name="data" required value="${d.data || hoje()}">`)}
    <div class="par">${campo('Distância (km)', `<input name="km" inputmode="decimal" placeholder="0 = descanso" value="${d.km ? n2(d.km).replace('.', '') : ''}">`)}${campo('Velocidade máx. (km/h)', `<input name="vmax" inputmode="decimal" value="${d.vmax ? n1(d.vmax) : ''}">`)}</div>
    <div class="trio">${campo('Horas', `<input name="h" inputmode="numeric" value="${min ? Math.floor(min / 60) : ''}">`)}${campo('Minutos', `<input name="m" inputmode="numeric" value="${min ? Math.round(min % 60) : ''}">`)}${campo('Subida (m)', `<input name="subida" inputmode="numeric" value="${d.subida ? Math.round(d.subida) : ''}">`)}</div>
    <div class="par">${campo('Saí de', `<input name="de" value="${esc(d.de || '')}">`)}${campo('Cheguei em', `<input name="para" value="${esc(d.para || '')}">`)}</div>
    <div class="par">${campo('País', `<select name="pais">${opcoes(PAISES, d.pais || S.cfg.pais)}</select>`)}${campo('Dormi em', `<select name="pernoite"><option value="">—</option>${opcoes(Object.entries(PERNOITES), d.pernoite || '')}</select>`)}</div>
    ${campo('Clima', `<select name="clima"><option value="">—</option>${opcoes(CLIMAS, d.clima || '')}</select>`)}
    ${campo('Anotações', `<textarea name="nota">${esc(d.nota || '')}</textarea>`)}
    <p class="erro" id="erro"></p><div class="acoes"><button type="button" class="btn" data-act="fechar">Cancelar</button><button class="btn p" type="submit">Salvar</button></div></form>`);
}
function lerNumero(f, nome) { const v = num(f.elements[nome].value); return Number.isFinite(v) ? v : 0; }
function enviarDia(ev) {
  ev.preventDefault();
  const f = ev.target, erro = $('#erro');
  const data = f.elements.data.value, km = lerNumero(f, 'km'), min = Math.round(lerNumero(f, 'h') * 60 + lerNumero(f, 'm'));
  if (!data) { erro.textContent = 'Escolha a data.'; return; }
  if (km < 0 || km > 1500) { erro.textContent = 'Distância fora do normal.'; return; }
  const base = pend.base, d = { ...base };
  delete d._trilha;
  Object.assign(d, { data, km, min, subida: lerNumero(f, 'subida'), vmax: lerNumero(f, 'vmax'), pais: f.elements.pais.value, de: f.elements.de.value.trim(), para: f.elements.para.value.trim(), pernoite: f.elements.pernoite.value, clima: f.elements.clima.value, nota: f.elements.nota.value.trim(), fonte: base.fonte || 'manual' });
  const trilha = pend.trilha;
  fecharSheet(); salvarDia(d, trilha); aviso('Dia salvo.');
}

function candidatoParaDia(c) {
  return { data: c.data || hoje(), km: Math.round(c.km * 100) / 100, min: Math.round(c.min), subida: Math.round(c.subida || 0), vmax: Math.round((c.vmax || 0) * 10) / 10, pais: S.cfg.pais, fonte: c.fonte, assinatura: c.assinatura, arquivo: c.arquivo, _trilha: c.trilha };
}
async function lerVarios(files) {
  const novos = [], erros = [];
  for (const f of files) { try { novos.push(...await lerArquivo(f)); } catch (e) { erros.push(`${f.name}: ${e.message}`); } }
  return { novos, erros };
}
async function importarLista(files) {
  if (!files.length) return;
  aviso('Lendo arquivo…');
  const { novos, erros } = await lerVarios(files);
  const ja = new Set(S.dias.map(d => d.assinatura).filter(Boolean));
  const livres = novos.filter(c => !ja.has(c.assinatura));
  const repetidos = novos.length - livres.length;
  if (livres.length === 1 && files.length === 1) { formDia(candidatoParaDia(livres[0])); return; }
  for (const c of livres) { const d = candidatoParaDia(c), tr = d._trilha; delete d._trilha; salvarDia(d, tr); }
  const partes = [];
  if (livres.length) partes.push(`${livres.length} ${livres.length === 1 ? 'dia importado' : 'dias importados'}`);
  if (repetidos) partes.push(`${repetidos} já estava${repetidos > 1 ? 'm' : ''} importado${repetidos > 1 ? 's' : ''}`);
  if (erros.length) partes.push(erros[0]);
  aviso(partes.join(' · ') || 'Nada para importar.');
}
async function importarNoForm(file) {
  if (!file) return;
  try {
    const [c] = await lerArquivo(file); const f = $('#f-dia'); if (!f || !c) return;
    const set = (n, v) => { if (v !== '' && v != null) f.elements[n].value = v; };
    set('data', c.data); set('km', c.km ? n2(c.km).replace('.', '') : ''); set('vmax', c.vmax ? n1(c.vmax) : '');
    const mi = Math.round(c.min); set('h', mi ? Math.floor(mi / 60) : ''); set('m', mi ? mi % 60 : ''); set('subida', c.subida ? Math.round(c.subida) : '');
    pend.trilha = c.trilha; pend.base = { ...pend.base, fonte: c.fonte, assinatura: c.assinatura, arquivo: c.arquivo };
    aviso('Preenchido com os dados do arquivo.');
  } catch (e) { $('#erro').textContent = e.message; }
}

// ---------- GASTOS ----------
function telaGastos() {
  const barra = `<div class="bts"><button class="btn p" data-act="novo-gasto">Novo gasto</button></div>`;
  if (!S.gastos.length) return barra + `<div class="vazio"><p>Nenhum gasto registrado ainda.</p></div>`;
  let o = barra;
  o += `<div class="tiles">${tile(brl0(st.totalBRL), 'total', 'd')}${tile(brl(st.gastoPorDia), 'por dia', 'd')}${tile(brl(st.gastoPorKm), 'por km', 'd')}</div>`;
  const cartaoPag = st.porPag.find(p => p[0] === 'Cartão');
  if (cartaoPag) o += `<p class="nota" style="margin:-4px 4px 12px">${n0(cartaoPag[1] / st.totalBRL * 100)}% do que você gastou foi no cartão.</p>`;
  o += cartao('Por categoria', hbarras(st.porCat.map(([c, v]) => ({ nome: c, v, txt: `${brl0(v)} · ${n0(v / st.totalBRL * 100)}%` }))), '', false);
  if (st.serieGastoMes.length > 1) o += cartao('Gasto por mês', barras(st.serieGastoMes.map(s => ({ v: s.v, x: mesCurto(s.k), t: `${mesLongo(s.k)} · ${brl0(s.v)}` })), { cor: 'var(--side)', fmt: v => n0(v) }));
  if (st.porPag.length > 1) o += cartao('Forma de pagamento', hbarras(st.porPag.map(([c, v]) => ({ nome: c, v, txt: brl0(v) }))), '', false);
  if (st.diaMaisCaro) o += `<p class="nota" style="margin:0 4px 12px">Dia mais caro: ${dataLonga(st.diaMaisCaro[0])} (${brl(st.diaMaisCaro[1])}).</p>`;
  const cats = ['Todas', ...CATS.filter(c => S.gastos.some(g => g.cat === c))];
  o += `<h2>Lançamentos</h2><div class="chips">${cats.map(c => `<button class="chip" data-act="fcat" data-c="${esc(c)}" aria-pressed="${c === filtroCat}">${esc(c)}</button>`).join('')}</div>`;
  const lista = S.gastos.filter(g => filtroCat === 'Todas' || g.cat === filtroCat);
  const soma = lista.reduce((t, g) => t + g.brl, 0);
  if (filtroCat !== 'Todas') o += `<div class="grupo"><span>${esc(filtroCat)}</span><span>${brl(soma)}</span></div>`;
  for (const g of lista) {
    o += `<button class="linha g" data-act="gasto" data-id="${g.id}"><div class="dt"><b>${g.data.slice(8)}</b><span>${mesCurto(g.data)}</span></div><div class="mid"><div class="t1">${esc(g.desc || g.cat)}</div>
      <div class="t2">${esc(g.cat)} · ${esc(g.pag)} ${FLAG[g.pais] || ''}</div></div><div class="dir">${brl(g.brl)}${g.moeda !== 'BRL' ? `<small>${esc(dinheiro(g.valor, g.moeda))}</small>` : ''}</div></button>`;
  }
  return o;
}

function formGasto(g = {}) {
  const novo = !g.id, pais = g.pais || S.cfg.pais, moeda = g.moeda || MOEDA_PAIS[pais] || 'BRL';
  pend = { gBrlManual: !novo };
  abrirSheet(`<h2>${novo ? 'Novo gasto' : 'Editar gasto'}</h2><form id="f-gasto" autocomplete="off">
    <div class="par">${campo('Data', `<input type="date" name="data" required value="${g.data || hoje()}">`)}${campo('País', `<select name="pais">${opcoes(PAISES, pais)}</select>`)}</div>
    <div class="par">${campo('Valor', `<input name="valor" inputmode="decimal" required value="${g.valor ? String(g.valor).replace('.', ',') : ''}">`)}${campo('Moeda', `<select name="moeda">${opcoes(MOEDAS, moeda)}</select>`)}</div>
    <div id="bloco-brl">${campo('Em R$', `<input name="brl" inputmode="decimal" value="${g.brl ? String(g.brl).replace('.', ',') : ''}">`, '<span id="dica-taxa"></span>')}</div>
    <div class="par">${campo('Categoria', `<select name="cat">${opcoes(CATS, g.cat || 'Comida')}</select>`)}${campo('Pago com', `<select name="pag">${opcoes(PAGS, g.pag || 'Cartão')}</select>`)}</div>
    ${campo('Descrição', `<input name="desc" value="${esc(g.desc || '')}" placeholder="opcional">`)}
    <p class="erro" id="erro"></p><div class="acoes"><button type="button" class="btn" data-act="fechar">Cancelar</button><button class="btn p" type="submit">Salvar</button></div></form>`);
  ajustarBRL(true);
}
function ajustarBRL(inicial) {
  const f = $('#f-gasto'); if (!f) return;
  const moeda = f.elements.moeda.value, bloco = $('#bloco-brl'), valor = num(f.elements.valor.value);
  bloco.style.display = moeda === 'BRL' ? 'none' : '';
  if (moeda === 'BRL') return;
  const taxa = S.cfg.taxas[moeda];
  $('#dica-taxa').textContent = taxa ? `Última cotação que você usou: 1 ${moeda} = ${brl(taxa)}. Confira o valor na fatura.` : `Digite quanto custou em reais (veja no app do banco). Eu guardo a cotação para as próximas vezes.`;
  if (!pend.gBrlManual && !inicial || (inicial && !f.elements.brl.value && taxa)) { if (taxa && valor > 0) f.elements.brl.value = n2(valor * taxa).replace('.', ''); else if (!pend.gBrlManual) f.elements.brl.value = ''; }
}
function enviarGasto(ev) {
  ev.preventDefault();
  const f = ev.target, erro = $('#erro'), moeda = f.elements.moeda.value, valor = num(f.elements.valor.value);
  if (!(valor > 0)) { erro.textContent = 'Digite o valor.'; return; }
  let reais = moeda === 'BRL' ? valor : num(f.elements.brl.value);
  if (!(reais > 0)) { erro.textContent = 'Digite quanto deu em reais.'; return; }
  const g = { ...(S.gastos.find(x => x.id === pend.id) || {}), id: pend.id, data: f.elements.data.value, valor, moeda, brl: Math.round(reais * 100) / 100, cat: f.elements.cat.value, pag: f.elements.pag.value, desc: f.elements.desc.value.trim(), pais: f.elements.pais.value };
  fecharSheet(); salvarGasto(g); aviso('Gasto salvo.');
}

function detalheGasto(id) {
  const g = S.gastos.find(x => x.id === id); if (!g) return;
  abrirSheet(`<h2>${esc(g.desc || g.cat)}</h2><div class="tiles">${tile(brl(g.brl), 'em reais', 'd')}${g.moeda !== 'BRL' ? tile(esc(dinheiro(g.valor, g.moeda)), 'valor original', 'd') : ''}${tile(esc(g.cat), 'categoria')}${tile(esc(g.pag), 'pago com')}${tile(dataLonga(g.data), 'data')}${tile((FLAG[g.pais] || '') + ' ' + esc(g.pais || ''), 'país')}</div>
    <div class="acoes"><button class="btn" data-act="editar-gasto" data-id="${id}">Editar</button><button class="btn d" data-act="apagar-gasto" data-id="${id}">Apagar</button><button class="btn tudo" data-act="fechar">Fechar</button></div>`);
}

// ---------- GRÁFICOS ----------
function telaGraficos() {
  if (st.vazio) return `<div class="vazio"><p>Os gráficos aparecem quando você registrar o primeiro dia.</p><div class="bts"><button class="btn" data-act="exemplo">Ver com dados de exemplo</button></div></div>`;
  const X = (l, f = F.dm) => l.map(r => ({ v: r.v, x: f(r.data), t: '' }));
  const dia = (l, fmt, cor, cada) => barras(l.map(r => ({ v: r.v, x: dm(r.data), t: `${dm(r.data)} · ${fmt(r.v)}` })), { cor, fmt: v => n0(v), cada });
  const e = extras(S, st);
  const sem = (l, fmt, cor) => barras(l.map(s => ({ v: s.v, x: dm(s.k), t: `Semana de ${dm(s.k)} · ${fmt(s.v)}` })), { cor, fmt: v => n0(v) });
  const mes = (l, fmt, cor) => barras(l.map(s => ({ v: s.v, x: mesCurto(s.k), t: `${mesLongo(s.k)} · ${fmt(s.v)}` })), { cor, fmt: v => n0(v) });
  const k = v => n1(v) + ' km', R = 'var(--route)', A = 'var(--side)';
  let o = '<h2>Pedaladas</h2>';
  o += cartao('Km por dia (últimos 60 dias)', dia(e.ultKm, k, R, 10));
  if (st.serieMeses.length) o += cartao('Km por mês', mes(st.serieMeses, v => n0(v) + ' km', R));
  o += cartao('Velocidade média por dia (km/h)', dia(e.ultVel, v => n1(v) + ' km/h', R, 10));
  if (st.serieSemanas.length > 1) o += cartao('Velocidade média por semana (km/h)', sem(e.serieVelSem, v => n1(v) + ' km/h', R));
  o += cartao('Horas pedalando por dia', dia(e.ultH, v => n1(v) + ' h', R, 10));
  if (e.acTempo.length > 1) o += cartao('Horas acumuladas', linha(e.acTempo, { un: 'h' }));
  o += cartao('Subida por dia (m)', dia(e.ultSub, v => n0(v) + ' m', R, 10));
  if (e.acSub.length > 1) o += cartao('Subida acumulada (m)', linha(e.acSub, { un: 'm' }));
  const med = e.semDia.map((w, i) => ({ v: w.n ? w.s / w.n : 0, x: ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'][i], t: `${['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][i]} · média ${n1(w.n ? w.s / w.n : 0)} km em ${w.n} dias` }));
  o += cartao('Média de km por dia da semana', barras(med, { cada: 1 }));
  const fx = e.faixas;
  o += cartao('Quantos dias em cada faixa de km', barras(fx.map(f => ({ v: f.v, x: f.nome, t: `${f.nome} · ${f.v} dias` })), { cada: 1, fmt: v => n0(v) }));
  if (e.clima.length) o += `<section class="card"><h3>Clima nos dias</h3>${hbarras(e.clima.map(([c, v]) => ({ nome: c, v, txt: `${v} ${v === 1 ? 'dia' : 'dias'}` })), 'var(--route)')}</section>`;
  if (st.porPais.length) o += `<section class="card"><h3>Km por país</h3>${hbarras(st.porPais.filter(p => p.km > 0).map(p => ({ nome: (FLAG[p.pais] || '') + ' ' + p.pais, v: p.km, txt: n0(p.km) + ' km' })), 'var(--route)')}</section>`;
  o += '<h2>Dinheiro</h2>';
  o += cartao('Gasto por dia (últimos 60 dias, R$)', dia(e.ultGasto, brl0, A, 10));
  if (st.serieSemanas.length > 1) o += cartao('Gasto por semana (R$)', sem(e.serieSemG, brl0, A));
  if (st.serieGastoMes.length > 1) o += cartao('Gasto por mês (R$)', mes(st.serieGastoMes, brl0, A));
  if (e.acGasto.length > 1) o += cartao('Gasto acumulado (R$)', linha(e.acGasto, { un: 'R$', cor: A }));
  if (e.custoKmMes.some(m => m.v > 0)) o += cartao('Custo por km em cada mês (R$)', barras(e.custoKmMes.map(m => ({ v: m.v, x: mesCurto(m.k), t: `${mesLongo(m.k)} · ${brl(m.v)} por km` })), { cor: A, fmt: v => n1(v) }));
  if (st.porCat.length) o += `<section class="card"><h3>Reais por km, por categoria</h3>${hbarras(e.porCatPorKm.map(([c, v]) => ({ nome: c, v, txt: brl(v) })))}</section>`;
  const gp = st.porPais.filter(p => p.gasto > 0);
  if (gp.length) o += `<section class="card"><h3>Gasto por país</h3>${hbarras(gp.map(p => ({ nome: (FLAG[p.pais] || '') + ' ' + p.pais, v: p.gasto, txt: brl0(p.gasto) })))}</section>`;
  return o;
}

// ---------- MAIS ----------
function telaMais() {
  let o = '';
  if (st.porPais.length) {
    o += `<h2>Por país</h2><section class="card"><div class="rec">${st.porPais.map(p => `<div><span>${FLAG[p.pais] || '🌎'} ${esc(p.pais)}</span><b>${n0(p.km)} km · ${p.dias} d · ${brl0(p.gasto)}</b></div>`).join('')}</div></section>`;
  }
  const nn = st.noites, tn = nn.barraca + nn.pousada + nn.casa + nn.outro;
  if (tn) o += `<h2>Onde você dormiu</h2><section class="card">${hbarras(Object.entries(PERNOITES).filter(([k]) => nn[k]).map(([k, t]) => ({ nome: t, v: nn[k], txt: `${nn[k]} ${nn[k] === 1 ? 'noite' : 'noites'}` })), 'var(--route)')}${st.custoNoite ? `<p class="nota">Média de ${brl(st.custoNoite)} por noite de pousada (soma de “Hospedagem” ÷ noites em pousada).</p>` : ''}</section>`;

  o += `<h2>Peças da bike</h2>`;
  if (S.pecas.length) o += S.pecas.map(p => { const uso = Math.max(0, st.odometro - p.odo), pc = p.vida ? Math.min(100, uso / p.vida * 100) : 0; return `<button class="linha peca" data-act="peca" data-id="${p.id}"><div class="mid"><div class="t1">${esc(p.nome)}</div><div class="t2">${n0(uso)} km${p.vida ? ` de ${n0(p.vida)} km` : ''}</div>${p.vida ? `<div class="barra"><i class="${pc >= 85 ? 'alto' : ''}" style="width:${pc}%"></i></div>` : ''}</div></button>`; }).join('');
  o += `<div class="bts"><button class="btn" data-act="nova-peca">Adicionar peça</button></div>`;

  o += `<h2>Dados</h2><div class="menu">
    <button data-act="exp-backup"><span>Salvar backup<small>Gera um arquivo para guardar no Drive${S.cfg.ultimoBackup ? ` · último em ${dataLonga(F.iso(new Date(S.cfg.ultimoBackup)))}` : ''}</small></span><span class="seta">›</span></button>
    <button data-act="imp-backup"><span>Restaurar backup<small>Abre um arquivo salvo antes</small></span><span class="seta">›</span></button>
    <button data-act="csv-dias"><span>Dias em planilha (CSV)</span><span class="seta">›</span></button>
    <button data-act="csv-gastos"><span>Gastos em planilha (CSV)</span><span class="seta">›</span></button></div>
    <h2>Ajustes</h2><div class="menu"><button data-act="cfg"><span>Viagem e cotações<small>Saída ${dataLonga(S.cfg.inicio)} · ${n0(S.cfg.metaKm)} km · ${n0(S.cfg.diasPlanejados)} dias</small></span><span class="seta">›</span></button>
    ${temExemplo() ? '<button data-act="limpar-exemplo"><span>Apagar dados de exemplo</span><span class="seta">›</span></button>' : (!S.dias.length && !S.gastos.length ? '<button data-act="exemplo"><span>Ver com dados de exemplo</span><span class="seta">›</span></button>' : '')}</div>
    <p class="nota" style="text-align:center">Tudo fica só no seu celular. O backup é o seu seguro: salve no Drive de vez em quando.</p>`;
  return o;
}

function formCfg() {
  const taxas = MOEDAS.filter(m => m !== 'BRL');
  abrirSheet(`<h2>Viagem e cotações</h2><form id="f-cfg" autocomplete="off">
    ${campo('Data de saída', `<input type="date" name="inicio" value="${S.cfg.inicio}">`)}
    <div class="par">${campo('Meta (km)', `<input name="metaKm" inputmode="decimal" value="${S.cfg.metaKm}">`)}${campo('Dias planejados', `<input name="dias" inputmode="numeric" value="${S.cfg.diasPlanejados}">`)}</div>
    ${campo('Km que a bike já tinha', `<input name="odo" inputmode="decimal" value="${S.cfg.odometro || ''}">`, 'Para o odômetro e o desgaste das peças.')}
    <h3 style="margin-top:16px">Cotações (quanto vale 1 em reais)</h3><p class="nota" style="margin:0 0 10px">Se ficar vazio, o app pede o valor em R$ no gasto e guarda a cotação.</p>
    ${taxas.map(m => `<div class="cot"><span>1 ${m} =</span><input name="t-${m}" inputmode="decimal" placeholder="R$" value="${S.cfg.taxas[m] ? String(Math.round(S.cfg.taxas[m] * 100000) / 100000).replace('.', ',') : ''}" style="border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:10px 12px;min-height:44px;width:100%"></div>`).join('')}
    <p class="erro" id="erro"></p><div class="acoes"><button type="button" class="btn" data-act="fechar">Cancelar</button><button class="btn p" type="submit">Salvar</button></div></form>`);
}
function enviarCfg(ev) {
  ev.preventDefault(); const f = ev.target;
  const meta = num(f.elements.metaKm.value), dias = Math.round(num(f.elements.dias.value));
  if (!(meta > 0) || !(dias > 0) || !f.elements.inicio.value) { $('#erro').textContent = 'Confira a data, a meta e os dias.'; return; }
  const odo = num(f.elements.odo.value);
  for (const m of MOEDAS) if (m !== 'BRL') { const v = num(f.elements['t-' + m].value); salvarTaxa(m, Number.isFinite(v) ? v : 0); }
  fecharSheet(); salvarCfg({ inicio: f.elements.inicio.value, metaKm: meta, diasPlanejados: dias, odometro: Number.isFinite(odo) ? odo : 0 }); aviso('Ajustes salvos.');
}
function formPeca(p = {}) {
  pend = { id: p.id };
  abrirSheet(`<h2>${p.id ? 'Editar peça' : 'Nova peça'}</h2><form id="f-peca" autocomplete="off">
    ${campo('Peça', `<input name="nome" required value="${esc(p.nome || '')}" placeholder="Pneu traseiro, corrente…">`)}
    ${campo('Odômetro quando instalou (km)', `<input name="odo" inputmode="decimal" value="${p.odo != null ? p.odo : Math.round(st.odometro)}">`, 'O odômetro de hoje já vem preenchido.')}
    ${campo('Vida útil estimada (km)', `<input name="vida" inputmode="decimal" value="${p.vida || ''}" placeholder="opcional">`)}
    <p class="erro" id="erro"></p><div class="acoes">${p.id ? '<button type="button" class="btn d" data-act="apagar-peca" data-id="' + p.id + '">Apagar</button>' : '<button type="button" class="btn" data-act="fechar">Cancelar</button>'}<button class="btn p" type="submit">Salvar</button></div></form>`);
}
function enviarPeca(ev) {
  ev.preventDefault(); const f = ev.target, nome = f.elements.nome.value.trim();
  if (!nome) { $('#erro').textContent = 'Dê um nome à peça.'; return; }
  const odo = num(f.elements.odo.value), vida = num(f.elements.vida.value);
  const old = S.pecas.find(x => x.id === pend.id) || {};
  fecharSheet(); salvarPeca({ ...old, id: pend.id, nome, odo: Number.isFinite(odo) ? odo : 0, vida: Number.isFinite(vida) ? vida : 0 });
}

function confirmar(titulo, texto, rotulo, act, id) {
  abrirSheet(`<h2>${esc(titulo)}</h2><p style="color:var(--muted)">${esc(texto)}</p><div class="acoes"><button class="btn" data-act="fechar">Cancelar</button><button class="btn d" data-act="${act}" data-id="${id || ''}">${esc(rotulo)}</button></div>`);
}

// ---------- backup e CSV ----------
async function fazerBackup() {
  try {
    const txt = await montarBackup();
    const ok = await salvarArquivo(`diario-da-viagem-${hoje()}.json`, txt, 'application/json');
    if (ok) { marcarBackup(); aviso('Backup gerado. Salve no Drive.'); }
  } catch (e) { aviso('Não consegui gerar o backup: ' + e.message); }
}
function escolherModoBackup(texto) {
  let j; try { j = JSON.parse(texto); if (j.app !== 'diario-da-viagem') throw 0; } catch { aviso('Esse arquivo não é um backup do Diário da Viagem.'); return; }
  pend = { texto };
  abrirSheet(`<h2>Restaurar backup</h2><p style="color:var(--muted)">O arquivo tem ${(j.estado.dias || []).length} dias e ${(j.estado.gastos || []).length} gastos (salvo em ${j.exportadoEm ? dataLonga(F.iso(new Date(j.exportadoEm))) : '?'}).</p>
    <div class="bts"><button class="btn p" data-act="restaurar" data-modo="mesclar">Juntar com o que já tenho</button><button class="btn d" data-act="restaurar" data-modo="substituir">Substituir tudo</button><button class="btn" data-act="fechar">Cancelar</button></div>`);
}
const csv = (cab, linhas) => '﻿' + [cab, ...linhas].map(l => l.map(c => { const s = typeof c === 'number' ? String(c).replace('.', ',') : String(c ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\r\n');
async function exportarCSV(tipo) {
  try {
    const txt = tipo === 'dias'
      ? csv(['data', 'km', 'minutos', 'subida_m', 'vel_max_kmh', 'pais', 'saiu_de', 'chegou_em', 'dormiu_em', 'clima', 'nota'], S.dias.map(d => [d.data, d.km, d.min, Math.round(d.subida || 0), d.vmax || 0, d.pais || '', d.de || '', d.para || '', d.pernoite || '', d.clima || '', d.nota || '']))
      : csv(['data', 'valor', 'moeda', 'reais', 'categoria', 'pagamento', 'descricao', 'pais'], S.gastos.map(g => [g.data, g.valor, g.moeda, g.brl, g.cat, g.pag, g.desc || '', g.pais || '']));
    await salvarArquivo(`${tipo}-${hoje()}.csv`, txt, 'text/csv');
  } catch (e) { aviso('Não consegui exportar: ' + e.message); }
}

// ---------- desenho ----------
function render() {
  st = calcular(S);
  const t = $('#tela');
  if (t._aba) rolagem[t._aba] = t.scrollTop;
  t._aba = aba;
  t.innerHTML = aba === 'painel' ? telaPainel() : aba === 'dias' ? telaDias() : aba === 'graficos' ? telaGraficos() : aba === 'gastos' ? telaGastos() : telaMais();
  t.scrollTop = rolagem[aba] || 0;
  $('#tit').textContent = TITULOS[aba];
  document.querySelectorAll('#abas button').forEach(b => { if (b.dataset.aba === aba) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  $('#fab').hidden = aba === 'mais' || aba === 'graficos';
  t.querySelectorAll('[data-fim]').forEach(e => { e.scrollLeft = e.scrollWidth; });
}
let quer = false;
function pedirRender() { if (quer) return; quer = true; requestAnimationFrame(() => { quer = false; render(); }); }

// ---------- eventos ----------
document.addEventListener('click', async ev => {
  const t = ev.target.closest('[data-act],[data-t]'); if (!t) return;
  if (t.dataset.t != null && !t.dataset.act) { const l = t.closest('.card')?.querySelector('.leitura'); if (l) l.textContent = t.dataset.t; return; }
  const id = t.dataset.id;
  switch (t.dataset.act) {
    case 'aba': aba = t.dataset.aba; render(); break;
    case 'fab': aba === 'gastos' ? formGasto() : formDia(); break;
    case 'novo-dia': formDia(); break;
    case 'novo-gasto': formGasto(); break;
    case 'importar': $('#arq').value = ''; $('#arq').click(); break;
    case 'imp-form': $('#arq1').value = ''; $('#arq1').click(); break;
    case 'dia': detalheDia(id); break;
    case 'editar-dia': formDia(S.dias.find(d => d.id === id)); break;
    case 'apagar-dia': confirmar('Apagar este dia?', 'Isso não dá para desfazer.', 'Apagar', 'apagar-dia-ok', id); break;
    case 'apagar-dia-ok': fecharSheet(); apagarDia(id); aviso('Dia apagado.'); break;
    case 'gasto': detalheGasto(id); break;
    case 'editar-gasto': { const g = S.gastos.find(x => x.id === id); formGasto(g); pend.id = id; break; }
    case 'apagar-gasto': confirmar('Apagar este gasto?', 'Isso não dá para desfazer.', 'Apagar', 'apagar-gasto-ok', id); break;
    case 'apagar-gasto-ok': fecharSheet(); apagarGasto(id); aviso('Gasto apagado.'); break;
    case 'fcat': filtroCat = t.dataset.c; render(); break;
    case 'nova-peca': formPeca(); break;
    case 'peca': formPeca(S.pecas.find(p => p.id === id)); break;
    case 'apagar-peca': fecharSheet(); apagarPeca(id); break;
    case 'cfg': formCfg(); break;
    case 'exp-backup': fazerBackup(); break;
    case 'imp-backup': $('#arqbk').value = ''; $('#arqbk').click(); break;
    case 'restaurar': { const r = await lerBackup(pend.texto, t.dataset.modo); fecharSheet(); aviso(`Restaurado: ${r.dias} dias e ${r.gastos} gastos.`); break; }
    case 'csv-dias': exportarCSV('dias'); break;
    case 'csv-gastos': exportarCSV('gastos'); break;
    case 'exemplo': carregarExemplo(); aba = 'painel'; break;
    case 'limpar-exemplo': apagarExemplo(); aviso('Exemplo apagado.'); break;
    case 'fechar': fecharSheet(); break;
  }
});
document.addEventListener('submit', ev => {
  const id = ev.target.id;
  if (id === 'f-dia') enviarDia(ev); else if (id === 'f-gasto') { if (!pend.id && pend.id !== undefined) { /* novo */ } enviarGasto(ev); } else if (id === 'f-cfg') enviarCfg(ev); else if (id === 'f-peca') enviarPeca(ev);
});
document.addEventListener('input', ev => {
  const f = ev.target.form; if (!f || f.id !== 'f-gasto') return;
  if (ev.target.name === 'brl') pend.gBrlManual = true;
  if (ev.target.name === 'valor' || ev.target.name === 'moeda') { if (ev.target.name === 'moeda') pend.gBrlManual = false; ajustarBRL(); }
});
document.addEventListener('change', ev => { // trocar o país do gasto sugere a moeda daquele país
  const f = ev.target.form;
  if (f && f.id === 'f-gasto' && ev.target.name === 'pais') { f.elements.moeda.value = MOEDA_PAIS[ev.target.value] || 'BRL'; pend.gBrlManual = false; ajustarBRL(); }
});
$('#arq').addEventListener('change', e => importarLista([...e.target.files]));
$('#arq1').addEventListener('change', e => importarNoForm(e.target.files[0]));
$('#arqbk').addEventListener('change', async e => { const f = e.target.files[0]; if (f) escolherModoBackup(await f.text()); });
document.addEventListener('visibilitychange', () => { if (document.hidden) salvarAgora(); });
window.addEventListener('pagehide', salvarAgora);

aoMudar(pedirRender);
iniciarNativo(voltar);
carregar().then(render);
render();

import json, math, re, sys
G = sys.argv[1]
OUT = sys.argv[2]

def gpx(path):
    s = open(path).read()
    pts = re.findall(r'<trkpt lat="([-\d.]+)" lon="([-\d.]+)"><ele>([-\d.]+)</ele>', s)
    return [(float(a), float(b), float(e)) for a, b, e in pts]

def hav(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2*R*math.asin(math.sqrt(h))

track = []
boat_at = set()
for f in ['a.gpx', 'b.gpx', 'c.gpx', 'n1.gpx', 'n2.gpx', 'n3.gpx', 'n4.gpx', 'n5.gpx', 'n6.gpx', 'n7.gpx']:
    p = gpx(f'{G}/{f}')
    if track and hav(track[-1], p[0]) < 0.05:
        p = p[1:]
    elif track:
        print('gap before', f, hav(track[-1], p[0]))
        boat_at.add(len(track))
    track += p
exec(open(sys.argv[0].replace('build.py','stops_ve.py')).read())
exec(open(sys.argv[0].replace('build.py','stops_n.py')).read())
exec(open(sys.argv[0].replace('build.py','stops_and.py')).read())
exec(open(sys.argv[0].replace('build.py','stops_volta.py')).read())
exec(open(sys.argv[0].replace('build.py','stops_int.py')).read())
scale = {}
pending_gap = False
aprox = []
def near(t, c):
    return min(range(len(t)), key=lambda i: (t[i][0]-c[0])**2 + (t[i][1]-c[1])**2)
for seg in SEGS:
    if seg[0] == 'gap':
        pending_gap = True
        continue
    if pending_gap:
        boat_at.add(len(track)); pending_gap = False
        t0 = gpx(f'{G}/{seg[1]}')
        a = near(t0, seg[2]) if seg[2] else 0
        b = near(t0, seg[3]) if seg[3] else len(t0) - 1
        track += t0[a:b+1]
        continue
    if seg[0] == 'gpx':
        t = gpx(f'{G}/{seg[1]}')
        a = near(t, seg[2]) if seg[2] else 0
        b = near(t, seg[3]) if seg[3] else len(t) - 1
        t = t[a:b+1]
        if len(seg) > 4 and seg[4] == 'rev': t = t[::-1]
        if hav(track[-1], t[0]) < 0.3: t = t[1:]
        else: print('VE gap', seg[1], hav(track[-1], t[0]))
        track += t
    else:
        pts, km = seg[1], seg[2]
        dense = []
        for (la1, lo1, e1), (la2, lo2, e2) in zip(pts, pts[1:]):
            n = max(2, int(hav((la1, lo1), (la2, lo2)) / 0.5))
            for k in range(n):
                f = k / n
                dense.append((la1 + (la2-la1)*f, lo1 + (lo2-lo1)*f, e1 + (e2-e1)*f))
        dense.append(pts[-1])
        if hav(track[-1], dense[0]) < 0.3: dense = dense[1:]
        L = sum(hav(dense[k], dense[k+1]) for k in range(len(dense)-1)) + hav(track[-1], dense[0])
        f = km / L
        a = len(track)
        track += dense
        for i in range(a, len(track)): scale[i] = f
        aprox.append((a - 1, len(track) - 1))
        print('aprox seg', km, 'poly', round(L), 'f', round(f, 2))
cum = [0.0]
for i in range(1, len(track)):
    cum.append(cum[-1] + (0 if i in boat_at else hav(track[i-1], track[i]) * scale.get(i, 1)))
barcos = []
for k_, i in enumerate(sorted(boat_at)):
    if 'GAP_PATHS' in globals() and k_ < len(GAP_PATHS) and GAP_PATHS[k_]:
        barcos += [RIVER[x] for x in GAP_PATHS[k_]]
    elif 'GAP_PATHS' not in globals() and k_ == 1:
        barcos += [RIVER['santarem'], RIVER['manaus']]
    elif 'GAP_PATHS' not in globals() and k_ == 2:
        barcos += [RIVER[x] for x in GAP3]
    else:
        barcos.append([[round(track[i-1][1],4), round(track[i-1][0],4)], [round(track[i][1],4), round(track[i][0],4)]])
def plen(c): return sum(hav((c[k][1], c[k][0]), (c[k+1][1], c[k+1][0])) for k in range(len(c)-1))
BARCO_KM = {k: round(plen(v)) for k, v in RIVER.items()}
print('barco km', BARCO_KM)
# equator crossing
EQ = None
for k in range(1, len(track)):
    if track[k-1][0] < 0 <= track[k][0]:
        EQ = track[k]; break
print('total km', cum[-1], len(track))

def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[1]-a[1], b[0]-a[0]
    L = math.hypot(dx, dy) or 1e-12
    dmax, idx = 0, 0
    for i in range(1, len(pts)-1):
        p = pts[i]
        d = abs(dy*(p[1]-a[1]) - dx*(p[0]-a[0]))/L
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(pts[:idx+1], eps)[:-1] + rdp(pts[idx:], eps)
    return [a, b]

sys.setrecursionlimit(100000)

# stops: id, name, lat, lon, kind, onroute
stops = [
 dict(id='tanque-novo', nome='Tanque Novo', lat=-13.5484, lon=-42.4897, tipo='Partida', dias=0,
      resumo='Casa. Ponto de partida da volta pela América do Sul.',
      fazer=['Revisar bike e bagagem com calma antes de sair', 'Primeiro dia curto até Paramirim para testar o peso'],
      dica='Saia cedo: a manhã é a parte mais fresca do dia no sertão.'),
 dict(id='paramirim', nome='Paramirim', lat=-13.4425, lon=-42.2386, tipo='Apoio', dias=0,
      resumo='Cidade de apoio no vale do Paramirim. Mercado, água e pousada simples.',
      fazer=['Reabastecer água antes do trecho seco até Livramento'],
      dica='Trecho quente e com pouca sombra; leve pelo menos 3 litros.'),
 dict(id='livramento', nome='Livramento de Nossa Senhora', lat=-13.6428, lon=-41.8411, tipo='Apoio', dias=0,
      resumo='Pé da serra. Daqui começa a subida forte até Rio de Contas.',
      fazer=['Comer bem antes da serra', 'Cachoeira do Véu de Noiva fica no caminho da subida'],
      dica='A subida tem uns 600 m de desnível em pouco mais de 10 km. Faça de manhã.'),
 dict(id='rio-de-contas', nome='Rio de Contas', lat=-13.5789, lon=-41.8114, tipo='Base', dias=1,
      resumo='Cidade colonial do século XVIII, tombada, a mais de 1.000 m de altitude. Clima fresco.',
      fazer=['Centro histórico e Igreja de Santana', 'Cachoeira do Fraga e Poço do Raposo', 'Dia parado para descansar as pernas'],
      dica='Alternativa de terra: Catolés e Pico do Barbado (ponto mais alto do Nordeste) via Piatã até Mucugê. São uns 144 km com 2.780 m de subida.'),
 dict(id='ibicoara', nome='Ibicoara', lat=-13.409, lon=-41.284, tipo='Base', dias=1,
      resumo='Base para a Cachoeira do Buracão, uma das mais bonitas da Chapada.',
      fazer=['Bate-volta de bike até o Buracão (58 km ida e volta)'],
      dica='Guia local é obrigatório no Buracão. Combine na véspera em Ibicoara.'),
 dict(id='buracao', nome='Cachoeira do Buracão', lat=-13.3157, lon=-41.1626, tipo='Bate-volta', dias=0, lateral=True, km_extra=58,
      resumo='Cachoeira de uns 85 m dentro de um cânion. Chega-se nadando pelo rio entre paredões.',
      fazer=['Nadar pelo cânion até a queda', 'Mirante no alto da cachoeira'],
      dica='Vale o desvio. Estrada de terra no final; leve colete se for nadar com pouca experiência.'),
 dict(id='mucuge', nome='Mucugê', lat=-13.005, lon=-41.371, tipo='Base', dias=1,
      resumo='Cidade do ciclo do diamante. Noites frias, centro histórico bem conservado.',
      fazer=['Cemitério Bizantino', 'Parque Municipal da Sempre-Viva', 'Projeto Sempre Viva e cachoeiras do Tiburtino'],
      dica='Leve agasalho: à noite pode fazer menos de 15 °C.'),
 dict(id='andarai', nome='Andaraí', lat=-12.807, lon=-41.331, tipo='Base', dias=1,
      resumo='Porta de entrada do Vale do Pati e de Igatu.',
      fazer=['Igatu, a "Machu Picchu baiana", uns 6 km de subida em pedra', 'Opcional: trekking de 3 a 5 dias no Vale do Pati (a pé, deixando a bike na cidade)'],
      dica='A subida para Igatu é calçamento de pedra irregular. Dá para ir de bike sem bagagem.'),
 dict(id='lencois', nome='Lençóis', lat=-12.563, lon=-41.389, tipo='Base', dias=2,
      resumo='Capital turística da Chapada Diamantina. Muita estrutura, campings e agências.',
      fazer=['Ribeirão do Meio (escorregador natural, trilha fácil)', 'Rio Serrano e Salão de Areias', 'Bom ponto para revisar a bike'],
      dica='Os passeios mais longes da cidade costumam exigir carro; foque no que dá a pé.'),
 dict(id='capao', nome='Vale do Capão', lat=-12.6095, lon=-41.5013, tipo='Base', dias=2,
      resumo='Vila alternativa no meio das serras, com muitos campings.',
      fazer=['Cachoeira da Fumaça por cima (uns 6 km de trilha, ida)', 'Riachinho e Poço Angélica'],
      dica='Sinal de celular fraco. Baixe os mapas offline antes de subir.'),
 dict(id='pai-inacio', nome='Morro do Pai Inácio', lat=-12.4556, lon=-41.4731, tipo='Atração', dias=0,
      resumo='Cartão-postal da Chapada, na BR-242. Subida curta a pé até o topo.',
      fazer=['Pôr do sol no topo', 'Bate-volta para Pratinha e Lapa Doce'],
      dica='Abre das 9h às 17h. Dá para deixar a bike na base.'),
 dict(id='pratinha', nome='Gruta da Pratinha e Lapa Doce', lat=-12.3535, lon=-41.5402, tipo='Bate-volta', dias=0, lateral=True, km_extra=39,
      resumo='Água azul dentro de gruta (Pratinha) e uma das maiores cavernas da região (Lapa Doce), em Iraquara.',
      fazer=['Flutuar na Pratinha', 'Visita guiada na Lapa Doce'],
      dica='Substitui o Poço Azul e o Poço Encantado com menos desvio (39 km contra 75 km).'),
 dict(id='itaberaba', nome='Itaberaba', lat=-12.527, lon=-40.306, tipo='Apoio', dias=0,
      resumo='Cidade grande no meio do trecho até o Recôncavo. Boa para descansar e comprar peças.',
      fazer=['Lojas de bike e mercado grande'],
      dica='BR-242 tem caminhões. Use o acostamento e luz traseira mesmo de dia.'),
 dict(id='cachoeira', nome='Cachoeira', lat=-12.605, lon=-38.964, tipo='Atração', dias=1,
      resumo='Cidade histórica do Recôncavo, à beira do Rio Paraguaçu, ligada a São Félix por ponte de ferro.',
      fazer=['Casario colonial e Irmandade da Boa Morte', 'Atravessar a ponte para São Félix'],
      dica='Trecho final até Salvador tem trânsito pesado. Entre na cidade cedo, num domingo se der.'),
 dict(id='salvador', nome='Salvador', lat=-12.9736, lon=-38.5097, tipo='Base', dias=3,
      resumo='Primeira capital do Brasil. Pelourinho, Farol da Barra e a orla.',
      fazer=['Pelourinho e Elevador Lacerda', 'Pôr do sol no Farol da Barra', 'Sair pela orla até Itapuã rumo ao norte'],
      dica='Guarde a bike na hospedagem para andar no centro histórico.'),
 dict(id='praia-do-forte', nome='Praia do Forte', lat=-12.5774, lon=-38.002, tipo='Atração', dias=1,
      resumo='Vila na Linha Verde com a base do Projeto Tamar.',
      fazer=['Projeto Tamar', 'Piscinas naturais na maré baixa'],
      dica='Vila cara. Bom para água e comida; durma em camping ou mais adiante.'),
 dict(id='imbassai', nome='Imbassaí', lat=-12.4999, lon=-37.9594, tipo='Atração', dias=1,
      resumo='Rio de água escura encontrando o mar entre dunas.',
      fazer=['Banho no encontro do rio com o mar'],
      dica='A Linha Verde segue com bom acostamento até a divisa.'),
 dict(id='mangue-seco', nome='Mangue Seco', lat=-11.4566, lon=-37.359, tipo='Fim da Bahia', dias=1,
      resumo='Dunas na ponta norte da Bahia, na foz do Rio Real. Fim do trecho baiano.',
      fazer=['Passeio nas dunas', 'Travessia de barco para Sergipe'],
      dica='A vila não tem carro; a travessia de barco para o lado de Sergipe é pelo Rio Real.'),
]

exec(open(sys.argv[0].replace('build.py','stops_ne.py')).read())
for s in stops: s.setdefault('uf', 'BA')
for s in stops:
    if s['id'] == 'mangue-seco': s['tipo'] = 'Divisa'; s['dica'] = 'A vila não tem carro. Para seguir, pegue o barco pelo Rio Real até o Pontal, já em Sergipe.'
stops += NE
for x in NORTE:
    if x['id'] == 'equador': x['lat'], x['lon'] = round(EQ[0], 4), round(EQ[1], 4)
stops += NORTE
stops += [x for x in VE if x['id'] in VE_KEEP]
stops += AND
stops += VOLTA
stops = [x for x in stops if x['id'] not in REMOVE]
for x in INT: x['uf'] = None
stops += INT
for x in stops:
    if x['id'] == 'medellin':
        x['tipo'] = 'Base'; x['dica'] = 'Ponto de virada do arco. Daqui a rota volta para o sul por Bogotá e pelo sul da Colômbia.'
for x in stops:
    if x['id'] == 'gran-sabana':
        x['dica'] = 'Ponto de volta. Daqui você retorna a Pacaraima; de Boa Vista a Manaus a sugestão é ônibus (umas 12 h, a bike vai no bagageiro) para não repetir 1.000 km de BR-174.'
        x['resumo'] = 'Planalto aberto de savana com tepuis no horizonte e cachoeiras ao lado da estrada. Ponto mais ao norte da rota na Venezuela.'
# locate onroute stops monotonic
j = 0
for s in stops:
    if s.get('lateral'):
        continue
    if s['id'] == 'santarem' or s.get('semTrilha'):
        s['idx'] = j; s['km'] = round(cum[j], 1); s['ele'] = None
        continue
    best, bi = 1e9, j
    for i in range(j, len(track)):
        d = hav((s['lat'], s['lon']), track[i])
        if d < best:
            best, bi = d, i
        if cum[i] - cum[j] > 600:
            break
    s['idx'] = bi
    s['km'] = round(cum[bi], 1)
    s['ele'] = round(track[bi][2])
    j = bi
    print(s['nome'], s['km'], round(best, 2))
# laterals: attach to previous onroute stop
prev = None
for s in stops:
    if s.get('lateral'):
        s['km'] = prev['km']
        s['de'] = prev['id']
    else:
        prev = s

def gain(seg):
    # smooth elevation with 7-pt moving average then sum ups
    e = [p[2] for p in seg]
    k = 5
    sm = [sum(e[max(0,i-k):i+k+1])/len(e[max(0,i-k):i+k+1]) for i in range(len(e))]
    up = sum(max(0, sm[i]-sm[i-1]) for i in range(1, len(sm)))
    return round(up)

onr = [s for s in stops if not s.get('lateral')]
etapas = []
for a, b in zip(onr, onr[1:]):
    seg = track[a['idx']:b['idx']+1]
    etapas.append(dict(de=a['id'], para=b['id'], km=round(cum[b['idx']]-cum[a['idx']], 1), subida=gain(seg),
                       max=round(max(p[2] for p in seg))))
    if b['id'] in BARCO_DIAS:
        etapas[-1].update(km=0, subida=0, barco=dict(km=BARCO_KM[b['id']], dias=BARCO_DIAS[b['id']], texto=globals().get('BARCO_TEXTO', {}).get(b['id'])))
print(etapas[-6:])
total_gain = sum(e['subida'] for e in etapas)
byid = {x['id']: x for x in stops}

cuts = [0] + sorted(boat_at) + [len(track)]
line, line_aprox = [], []
for a, b in zip(cuts, cuts[1:]):
    pos = a
    for (x, y) in [r for r in aprox if r[0] >= a and r[1] < b]:
        line.append([[round(p[1], 4), round(p[0], 4)] for p in rdp(track[pos:x+1], 0.0012)])
        line_aprox.append([[round(p[1], 4), round(p[0], 4)] for p in rdp(track[x:y+1], 0.0012)])
        pos = y
    line.append([[round(p[1], 4), round(p[0], 4)] for p in rdp(track[pos:b], 0.0012)])
line = [l for l in line if len(l) > 1]
print('line pts', len(line))
# profile every 1 km
prof = []
t = 0.0
i = 0
while t <= cum[-1]:
    while i < len(cum)-1 and cum[i+1] < t:
        i += 1
    prof.append([round(track[i][2]), round(track[i][1],3), round(track[i][0],3)])
    t += 1.0

def side(f):
    p = gpx(f'{G}/{f}')
    return [[round(q[1], 4), round(q[0], 4)] for q in rdp(p, 0.0008)]

br = json.load(open(f'{G}/br.json'))
keep = {'BA', 'SE', 'AL', 'PE', 'PI', 'TO', 'GO', 'MG', 'ES', 'MA', 'PB', 'RN', 'CE', 'DF', 'PA'}
ROUTE_UF = ['BA','SE','AL','PE','PB','RN','CE','PI','MA','TO','GO','DF','MT','PA','AM','RR','VE','PEX','EC','CO','BO','CL','AR','PY','UY','PR','SP','RJ','MG','MS']
full = {}
states = []
for f in br['features']:
    sg = f['properties']['sigla']
    if sg in ('AC','RO','SC','RS'):
        continue
    g = f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    out = []
    for poly in polys:
        ring = poly[0]
        rr = [(c[1], c[0]) for c in ring]
        full.setdefault(sg, []).append(ring)
        e = 0.012 if sg in ROUTE_UF else 0.04
        h = len(rr)//2
        r = rdp(rr[:h+1], e)[:-1] + rdp(rr[h:], e)
        if len(r) >= 4:
            ar = sum(r[i][1]*r[i+1][0]-r[i+1][1]*r[i][0] for i in range(len(r)-1))
            if ar > 0: r = r[::-1]
            out.append([[[round(q[1], 3), round(q[0], 3)] for q in r]])
    states.append(dict(type='Feature', properties=dict(sigla=sg, nome=f['properties']['name']),
                       geometry=dict(type='MultiPolygon', coordinates=out)))

def pip(lon, lat, ring):
    ins = False
    n = len(ring)
    for i in range(n - 1):
        x1, y1 = ring[i]; x2, y2 = ring[i+1]
        if (y1 > lat) != (y2 > lat) and lon < (x2-x1)*(lat-y1)/(y2-y1) + x1:
            ins = not ins
    return ins
bbox = {k: [(min(c[0] for c in r), max(c[0] for c in r), min(c[1] for c in r), max(c[1] for c in r), r) for r in v] for k, v in full.items()}
def uf_of(lon, lat, last):
    order = [last] + [u for u in ROUTE_UF if u != last] if last else ROUTE_UF
    for u in order:
        for x0, x1, y0, y1, r in bbox.get(u, []):
            if x0 <= lon <= x1 and y0 <= lat <= y1 and pip(lon, lat, r):
                return u
    return None
wd0 = json.load(open(f'{G}/world.json'))
CP = {}
for f in wd0['features']:
    code = {'Venezuela': 'VE', 'Peru': 'PEX', 'Ecuador': 'EC', 'Colombia': 'CO', 'Bolivia': 'BO', 'Chile': 'CL', 'Argentina': 'AR', 'Paraguay': 'PY', 'Uruguay': 'UY'}.get(f['properties']['name'])
    if not code: continue
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    CP[code] = [poly[0] for poly in polys]
def country_of(lon, lat):
    for c, rings in CP.items():
        for r in rings:
            if pip(lon, lat, r): return c
    return None
last = 'BA'
for p_ in prof:
    u = (uf_of(p_[1], p_[2], last) if p_[2] < 1 or p_[1] > -70 else None) or country_of(p_[1], p_[2]) or last
    p_.append(u); last = u
# runs: merge tiny runs, suffix repeated states
runs = []
for i_, p_ in enumerate(prof):
    if runs and runs[-1][0] == p_[3]: runs[-1][2] = i_
    else: runs.append([p_[3], i_, i_])
merged = []
for r in runs:
    if merged and (r[2] - r[1] < 40 or r[0] == merged[-1][0]):
        merged[-1][2] = r[2]
    else: merged.append(r)
seen = {}; order = []
for r in merged:
    seen[r[0]] = seen.get(r[0], 0) + 1
    code = r[0] + ('' if seen[r[0]] == 1 else str(seen[r[0]]))
    for i_ in range(r[1], r[2] + 1): prof[i_][3] = code
    order.append(code)
for x in stops:
    if x['uf'] is None and not x.get('lateral'):
        k0 = round(x['km'])
        cand = range(max(0, k0 - 2), min(len(prof), k0 + 6))
        best_k = min(cand, key=lambda q: hav((x['lat'], x['lon']), (prof[q][2], prof[q][1])))
        x['uf'] = prof[best_k][3]
for x in stops:
    if x.get('uf_fix'): x['uf'] = x['uf_fix']
for x in stops:
    if x['uf'] is None and x.get('lateral'):
        x['uf'] = byid[x['de']]['uf']
ufs = []
for u in order:
    st = [x for x in stops if x['uf'] == u]
    kms = [i for i, p_ in enumerate(prof) if p_[3] == u]
    if not kms: continue
    ufs.append(dict(sigla=u, nome=UF_NAMES.get(u) or next((f['properties']['name'] for f in br['features'] if f['properties']['sigla'] == u), u),
                    km=len(kms), de=min(kms), ate=max(kms), paradas=len(st), dias=sum(x.get('dias', 0) for x in st),
                    subida=sum(e['subida'] for e in etapas if byid[e['para']]['uf'] == u)))
print(ufs)
wd = json.load(open(f'{G}/world.json'))
paises = []
for f in wd['features']:
    nm = f['properties']['name']
    if nm not in ('Venezuela', 'Guyana', 'Suriname', 'French Guiana', 'Colombia', 'Peru', 'Bolivia', 'Ecuador', 'Panama', 'Paraguay', 'Argentina', 'Chile', 'Uruguay'):
        continue
    g = f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    out = []
    for poly in polys:
        rr = [(c[1], c[0]) for c in poly[0]]
        h = len(rr)//2
        r = rdp(rr[:h+1], 0.03)[:-1] + rdp(rr[h:], 0.03)
        if len(r) >= 4:
            ar = sum(r[i][1]*r[i+1][0]-r[i+1][1]*r[i][0] for i in range(len(r)-1))
            if ar > 0: r = r[::-1]
            out.append([[[round(q[1], 3), round(q[0], 3)] for q in r]])
    pt = {'Venezuela': 'Venezuela', 'Guyana': 'Guiana', 'Suriname': 'Suriname', 'French Guiana': 'Guiana Francesa', 'Colombia': 'Colômbia', 'Peru': 'Peru', 'Bolivia': 'Bolívia', 'Ecuador': 'Equador', 'Panama': 'Panamá', 'Paraguay': 'Paraguai', 'Argentina': 'Argentina', 'Chile': 'Chile', 'Uruguay': 'Uruguai'}[nm]
    paises.append(dict(type='Feature', properties=dict(nome=pt), geometry=dict(type='MultiPolygon', coordinates=out)))
barcos.append([[-48.502, -1.455], [-48.5156, -0.7536]])
# ---- cidades no caminho e água por etapa ----
import csv
TD = sys.argv[0].replace('build.py', 'towns')
towns = []
for r in csv.DictReader(open(TD + '/municipios.csv', encoding='utf-8')):
    towns.append((r['nome'], float(r['latitude']), float(r['longitude']), 'cidade'))
for c in json.load(open(TD + '/cj/package/cities.json')):
    if c['country'] in ('BR', 'BO', 'AR', 'CL', 'PE', 'UY', 'PY'):
        towns.append((c['name'], float(c['lat']), float(c['lng']), 'vila' if c['country'] == 'BR' else 'cidade'))
grid = {}
for t in towns:
    grid.setdefault((int(t[1] * 10), int(t[2] * 10)), []).append(t)
def near_towns(lat, lon, r):
    out = []
    ci, cj = int(lat * 10), int(lon * 10)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            for t in grid.get((ci + di, cj + dj), []):
                if hav((lat, lon), (t[1], t[2])) <= r: out.append(t)
    return out
cidades_mapa = {}
onr2 = [x for x in stops if not x.get('lateral')]
for e in etapas:
    if e.get('barco'): continue
    a, b = byid[e['de']], byid[e['para']]
    ka, kb = int(round(a['km'])), int(round(b['km']))
    found = {}
    for k in range(ka, min(kb, len(prof) - 1) + 1):
        el, lon, lat = prof[k][0], prof[k][1], prof[k][2]
        for t in near_towns(lat, lon, 4):
            if hav((a['lat'], a['lon']), (t[1], t[2])) < 4 or hav((b['lat'], b['lon']), (t[1], t[2])) < 4: continue
            key = t[0]
            if key not in found: found[key] = (k - ka, t)
    lst = sorted(found.values(), key=lambda x: x[0])
    # dedupe: same place listed twice within 3 km
    clean = []
    for off, t in lst:
        if clean and off - clean[-1][0] < 3 and t[3] == 'vila': continue
        clean.append((off, t))
    L = e['km']
    pos = [0] + [off for off, _ in clean] + [L]
    gap = max(b2 - a2 for a2, b2 in zip(pos, pos[1:])) if L else 0
    hot = e['max'] < 1100 and b['lat'] > -38
    rate = 1 / 15 if hot else 1 / 20
    agua = max(1.5, gap * rate + 0.5)
    pernoite = gap > 90
    if pernoite: agua += 3
    agua = math.ceil(agua * 2) / 2
    if b.get('uf') in ('PR', 'SP', 'RJ', 'MG'):
        agua = min(agua, 5); pernoite = False
    if b.get('uf') == 'CL2' or (-42.2 < b['lat'] < -39.5 and b['lon'] < -71.2) or b['lat'] < -54.4:
        agua = min(agua, 3); e['rios'] = True; pernoite = pernoite and False
    e['cidades'] = [[t[0], round(off)] for off, t in clean]
    e['gap'] = round(gap)
    e['agua'] = agua
    e['pernoite'] = pernoite
    for off, t in clean:
        cidades_mapa[t[0] + str(round(t[1], 2))] = [t[0], round(t[2], 4), round(t[1], 4)]
print('etapas c/ agua', [(e['para'], e.get('agua'), e.get('gap'), len(e.get('cidades', []))) for e in etapas][-25:])
for s in stops:
    s.pop('idx', None)
data = dict(
    regiao=dict(nome='Nordeste', km=round(cum[-1], 1), subida=total_gain,
                km_laterais=sum(s.get('km_extra', 0) for s in stops)),
    ufs=ufs, barcos=barcos, cidades=list(cidades_mapa.values()),
    stops=stops, etapas=etapas, linha=line, perfil=prof,
    laterais={'buracao': side('s1.gpx'), 'pratinha': side('s2.gpx'), 'transpantaneira': side('s6.gpx'), 'perito-moreno': side('s7.gpx'), 'paine': side('s8.gpx'), 'valdes': side('s9.gpx'), 'morretes': side('s10.gpx'), 'sajama': side('s11.gpx')},
    paises=paises, linha_aprox=line_aprox,
    estados=states)
data['epocas'] = EPOCAS
# ---- GPX por trecho (zipados, porque o download do app aceita .zip e não .gpx) ----
import zipfile, bisect, os
from xml.sax.saxutils import escape as xesc
GPXDIR = sys.argv[0].replace('build.py', 'gpx')
os.makedirs(GPXDIR, exist_ok=True)
for f_ in os.listdir(GPXDIR):
    os.remove(os.path.join(GPXDIR, f_))
def rdp_iter(pts, eps):
    n = len(pts)
    if n < 3: return list(pts)
    keep = [False] * n; keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2: continue
        A, B = pts[a], pts[b]
        dx, dy = B[1] - A[1], B[0] - A[0]
        L = math.hypot(dx, dy)
        dmax, idx = -1, a
        for i in range(a + 1, b):
            P = pts[i]
            d = abs(dy * (P[1] - A[1]) - dx * (P[0] - A[0])) / L if L > 0 else math.hypot(P[1] - A[1], P[0] - A[0])
            if d > dmax: dmax, idx = d, i
        if dmax > eps:
            keep[idx] = True
            stack.append((a, idx)); stack.append((idx, b))
    return [p for p, k in zip(pts, keep) if k]
def segs_for(km_a, km_b):
    ia = bisect.bisect_left(cum, km_a)
    ib = bisect.bisect_right(cum, km_b)
    cuts_ = [ia] + [x for x in sorted(boat_at) if ia < x < ib] + [ib]
    out = []
    for a_, b_ in zip(cuts_, cuts_[1:]):
        if b_ - a_ >= 2: out.append(rdp_iter(track[a_:b_], 0.0002))
    return out
def gpx_text(title, segs, wpts, lats):
    o = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<gpx version="1.1" creator="Rotas de Bike do Tem" xmlns="http://www.topografix.com/GPX/1/1">',
         '<metadata><name>' + xesc(title) + '</name></metadata>']
    for w in wpts:
        o.append('<wpt lat="%.5f" lon="%.5f"><name>%s</name><desc>%s</desc></wpt>' % (w['lat'], w['lon'], xesc(w['nome']), xesc(w['tipo'] + ' · ' + w['resumo'])))
    o.append('<trk><name>' + xesc(title) + '</name>')
    for sg in segs:
        o.append('<trkseg>' + ''.join('<trkpt lat="%.5f" lon="%.5f"><ele>%d</ele></trkpt>' % (p[0], p[1], round(p[2])) for p in sg) + '</trkseg>')
    o.append('</trk>')
    for nm, coords in lats:
        o.append('<trk><name>' + xesc('Bate-volta: ' + nm) + '</name><trkseg>' + ''.join('<trkpt lat="%.5f" lon="%.5f"></trkpt>' % (c[1], c[0]) for c in coords) + '</trkseg></trk>')
    o.append('</gpx>')
    return '\n'.join(o)
def slug(t):
    import unicodedata
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')
gpx_index = {}
def write_zip(code, title, segs, wpts, lats):
    txt = gpx_text(title, segs, wpts, lats)
    inner = 'volta-america-do-sul-' + slug(title) + '.gpx'
    zp = os.path.join(GPXDIR, code.lower() + '.xml')
    open(zp, 'w', encoding='utf-8').write(txt)
    gpx_index[code] = dict(arquivo='gpx/' + code.lower() + '.xml', nome=inner, pontos=sum(len(sg) for sg in segs), kb=round(os.path.getsize(zp) / 1024))
for u in ufs:
    sts_ = [x for x in stops if x['uf'] == u['sigla']]
    lats_ = [(x['nome'], data['laterais'][x['id']]) for x in sts_ if x.get('lateral') and x['id'] in data['laterais']]
    write_zip(u['sigla'], u['nome'], segs_for(u['de'], u['ate'] + 1), sts_, lats_)
write_zip('NE', 'Rota inteira', segs_for(0, cum[-1] + 1), stops, [(x['nome'], data['laterais'][x['id']]) for x in stops if x.get('lateral') and x['id'] in data['laterais']])
data['gpx'] = gpx_index
print('gpx', len(gpx_index), 'rota inteira', gpx_index['NE'])
js = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
open(OUT, 'w').write(js)
print('bytes', len(js), 'gain', total_gain)

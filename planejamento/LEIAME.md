# Planejamento da rota

Estes scripts montam `dados/rota.json` e os GPX de `public/gpx/` a partir das rotas planejadas no komoot.

## O que tem aqui

| Arquivo | O que é |
|---|---|
| `build.py` | Lê os trechos, calcula km, subidas, água, cidades no caminho, divisas e épocas, e grava os dados e os GPX |
| `stops_int.py` | **A rota atual:** a ordem dos trechos, as 219 paradas com descrição, as travessias de barco e as épocas |
| `stops_ne.py`, `stops_n.py`, `stops_ve.py`, `stops_and.py`, `stops_volta.py` | Versões anteriores da rota. O `build.py` ainda lê esses arquivos, e o `stops_int.py` substitui o que mudou |
| `entradas.tar.xz` | Os trechos do komoot em GPX, os mapas do Brasil e do mundo, e as listas de cidades |

## Gerar de novo depois de mudar a rota

```sh
cd planejamento
tar -xJf entradas.tar.xz
mkdir -p towns/cj && tar -xzf towns/cities.json-1.1.50.tgz -C towns/cj
python3 build.py geo data.json
cp data.json ../dados/rota.json
cp gpx/*.xml ../public/gpx/
```

Depois é só enviar para o `main`: o GitHub Actions gera um APK novo sozinho.

As pastas `geo/`, `towns/` e `gpx/` e o arquivo `data.json` que esses comandos criam ficam fora do git.

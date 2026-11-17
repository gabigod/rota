# Rotas de Bike

App Android para planejar a volta de bike pela América do Sul. A saída é em Tanque Novo (BA), em janeiro de 2027. É o mesmo app de rotas publicado no Claude, empacotado para o celular e o tablet.

## O que o app faz

- **Mapa da rota inteira:** 26.535 km de bike por 7 países. Mostra os bate-voltas, as travessias de barco e os trechos aproximados.
- **Paradas por estado ou país:** cada parada tem descrição, quanto de água levar até a próxima e as cidades no caminho. Você pode marcar as que já visitou.
- **Perfil de altitude:** passe o dedo no gráfico para ver o km, a altitude e a parada mais próxima.
- **Cronograma:** escolha a data de saída, o ritmo e quantos dias parado. O app calcula a data de cada parada, mostra os km de cada mês e avisa se cada lugar cai na época boa.
- **Números da viagem:** seu progresso, os km de bike por país e os recordes da rota.
- **GPX de cada trecho:** o botão **Baixar GPX** abre o menu de compartilhar do Android. Dali dá para salvar o arquivo em Arquivos ou no Drive, ou abrir direto no Organic Maps, OsmAnd, komoot ou Strava.
- **Funciona sem internet.** Só os links do Google Maps precisam de rede.

## Instalar no celular

1. Abra a página **Releases** deste repositório no celular.
2. Baixe o `RotasDeBike.apk` e instale. O Android vai pedir para permitir a instalação de "fontes desconhecidas".

O APK é sempre assinado com a mesma chave, que fica em `android/app/rotas-debug.keystore`. Por isso as versões novas instalam por cima sem apagar o que você marcou.

## Como o APK é gerado

A cada envio para o branch `main`, o GitHub Actions compila o app em uns 3 a 5 minutos. O APK novo aparece em **Releases**.

## Onde fica cada coisa

| Pasta ou arquivo | O que é |
|---|---|
| `src/app.html` | A página do app: mapa, paradas, cronograma e números |
| `dados/rota.json` | A rota: trajeto, paradas, perfil de altitude, água e épocas |
| `public/gpx/` | Um GPX para cada trecho e um para a rota inteira |
| `src/native.js` | A ponte com o Android: GPX, botão voltar e fontes |
| `planejamento/` | Os scripts que geram `dados/rota.json` e os GPX a partir das rotas do komoot. Veja `planejamento/LEIAME.md` |
| `assets/icone.svg` | O ícone do app |

## E o Gráficos FX?

O app de gráficos que ficava aqui foi guardado inteiro no branch [`graficos-fx`](../../tree/graficos-fx). O Rotas de Bike é um app separado, com outro ID (`com.tem.rotasbike`), então o Gráficos FX que já está instalado no celular continua funcionando, inclusive com os links do Diário de Trades.

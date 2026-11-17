# Licenças de terceiros

## Traçados dos autódromos: bacinger/f1-circuits

Os traçados dos 14 autódromos (`src/data/circuitLayouts.ts`) foram gerados a
partir do conjunto de dados público
[bacinger/f1-circuits](https://github.com/bacinger/f1-circuits), pelo script
`scripts/import-f1-circuits.mjs`. Os nomes das pistas no jogo são fictícios; a
geometria é a das pistas reais.

Licença MIT:

```
Copyright (c) 2019-2025 Tomislav Bacinger

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Traçados dos kartódromos: OpenStreetMap

Os traçados de 19 kartódromos contêm dados do
[OpenStreetMap](https://www.openstreetmap.org/copyright),
© OpenStreetMap contributors, disponíveis sob a
[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

- `scripts/osm-kart-tracks/*.json`: recorte dos dados de origem, um arquivo por
  kartódromo, com as vias `highway=raceway` da pista (identificador, etiquetas e
  nós), obtidas da API do OpenStreetMap em 14/11/2026.
- `src/data/kartLayouts.ts`: os traçados usados pelo jogo, gerados a partir
  desses recortes por `scripts/import-osm-kart-tracks.mjs` (escolha ou junção
  das vias, conversão para metros, sentido e ponto de largada).

Esses arquivos são bases de dados derivadas e são distribuídos sob a mesma
licença ODbL 1.0, separadamente da licença do restante do código. Quem
redistribuir ou adaptar esses dados deve manter o crédito
"© OpenStreetMap contributors" e a mesma licença. O crédito aparece no jogo
junto dos mapas dessas pistas (painel, calendário, tela do fim de semana e
transmissão da corrida) e na tela Como jogar.

Os nomes das pistas no jogo são fictícios; a geometria é a dos kartódromos
reais: Granja Viana (Cotia), Luigi Borghesi (Londrina), Velopark (Nova Santa
Rita), kartódromo do autódromo de Brasília, Ayrton Senna (Interlagos, São
Paulo), Joinville, José Carlos Pace (Uberlândia), Tarumã (Viamão), Speed Park
(Birigui), Guapimirim, South Garda (Lonato), Karting Genk, Le Mans Karting
International, Zuera, Prokart Raceland (Wackersdorf), Åsum Ring
(Kristianstad), PF International, Kartódromo Internacional do Algarve
(Portimão) e Franciacorta Karting Track.

## Fontes: Barlow Condensed, Inter e Saira Condensed

As fontes do jogo ficam embutidas em `src/assets/fonts/` (arquivos `.woff2`,
subconjuntos latino e latino estendido), para o jogo funcionar sem internet.

- **Barlow Condensed** (pesos 500, 600 e 700), © 2017 The Barlow Project Authors.
  Títulos, nomes e números grandes.
- **Inter** (variável), © 2016 The Inter Project Authors. Texto, tabelas e
  cronômetro.
- **Saira Condensed** (pesos 500, 600 e 700), © 2016 The Saira Project Authors.
  Só para o comparativo de títulos da Fase 1: é carregada apenas no servidor de
  desenvolvimento, com a flag `sairaTitles` ligada, e não entra no jogo
  publicado enquanto o padrão for a Barlow.

As três sob a SIL Open Font License 1.1, que permite uso comercial, embutir e
redistribuir (os nomes reservados "Barlow", "Inter" e "Saira" não podem ser
usados em versões modificadas). O texto da licença acompanha os arquivos
(`OFL-BarlowCondensed.txt`, `OFL-Inter.txt` e `OFL-SairaCondensed.txt`). Os
arquivos vêm dos pacotes `@fontsource/*`, sem modificação.

O jogo não usa fontes oficiais de campeonatos reais nem recriações delas.

## Ícones: Lucide

Os ícones da interface vêm do conjunto [Lucide](https://lucide.dev)
(pacote `lucide-react`), sob a licença ISC, © Lucide Contributors; parte dos
ícones deriva do Feather (licença MIT, © Cole Bemis).

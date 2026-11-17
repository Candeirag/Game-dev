# Imagens do jogo: o que existe e o que falta

O jogo não busca nada na rede: toda imagem e toda fonte vão dentro do aplicativo. Este arquivo
lista o que já existe, o que é provisório e o que ainda falta, com o tamanho e o formato
sugeridos para cada arte. Onde falta imagem, o jogo usa um substituto discreto, descrito na
coluna "Hoje"; nenhuma tela fica com um espaço vazio.

## O que já existe

| Imagem                                 | Arquivo                                         | Tamanho           | Uso                                                                   |
| -------------------------------------- | ----------------------------------------------- | ----------------- | --------------------------------------------------------------------- |
| Kart regional, nacional, internacional | `src/assets/race/vehicles/kart-*.webp`          | 256 px de largura | Corrida, grid, garagem, escada da carreira.                           |
| Fórmula 4, 3, 2 e 1                    | `src/assets/race/vehicles/f1.webp` a `f4.webp`  | 320 px de largura | Os mesmos lugares.                                                    |
| Safety car                             | `src/assets/race/vehicles/safety-car.webp`      | 256×126           | Corrida.                                                              |
| Arquibancada e árvore                  | `src/assets/race/scenery/*.webp`                | 400×74 e 128×129  | Cenário da pista.                                                     |
| Traçados das pistas                    | `src/data/circuitLayouts.ts` e `kartLayouts.ts` | vetorial          | Desenhados pelo jogo, sem arquivo de imagem.                          |
| Fontes Barlow Condensed e Inter        | `src/assets/fonts/*.woff2`                      |                   | Títulos, números e texto (licença OFL).                               |
| Fonte Saira Condensed                  | `src/assets/fonts/saira-condensed-*.woff2`      |                   | Só no comparativo de títulos (flag de desenvolvimento `sairaTitles`). |

Os carros são pintados pelo jogo com a cor de cada equipe e o número de cada piloto; por isso as
imagens são em tons neutros, vistas de cima, com fundo transparente.

## Imagens geradas: carros por categoria e retratos

Os originais ficam em `assets/higgsfield/` (fora do pacote do jogo). `npm run app:images`
(`scripts/importar-imagens.mjs`) os converte para WebP, nos tamanhos de celular, em
`src/assets/generated/`, de onde o jogo os carrega. A pasta de origem pode não existir: nesse
caso o comando não faz nada e o jogo segue como está.

| Origem                        | Nome do arquivo                                                                                                               | Saída                                                      | Onde aparece                                                                              | Reserva (sem a imagem)                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `assets/higgsfield/carros/`   | o id da categoria: `kart-regional`, `kart-national`, `kart-international`, `f4`, `f3`, `f2`, `f1` (`.png`, `.jpg` ou `.webp`) | `src/assets/generated/carros/<id>.webp`, 640 px de largura | Cartão do carro no Painel (o da categoria atual)                                          | O carro desenhado pelo jogo, com a pintura da equipe |
| `assets/higgsfield/retratos/` | `jogador.*` para o piloto do jogador; qualquer outro nome entra no elenco                                                     | `src/assets/generated/retratos/<nome>.webp`, 256×320 (4:5) | Painel (cartão Piloto), Piloto (Avaliação), Equipe (pilotos) e o painel Piloto da corrida | A placa com o número do piloto                       |

- Os retratos usam a moldura padrão (`Portrait`, em `src/ui/kit`): proporção 4:5, canto chanfrado
  e a cor da equipe na base. O corte é centrado no alto da imagem, onde costuma ficar o rosto.
- Cada piloto do elenco recebe sempre o mesmo retrato (escolhido pelo id dele); com poucos
  retratos, eles se repetem entre pilotos.
- Na pista, os carros continuam sendo os sprites vistos de cima, pintados com a cor de cada
  equipe: uma arte única por categoria não mostra a pintura nem o número de cada carro.
- Depois de importar, confira as telas (`npm run test:e2e`) e rode `npm run app:sync` para levar
  as imagens ao aplicativo. Registre a origem das artes em `THIRD_PARTY_LICENSES.md`.

## Provisório (trocar antes de publicar)

Gerado por `npm run app:icons` (`scripts/gerar-icones-do-app.mjs`) a partir da marca atual: o "A"
chanfrado em vermelho sobre grafite. Os originais ficam em `resources/`.

| Arte                       | Hoje                                            | Arte final sugerida                                                                                                                                            |
| -------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ícone do aplicativo        | `resources/icone-provisorio.png` (1024×1024)    | PNG 1024×1024, sem transparência e sem cantos arredondados (o sistema arredonda). Figura principal dentro dos 66% centrais, para o ícone adaptável do Android. |
| Camada da frente (Android) | A marca sobre fundo transparente                | PNG 432×432 com transparência; fundo em cor sólida (`ic_launcher_background.xml`).                                                                             |
| Tela de abertura           | `resources/abertura-provisoria.png` (2732×2732) | PNG 2732×2732, com a arte nos 1200×1200 centrais: o sistema corta as bordas conforme a tela. Fundo `#15181d`.                                                  |

Para trocar: substitua os dois arquivos de `resources/` pela arte final e ajuste o script para
redimensionar a partir deles (ou use `npx @capacitor/assets generate`), depois rode
`npm run app:sync`.

## O que falta

### Para a loja (obrigatório para publicar)

| Arte                             | Tamanho e formato                                                                  | Observação                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Capturas de tela, celular        | PNG ou JPG, deitadas: 2796×1290 (iPhone 6,7") e 2400×1080 (Android); 4 a 8 imagens | Podem sair dos prints do teste visual (`test-results/telas/deitado`). |
| Capturas de tela, tablet         | PNG ou JPG, deitadas: 2732×2048 (iPad 12,9") e 2560×1600 (Android)                 | Só se o aplicativo for oferecido para tablet.                         |
| Imagem de destaque (Google Play) | PNG ou JPG 1024×500, sem transparência                                             | Aparece no topo da página da loja.                                    |
| Ícone da loja (Google Play)      | PNG 512×512                                                                        | O mesmo desenho do ícone do aplicativo.                               |

### Dentro do jogo (opcional; hoje há um substituto)

| Arte                        | Hoje                                                          | Sugestão                                                                                                |
| --------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Escudo de cada equipe       | Faixa com a cor da equipe ao lado do nome                     | SVG ou WebP 256×256 com transparência, um por equipe (ou um conjunto de formas combináveis).            |
| Retrato de piloto           | Placa com o número do piloto e a cor da equipe                | Ver "Imagens geradas", acima: o caminho já existe; faltam os arquivos em `assets/higgsfield/retratos/`. |
| Marca dos patrocinadores    | Nome do patrocinador em texto                                 | SVG monocromático, altura de 64 px.                                                                     |
| Troféu e pódio              | Posição em número grande, com a cor do resultado              | WebP 512×512 com transparência (troféu); ilustração 1600×600 (pódio).                                   |
| Imagem de fundo do menu     | Grafite com faixas diagonais e linhas de grade (feito em CSS) | WebP 2400×1080, escura o bastante para o texto claro ficar legível por cima.                            |
| Carros de outras categorias | Não se aplica hoje (as sete categorias têm imagem)            | WebP de 320 px de largura, vista de cima, tons neutros, fundo transparente.                             |

## Regras para qualquer imagem nova

- Arquivo local, em `src/assets/`, importado pelo código (o Vite põe no pacote). Nada de endereço da rede.
- WebP para fotos e ilustrações, SVG para marcas e ícones, PNG só onde o sistema exige (ícone e abertura).
- Fundo transparente quando a imagem fica sobre um painel.
- Largura fixa no layout (`shrink-0` e tamanho em px ou `min(…%, …px)`): o teste visual falha se uma imagem cruzar um texto.
- Registre a origem e a licença em `THIRD_PARTY_LICENSES.md` quando a arte não for própria.

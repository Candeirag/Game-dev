# Fase 1: contraste antes e depois (todas as telas)

Gerado a partir das medidas de `e2e/contraste.ts` (com `AUDITORIA=<nome> npx playwright test e2e/telas.spec.ts -g "844×390"`), no código da `main` de antes da fase e no desta branch. A coluna "Tela" é o nome do print em `test-results/telas/deitado`.

Medição automática (`e2e/contraste.ts`) em 844×390: a cor que chega à tela, composta sobre os fundos e as opacidades.

| | Telas e abas | Medidas | Abaixo do mínimo |
| --- | --- | --- | --- |
| Antes | 64 | 6455 | **431** |
| Depois | 66 | 6655 | **0** |

| Tela | Elemento | Antes | Depois | Mínimo |
| --- | --- | --- | --- | --- |
| calendario | texto: "01", "02" (11 ocorrências) | 3,09:1 (`#626e7f` sobre `#1d222a`) | **6,32:1** (`#99a4b2` sobre `#1d222a`) | 4,5:1 |
| calendario | texto: "Ir para o fim de semana", "Próxima" (2 ocorrências) | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| calendario | texto: "04" | 3,72:1 (`#ff6250` sobre `#343d4b`) | **4,70:1** (`#ff6250` sobre `#262d38`) | 4,5:1 |
| calendario | texto: "7 mai" | 3,17:1 (`#7f8b9b` sobre `#343d4b`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| carreira | texto: "Degrau", "2 temporadas" (10 ocorrências) | 4,29:1 (`#7f8b9b` sobre `#222831`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| carreira | texto: "Degrau", "1 temporada" (2 ocorrências) | 4,21:1 (`#7f8b9b` sobre `#32262b`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| carreira | texto: "Degrau", "A equipe paga salário" (2 ocorrências) | 4,45:1 (`#7f8b9b` sobre `#20252e`) | **6,09:1** (`#99a4b2` sobre `#20252e`) | 4,5:1 |
| carreira | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| carreira-interesse | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| carreira-interesse | texto: "Atualizado a cada etapa" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| carreira-licenca | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| carreira-propostas | texto: "Assinar" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| carreira-propostas | texto: "Kart Regional" | 3,17:1 (`#7f8b9b` sobre `#343d4b`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| classificacao | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| classificacao | texto: "-31" | 4,21:1 (`#7f8b9b` sobre `#32262b`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| classificacao-equipes | texto: "Teste / Sullivan", "83 / 79 / 86" (2 ocorrências) | 4,21:1 (`#7f8b9b` sobre `#32262b`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| classificacao-equipes | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| como-jogar | texto: (símbolo) (4 ocorrências) | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| como-jogar | texto: "Ir para o fim de semana" (2 ocorrências) | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| como-jogar-dinheiro | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| como-jogar-fim-de-semana | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| corrida | texto: "Piloto", "Eventos" (2 ocorrências) | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **6,32:1** (`#99a4b2` sobre `#1d222a`) | 4,5:1 |
| corrida | texto sobre a pista: "Meu piloto", "1×" (2 ocorrências) | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| corrida | texto: (símbolo) | 4,01:1 (`#7f8b9b` sobre `#3c272b`) | **14,10:1** (`#eef1f5` sobre `#1d222a`) | 4,5:1 |
| corrida | texto sobre a pista: "TES" | 4,05:1 (`#ff6250` sobre `#34373b`) | **4,72:1** (`#ff6250` sobre `#2a2c31`) | 4,5:1 |
| corrida | texto sobre a pista: (símbolo) | 3,45:1 (`#7f8b9b` sobre `#34373b`) | **9,81:1** (`#d3d9e1` sobre `#2a2c31`) | 4,5:1 |
| corrida | texto sobre a pista: "Traçado:" | 3,40:1 (`#a7b1c0` sobre `#545659`) | **9,81:1** (`#d3d9e1` sobre `#2a2c31`) | 4,5:1 |
| corrida | contorno: "Diferença para o líderTrocar" | 1,46:1 (`#343d4b` sobre `#1d222a`) | elemento redesenhado (a tela inteira passa na auditoria) | 3:1 |
| cronometragem | texto: "8×" (10 ocorrências) | 4,03:1 (`#ffffff` sobre `#e8402f`) | **7,54:1** (`#b7c0cc` sobre `#262d38`) | 4,5:1 |
| cronometragem | texto: "Boxes", "Eventos" (2 ocorrências) | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| cronometragem | texto desativado: "+1 volta" | 2,93:1 (`#656a72` sobre `#1e2129`) | **11,29:1** (`#d3d9e1` sobre `#1e2129`) | 4,5:1 |
| cronometragem | ícone desativado: "+1 volta" | 2,93:1 (`#656a72` sobre `#1e2129`) | **11,29:1** (`#d3d9e1` sobre `#1e2129`) | 3:1 |
| cronometragem-boxes | texto: "Meu carro", "Eventos" (2 ocorrências) | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| cronometragem-boxes | texto: "8×" (2 ocorrências) | 4,03:1 (`#ffffff` sobre `#e8402f`) | **7,54:1** (`#b7c0cc` sobre `#262d38`) | 4,5:1 |
| cronometragem-boxes | texto desativado: "+1 volta" | 2,93:1 (`#656a72` sobre `#1e2129`) | **11,29:1** (`#d3d9e1` sobre `#1e2129`) | 4,5:1 |
| cronometragem-boxes | ícone desativado: "+1 volta" | 2,93:1 (`#656a72` sobre `#1e2129`) | **11,29:1** (`#d3d9e1` sobre `#1e2129`) | 3:1 |
| dirigente-carreira | texto: "Seguir sem equipe", "Aceitar o cargo" (2 ocorrências) | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| dirigente-carreira | texto: "Prestígio" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| dirigente-carreira-a-venda | texto: "Seguir sem equipe" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| dirigente-carreira-a-venda | texto: "Seu caixa:" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| dirigente-carreira-com-equipe | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| dirigente-carreira-fundar | contorno: "Kart Regional · R$ 45.500Kar", "input" (3 ocorrências) | 1,46:1 (`#343d4b` sobre `#1d222a`) | **3,77:1** (`#6f7c8e` sobre `#1d222a`) | 3:1 |
| dirigente-carreira-fundar | texto: "Seguir sem equipe" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| dirigente-carreira-fundar | texto: "Seu caixa:" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| dirigente-carreira-fundar | texto desativado: "Sem caixa" | 2,34:1 (`#777a7f` sobre `#6e2e2c`) | **7,54:1** (`#b7c0cc` sobre `#262d38`) | 4,5:1 |
| dirigente-fim-de-semana | texto: "Cotia, SP", "Corrida:" (2 ocorrências) | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| dirigente-fim-de-semana | texto: "Assistir à corrida" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| dirigente-gestao | texto: "até", "R$ 4.000" (6 ocorrências) | 4,29:1 (`#7f8b9b` sobre `#222831`) | **5,87:1** (`#99a4b2` sobre `#222831`) | 4,5:1 |
| dirigente-gestao | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| dirigente-gestao | texto: (símbolo) | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| dirigente-gestao-desenvolvimento | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| dirigente-gestao-desenvolvimento | texto: "Até" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| dirigente-gestao-equipe-tecnica | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| dirigente-gestao-equipe-tecnica | texto: "Chefe de equipe" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| dirigente-gestao-instalacoes | texto desativado: "Ampliar (R$ 21.000)", "Ampliar (R$ 7.000)" (3 ocorrências) | 3,26:1 (`#71757b` sobre `#212630`) | **7,54:1** (`#b7c0cc` sobre `#262d38`) | 4,5:1 |
| dirigente-gestao-instalacoes | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| dirigente-gestao-pilotos | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| dirigente-painel | texto: "8 mar 2028", "13 set 2027" (39 ocorrências) | 3,09:1 (`#626e7f` sobre `#1d222a`) | **6,32:1** (`#99a4b2` sobre `#1d222a`) | 4,5:1 |
| dirigente-painel | texto: "moral" (2 ocorrências) | 4,29:1 (`#7f8b9b` sobre `#222831`) | **5,87:1** (`#99a4b2` sobre `#222831`) | 4,5:1 |
| dirigente-painel | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| dirigente-painel | texto: (símbolo) | 4,21:1 (`#7f8b9b` sobre `#32262b`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| equipe | texto: "Primeiro piloto", "Segundo piloto" (2 ocorrências) | 4,29:1 (`#7f8b9b` sobre `#222831`) | **5,87:1** (`#99a4b2` sobre `#222831`) | 4,5:1 |
| equipe | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| equipe-contrato | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| equipe-pilotos | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| familia | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| familia | texto desativado: "Passar o comando em vida" | 3,26:1 (`#71757b` sobre `#212630`) | **7,54:1** (`#b7c0cc` sobre `#262d38`) | 4,5:1 |
| familia-filhos | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| familia-linhagem | texto: "Ir para o fim de semana", "Atual" (2 ocorrências) | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| fim-de-semana | texto: (símbolo) (3 ocorrências) | 4,21:1 (`#7f8b9b` sobre `#32262b`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| fim-de-semana | texto: "Iniciar fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| fim-de-semana-classificacao | texto: "+0.031" (2 ocorrências) | 4,21:1 (`#7f8b9b` sobre `#32262b`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| fim-de-semana-classificacao | texto: "Disputar classificação" | 2,95:1 (`#ffffff` sobre `#ff6250`) | **5,60:1** (`#ffffff` sobre `#c2311f`) | 4,5:1 |
| fim-de-semana-classificacao | texto: "Classificação" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| fim-de-semana-classificacao | texto: "Seco" | 3,06:1 (`#fad9d5` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| fim-de-semana-classificacao | texto: "Corrida" | 4,29:1 (`#7f8b9b` sobre `#222831`) | **5,87:1** (`#99a4b2` sobre `#222831`) | 4,5:1 |
| fim-de-semana-classificacao | texto: "Seco" | 3,27:1 (`#6c7786` sobre `#222831`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| fim-de-semana-classificacao | ícone: "Disputar classificação" | 2,95:1 (`#ffffff` sobre `#ff6250`) | **5,60:1** (`#ffffff` sobre `#c2311f`) | 3:1 |
| fim-de-semana-grid | texto: "Ir para a largada", "Corrida" (2 ocorrências) | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| fim-de-semana-grid | texto: "+0.533" (2 ocorrências) | 4,21:1 (`#7f8b9b` sobre `#32262b`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| fim-de-semana-grid | texto: "Úmido" | 3,06:1 (`#fad9d5` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| fim-de-semana-grid | texto: "Traçado:" | 3,09:1 (`#626e7f` sobre `#1d222a`) | **6,32:1** (`#99a4b2` sobre `#1d222a`) | 4,5:1 |
| fim-de-semana-grid-formula | texto: "Ir para a largada" | 2,95:1 (`#ffffff` sobre `#ff6250`) | **5,60:1** (`#ffffff` sobre `#c2311f`) | 4,5:1 |
| fim-de-semana-grid-formula | texto: "Corrida" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| fim-de-semana-grid-formula | texto: "Seco" | 3,06:1 (`#fad9d5` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| fim-de-semana-grid-formula | texto: (símbolo) | 4,21:1 (`#7f8b9b` sobre `#32262b`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| fim-de-semana-grid-formula | ícone: "Ir para a largada" | 2,95:1 (`#ffffff` sobre `#ff6250`) | **5,60:1** (`#ffffff` sobre `#c2311f`) | 3:1 |
| fim-de-semana-treino | texto: "Classificação", "Corrida" (2 ocorrências) | 4,29:1 (`#7f8b9b` sobre `#222831`) | **5,87:1** (`#99a4b2` sobre `#222831`) | 4,5:1 |
| fim-de-semana-treino | texto: "Seco" (2 ocorrências) | 3,27:1 (`#6c7786` sobre `#222831`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| fim-de-semana-treino | texto: "Disputar treino livre" | 3,12:1 (`#ffffff` sobre `#fb5c4b`) | **5,60:1** (`#ffffff` sobre `#c2311f`) | 4,5:1 |
| fim-de-semana-treino | texto: "Treino livre" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| fim-de-semana-treino | texto: "Seco" | 3,06:1 (`#fad9d5` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| financas | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| financas-credito | texto: "Ir para o fim de semana", "Contratar" (2 ocorrências) | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| financas-credito | texto: "Moral +0,4 por etapa · relaç", "Moral +0,8 por etapa · relaç" (2 ocorrências) | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **7,54:1** (`#b7c0cc` sobre `#262d38`) | 4,5:1 |
| financas-credito | contorno: "input", "2 temporadas4 temporadas6 te" (2 ocorrências) | 1,46:1 (`#343d4b` sobre `#1d222a`) | **3,77:1** (`#6f7c8e` sobre `#1d222a`) | 3:1 |
| financas-credito | texto: "Moral 0 por etapa · relação " | 4,01:1 (`#7f8b9b` sobre `#3c272b`) | **7,77:1** (`#b7c0cc` sobre `#39252a`) | 4,5:1 |
| financas-imoveis | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| financas-imoveis | texto: "Reputação" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| financas-investimentos | texto desativado: "Resgatar", "Vender" (8 ocorrências) | 2,34:1 (`#545b66` sobre `#1d222a`) | **7,54:1** (`#b7c0cc` sobre `#262d38`) | 4,5:1 |
| financas-investimentos | contorno: "input", "Quantidade de Banco Box" (7 ocorrências) | 1,46:1 (`#343d4b` sobre `#1d222a`) | **3,77:1** (`#6f7c8e` sobre `#1d222a`) | 3:1 |
| financas-investimentos | texto: "Rendimento creditado no fech", "Carteira:" (2 ocorrências) | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| financas-investimentos | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| financas-participacoes | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| financas-participacoes | texto: "Fatia a comprar" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| financas-patrocinios | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| financas-patrocinios | texto: (símbolo) | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| historico | texto: "01", "02" (3 ocorrências) | 3,09:1 (`#626e7f` sobre `#1d222a`) | **6,32:1** (`#99a4b2` sobre `#1d222a`) | 4,5:1 |
| historico | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| historico | texto: "Toque numa etapa para ver o " | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| historico | contorno: "2035 · F. Elite2034 · F. Spr" | 1,62:1 (`#343d4b` sobre `#15181d`) | **4,19:1** (`#6f7c8e` sobre `#15181d`) | 3:1 |
| menu | texto: "Vazio" (4 ocorrências) | 3,09:1 (`#626e7f` sobre `#1d222a`) | **6,32:1** (`#99a4b2` sobre `#1d222a`) | 4,5:1 |
| menu | texto desativado: "Carregar" (4 ocorrências) | 3,26:1 (`#71757b` sobre `#212630`) | **7,54:1** (`#b7c0cc` sobre `#262d38`) | 4,5:1 |
| menu | texto: "Nova carreira" (2 ocorrências) | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| nova-carreira | contorno: "input", "BrasilArgentinaUruguaiParagu" (12 ocorrências) | 1,46:1 (`#343d4b` sobre `#1d222a`) | **3,77:1** (`#6f7c8e` sobre `#1d222a`) | 3:1 |
| nova-carreira | texto: "Potencial 86 · Experiência i", "Potencial 89 · Experiência i" (10 ocorrências) | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| nova-carreira | ícone desativado: "Remover ponto de Velocidade", "Remover ponto de Consistênci" (8 ocorrências) | 1,87:1 (`#464d57` sobre `#1d222a`) | **7,54:1** (`#b7c0cc` sobre `#262d38`) | 3:1 |
| nova-carreira | contorno desativado: "Remover ponto de Velocidade", "Remover ponto de Consistênci" (8 ocorrências) | 1,11:1 (`#242a34` sobre `#1d222a`) | **3,77:1** (`#6f7c8e` sobre `#1d222a`) | 3:1 |
| nova-carreira | texto: "Potencial 92 · Experiência i", "Motor" (5 ocorrências) | 4,01:1 (`#7f8b9b` sobre `#3c272b`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| nova-carreira | texto: "Começar carreira" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| nova-carreira | texto: "evolui mais rápido até os 17" | 3,09:1 (`#626e7f` sobre `#1d222a`) | **6,32:1** (`#99a4b2` sobre `#1d222a`) | 4,5:1 |
| painel | contorno: "Disputa e estratégia", "Consistência mental" (7 ocorrências) | 1,46:1 (`#343d4b` sobre `#1d222a`) | **3,77:1** (`#6f7c8e` sobre `#1d222a`) | 3:1 |
| painel | texto: "Voltas", "Ultrapassar" (4 ocorrências) | 4,06:1 (`#7f8b9b` sobre `#252c38`) | **5,56:1** (`#99a4b2` sobre `#252c38`) | 4,5:1 |
| painel | ícone: "Piloto: abrir", "Kart: abrir" (4 ocorrências) | 2,68:1 (`#626e7f` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 3:1 |
| painel | texto: "Continuar fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| painel | texto: "Traçado:" | 3,09:1 (`#626e7f` sobre `#1d222a`) | **6,32:1** (`#99a4b2` sobre `#1d222a`) | 4,5:1 |
| painel | texto: "R$ 250" | 4,01:1 (`#7f8b9b` sobre `#3c272b`) | **5,65:1** (`#99a4b2` sobre `#39252a`) | 4,5:1 |
| painel | texto: "Patrimônio" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| painel-fim-de-temporada | contorno: "Disputa e estratégia", "Consistência mental" (7 ocorrências) | 1,46:1 (`#343d4b` sobre `#1d222a`) | **3,77:1** (`#6f7c8e` sobre `#1d222a`) | 3:1 |
| painel-fim-de-temporada | ícone: "Piloto: abrir", "Kart: abrir" (4 ocorrências) | 2,68:1 (`#626e7f` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 3:1 |
| painel-fim-de-temporada | contorno: "Aceitar a responsabilidadePu", "Defender-se na audiênciaPode" (3 ocorrências) | 1,99:1 (`#465162` sobre `#1d222a`) | **3,77:1** (`#6f7c8e` sobre `#1d222a`) | 3:1 |
| painel-fim-de-temporada | texto: "R$ 250" | 4,01:1 (`#7f8b9b` sobre `#3c272b`) | **5,65:1** (`#99a4b2` sobre `#39252a`) | 4,5:1 |
| painel-fim-de-temporada | texto: "Patrimônio" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| painel-formula | contorno: "Velocidade", "Disputa e estratégia" (7 ocorrências) | 1,46:1 (`#343d4b` sobre `#1d222a`) | **3,77:1** (`#6f7c8e` sobre `#1d222a`) | 3:1 |
| painel-formula | texto: "Voltas", "Ultrapassar" (4 ocorrências) | 4,06:1 (`#7f8b9b` sobre `#252c38`) | **5,56:1** (`#99a4b2` sobre `#252c38`) | 4,5:1 |
| painel-formula | ícone: "Piloto: abrir", "Carro: abrir" (4 ocorrências) | 2,68:1 (`#626e7f` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 3:1 |
| painel-formula | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| painel-formula | texto: "R$ 10.000" | 4,01:1 (`#7f8b9b` sobre `#3c272b`) | **5,65:1** (`#99a4b2` sobre `#39252a`) | 4,5:1 |
| painel-formula | texto: "Patrimônio" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| piloto | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| piloto | texto: "Variação desde o início da t" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| piloto-condicao-e-treino | contorno: "Velocidade", "Disputa e estratégia" (7 ocorrências) | 1,46:1 (`#343d4b` sobre `#1d222a`) | **3,77:1** (`#6f7c8e` sobre `#1d222a`) | 3:1 |
| piloto-condicao-e-treino | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| piloto-condicao-e-treino | texto: "R$ 10.000" | 4,01:1 (`#7f8b9b` sobre `#3c272b`) | **5,65:1** (`#99a4b2` sobre `#39252a`) | 4,5:1 |
| piloto-numeros | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| resultado | texto: "17" (2 ocorrências) | 4,21:1 (`#7f8b9b` sobre `#32262b`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| resultado | texto: "Concluir etapa e salvar" | 2,95:1 (`#ffffff` sobre `#ff6250`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| resultado | ícone: "Concluir etapa e salvar" | 2,95:1 (`#ffffff` sobre `#ff6250`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 3:1 |
| saves | texto: "Vazio" (3 ocorrências) | 3,09:1 (`#626e7f` sobre `#1d222a`) | **6,32:1** (`#99a4b2` sobre `#1d222a`) | 4,5:1 |
| saves | texto desativado: "Carregar" (3 ocorrências) | 3,26:1 (`#71757b` sobre `#212630`) | **7,54:1** (`#b7c0cc` sobre `#262d38`) | 4,5:1 |
| saves | texto desativado: "Apagar" (3 ocorrências) | 2,34:1 (`#545b66` sobre `#1d222a`) | **7,54:1** (`#b7c0cc` sobre `#262d38`) | 4,5:1 |
| saves | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| saves-copia-do-formato-anterior | texto: "Vazio" (3 ocorrências) | 3,09:1 (`#626e7f` sobre `#1d222a`) | **6,32:1** (`#99a4b2` sobre `#1d222a`) | 4,5:1 |
| saves-copia-do-formato-anterior | texto desativado: "Carregar" (3 ocorrências) | 3,26:1 (`#71757b` sobre `#212630`) | **7,54:1** (`#b7c0cc` sobre `#262d38`) | 4,5:1 |
| saves-copia-do-formato-anterior | texto desativado: "Apagar" (3 ocorrências) | 2,34:1 (`#545b66` sobre `#1d222a`) | **7,54:1** (`#b7c0cc` sobre `#262d38`) | 4,5:1 |
| topo-carreira | texto: "Assinar" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| topo-carreira | texto: "GP Mundial" | 3,17:1 (`#7f8b9b` sobre `#343d4b`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| topo-carreira-escada | texto: "Degrau", "1 temporada" (12 ocorrências) | 4,29:1 (`#7f8b9b` sobre `#222831`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| topo-carreira-escada | texto: "Degrau", "1 temporada" (2 ocorrências) | 4,21:1 (`#7f8b9b` sobre `#32262b`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| topo-carreira-interesse | texto: "Atualizado a cada etapa" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| topo-classificacao | texto: "Ver propostas" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| topo-classificacao | texto: "-64" | 4,21:1 (`#7f8b9b` sobre `#32262b`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| topo-classificacao-equipes | texto: "Teste / Fraser", "85 / 81 / 86" (2 ocorrências) | 4,21:1 (`#7f8b9b` sobre `#32262b`) | **5,86:1** (`#99a4b2` sobre `#30252a`) | 4,5:1 |
| topo-classificacao-equipes | texto: "Ver propostas" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| topo-equipe | texto: "Primeiro piloto", "Segundo piloto" (2 ocorrências) | 4,29:1 (`#7f8b9b` sobre `#222831`) | **5,87:1** (`#99a4b2` sobre `#222831`) | 4,5:1 |
| topo-equipe | texto: "Ver propostas" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| topo-equipe-contrato | texto: "Ver propostas" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| topo-historico | texto: "01", "02" (14 ocorrências) | 3,09:1 (`#626e7f` sobre `#1d222a`) | **5,41:1** (`#ff6250` sobre `#1d222a`) | 4,5:1 |
| topo-historico | texto: "Ver propostas" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| topo-historico | texto: "Toque numa etapa para ver o " | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| topo-historico | contorno: "2038 · GP Mundial2037 · F. E" | 1,62:1 (`#343d4b` sobre `#15181d`) | **4,19:1** (`#6f7c8e` sobre `#15181d`) | 3:1 |
| topo-painel | contorno: "Velocidade", "Consistência mental" (7 ocorrências) | 1,46:1 (`#343d4b` sobre `#1d222a`) | **3,77:1** (`#6f7c8e` sobre `#1d222a`) | 3:1 |
| topo-painel | ícone: "Piloto: abrir", "Carro: abrir" (4 ocorrências) | 2,68:1 (`#626e7f` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 3:1 |
| topo-painel | texto: "Ver propostas" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |
| topo-painel | texto: "R$ 30.000" | 4,01:1 (`#7f8b9b` sobre `#3c272b`) | **5,65:1** (`#99a4b2` sobre `#39252a`) | 4,5:1 |
| topo-painel | texto: "Patrimônio" | 4,01:1 (`#7f8b9b` sobre `#262d38`) | **5,48:1** (`#99a4b2` sobre `#262d38`) | 4,5:1 |
| vida | texto: "Ir para o fim de semana" | 4,03:1 (`#ffffff` sobre `#e8402f`) | **4,62:1** (`#ffffff` sobre `#d93826`) | 4,5:1 |

# Dados de origem dos kartódromos

Um arquivo por kartódromo real, com as vias `highway=raceway` da pista como
estavam no OpenStreetMap em 14/11/2026: identificador da via, etiquetas
relevantes (`name`, `sport`, `oneway`, `bridge`, `layer`) e a lista de nós
(`[id, latitude, longitude]`).

Origem: API do OpenStreetMap (`/api/0.6/map` na área de cada kartódromo),
filtrando as vias de corrida da pista de kart.

© OpenStreetMap contributors. Dados sob a Open Database License (ODbL) 1.0:
https://www.openstreetmap.org/copyright. Estes recortes e o arquivo gerado a
partir deles (`src/data/kartLayouts.ts`) são bases derivadas e seguem a mesma
licença.

Para gerar de novo os traçados do jogo: `node scripts/import-osm-kart-tracks.mjs`.

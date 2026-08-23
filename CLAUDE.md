# D:\bbb — raiz de trabalho do Órbita Zero

Esta pasta é o **depósito de arte crua**, não o projeto.

- O projeto vive em [`game/`](game/). Comece por
  [`game/docs/MAPA-DO-PROJETO.md`](game/docs/MAPA-DO-PROJETO.md) — a orientação
  completa numa página. As regras do repositório estão em
  [`game/CLAUDE.md`](game/CLAUDE.md).
- A fonte de verdade de design é
  [`game/docs/ESPECIFICACAO-MESTRE.md`](game/docs/ESPECIFICACAO-MESTRE.md).
- O que falta fazer, em passos ordenados e com critério de aceite, está em
  [`game/docs/PLANO.md`](game/docs/PLANO.md).
- As telas estão em [`game/docs/TELAS.md`](game/docs/TELAS.md) e os sistemas por
  dentro em [`game/docs/SISTEMAS.md`](game/docs/SISTEMAS.md).
- Os agentes especializados estão em `.claude/agents/`.

## Regra que vale para esta pasta

Todo o resto de `D:\bbb\` — `Jogando/`, `parallax/`, `new spaceships/`,
`PlanetPack_V1*/`, `space_background_pack/`, `Tiles/`, `Drone/`, `PNG_*/` e os
PNGs soltos — é **arte crua somente leitura**. O pipeline (`npm run assets`)
lê daqui e escreve em `game/public/assets`. Nada aqui é modificado.

`arte/` é gerada por `npm run assets:organizar`: um espelho por hard link do que
está e do que não está sendo usado. Também não é fonte.

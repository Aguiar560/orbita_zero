# D:\bbb — raiz de trabalho do Órbita Zero

Esta pasta é o **depósito de arte crua**, não o projeto.

- O projeto vive em [`game/`](game/). As instruções completas estão em
  [`game/CLAUDE.md`](game/CLAUDE.md) — leia antes de mexer em qualquer coisa.
- A fonte de verdade de design é
  [`game/docs/ESPECIFICACAO-MESTRE.md`](game/docs/ESPECIFICACAO-MESTRE.md).
- O estado do repositório no início da FASE 0 está em
  [`game/docs/HANDOFF-FASE-0.md`](game/docs/HANDOFF-FASE-0.md).
- Os agentes especializados estão em `.claude/agents/`.

## Regra que vale para esta pasta

Todo o resto de `D:\bbb\` — `Jogando/`, `parallax/`, `new spaceships/`,
`PlanetPack_V1*/`, `space_background_pack/`, `Tiles/`, `Drone/`, `PNG_*/` e os
PNGs soltos — é **arte crua somente leitura**. O pipeline (`npm run assets`)
lê daqui e escreve em `game/public/assets`. Nada aqui é modificado.

`arte/` é gerada por `npm run assets:organizar`: um espelho por hard link do que
está e do que não está sendo usado. Também não é fonte.

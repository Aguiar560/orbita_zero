# Catálogo de cascos

Fonte humana de consulta do Hangar. A fonte executável continua sendo
`src/data/hulls.ts` e, para o lote novo, `src/data/hulls-spaceships2.ts`.

**Estado em 24/08/2026:** 49 cascos — 20 originais e 29 do lote Spaceships
2.0. As 29 artes novas estão em uma única faixa de orçamento, T4, com custo e
setor temporariamente zerados. A bateria completa fechou a calibração e elas
agora entram diretamente no Hangar e na campanha, inclusive em saves existentes.
O sistema autoral de desbloqueio continua deliberadamente para depois; até ele
existir, nenhum casco novo fica escondido por uma regra provisória.

Para imprimir a ficha numérica completa de todos os cascos:

```text
npm run cascos:listar
```

## Contrato para toda nave futura

Uma nave só está implementada quando possui:

1. id autoral estável, independente do nome do arquivo;
2. nome e descrição de fantasia;
3. uma arte de jogador no atlas e escala conferida;
4. arquétipo e calibração;
5. elemento nativo;
6. família de tiro, sprite, velocidade, escala e abertura;
7. hitbox retangular conferida e salva no Laboratório;
8. ficha de dano, cadência, vida, escudo, regeneração, velocidade e projéteis;
9. especialidades adicionais quando aplicáveis: crítico, perfuração, explosão,
   sincronia ou sorte;
10. entrada no Hangar e no Laboratório;
11. teste que prove a relação arte ↔ ficha e a faixa de balanceamento.

O teste falha se uma arte nova for listada sem casco ou se um casco apontar para
arte inexistente. Assim a pasta pode crescer sem o Laboratório e o Hangar
voltarem a divergir.

## Faixa de balanceamento Spaceships 2.0

| Arquétipo | Dano | Cadência | Vida | Escudo | Regen | Velocidade | Projéteis | Identidade |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Interceptador | 17 | 5,2 | 185 | 130 | 7 | 360 | 2 | mobilidade e resposta |
| Assalto | 30 | 3,5 | 250 | 155 | 9 | 280 | 2 | pressão frontal, explosão 10 |
| Artilharia | 50 | 2,0 | 225 | 135 | 9 | 220 | 2 | perfuração 2, explosão 28 |
| Baluarte | 27 | 2,8 | 500 | 440 | 24 | 185 | 2 | defesa extrema |
| Suporte | 21 | 3,6 | 285 | 310 | 21 | 250 | 2 | IA 0,24 e sorte 0,16 |
| Saturação | 16 | 4,8 | 225 | 150 | 9 | 310 | 5 | explosão 28 e controle de espaço |
| Duelista | 50 | 3,0 | 215 | 115 | 7 | 325 | 1 | crítico 30% e +115% |

Esses números são o ponto neutro. A calibração faz a troca:

| Calibração | Ganha | Paga |
|---|---|---|
| Equilibrado | nenhuma distorção | nenhuma distorção |
| Agressivo | dano +15%, cadência +8% | vida −10%, escudo −15% |
| Blindado | vida +22%, escudo +25%, regen +18% | velocidade −12%, dano −8% |
| Veloz | velocidade +18%, cadência +5% | vida e escudo −10% |
| Preciso | dano +5%, crítico +12%, dano crítico +45%, perfuração +1 | não amplia defesa ou volume |
| Sincrônico | IA +18%, sorte +12%, regen +12% | dano −5% |

## Famílias de tiro

| Família | Velocidade | Abertura | Dano | Cadência | Especialidade |
|---|---:|---:|---:|---:|---|
| Emissor de Rajada | 900 | 0,060 | ×0,90 | ×1,06 | pressão estável |
| Canhão Vetorial | 720 | 0,050 | ×1,12 | ×0,92 | perfuração +1 |
| Lança Perfurante | 1.020 | 0,025 | ×0,98 | ×0,94 | perfuração +1 |
| Bombarda de Cerco | 620 | 0,110 | ×1,20 | ×0,86 | explosão +22 |
| Saturador | 800 | 0,100 | ×0,55 | ×1,08 | projéteis +2 |
| Agulha de Fase | 1.120 | 0,020 | ×1,08 | ×0,96 | precisão |

O sprite e a cor sempre vêm do elemento. A família muda comportamento e
silhueta do disparo, mas não pode mentir sobre o tipo de dano.

As escalas visuais também são canônicas por papel: Interceptador e Duelista
miram 74 px no maior eixo; Suporte e Saturação, 78 px; Assalto, 80 px;
Artilharia, 84 px; Baluarte, 88 px. A hitbox acompanha a arte sem transformar
uma nave pequena em alvo invisível nem uma nave grande em vantagem gratuita.

O resultado completo de 261 execuções está em
[`RELATORIO-BATERIA-CONFRONTOS-COMPLETA.md`](RELATORIO-BATERIA-CONFRONTOS-COMPLETA.md).
Nenhuma família liderou Elite, Enxame e Cerco ao mesmo tempo.

## Os 29 cascos Spaceships 2.0

| # | Id | Nome | Arquétipo | Calibração | Elemento | Tiro |
|---:|---|---|---|---|---|---|
| 1 | `bastiao_8` | Bastião 8 | Baluarte | Preciso | Cósmico | Canhão Vetorial |
| 2 | `centuriao_atlas` | Centurião Atlas | Interceptador | Equilibrado | Fogo | Emissor de Rajada |
| 3 | `ariete_vesper` | Aríete Vesper | Assalto | Blindado | Padrão | Canhão Vetorial |
| 4 | `lamina_kheiron` | Lâmina Kheiron | Duelista | Agressivo | Raio | Agulha de Fase |
| 5 | `peregrina_sol` | Peregrina do Sol | Artilharia | Sincrônico | Fogo | Lança Perfurante |
| 6 | `lince_polar` | Lince Polar | Suporte | Veloz | Gelo | Emissor de Rajada |
| 7 | `cerbero_azul` | Cérbero Azul | Interceptador | Preciso | Raio | Agulha de Fase |
| 8 | `vipera_helix` | Víbora Helix | Artilharia | Blindado | Padrão | Bombarda de Cerco |
| 9 | `draco_viridiano` | Draco Viridiano | Duelista | Veloz | Químico | Agulha de Fase |
| 10 | `oraculo_safira` | Oráculo Safira | Suporte | Preciso | Gelo | Lança Perfurante |
| 11 | `talon_ignifero` | Talon Ignífero | Assalto | Agressivo | Fogo | Emissor de Rajada |
| 12 | `arraia_boreal` | Arraia Boreal | Interceptador | Blindado | Gelo | Agulha de Fase |
| 13 | `martelo_helios` | Martelo Hélios | Artilharia | Agressivo | Fogo | Bombarda de Cerco |
| 14 | `asa_carmim` | Asa Carmim | Saturação | Veloz | Padrão | Saturador |
| 15 | `condor_magma` | Condor Magma | Artilharia | Equilibrado | Fogo | Bombarda de Cerco |
| 16 | `navegante_nox` | Navegante Nox | Suporte | Sincrônico | Cósmico | Canhão Vetorial |
| 17 | `quimera_verde` | Quimera Verde | Assalto | Sincrônico | Químico | Saturador |
| 18 | `seta_quantica` | Seta Quântica | Interceptador | Agressivo | Raio | Lança Perfurante |
| 19 | `rapina_ambar` | Rapina Âmbar | Duelista | Equilibrado | Fogo | Agulha de Fase |
| 20 | `leviata_ferro` | Leviatã de Ferro | Baluarte | Agressivo | Padrão | Bombarda de Cerco |
| 21 | `tridente_violeta` | Tridente Violeta | Suporte | Agressivo | Cósmico | Emissor de Rajada |
| 22 | `aurora_negra` | Aurora Negra | Assalto | Veloz | Cósmico | Canhão Vetorial |
| 23 | `eclipse_rubro` | Eclipse Rubro | Duelista | Sincrônico | Cósmico | Agulha de Fase |
| 24 | `nemesis_alada` | Nêmesis Alada | Artilharia | Preciso | Cósmico | Lança Perfurante |
| 25 | `arca_turquesa` | Arca Turquesa | Baluarte | Sincrônico | Químico | Canhão Vetorial |
| 26 | `vanguarda_dez` | Vanguarda Dez | Suporte | Equilibrado | Raio | Lança Perfurante |
| 27 | `fornalha_dezenove` | Fornalha Dezenove | Artilharia | Blindado | Fogo | Bombarda de Cerco |
| 28 | `custodio_vinte_tres` | Custódio Vinte e Três | Baluarte | Equilibrado | Padrão | Canhão Vetorial |
| 29 | `horizonte_trinta` | Horizonte Trinta | Assalto | Preciso | Químico | Emissor de Rajada |

## Os 20 cascos originais preservados

| Linha | Cascos |
|---|---|
| Vetor | `void_canhao`, `void_zapper`, `void_foguete`, `void_canhaozao` |
| Aurora / Ignis | `aurora1`, `aurora2`, `ignis1`, `aurora3`, `ignis2`, `aurora4`, `ignis4`, `aurora_x` |
| Falcão | `falcao_b`, `falcao_r` |
| Prisma elemental | `prisma_raio`, `prisma_gelo`, `prisma_padrao`, `prisma_fogo`, `prisma_cosmico`, `prisma_quimico` |

Esses vinte mantêm seus números e desbloqueios históricos. Uma revisão futura
deve trazê-los para o mesmo schema de arquétipo/calibração, sem mudar ids de
save.

## Fluxo para adicionar a próxima arte

1. colocar o PNG em `spaceships new/spaceships 2.0/Jogador`;
2. acrescentar o nome do arquivo em `PLAYER_SOURCES` de `spaceships2.ts`;
3. criar uma única ficha em `SPACESHIPS2_HULL_SPECS`;
4. rodar `npm run assets`;
5. rodar `npm run cascos:listar`, `npm run typecheck` e `npm test`;
6. conferir escala, orientação, tiro e escudo no Laboratório.

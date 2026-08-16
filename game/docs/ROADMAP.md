# Roadmap — Órbita Zero

Documento **vivo**: atualizado a cada etapa concluída. É a resposta para "onde
estamos e o que vem agora".

Os dois documentos ao lado não são isto:
[`ESPECIFICACAO-MESTRE.md`](ESPECIFICACAO-MESTRE.md) é a fonte de verdade de
design, e [`FASE-0-AUDITORIA.md`](FASE-0-AUDITORIA.md) é o diagnóstico de um
momento — o ponto de partida, que não se reescreve.

**Última atualização:** 16/08/2026 · 48 testes passando · typecheck e build limpos.

---

## Onde estamos

```
Etapa 0  ██████████  concluída
Fase 1   ██████░░░░  4 de 7 tarefas
Fase 2   ░░░░░░░░░░
Fase 3   ░░░░░░░░░░
Fase 4   ░░░░░░░░░░
Fase 5   ░░░░░░░░░░
```

**Próxima tarefa:** 1.5 — sete raridades, de Comum a Divino.

---

## Etapa 0 — Rede de segurança ✅

Bloqueava todas as outras: sem controle de versão e sem forma de medir, qualquer
mudança de balanceamento seria fé.

| # | Tarefa | Onde |
|---|---|---|
| 0.1 | ✅ Repositório, `.gitignore` de lista branca, `.gitattributes` | `276369c` |
| 0.2 | ✅ Vitest com testes de determinismo, limites, raridade, saves | `c456541` |
| 0.3 | ✅ Arnês de simulação em Node — `tools/lib/balanco.ts`, `tools/simular.ts` | `c456541` |

---

## Fase 1 — Fundação de dados

| # | Tarefa | Estado |
|---|---|---|
| 1.1 | Tetos de sanidade do §40 em `data/balance/limites.ts` | ✅ `f6cbac6` |
| 1.2 | Curvas centralizadas em `data/balance/curvas.ts` | ✅ `f6cbac6` |
| 1.3 | Inverter a dependência: `hpDaOnda = poderEsperado × tempoAlvo` | ✅ `72c849e` |
| 1.4 | Calibrar por simulação, com corrida do zero como prova | ✅ `72c849e` |
| — | Densidade e pressão como eixos de dificuldade (§16) | ✅ `82b4347` |
| 1.5 | **Sete raridades, Comum → Divino** (§9) | ⬜ próxima |
| 1.6 | Tiers de atributo T1–T10 (§6) | ⬜ |
| 1.7 | Orçamento e peso de atributos (§7) | ⬜ |
| 1.8 | Nível de personagem 1–300 (§17) | ⬜ |
| 1.9 | Nível de nave 1–300, sem transferência entre naves (§17, §18) | ⬜ |
| ~~1.10~~ | ~~Save v4 + migração~~ — cancelado: o save é descartável no desenvolvimento | — |

### Fora do plano, feito no caminho

Duas remoções que a especificação pedia e que não dependiam de mais nada:

| Tarefa | Onde |
|---|---|
| Remover o menu Melhorias (§31) | `dc6ec0b` |
| Remover os Power Ups de batalha (§30) e tornar o dano normal irresistível | `857c2cc` |

---

## Fase 2 — Combate

Depende da Fase 1: sem tiers e sem orçamento de poder, o dano elemental não tem
como ser dimensionado.

| # | Tarefa |
|---|---|
| 2.1 | `DamagePacket` — separar dano normal de elemental (§3) |
| 2.2 | Refatorar o protótipo elemental para o novo modelo |
| 2.3 | Matriz elemental gerada a partir do anel, configurável (§5) |
| 2.4 | Crítico normal × crítico elemental, separados (§4) |
| 2.5 | Resistência e penetração elemental (§4) |
| 2.6 | Pipeline de `tiros e explosoes.png` — 6 elementos × 8 categorias (§21) |
| 2.7 | Projéteis, impactos e explosões por elemento (§22) |

---

## Fase 3 — Itemização

| # | Tarefa |
|---|---|
| 3.1 | Pipeline de `novos itens.png` — 10 categorias × 7 raridades (§23) |
| 3.2 | `AffixDef` com tier, pesos e restrições (§6, §7) |
| 3.3 | Gerador de item com orçamento de poder |
| 3.4 | `+N projéteis` com as restrições do §8 |
| 3.5 | Tabelas de drop por galáxia, inimigo, chefe e exclusivo (§10) |
| 3.6 | Décima categoria: Upgrades Gerais (§11) |
| 3.7 | Filtros e ordenação do inventário (§28) |
| 3.8 | Separar inventário de itens do armazém de recursos (§29) |

---

## Fase 4 — Progressão

Integração da Matriz com o nível de personagem, curvas de XP calibradas,
requisitos de nível, e o balanceamento das galáxias contra as metas de tempo do
§2 — hoje a galáxia 1 leva 40 minutos e a meta é ~10 horas.

---

## Fase 5 — Conteúdo

Naves, inimigos, chefes, recursos por galáxia, crafting (§25), sacrifício e
fusão de itens (§26), missões (§27) e o modo de chefes de 100 pisos (§32–§35).
É onde o `content-data-agent` trabalha em volume, a partir de schemas já
aprovados.

---

## Dívidas conhecidas

Coisas medidas e registradas, que ainda não têm etapa marcada.

| O quê | Evidência | Onde resolve |
|---|---|---|
| **Ritmo de relógio 15× rápido** | galáxia 1 em 40 min; meta é ~10 h | Fase 4 |
| **Itemização torta na origem** | ofensiva cresce com expoente 3,70, defensiva com 1,10 | Fase 3 (orçamento) |
| **Dispersão de 135× entre itens da mesma raridade** | `simular item 30` | Fase 3 (orçamento) |
| **`powerScore` é cego para vários atributos** | itens utilitários pontuam 0 e o auto-equipar erra | Fase 3 |
| **Anel elemental com deriva de 5%** | 1,5 × 0,7 = 1,05; a especificação propõe 1,25 × 0,80 | Fase 2 · decisão pendente |
| **Mortes acumulam muito no fim** | 141 mortes até o setor 13 numa corrida do zero | Fase 4 |
| **`sharp` com CVE de libvips** | `npm audit`; é ferramenta de build, não entra no bundle | etapa própria |

---

## Como verificar cada etapa

Os critérios de aceite completos estão no §6 da auditoria. Os comandos:

```bash
npm test                              # 48 testes
npm run simular -- curva 1 300        # dificuldade × poder, setor a setor
npm run simular -- ondas 40 42        # composição e variedade das ondas
npm run simular -- drops 200000       # distribuição real de raridade
npm run simular -- item 30            # dispersão de poder entre itens
npm run simular -- ajustar            # remede o poder e reajusta os expoentes
```

O último é o mais importante depois de qualquer mudança em afixos, cascos ou
Matriz: os expoentes em `curvas.ts` **descrevem** o jogo, e se o jogo mudar e
eles não, o ritmo desanda em silêncio.

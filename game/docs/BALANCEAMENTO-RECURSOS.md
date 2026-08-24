# Balanceamento de recursos e craft

> Fonte executável: `src/data/balance/economia-recursos.ts`,
> `src/data/balance/fusao.ts` e `src/data/balance/modulacao.ts`  
> Revisão: 24/08/2026

## Metas de farm

| Fonte | Meta | Tempo-alvo de jogo ativo |
|---|---:|---:|
| Material de galáxia para uma receita | 8–22 setores dirigidos | 12–45 min |
| Tecnologia de chefe numa receita | 12–20 vitórias dirigidas | 20–60 min |
| Essência para uma modulação | 1–3 repetições do piso correto | 5–20 min |
| Gás de evento | 1 objetivo na ocorrência de 72 h | 30–90 min |

Os tempos são faixas de design, não promessas cronométricas: dependem de nave,
equipamento, falhas e repetição de setor. A unidade estável usada pelo código é
“conclusões dirigidas”; o tempo é a tradução esperada para um jogador na faixa
de poder do conteúdo.

## Quantidade por setor

Ao concluir um setor, o material-assinatura paga:

`5 + piso(galáxia / 5) + 2 se for chefe + bônus de Sorte`

- o valor-base tem teto 10;
- o bônus de Sorte tem teto 3;
- setores de chefe pagam +2;
- a fonte continua determinística: um setor nunca troca seu material por outro.

Exemplos sem Sorte: setor 1 paga 5; setor 10 paga 7; setor 251 paga 10;
setor 260 paga 12.

## Custos de fusão revisados

| Receita | Materiais | Núcleos | Farm galáctico equivalente |
|---|---|---:|---:|
| Síntese Básica | 40 Ferrita | 40 | 8 setores |
| Síntese Ligada | 80 Ferrita + 30 Titânio | 150 | 22 setores |
| Transmutação | 60 Titânio + 24 Cristal Quântico | 600 | ~15 setores |
| Fusão Estelar | 60 Cristal Quântico + 30 Aço Estelar | 2.500 | ~10 setores |
| Convergência | 80 Aço Estelar + 20 Núcleos de Energia | 12.000 | 8 setores + 20 chefes |
| Singularidade Contida | 12 Fragmentos Divinos + 6 Essências Primordiais | 60.000 | 12 chefes + ~2 Provações |

A barreira principal da fusão continua sendo sacrificar dez itens e vencer a
chance de subir. Materiais orientam o jogador para conteúdos específicos; não
devem superar em dezenas de vezes o custo dos itens.

## Dez operações da Bancada

| Essência | Operação | Custo-base | Regra |
|---|---|---:|---|
| Pó Lunar | Remoldar linha | 3 | troca identidade, mantém tipo/tier |
| Rolha de Asteroide | Ancorar | 4 | protege ou libera a linha |
| Areia Estelar | Lapidar | 4 | rerrola só valor/qualidade |
| Cinzas Cósmicas | Dissolver | 5 | remove e abre espaço |
| Crista Meteórica | Imprimir prefixo | 6 | adiciona ofensiva em espaço vazio |
| Sangue de Estrela | Ascender | 8 | eleva um tier até o teto da raridade |
| Lágrima Galáctica | Imprimir sufixo | 6 | adiciona defesa/utilidade |
| Átomo Raro | Transpor | 10 | converte prefixo/sufixo |
| Fragmento Temporal | Eco temporal | 8 | alterna com o estado anterior |
| Essência Primordial | Aperfeiçoar | 6 | qualidade mínima 75% nas linhas livres |

O custo de Núcleos cresce por raridade e nível do item. Operações de até cinco
essências recebem +1 unidade em Épico e +2 em Divino; as finais já são raras e
não recebem esse multiplicador.

## Orgânicos e seus sinks

- Medicina do Vácuo: entrega 60 Biogel e 50 Esporos; o final consome 30/25 e
  produz 25 Núcleos Orgânicos.
- Jardins sem Sol: entrega 55 Algas e 35 Néctares; o final consome 30/20 e
  produz 18 Polpas Nebulares.
- O Outro Lado: entrega 40 Essências Xeno; o final consome 25 e produz 20
  Cristais Vivos.

## Eventos e gases

Um evento dura 72 horas, guarda progresso por ocorrência (`evento:ciclo`) e
entrega somente seu gás. A rotação completa leva 30 dias. Nenhum gás existe em
drop comum, planeta, desmontagem, chefe ou loja.

## Critérios de revisão futura

Só alterar abundância depois de medir: conclusões por receita, taxa de uso de
cada protocolo, recursos parados no Armazém e quantos eventos são concluídos.
Se um material acumular sem uso, criar sink antes de reduzir drop; se uma
receita travar por material enquanto os itens já existem, reduzir o custo ou
subir a fonte dentro das metas acima.

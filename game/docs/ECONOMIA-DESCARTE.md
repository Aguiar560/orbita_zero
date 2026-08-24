# Venda e desmontagem de equipamentos

> Fonte de verdade: `src/data/balance/descarte.ts`  
> Auditoria reproduzível: `npm run simular:descarte`  
> Revisão: 23/08/2026

## A decisão

Todo equipamento sem uso tem dois destinos mutuamente exclusivos:

| Ação | Entrega | Serve para | Nunca entrega |
|---|---|---|---|
| **Vender** | Sucata | Loja, serviços e câmbio limitado | Núcleos, Cristais ou materiais |
| **Desmontar** | Materiais galácticos | Fusão e craft | Qualquer moeda |

O sistema antigo dava Núcleos **e** materiais no mesmo desmanche. Isso foi
removido porque eliminava a decisão: uma ação obtinha todos os resultados e a
outra não teria motivo para existir.

## O que determina o retorno

As duas ações leem quatro propriedades da peça:

1. **Raridade** — é o maior multiplicador.
2. **Nível do item** — venda cresce continuamente; desmontagem usa faixas de 20 níveis.
3. **Tier da base, 0–7** — representa quantidade/qualidade física do componente.
4. **Tier e qualidade média dos afixos** — acrescentam aproximadamente 0,93× a 1,30×.

Item de conjunto ganha +20% na venda e +10% na desmontagem. O bônus é pequeno
porque conjunto já possui valor funcional e não deve virar a melhor matéria-
prima do jogo.

## Fórmula de venda

```text
(12 + ilvl × 2,4)
× multiplicador da raridade
× (1 + tier da base × 0,07)
× qualidade média
× bônus de conjunto
```

| Raridade | Multiplicador |
|---|---:|
| Comum | 1× |
| Incomum | 2× |
| Raro | 4× |
| Épico | 8× |
| Lendário | 18× |
| Mítico | 45× |
| Divino | 120× |

A venda paga Sucata porque é a moeda de volume. Não paga Cristal — moeda de
conquista — nem Núcleo, que continua vindo principalmente do combate. O câmbio
da Loja permite transformar excesso de Sucata em Núcleos, mas possui perda e
cota, impedindo uma conversão infinita.

## Fórmula de desmontagem

```text
unidades = faixa de 20 níveis
× multiplicador da raridade
× (1 + tier da base × 0,06)
× qualidade média
× bônus de conjunto

material secundário = 25% do principal
```

| Raridade | Material principal | Secundário | Multiplicador |
|---|---|---|---:|
| Comum | Ferrita | — | 1× |
| Incomum | Ferrita | Titânio | 1,45× |
| Raro | Titânio | Cristal Quântico | 2,10× |
| Épico | Cristal Quântico | Aço Estelar | 3× |
| Lendário | Aço Estelar | Liga Celestial | 4,20× |
| Mítico | Liga Celestial | Fluxo Dimensional | 6× |
| Divino | Fluxo Dimensional | Matéria Escura | 8,50× |

Somente materiais galácticos aparecem aqui. Desmontar nunca cria recursos de
Missão, Evento, Chefe ou Provação; esses modos mantêm sua identidade econômica.

## Medianas reais

Valores medidos com 101 itens reais por célula, incluindo bases e afixos
sorteados pelo gerador do jogo.

### Nível de item 100

| Raridade | Venda | Desmontagem mediana |
|---|---:|---|
| Comum | 360 Sucatas | 7 Ferritas |
| Incomum | 740 Sucatas | 10 Ferritas + 3 Titânios |
| Raro | 1.575 Sucatas | 16 Titânios + 4 Cristais Quânticos |
| Épico | 3.250 Sucatas | 23 Cristais Quânticos + 6 Aços Estelares |
| Lendário | 8.100 Sucatas | 33 Aços Estelares + 8 Ligas Celestiais |
| Mítico | 20.475 Sucatas | 48 Ligas Celestiais + 12 Fluxos Dimensionais |
| Divino | 56.350 Sucatas | 70 Fluxos Dimensionais + 18 Matérias Escuras |

### Nível de item 270

| Raridade | Venda | Desmontagem mediana |
|---|---:|---|
| Comum | 970 Sucatas | 20 Ferritas |
| Incomum | 1.925 Sucatas | 28 Ferritas + 7 Titânios |
| Raro | 4.050 Sucatas | 43 Titânios + 11 Cristais Quânticos |
| Épico | 8.475 Sucatas | 64 Cristais Quânticos + 16 Aços Estelares |
| Lendário | 20.150 Sucatas | 94 Aços Estelares + 24 Ligas Celestiais |
| Mítico | 55.675 Sucatas | 139 Ligas Celestiais + 35 Fluxos Dimensionais |
| Divino | 158.350 Sucatas | 209 Fluxos Dimensionais + 52 Matérias Escuras |

## Relação com a Fusão

- No nível 100, um Comum mediano entrega 7 Ferritas: são necessários cerca de
  29 desmontes para pagar as 200 Ferritas da primeira receita.
- No nível 270, um Comum entrega 20: dez desmontes pagam o material, mas a
  receita ainda consome outras dez peças. Não existe ciclo autossustentável.
- Raro e Épico alimentam as ligas das receitas equivalentes.
- Lendário+ pode pagar a parte galáctica, mas não produz Núcleo de Energia,
  Fragmento Divino ou Essência Primordial. Chefes e Provação continuam sendo
  portas obrigatórias do craft superior.

## Regras de segurança e interface

- Favorito nunca pode ser vendido ou desmontado; é preciso desmarcá-lo.
- Desmontagem manual é recusada se os novos tipos não couberem no Armazém.
- Descarte automático pode ser configurado como **Vender** ou **Desmontar**.
- Se o Armazém estiver cheio durante desmontagem automática, a peça é vendida
  em vez de perder todo o valor silenciosamente.
- Clique equipa; Shift+clique desmonta; Alt+clique vende; botão direito favorita.
- Existem ações em lote separadas para vender ou desmontar itens até Incomum.
- O cartão do item mostra os dois retornos antes da decisão.

## O que medir futuramente

As fórmulas estão balanceadas contra os custos atuais, mas precisam ser
remedidas quando o volume real de drops ou as receitas mudarem:

1. Sucata por hora vinda de venda contra Sucata por combate.
2. Quantos itens de cada raridade são vendidos, desmontados, fundidos ou guardados.
3. Tempo para pagar cada receita somente com desmontagem.
4. Frequência da venda automática por Armazém cheio.
5. Se uma ação supera 75% de preferência; acima disso a escolha provavelmente
   virou obrigação e os multiplicadores devem ser revistos.

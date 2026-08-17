/**
 * Orçamento e peso de atributos (§7).
 *
 * `powerScore` enxergava 9 dos 27 atributos. Os outros 18 — perfuração,
 * explosão, velocidade, sorte, as três rendas e as cinco resistências —
 * valiam ZERO na comparação de itens. As consequências não eram cosméticas:
 *
 * - O auto-equipar descartava uma peça de resistência pura como se fosse vazia.
 * - A medição de dispersão do §7 dava piso ~0 e razão máx/mín de 570×, porque
 *   um item cujas linhas caíssem todas no conjunto cego pontuava nada. O número
 *   media a cegueira do medidor, não a dispersão dos itens.
 *
 * Os coeficientes abaixo não são pesos arbitrários somados no fim. Cada um
 * entra ONDE o atributo age — perfuração e explosão dentro do dano por segundo,
 * velocidade e resistência dentro da sobrevivência, renda e sorte num fator
 * próprio. Uma soma ponderada plana perderia justamente o que a nota tem de
 * certo hoje: o produto `√dps × √vida` faz um canhão de vidro pontuar abaixo de
 * uma nave equilibrada, e é isso que impede o auto-equipar de montar uma nave
 * que mata rápido e morre mais rápido ainda.
 */

/**
 * Quanto cada ponto de perfuração vale, como fração de um alvo extra.
 *
 * Uma bala com `pierce = 1` atravessa e acerta o próximo inimigo com dano
 * cheio, o que valeria 1,0 — mas só quando há um segundo inimigo NA LINHA do
 * tiro. Em onda de vanguarda (poucos e espalhados) não há; em enxame há quase
 * sempre. 0,5 é a média entre os perfis de `PERFIS_DE_ONDA`.
 */
export const PERFURACAO_EFICACIA = 0.5;

/**
 * Quanto cada unidade de raio de explosão vale em dano por segundo.
 *
 * O respingo bate a 45% do dano (`VerticalMode`), e quantos inimigos pega
 * depende da densidade. Medido contra os raios que os afixos rolam — dezenas de
 * pixels, contra uma tela de centenas —, o respingo típico alcança bem menos de
 * um inimigo extra por tiro. Daí o coeficiente por UNIDADE de raio ser pequeno:
 * ele é multiplicado por um número grande.
 */
export const EXPLOSAO_EFICACIA = 0.004;

/**
 * Quanto a velocidade de deslocamento vale em sobrevivência.
 *
 * Velocidade não some com dano recebido — ela evita o tiro antes. Vale menos
 * que vida por ponto porque depende do piloto: com `iaSkill` baixo o piloto não
 * usa a mobilidade que tem. Deliberadamente modesto, porque velocidade é o
 * único atributo sem teto (§40 fala de cadência de ataque, não de deslocamento)
 * e um coeficiente alto faria o auto-equipar perseguir só isso.
 */
export const VELOCIDADE_EFICACIA = 0.0025;

/**
 * Peso da sorte na nota.
 *
 * Sorte não ganha combate nenhum: ela muda o que CAI. Entra na nota porque uma
 * peça de sorte pura é um investimento real, e valia zero antes. Baixo de
 * propósito — se pesasse como dano, o auto-equipar montaria uma nave que não
 * mata nada e morre com o inventário cheio.
 */
export const SORTE_PESO = 0.06;

/**
 * Peso das três rendas — sucata, núcleo e XP — somadas.
 *
 * Mesma lógica da sorte, e ainda menor: renda acelera o que já está acontecendo,
 * enquanto sorte muda a qualidade do que aparece.
 */
export const RENDA_PESO = 0.03;

/**
 * Janela de combate para valorizar regeneração, em segundos.
 *
 * Já era usada em `effectiveHp`; mora aqui agora para o §7 ter todos os
 * coeficientes de valoração no mesmo arquivo.
 */
export const JANELA_DE_COMBATE = 20;

/**
 * Todas as curvas de progressão do jogo, num lugar só (§2, §36).
 *
 * Antes disto os expoentes viviam espalhados por sete arquivos — dificuldade em
 * `sim/progression.ts`, custo da Matriz em `sim/tree.ts`, XP de patrulha em
 * `sim/index.ts`, escala de afixo em `sim/loot.ts`. O efeito prático era que
 * ninguém nunca havia calculado a RAZÃO entre a curva do inimigo e a do
 * jogador, que é justamente o número que define o ritmo do jogo. A auditoria da
 * FASE 0 mediu essa razão em 1,129 por setor: 131 mil vezes acumuladas em 99
 * setores, o que torna o jogo trivial até o setor 40 e impossível depois do 80.
 *
 * Este arquivo é só de DADOS: nenhuma regra de jogo mora aqui, só os números e
 * a forma das curvas. Quem os consome continua em `sim/`.
 *
 * ► Os valores abaixo são os ORIGINAIS, movidos sem alteração. A recalibragem é
 *   a etapa 1.4, e vai mexer nestes números com simulação por trás.
 */

// ── estrutura do setor ──────────────────────────────────────────────────────

/** Ondas por setor antes do encontro final. */
export const WAVES_PER_SECTOR = 5;

/** Nível de item que cai no setor. */
export const ILVL_POR_SETOR = 0.9;

// ── poder esperado do jogador (MEDIDO) ──────────────────────────────────────

/**
 * A curva de poder do jogador não é exponencial — é polinomial no nível de item.
 *
 * O afixo aditivo escala com `1 + ilvl × 0,32` e o nível de item cresce
 * linearmente com o setor, então o poder cresce como POLINÔMIO em ilvl. A curva
 * de dificuldade antiga era exponencial pura (1,235 por setor), e uma
 * exponencial sempre ultrapassa um polinômio: não existia constante capaz de
 * consertar aquilo, só mudar a forma.
 *
 * Estes números saíram de medição, não de palpite. `npm run simular -- ajustar`
 * monta um jogador em 34 setores de 1 a 300, tira a mediana de sete sementes
 * por setor e ajusta a lei de potência por mínimos quadrados em log-log.
 *
 *   DPS      = 0,527  × (ilvl + 3,0) ^ 2,9279    R² 0,9945
 *   vida ef. = 42,902 × (ilvl + 1,5) ^ 1,2541    R² 0,9865
 *
 * ► Remedidos na 3.6: a décima categoria (§11) é um slot A MAIS, e um slot a
 *   mais é ~11% de poder que a curva não conhecia.
 *
 * ► Remedidos antes na 3.3, e desta vez o refit É a ferramenta certa: a calibragem
 *   de afixo mudou o poder de TODO item do jogo, não um setor. Sem ele, três
 *   setores ficavam impossíveis.
 *
 * ► A 3.2 TENTOU remedir e reverteu. A afinidade de slot deixou o jogador mais
 *   duro no setor 50, e refazer o ajuste baixou `DEFESA_A` — o que reduz o dano
 *   do inimigo e faz o jogador aguentar AINDA MAIS golpes. O sintoma piorou de
 *   34,7 para 37,3. O ajuste global é mínimos quadrados sobre 34 setores; puxá-lo
 *   para corrigir um ponto é usar a ferramenta errada.
 *
 * ► Remedidos na etapa 1.6. Os tiers de afixo tornaram o topo de magnitude uma
 *   ROLAGEM em vez de um efeito colateral da raridade, então o jogador médio
 *   ficou mais fraco e os coeficientes caíram junto — `PODER_A` pela metade.
 *   O expoente quase não se moveu (2,7626 → 2,7999), que é o sinal de que a
 *   FORMA da curva não mudou: só a altura.
 *
 * O deslocamento existe por causa do começo: no nível de item 1 o poder vem
 * quase todo do CASCO, e uma lei de potência pura previa 14 de dano onde a
 * medição dava 296.
 *
 * A medição modela o grau de OTIMIZAÇÃO subindo com o setor — poucas peças por
 * slot no começo, muitas no fim. Medir tudo com o jogador otimizado fazia o
 * setor 1 parecer trivial (2,3 s por onda) quando na prática é o trecho mais
 * apertado do jogo.
 *
 * ► Repita a medição sempre que mexer em afixos, cascos ou Matriz. Estes
 *   expoentes DESCREVEM o jogo; se o jogo mudar e eles não, o ritmo desanda em
 *   silêncio.
 */
export const PODER_A = 0.0602;
export const PODER_P = 3.0655;

export const DEFESA_A = 27.630;
export const DEFESA_P = 1.2515;

export const PODER_C = 3;
export const DEFESA_C = 1.5;

/**
 * O primeiro trecho do jogo tem curva própria, e isso não é fudge — é o
 * reconhecimento de que uma lei de potência só não descreve as duas pontas.
 *
 * Medido: no setor 5 o ajuste prevê 276 de dano por segundo e o jogador tem 95;
 * no setor 15 prevê 8,2 mil e ele tem 10,1 mil. O erro é SISTEMÁTICO, não
 * ruído — o começo é dominado por QUANTOS slots estão preenchidos, e o resto
 * pela qualidade do que está neles. São dois regimes.
 *
 * Ignorar isso custou caro na primeira tentativa: o jogo travava no setor 5 com
 * 150 mortes e o jogador nunca coletava item suficiente para sair.
 *
 * `INICIO_BASE` é o dano por segundo da nave nua, medido. `INICIO_RAZAO` é o
 * crescimento por setor observado entre os setores 1 e 15. A lei de potência
 * assume o comando por volta do setor 19, quando passa a ser a menor das duas.
 */
export const INICIO_BASE = 23.1;
export const INICIO_RAZAO = 1.2296;
export const INICIO_DEFESA_BASE = 162.1;
export const INICIO_DEFESA_RAZAO = 1.0882;

/**
 * A assimetria que a Fase 3 ainda precisa atacar: **2,76 contra 1,25**.
 *
 * A ofensiva do jogador cresce mais que o dobro da defensiva, porque os afixos
 * ofensivos são multiplicativos e os defensivos são aditivos. Já foi pior — era
 * 3,70 contra 1,10 enquanto crítico e sorte escalavam com o nível de item, o
 * que inflava o dano e não a sobrevivência. As curvas abaixo acomodam o que
 * sobrou; fechar a diferença é trabalho de orçamento de item (§7).
 */
export const poderEsperado = (setor: number): number => Math.min(
  PODER_A * Math.pow(curvaIlvl(setor) + PODER_C, PODER_P),
  INICIO_BASE * Math.pow(INICIO_RAZAO, setor - 1),
);

export const defesaEsperada = (setor: number): number => Math.min(
  DEFESA_A * Math.pow(curvaIlvl(setor) + DEFESA_C, DEFESA_P),
  INICIO_DEFESA_BASE * Math.pow(INICIO_DEFESA_RAZAO, setor - 1),
);

// ── ritmo: o jogo escrito em segundos e em golpes ───────────────────────────

/**
 * Quantos segundos uma onda comum DEVE durar.
 *
 * Este é o botão do ritmo de combate, e é deliberadamente uma grandeza que se
 * pode discutir sem abrir o código: "a onda do setor 200 leva 40 segundos" é
 * uma frase de design, "a vida vale 34 × 1,235^199" não é.
 *
 * Sobe devagar porque o encontro precisa ganhar peso conforme a nave fica
 * poderosa — mas nunca vira espera: 45 s é o teto assintótico.
 */
/**
 * 4 e não 8: o ajuste de poder foi medido num jogador que JÁ TEM equipamento, e
 * no setor 1 ninguém tem. A nave crua faz 24 de dano por segundo contra os 86
 * que a curva pressupõe — 28% do esperado —, então uma onda dimensionada para
 * 8 s levava 30 s e o piloto morria antes de fechá-la. Medido: 25 minutos preso
 * na onda 1 com 16 mortes.
 */
export const TEMPO_INICIO = 4;
/**
 * 34 e não 45: o ajuste de poder tem resíduo de ±35%, então o tempo real de uma
 * onda oscila nessa faixa em torno do alvo. Com teto em 45 os setores do fim
 * batiam em 60–70 s. O resíduo vem da dispersão de poder entre itens da mesma
 * raridade — medida em 135× no §2.4 —, que é problema de orçamento de item e
 * cabe à Fase 3. Quando ela apertar essa dispersão, dá para subir este teto.
 */
export const TEMPO_FIM = 34;
export const TEMPO_K = 90;

export const tempoAlvo = (setor: number): number =>
  TEMPO_INICIO + (TEMPO_FIM - TEMPO_INICIO) * (1 - Math.exp(-setor / TEMPO_K));

/**
 * Quantos golpes o jogador DEVE aguentar.
 *
 * Cai ao longo do jogo: no começo o piloto de IA é cru de propósito e precisa
 * de margem para aprender; no fim a tensão vem de o erro custar caro. Dez
 * golpes é o piso — abaixo disso um único descuido mata e a camada idle vira
 * loteria.
 */
/**
 * 40 no começo pelo mesmo motivo do tempo: a nave crua tem 227 de vida efetiva
 * contra os 381 que a curva pressupõe. Além disso o piloto de IA nasce
 * incompetente de propósito (§30 da auditoria), e precisa de margem para
 * aprender. `K` menor faz essa generosidade se dissolver rápido — no setor 60
 * já sobrou pouca.
 */
export const GOLPES_INICIO = 40;
export const GOLPES_FIM = 10;
export const GOLPES_K = 60;

export const golpesAlvo = (setor: number): number =>
  GOLPES_FIM + (GOLPES_INICIO - GOLPES_FIM) * Math.exp(-setor / GOLPES_K);

/**
 * Fração da vida do encontro que vira recompensa.
 *
 * Amarrada à vida e não a uma exponencial própria: com `7 × 1,19^setor` a
 * recompensa chegava a 2,7 × 10²³ no setor 300 enquanto a vida ficava em
 * 6,9 × 10⁹ — o jogador afogado em moeda sem nada proporcional para comprar.
 * O valor preserva os 7 de recompensa do setor 1.
 */
export const RECOMPENSA_FRACAO = 0.0033;

/**
 * Encontros especiais, medidos em ONDAS COMUNS.
 *
 * Antes o chefe multiplicava a vida base por 26 a 260, números que faziam
 * sentido quando a base era minúscula perto do poder do jogador. Com a curva
 * amarrada ao tempo-alvo, quem escala com o setor é a própria base — e aquele
 * multiplicador passaria a somar duas escaladas, levando o chefe do setor 100 a
 * doze minutos de tiro.
 *
 * Aqui o número diz o que se quer dizer: um chefe vale três ondas e meia, uma
 * elite vale duas e pouco. `BossDef.hp` continua existindo para diferenciar um
 * chefe do outro, mas numa faixa estreita de identidade (1,0 a 2,0).
 */
export const CHEFE_ONDAS = 5;
export const ELITE_ONDAS = 2.2;

/**
 * Quanto o chefe pressupõe que o jogador esteja ACIMA da curva do setor.
 *
 * É o número que transforma o chefe em marco em vez de sexta onda. Todo o resto
 * do jogo é dimensionado para o jogador que acabou de chegar ao setor; o chefe é
 * dimensionado para quem já voltou aos setores anteriores atrás de item e de
 * nível. Quem tenta na chegada apanha, e apanhar aqui é a informação de que
 * falta preparo — não um bug de balanceamento.
 *
 * Multiplica vida E dano: só vida faria uma luta longa, só dano faria uma
 * loteria. Juntos, exigem equipamento para aguentar e para derrubar.
 */
export const CHEFE_EXIGENCIA = 1.6;

/**
 * Quanto um chefe fica mais duro a cada volta na lista.
 *
 * Era 2,6, também herdado de quando a base não escalava direito. Com a curva
 * corrigida, 1,25 basta para a repetição pesar sem virar muro.
 */
export const CHEFE_CICLO = 1.25;

/** Recompensa extra do chefe, sobre a parte proporcional à vida dele. */
export const CHEFE_BONUS_RECOMPENSA = 1.5;

// ── densidade e pressão: dificuldade que não é só número ────────────────────

/**
 * Quantos inimigos a onda coloca na tela.
 *
 * Isto não existia. A contagem saía de `orçamento ÷ vida por unidade`, e como
 * as duas parcelas escalavam com a mesma base, ela se cancelava: **o setor 1 e
 * o setor 300 tinham o mesmo número de inimigos**. Só a barra de vida mudava.
 *
 * Agora a contagem é ALVO e a vida por unidade é derivada — a mesma inversão
 * que se fez com a dificuldade. O total continua sendo `curvaHp`, então o
 * tempo-alvo da onda não muda; o que muda é a cara dela.
 */
export const DENSIDADE_INICIO = 50;
export const DENSIDADE_FIM = 90;
export const DENSIDADE_K = 110;

export const densidadeAlvo = (setor: number): number =>
  DENSIDADE_INICIO + (DENSIDADE_FIM - DENSIDADE_INICIO) * (1 - Math.exp(-setor / DENSIDADE_K));

/**
 * A densidade que a XP de abate continua enxergando.
 *
 * E a curva ANTERIOR ao adensamento, congelada de proposito. A XP por abate
 * e fixa por inimigo, entao dez vezes mais inimigos seriam dez vezes mais XP
 * — e a densidade, que e uma escolha de RITMO, viraria alavanca de
 * progressao.
 *
 * Guardar a curva velha em vez de um divisor unico e o que torna isto exato:
 * o adensamento nao e uniforme (10x no setor 1, 4,6x no 300), entao nenhum
 * divisor constante manteria a XP igual nas duas pontas.
 *
 * So `rewardKill` usa. Se um dia a XP de abate deixar de ser fixa por
 * inimigo, isto some junto.
 */
/**
 * Como a onda ENTRA em cena.
 *
 * Estavam soltos dentro do `WaveDirector` como `rng.int(4, 8)` e
 * `rng.range(1.1, 2.4)`. Vieram para ca por dois motivos.
 *
 * O primeiro e regra de projeto: numero de balanceamento nao mora dentro de
 * uma cena.
 *
 * O segundo e concreto e foi o que obrigou. Com a onda adensada, o que
 * determina a duracao de um setor no comeco do jogo deixou de ser o dano do
 * jogador e passou a ser a ENTRADA: no setor 1 a onda tem 50 inimigos de 0,2
 * de vida, que morrem instantaneamente — o que se espera e eles chegarem. E
 * o caminho abstrato (progresso offline) precisa saber disso, senao ele
 * limpa o setor 1 em 0,4s enquanto ao vivo leva 70s, e ficar offline vira o
 * jeito rapido de progredir.
 */
export const LEVA_MIN = 4;
export const LEVA_MAX = 8;
export const LEVA_INTERVALO_MIN = 1.1;
export const LEVA_INTERVALO_MAX = 2.4;

/** Inimigos por segundo que a cena consegue colocar em campo, na media. */
export const TAXA_DE_ENTRADA =
  ((LEVA_MIN + LEVA_MAX) / 2) / ((LEVA_INTERVALO_MIN + LEVA_INTERVALO_MAX) / 2);

export const DENSIDADE_XP_INICIO = 5;
export const DENSIDADE_XP_FIM = 20;

export const densidadeParaXp = (setor: number): number =>
  DENSIDADE_XP_INICIO + (DENSIDADE_XP_FIM - DENSIDADE_XP_INICIO) * (1 - Math.exp(-setor / DENSIDADE_K));

/**
 * Cadência de tiro dos inimigos, como multiplicador.
 *
 * Sobe devagar e tem teto: é o eixo que faz a tela ficar mais perigosa sem
 * inflar nenhum número da ficha. Passar disto vira parede de projétil, que num
 * jogo pilotado por IA é frustração e não desafio.
 */
export const PRESSAO_INICIO = 0.8;
export const PRESSAO_FIM = 1.6;
export const PRESSAO_K = 120;

export const pressaoAlvo = (setor: number): number =>
  PRESSAO_INICIO + (PRESSAO_FIM - PRESSAO_INICIO) * (1 - Math.exp(-setor / PRESSAO_K));

export interface PerfilDeOnda {
  id: string;
  nome: string;
  /** Multiplicador na CONTAGEM. A vida por unidade recebe o inverso. */
  densidade: number;
  /** Multiplicador na cadência de tiro dos inimigos. */
  pressao: number;
  /** Quantos tipos diferentes de inimigo a onda mistura. */
  tipos: readonly [number, number];
  peso: number;
}

/**
 * Perfis de onda — a variedade que o jogador percebe.
 *
 * Todos gastam o MESMO orçamento de vida, então nenhum quebra a calibragem de
 * tempo. O que muda é como esse orçamento é repartido: muitos inimigos fracos
 * que atiram pouco, poucos duros que atiram muito, ou algo no meio.
 *
 * O produto `densidade × pressão` fica entre 0,86 e 1,26 de propósito: dá para
 * uma onda ser mais tensa que a outra sem que nenhuma saia da faixa em que a
 * curva foi calibrada.
 */
export const PERFIS_DE_ONDA: readonly PerfilDeOnda[] = [
  { id: 'enxame', nome: 'Enxame', densidade: 2.4, pressao: 0.5, tipos: [1, 2], peso: 22 },
  { id: 'pelotao', nome: 'Pelotão', densidade: 1, pressao: 1, tipos: [2, 3], peso: 38 },
  { id: 'vanguarda', nome: 'Vanguarda', densidade: 0.45, pressao: 1.9, tipos: [1, 2], peso: 20 },
  { id: 'fuzilaria', nome: 'Fuzilaria', densidade: 1.2, pressao: 1.05, tipos: [2, 4], peso: 20 },
];

// ── progressão do jogador ───────────────────────────────────────────────────

/**
 * XP para subir um nível de personagem.
 *
 * POLINOMIAL, não exponencial, e a diferença decide se o nível 300 existe: com
 * `140 × 1,155^n` o último nível custaria 7 × 10²⁰ de XP — o teto de 300 do §17
 * seria decorativo. Uma potência de `n` cresce rápido o bastante para os níveis
 * altos serem conquista e devagar o bastante para serem alcançáveis.
 *
 * ► Primeira passada. Precisa de simulação contra as metas de tempo do §2.
 */
export const NIVEL_MAX = 300;
/**
 * Curva de XP do personagem: 20 x nivel^2,46.
 *
 * Era 90 x nivel^1,75, e com ela o teto de 300 niveis era batido por volta do
 * SETOR 140 — mais da metade da campanha sem dar nivel nenhum, com XP virando
 * lixo para missao, bau, patrulha e Provacao, e a Matriz parando de ganhar
 * pontos.
 *
 * Os valores saem de busca numérica CONJUNTA com o multiplicador de renda
 * (`XP_GANHO_GLOBAL`), contra oito alvos: nível acompanhando o setor do 5 ao
 * 180, e o nível 300 chegando por volta do setor 270 — daí em diante a
 * progressão é por ITENS, não por nível.
 *
 * Buscar as duas coisas juntas foi o que resolveu. Separadas, elas brigavam:
 * ajustar só a renda corrigia o começo e estourava o meio (setor 180 dava 232
 * em vez de 180), e ajustar só a curva não movia o começo (quatro variantes
 * levaram o setor 10 de nível 6 a 8, contra o alvo de 10). O erro médio caiu de
 * 12,8% para 7,2% quando os quatro parâmetros foram buscados de uma vez.
 *
 * Medido: setor 5 → 6, 10 → 10, 20 → 18, 30 → 27, 60 → 57, 100 → 103,
 * 180 → 198, 270 → 300.
 */
export const PERSONAGEM_XP_BASE = 10;
export const PERSONAGEM_XP_EXPO = 2.96;

/**
 * XP para subir um nível de NAVE.
 *
 * Mais rasa que a do personagem de propósito: subir a segunda nave precisa ser
 * viável, senão o §18 — trocar de nave conforme o conteúdo — não acontece, e a
 * frota vira uma nave só com dezenove enfeites.
 */
export const NAVE_XP_BASE = 60;
export const NAVE_XP_EXPO = 1.55;

/** Quanto cada nível de nave soma aos atributos base dela. */
export const NAVE_GANHO_POR_NIVEL = 0.012;

/** Sincronia do piloto concedida por patente, e o teto dessa fonte. */
export const COMANDO_IA_POR_NIVEL = 0.011;
export const COMANDO_IA_MAX = 0.4;

/** XP para subir o nível de patrulha da faixa horizontal. */
export const PATRULHA_XP_BASE = 120;
export const PATRULHA_XP_RAZAO = 1.24;

// ── itens ───────────────────────────────────────────────────────────────────

/**
 * Quanto um afixo aditivo cresce por nível de item.
 *
 * Vale para valores BRUTOS — dano, casco, escudo, regeneração —, que precisam
 * acompanhar a curva. Percentuais não escalam porque já são relativos.
 */
export const AFIXO_ESCALA_POR_ILVL = 0.32;

/**
 * Atributos que são FRAÇÃO, mesmo somando como valor absoluto.
 *
 * Nenhum deles pode escalar com o nível de item, e a distinção não é
 * cosmética: `+4,5% de crítico` escalado por ilvl 200 vira `+990% de crítico`.
 * Os tetos escondiam o problema em quase todos — crítico e sincronia batiam no
 * limite e o afixo virava inútil dali em diante — mas `sorte` não tem teto
 * natural, e o estrago apareceu na tabela de raridade: um jogador bem equipado
 * chegava a 3699% de sorte e o baú de Singularidade soltava Divino em metade
 * dos itens.
 *
 * A resistência elemental já estava fora por este mesmo motivo; esta lista
 * generaliza a regra em vez de tratar cada caso.
 */
export const ATRIBUTOS_FRACIONARIOS: ReadonlySet<string> = new Set([
  'critChance', 'critDano', 'sorte', 'iaSkill',
  // Os três da Fase 2. Penetração é o mais perigoso da lista: como `add` sem
  // esta marca, "+2% de penetração" viraria +180% no fim do jogo e o anel
  // elemental deixaria de existir.
  'critElemChance', 'critElemDano', 'penetracao',
  // As três rendas entraram na 1.7, quando deixaram de ser `mul` (sobre base
  // zero, portanto inertes) e viraram `add`. Como `add` sem esta marca, elas
  // passariam a escalar com o nível de item e "+6% de sucata" viraria +580% no
  // fim do jogo — exatamente o defeito que esta lista existe para impedir.
  // Os seis de potência elemental não precisam entrar: `rollAffix` já os
  // exclui por terem `element`.
  'sucataGanho', 'nucleoGanho', 'xpGanho',
]);

/** Chance de um abate soltar item, por tipo de encontro. */
export const DROP_BASE = { onda: 0.06, elite: 0.5, chefe: 1 } as const;
/** Quanto a sorte empurra a chance de drop, e o teto dela. */
export const DROP_SORTE_PESO = 0.8;
export const DROP_TETO = 0.75;

// ── funções de curva ────────────────────────────────────────────────────────

const geometrica = (base: number, razao: number, n: number): number =>
  base * Math.pow(razao, n - 1);

export const curvaIlvl = (setor: number): number =>
  Math.max(1, Math.floor(setor * ILVL_POR_SETOR));

/**
 * A inversão que a FASE 0 propôs.
 *
 * A dificuldade deixou de ser um número absoluto e passou a ser DERIVADA do
 * poder esperado e do ritmo desejado. O efeito é que a magnitude dos números
 * vira consequência auditável em vez de acidente: antes ninguém havia calculado
 * a razão entre as duas curvas, e ela valia 1,129 por setor — 131 mil vezes
 * acumuladas em 99 setores, o que tornava o jogo trivial até o setor 40 e
 * impossível depois do 80.
 */
export const curvaHp = (setor: number): number => poderEsperado(setor) * tempoAlvo(setor);
export const curvaDano = (setor: number): number => defesaEsperada(setor) / golpesAlvo(setor);
export const curvaRecompensa = (setor: number): number => RECOMPENSA_FRACAO * curvaHp(setor);

export const curvaXpPatrulha = (nivel: number): number =>
  Math.ceil(geometrica(PATRULHA_XP_BASE, PATRULHA_XP_RAZAO, nivel));

/** XP para sair do nível `n` do personagem — o tamanho da faixa desse nível. */
export const curvaXpPersonagem = (nivel: number): number =>
  Math.ceil(PERSONAGEM_XP_BASE * Math.pow(Math.max(1, nivel), PERSONAGEM_XP_EXPO));

/** XP para sair do nível `n` de uma nave. */
export const curvaXpNave = (nivel: number): number =>
  Math.ceil(NAVE_XP_BASE * Math.pow(Math.max(1, nivel), NAVE_XP_EXPO));

/**
 * Nível de personagem exigido para desbloquear algo que pede um SETOR (§17).
 *
 * Derivado do setor, e não escrito item a item: são 72 bases, dezenas de itens
 * de loja e a frota inteira, e uma coluna de nível à mão divergiria da coluna de
 * setor no primeiro ajuste de ritmo.
 *
 * O papel dele não é ser uma segunda parede. Quem chegou ao setor JOGANDO tem
 * folga de sobra — o fator 0,55 fica bem abaixo do nível típico de quem
 * atravessa aquele trecho. O que ele barra é o acesso RUSHADO: alguém que pulou
 * setores por um caminho lateral, ou que voltou de um universo avançado, chega
 * ao conteúdo com nível de personagem que não sustenta o que ele compra.
 *
 * É o que dá ao nível de personagem um segundo significado além dos pontos da
 * Matriz — sem ele, subir de nível só abastecia a Matriz e nada mais.
 */
export const NIVEL_POR_SETOR_EXIGIDO = 0.55;

export const nivelExigido = (setor: number): number =>
  Math.max(1, Math.floor(setor * NIVEL_POR_SETOR_EXIGIDO));

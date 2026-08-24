import type { StatMap } from '@sim/types';
import { curvaRecompensa, defesaEsperada, poderEsperado } from './curvas';

/**
 * A escada de aquisição dos cascos Spaceships 2.0.
 *
 * ## O problema que ela resolve
 *
 * Os 29 cascos entraram como arte em teste, todos com `tier 4`, `cost 0` e
 * `requiresSector 0` — grátis e equipáveis no setor 1. Medido, isso deixava
 * **14 dos 20 cascos legados obsoletos desde o minuto zero**: tudo do setor 0 ao
 * 34 era mais fraco que uma nave de graça, incluindo compras de até 420 núcleos.
 * O melhor grátis marcava nota 918 contra 85 do casco inicial.
 *
 * E havia o buraco simétrico: a espinha legada termina no setor **70**, e os
 * outros **230 setores** — 77% da campanha — não ganhavam nave nova nenhuma.
 *
 * ## O desenho
 *
 * Cada casco recebe um setor próprio, espaçado uniformemente de
 * `SETOR_INICIAL` a `SETOR_FINAL` — uma nave nova a cada ~9 setores.
 *
 * **Não são cinco saltos.** A primeira versão agrupava os 29 em cinco degraus de
 * poder, e a medição reprovou: saltos grandes criam degraus que nenhuma curva
 * suave consegue seguir, e o erro do ajuste da dificuldade subiu de 0,21 para
 * **2,24**. Com a escada contínua o ajuste volta a fechar.
 *
 * As cinco LINHAS sobrevivem como agrupamento de leitura — é o que dá `tier` e
 * nome de família no Hangar, e é o que preserva a intenção original dos 29:
 * *"alternativas táticas, não uma escada de poder"*. Dentro de uma linha a
 * escolha é de ESTILO (arquétipo, elemento, arma); ao longo da escada é de
 * PROGRESSO.
 *
 * ## De onde vêm os números
 *
 * A escala sai de `poderEsperado` e `defesaEsperada` — as MESMAS curvas que a
 * dificuldade usa. É o que garante que uma futura recalibração da dificuldade
 * arraste a escada junto, em vez de deixá-la para trás em silêncio.
 *
 * Verificado do setor 1 ao 300 com 21 conjuntos por setor: **dois setores fora
 * de banda**, ambos na abertura (1 e 12), onde o casco vale de 99% a 43% do
 * poder total e nenhuma curva suave descreve o regime. Antes desta etapa eram
 * doze.
 *
 * ## Duas armadilhas medidas pelo caminho
 *
 * **Escalar tudo não funciona.** A primeira tentativa multiplicava TODOS os
 * atributos e a nota respondia a `f³`, porque cadência, crítico e projéteis
 * subiam junto e se multiplicavam entre si. Além de incontrolável, apagaria a
 * identidade dos arquétipos — um baluarte com crítico de duelista deixa de ser
 * um baluarte. Só magnitudes escalam; as taxas são a assinatura do arquétipo.
 * `explosao` fica de fora porque tem teto de 260 em `LIMITES`.
 *
 * **No fim do jogo o `dano` do casco quase não conta.** Medido no setor 70,
 * baixar o dano de um casco de 62 para 26 move a razão de 4,02× para 3,57×: os
 * itens dominam o termo aditivo. Quem manda são os MULTIPLICADORES. Por isso o
 * papel do casco tarde é defesa e identidade, e não dano bruto — e por isso
 * `EXPOENTE_DANO` é bem menor que `EXPOENTE_DEFESA`.
 */
export const MAGNITUDES_OFENSIVAS = ['dano'] as const;
export const MAGNITUDES_DEFENSIVAS = ['vida', 'escudo', 'regen'] as const;

/** O tier das naves do topo. Rótulo, não mecânica — nada lê `tier` para calcular. */
export const TIER_DIVINA = 7;

/**
 * Onde a escada começa. Antes disso o casco vale de 99% a 43% do poder total —
 * é o único trecho em que uma nave sozinha decidiria o jogo — e a espinha legada
 * já entrega `falcao_b` no setor 34.
 */
export const SETOR_INICIAL = 36;
/** O último casco. Cai perto do fim da campanha, não nele. */
export const SETOR_FINAL = 288;

/**
 * Quanto da curva o casco acompanha, por eixo.
 *
 * **Não é 1,0, e a medição diz por quê.** Fazer o casco seguir a curva inteira
 * (`poderEsperado(260)/poderEsperado(36) = 352×` no ataque) parece correto —
 * manteria a fatia do casco constante. Mas os ITENS já crescem com a curva, e a
 * soma dos dois passa a crescer mais rápido que ela: medido, o tempo de limpar
 * caiu para **0,10× do alvo** no setor 260. O jogador virava dez vezes mais
 * rápido que o pretendido.
 *
 * Com expoente abaixo de 1 o casco acompanha em PARTE: continua sendo um
 * upgrade real e não vira a fonte principal de poder — que é o que o invariante
 * "a nave evolui por item, craft e Matriz" protege.
 *
 * Os dois expoentes foram resolvidos por busca contra a faixa de ritmo, e são
 * diferentes porque o jogo é assimétrico: do setor 36 ao 260 o ataque precisa
 * crescer 352× e a defesa só 11,5×.
 */
export const EXPOENTE_DANO = 0.42;
export const EXPOENTE_DEFESA = 0.78;

/**
 * O piso da escada.
 *
 * Sem ele, os três primeiros postos nasciam MORTOS: medido, `centuriao_atlas`
 * (setor 36) marcava nota 433 contra 497 do `falcao_b` já disponível, e
 * `draco_viridiano` (setor 108) marcava 1.663 contra 1.830 do
 * `void_canhaozao` — cascos que custam centenas de núcleos e que ninguém
 * equiparia. Uma escada cujo primeiro terço é pior do que o que o jogador já
 * tem não é uma escada.
 *
 * O valor é o menor que põe todo posto acima do melhor legado disponível no seu
 * setor, verificado casco a casco.
 */
export const PISO_DA_ESCADA = 1.5;

export interface DegrauDeCasco {
  id: string;
  /** Nome da linha, para a ficha do Hangar. */
  nome: string;
  tier: number;
  /** Primeiro setor da faixa que esta linha cobre. */
  setorMin: number;
  cascos: readonly string[];
}

/**
 * As cinco linhas, em ordem de aquisição.
 *
 * A ORDEM desta lista é a escada: cada casco recebe um setor de desbloqueio
 * espaçado uniformemente de `SETOR_INICIAL` a `SETOR_FINAL`, dando uma nave nova
 * a cada ~9 setores. Foi assim, e não em cinco saltos, porque saltos grandes
 * criam degraus que nenhuma curva suave consegue seguir — medido, o erro do
 * ajuste da dificuldade subiu de 0,21 para 2,24 com a versão em blocos.
 *
 * A `tier` continua sendo por LINHA, não por casco: ela é o rótulo que agrupa,
 * e agrupar em cinco famílias lê melhor no Hangar do que 29 degraus numerados.
 *
 * Dentro de uma linha os cascos dividem faixa de poder e se separam por
 * arquétipo, elemento e arma — a escolha é de ESTILO, que era a intenção
 * original dos 29. Entre linhas a escolha é de PROGRESSO.
 *
 * Cada linha mistura arquétipos de propósito. Não há baluarte na Ascensão nem
 * interceptador na Divina, e isso é escassez deliberada: uma linha que tem tudo
 * não faz ninguém escolher.
 */
export const DEGRAUS_DE_CASCO: readonly DegrauDeCasco[] = [
  {
    id: 'i', nome: 'Linha de Fronteira', tier: 4, setorMin: SETOR_INICIAL,
    cascos: ['centuriao_atlas', 'ariete_vesper', 'lamina_kheiron', 'peregrina_sol', 'lince_polar', 'custodio_vinte_tres'],
  },
  {
    id: 'ii', nome: 'Linha de Expedição', tier: 5,
    setorMin: 0,
    cascos: ['cerbero_azul', 'talon_ignifero', 'draco_viridiano', 'vipera_helix', 'oraculo_safira', 'leviata_ferro'],
  },
  {
    id: 'iii', nome: 'Linha de Domínio', tier: 6, setorMin: 0,
    cascos: ['arraia_boreal', 'quimera_verde', 'rapina_ambar', 'martelo_helios', 'navegante_nox', 'arca_turquesa'],
  },
  {
    id: 'iv', nome: 'Linha de Ascensão', tier: TIER_DIVINA, setorMin: 0,
    cascos: ['seta_quantica', 'horizonte_trinta', 'eclipse_rubro', 'nemesis_alada', 'tridente_violeta', 'fornalha_dezenove'],
  },
  {
    id: 'v', nome: 'Linha Divina', tier: TIER_DIVINA, setorMin: 0,
    cascos: ['asa_carmim', 'aurora_negra', 'condor_magma', 'vanguarda_dez', 'bastiao_8'],
  },
];

/** Todos os cascos da escada, na ordem de aquisição. */
export const ORDEM_DA_ESCADA: readonly string[] = DEGRAUS_DE_CASCO.flatMap((d) => d.cascos);

/** O setor de desbloqueio do i-ésimo casco da escada. */
export const setorDaEscada = (indice: number): number => Math.round(
  SETOR_INICIAL + (SETOR_FINAL - SETOR_INICIAL) * (indice / (ORDEM_DA_ESCADA.length - 1)),
);

/**
 * O preço em núcleos — derivado da RENDA, não da nota.
 *
 * A primeira versão cobrava 0,64 núcleos por ponto de nota, que era a razão que
 * a espinha legada praticava. Medido depois, era **decoração**: a renda de
 * núcleos cresce muito mais rápido que a nota, e o casco mais caro da escada
 * (64.080) saía por **0,03% da renda acumulada** até o setor dele. O único
 * portão real era o setor; o preço não pesava em decisão nenhuma.
 *
 * Agora o custo é uma fração da renda da JANELA — o que o jogador ganha entre o
 * casco anterior e este. Comprar todos consome `FRACAO_DA_RENDA` de toda a renda
 * de núcleos do jogo, e o resto sobra para a fusão e a Central de Serviços.
 * Assim o preço volta a ser escolha: dá para ter o próximo casco OU refinar o
 * que já se tem, não os dois.
 *
 * `NUCLEOS_POR_RECOMPENSA` é medido, não estimado: a renda de núcleos de um setor
 * é exatamente **8,91 ×** `curvaRecompensa` daquele setor, e a razão se manteve
 * idêntica do setor 36 ao 288. Vem de `rewardKill` (0,34 do bounty por fração de
 * abate) e `completeEncounter` (0,8), somados nas seis ondas, com o chefe
 * pesando mais.
 */
export const FRACAO_DA_RENDA = 0.35;
export const NUCLEOS_POR_RECOMPENSA = 8.91;

export interface PostoNaEscada {
  degrau: DegrauDeCasco;
  /** Posição na ordem de aquisição, de 0 a 28. */
  indice: number;
  setor: number;
  /** Preço em núcleos. */
  custo: number;
  escalaDano: number;
  escalaDefesa: number;
}

/**
 * O posto de cada casco na escada.
 *
 * A escala sai de `poderEsperado` e `defesaEsperada` — as MESMAS curvas que a
 * dificuldade usa. É o que garante que uma futura recalibração da dificuldade
 * arraste a escada dos cascos junto, em vez de deixá-la para trás em silêncio.
 */
/** Renda de núcleos entre o casco anterior e este, pela conta do jogo. */
function rendaDaJanela(indice: number): number {
  const fim = setorDaEscada(indice);
  const inicio = indice === 0 ? 1 : setorDaEscada(indice - 1) + 1;
  let total = 0;
  for (let setor = inicio; setor <= fim; setor++) total += curvaRecompensa(setor);
  return total * NUCLEOS_POR_RECOMPENSA;
}

export const POSTO_POR_CASCO: ReadonlyMap<string, PostoNaEscada> = new Map(
  ORDEM_DA_ESCADA.map((id, indice) => {
    const degrau = DEGRAUS_DE_CASCO.find((d) => d.cascos.includes(id))!;
    const setor = setorDaEscada(indice);
    return [id, {
      degrau,
      indice,
      setor,
      custo: Math.round(rendaDaJanela(indice) * FRACAO_DA_RENDA / 10) * 10,
      escalaDano: PISO_DA_ESCADA * Math.pow(poderEsperado(setor) / poderEsperado(SETOR_INICIAL), EXPOENTE_DANO),
      escalaDefesa: PISO_DA_ESCADA * Math.pow(defesaEsperada(setor) / defesaEsperada(SETOR_INICIAL), EXPOENTE_DEFESA),
    }] as const;
  }),
);

/** Aplica a escada às magnitudes, deixando as taxas do arquétipo intactas. */
export function escalarMagnitudes(stats: StatMap, posto: PostoNaEscada): StatMap {
  const out = { ...stats };
  const aplicar = (chaves: readonly (keyof StatMap)[], fator: number) => {
    if (fator === 1) return;
    for (const chave of chaves) {
      const valor = out[chave];
      if (typeof valor === 'number') out[chave] = Math.round(valor * fator * 100) / 100;
    }
  };
  aplicar(MAGNITUDES_OFENSIVAS, posto.escalaDano);
  aplicar(MAGNITUDES_DEFENSIVAS, posto.escalaDefesa);
  return out;
}

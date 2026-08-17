import { CRIT_ELEM_BASE, CRIT_ELEM_DANO_BASE, FRACAO_ELEMENTAL_MAX, confronto } from '@data/balance/elemental';
import { DANO_STAT, ELEMENT_IDS, type ElementId, type Stats } from './types';

/**
 * Dano em COMPONENTES (§3).
 *
 * A restrição que o projeto não negocia: `dano total = normal + Σ elementais`.
 * Antes o tiro carregava um número e um elemento, e o confronto multiplicava o
 * número INTEIRO — ou seja, toda a nave virava elemental assim que equipava uma
 * arma de fogo. Duas consequências ruins:
 *
 * - O dano normal deixava de existir na prática. Quem escolhesse o neutro não
 *   tinha um componente irresistível: tinha um tiro que só nunca ganhava nada.
 * - Escolher o elemento certo valia 1,5 sobre TUDO, então a decisão de arma
 *   ofuscava qualquer outra decisão de build.
 *
 * Com componentes, o normal atravessa resistência e anel intocado — é a parte
 * confiável — e o elemental é a parte que aposta. Investir em potência
 * elemental passa a ser trocar previsibilidade por variância, que é uma escolha
 * de verdade.
 */
export interface DamagePacket {
  /**
   * Componente irresistível. Vai direto no escudo, no casco e na vida: nenhuma
   * resistência o reduz e não existe atributo de "resistência a normal".
   */
  normal: number;
  /** Componentes elementais, por elemento. Só os não-nulos aparecem. */
  elementais: Partial<Record<ElementId, number>>;
}

/** Soma dos componentes — o número que o jogador vê como "dano". */
export function danoTotal(p: DamagePacket): number {
  let total = p.normal;
  for (const id of ELEMENT_IDS) total += p.elementais[id] ?? 0;
  return total;
}

/**
 * Monta o pacote a partir dos atributos resolvidos.
 *
 * `stats.dano` é o componente NORMAL, sempre. Cada potência elemental
 * (`danoFogo`, `danoGelo`, …) acrescenta um componente daquele elemento, no
 * tamanho `dano × potência`.
 *
 * É a leitura literal de "não transformar todo o dano da nave em elemental": a
 * base continua neutra e a potência SOMA por cima, em vez de converter. Uma
 * nave sem nenhum afixo elemental atira 100% normal, e é uma nave viável.
 *
 * `elementoAtivo` (a arma equipada) não aparece na conta: com componentes, uma
 * nave que carregue potência de fogo E de gelo dispara os dois. A arma decide a
 * aparência do tiro e qual potência a ficha destaca, não qual componente existe.
 */
export function montarPacote(stats: Stats, escala = 1): DamagePacket {
  const normal = stats.dano * escala;
  const elementais: Partial<Record<ElementId, number>> = {};

  for (const id of ELEMENT_IDS) {
    // `padrao` tem atributo de potência (`danoPadrao`) e ele é legítimo — é o
    // que dá o que investir a quem escolheu o neutro —, mas o que ele amplifica
    // é o componente NORMAL, não um componente elemental de nome "padrão".
    if (id === 'padrao') continue;
    const potencia = stats[DANO_STAT[id]];
    if (potencia > 0) elementais[id] = normal * potencia;
  }

  const base = normal * (1 + stats[DANO_STAT.padrao]);

  // Teto da fatia elemental (§3, §40). Sem ele, seis potências no tier máximo
  // deixavam a nave 74% elemental e o componente normal virava decoração —
  // exatamente o que "não transformar todo o dano em elemental" proíbe.
  //
  // O excesso é APARADO, não redistribuído: devolvê-lo ao normal faria empilhar
  // potência continuar valendo depois do teto, e o teto não seria teto.
  let soma = 0;
  for (const v of Object.values(elementais)) soma += v ?? 0;
  const limite = (base * FRACAO_ELEMENTAL_MAX) / (1 - FRACAO_ELEMENTAL_MAX);
  if (soma > limite && soma > 0) {
    const fator = limite / soma;
    for (const id of Object.keys(elementais) as ElementId[]) {
      elementais[id] = (elementais[id] ?? 0) * fator;
    }
  }

  return { normal: base, elementais };
}

/** O pacote depois de um golpe crítico — normal e elemental rolam SEPARADO (§4). */
export interface ResultadoCritico {
  critNormal: boolean;
  critElemental: boolean;
}

/**
 * Aplica crítico ao pacote.
 *
 * Duas rolagens independentes. Com uma só, o tiro seria inteiramente crítico ou
 * inteiramente não, e separar os componentes não teria consequência no combate.
 */
export function aplicarCritico(
  p: DamagePacket,
  stats: Stats,
  sorteio: () => number,
): { pacote: DamagePacket; crit: ResultadoCritico } {
  const critNormal = sorteio() < stats.critChance;
  const critElemental = sorteio() < (CRIT_ELEM_BASE + stats.critElemChance);

  const multNormal = critNormal ? 1 + stats.critDano : 1;
  const multElem = critElemental ? 1 + CRIT_ELEM_DANO_BASE + stats.critElemDano : 1;

  const elementais: Partial<Record<ElementId, number>> = {};
  for (const [id, v] of Object.entries(p.elementais)) {
    elementais[id as ElementId] = v * multElem;
  }

  return {
    pacote: { normal: p.normal * multNormal, elementais },
    crit: { critNormal, critElemental },
  };
}

/** Como um pacote foi mitigado, para o número que aparece na tela. */
export interface ResolucaoDeDano {
  total: number;
  /** Maior multiplicador elemental aplicado — decide a cor e o tamanho do popup. */
  melhorMult: number;
  /** Elemento que mais contribuiu, para colorir o número. */
  dominante: ElementId;
}

/**
 * Resolve o pacote contra uma defesa: anel, resistência e penetração.
 *
 * `resistenciaDe` devolve 0..1 para cada elemento — é o que difere o jogador
 * (que tem atributos de resistência) do inimigo (que só tem o anel).
 */
export function resolverDano(
  p: DamagePacket,
  defesa: ElementId,
  penetracao: number,
  resistenciaDe: (e: ElementId) => number = () => 0,
): ResolucaoDeDano {
  // O normal entra inteiro. Esta linha é a regra do §3 escrita uma vez só.
  let total = p.normal;
  let melhorMult = 1;
  let dominante: ElementId = 'padrao';
  let maior = p.normal;

  for (const [id, bruto] of Object.entries(p.elementais)) {
    const e = id as ElementId;
    const anel = confronto(e, defesa, penetracao);
    // Penetração já agiu no anel; contra a resistência ela age de novo, porque
    // são duas mitigações independentes — uma é do confronto, a outra do alvo.
    const res = resistenciaDe(e) * (1 - Math.min(1, penetracao));
    const aplicado = bruto * anel * (1 - res);
    total += aplicado;
    if (anel > melhorMult) melhorMult = anel;
    if (aplicado > maior) { maior = aplicado; dominante = e; }
  }

  return { total, melhorMult, dominante };
}

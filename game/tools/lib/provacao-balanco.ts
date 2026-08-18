import { dps, effectiveHp, resolveStats } from '@sim/stats';
import { sectorIlvl } from '@sim/progression';
import { abrirDesafio, encontroDoDesafio, setorEquivalente } from '@sim/desafio';
import { ESPECIAL_POR_ID } from '@data/provacao-especiais';
import { createState } from '@sim/state';
import { cascoDoSetor, equiparMelhor, slotsDoSetor, tentativasDoSetor } from './balanco';

/**
 * Medição do Núcleo de Provação, em Node.
 *
 * Usa a MESMA régua da campanha — `equiparMelhor`, `dps`, `effectiveHp` — e o
 * mesmo `encontroDoDesafio` que o navegador usa para lutar. Não existe cópia da
 * fórmula, então a medida não pode divergir do jogo real; é a mesma razão pela
 * qual `tools/lib/balanco.ts` existe.
 *
 * O que se quer descobrir, na ordem: o piso 1 é factível? Onde bate a parede? E
 * a luta dura o suficiente para o especial aparecer?
 */

export interface MedidaDePiso {
  piso: number;
  /** Setor da campanha com dificuldade comparável. */
  setorEquiv: number;
  marco: boolean;
  modificadores: string[];
  /** Segundos para derrubar o chefe. */
  segParaMatar: number;
  /** Quantos golpes do chefe o jogador aguenta. */
  golpesAteMorrer: number;
  /** Quantas vezes o especial dispara durante a luta. */
  disparosDoEspecial: number;
  especial: string;
}

/**
 * Mede um piso com um jogador do NÍVEL EQUIVALENTE.
 *
 * O jogador modelado é o que chegou ali jogando: equipamento do nível do setor
 * correspondente, e não um jogador ideal. Medir contra um jogador perfeito
 * responderia "isto é possível?" quando a pergunta é "isto é jogável?".
 */
export function medirPiso(piso: number, repeticoes = 5): MedidaDePiso {
  const setor = setorEquivalente(piso);
  const d = abrirDesafio(piso);
  const enc = encontroDoDesafio(createState(1), d);
  const casco = cascoDoSetor(setor);
  const ilvl = sectorIlvl(setor);
  const slots = slotsDoSetor(setor);
  const tentativas = tentativasDoSetor(setor);

  const amostras = Array.from({ length: repeticoes }, (_, i) => {
    const stats = resolveStats(equiparMelhor(ilvl, casco.id, 7000 + piso + i * 6151, tentativas, slots));
    return { dps: dps(stats), ehp: effectiveHp(stats) };
  });
  const mediana = (v: number[]) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
  const meuDps = mediana(amostras.map((a) => a.dps));
  const meuEhp = mediana(amostras.map((a) => a.ehp));

  // A resistência do chefe reduz o dano que chega. Aproximação deliberada: o
  // simulador não escolhe elemento, então usa a resistência MÉDIA — medir o
  // melhor caso mentiria a favor do jogador.
  const resistencias = Object.values(d.chefe.resistencias);
  const resMedia = resistencias.length ? resistencias.reduce((s, n) => s + n, 0) / 5 : 0;
  const dpsEfetivo = meuDps * (1 - Math.min(0.7, resMedia + d.efeitos.resistencia));

  /**
   * A regeneração só conta na FRAÇÃO do tempo em que o jogador não está
   * batendo — ela pausa por 2,5 s a cada dano recebido pelo chefe.
   *
   * Modelar como se ela corresse o tempo todo foi o erro da primeira versão, e
   * ele mostrou o piso 20 pedindo quinze milhões de segundos. Isso não era ruído
   * de medição: era um chefe imortal de verdade, e a correção foi no JOGO. O
   * simulador agora reflete a regra corrigida.
   *
   * 0,15 é a fração de tempo parado que um piloto competente tem — desviando do
   * especial, reposicionando. Estimativa declarada, não medida.
   */
  const FRACAO_PARADO = 0.15;
  const regenPorSeg = enc.hpPool * d.efeitos.regen * FRACAO_PARADO;
  const liquido = Math.max(dpsEfetivo * 0.05, dpsEfetivo - regenPorSeg);
  const segParaMatar = enc.hpPool / liquido;

  const golpes = meuEhp / Math.max(1, enc.damage);

  const esp = ESPECIAL_POR_ID.get(d.chefe.especial)!;
  const disparos = Math.floor(segParaMatar / (esp.carga + esp.aviso));

  return {
    piso,
    setorEquiv: setor,
    marco: piso % 10 === 0,
    modificadores: d.def.modificadores,
    segParaMatar,
    golpesAteMorrer: golpes,
    disparosDoEspecial: disparos,
    especial: esp.nome,
  };
}

/**
 * Faixa saudável de DURAÇÃO da luta.
 *
 * Mais curta que 20 s e o especial nem chega a sair — a mecânica que dá
 * identidade ao chefe viraria decoração. Mais longa que 150 s e vira teste de
 * paciência, não de build.
 */
export const FAIXA_DURACAO = [20, 150] as const;

/**
 * Faixa de LETALIDADE, em golpes até morrer.
 *
 * A mesma que a campanha usa (`FAIXA_GOLPES`, 8 a 30), e não uma inventada: se
 * as duas divergissem, "duro" na Provação significaria outra coisa que "duro"
 * na campanha, e não haveria como comparar.
 *
 * O chefe da Provação fica no PISO da faixa — 6 a 20 —, porque ele é um
 * encontro único e concentrado, não uma onda de vinte naves.
 */
export const FAIXA_GOLPES_PROVACAO = [6, 20] as const;

/** Ao menos um disparo: senão o especial não existe na prática. */
export const DISPAROS_MIN = 1;

/**
 * O diagnóstico usa DUAS FAIXAS INDEPENDENTES, e não uma simulação de
 * sobrevivência.
 *
 * A primeira versão calculava "o jogador vence?" comparando quanto ele aguenta
 * com quanto ele demora — e apontou doze pisos intransponíveis de doze. O erro
 * era meu: aquela conta assume o jogador levando 1,5 golpe por segundo sem
 * parar, o que nunca acontece com o piloto desviando. Pela mesma régua, metade
 * da campanha também seria intransponível.
 *
 * As duas faixas separadas são o que `tools/lib/balanco.ts` já fazia, e por
 * isso são o que se usa aqui.
 */
export function diagnosticoDoPiso(m: MedidaDePiso): string {
  const p: string[] = [];
  if (m.segParaMatar < FAIXA_DURACAO[0]) p.push('curta demais');
  if (m.segParaMatar > FAIXA_DURACAO[1]) p.push('longa demais');
  if (m.golpesAteMorrer < FAIXA_GOLPES_PROVACAO[0]) p.push('LETAL DEMAIS');
  if (m.golpesAteMorrer > FAIXA_GOLPES_PROVACAO[1]) p.push('inofensivo');
  if (m.disparosDoEspecial < DISPAROS_MIN) p.push('especial não sai');
  return p.join(' · ') || 'ok';
}

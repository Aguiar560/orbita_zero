import { cristalDoFimDeCadeia } from '@data/balance/cristal';
import { describeGalaxy } from '@data/galaxies';
import { PERSONAGENS } from '@data/personagens';
import { RECURSOS } from '@data/recursos';
import type { MissaoDef, Objetivo, Recompensa } from '@data/missoes';
import type { SlotId } from '@sim/types';

/**
 * As cadeias de contato, geradas a partir de sementes autorais.
 *
 * ## Por que gerar, e o que exatamente é gerado
 *
 * São 33 contatos × 15 missões. Escrever 495 blocos à mão significa 495
 * oportunidades de errar um número — e o erro que importa aqui é silencioso:
 * uma recompensa fora de escala não quebra teste nenhum, só estraga a curva de
 * quem jogar.
 *
 * Então a divisão é: **a prosa é autoral, a mecânica é derivada.** Cada contato
 * traz quinze pares de nome e descrição escritos à mão — é isso que faz a
 * cadeia ser dele e não de outro. O objetivo, o requisito, a recompensa e a
 * peça final saem da POSIÇÃO na cadeia cruzada com a GALÁXIA do contato.
 *
 * O molde é a cadeia do Kael Voss, escrita inteira à mão antes desta tabela
 * existir. Ela continua no arquivo de missões, sem passar por aqui: é a
 * referência contra a qual o gerado é comparado.
 *
 * ## O que NÃO é gerado
 *
 * A confiança. Ela sai de `balance/confianca.ts`, derivada da ordem dos elos —
 * a mesma regra para cadeia escrita à mão e para cadeia gerada.
 */

/** Uma missão da cadeia: só o que é do contato. O resto vem da posição. */
export type Batida = readonly [nome: string, descricao: string];

export interface SementeDeCadeia {
  /** Contato dono da cadeia. */
  contato: string;
  /**
   * Missão a que a cadeia se prende, quando o contato já tem missões escritas
   * à mão. A primeira gerada exige esta; sem ela, a cadeia começa livre.
   */
  depoisDe?: string;
  /** Prefixo dos ids gerados. Curto, estável, sem acento. */
  prefixo: string;
  /** As batidas, na ordem em que se destravam. */
  batidas: readonly Batida[];
  /**
   * Em que ponto da FORMA a semente entra. Padrão: no começo.
   *
   * Existe para as cadeias que já tinham missões escritas à mão. Zyrak tem
   * cinco e Lira Nexus seis; continuar com as formas iniciais faria o contato
   * pedir "abata 120 perto de casa" depois de o jogador já ter cruzado três
   * galáxias com ele. O deslocamento faz a continuação pegar as formas fundas,
   * que é onde a cadeia dele realmente está.
   */
  desdeAForma?: number;
  /** Nome da peça que fecha a cadeia. */
  peca: string;
  /** Slot da peça final — diz o que aquele contato É, não o que ele dá. */
  slot: SlotId;
}

/**
 * O que cada posição da cadeia pede.
 *
 * A forma vem do arco de Kael: começa perto (abater, avançar), passa pela
 * economia da região (coletar, entregar), sobe para o que exige construção
 * (fundir, peça de raridade) e termina em chefes fundos.
 *
 * `setorRel` é a distância em setores a partir do primeiro setor da galáxia do
 * contato — o conteúdo dele acontece na região dele, e continua acontecendo
 * quando o jogador já passou dali.
 */
type Forma =
  | { tipo: 'abate'; base: number; setorRel: number }
  | { tipo: 'setor'; base: number }
  | { tipo: 'coleta'; base: number }
  | { tipo: 'entrega'; base: number }
  | { tipo: 'chefe'; base: number; setorRel: number }
  | { tipo: 'item'; base: number; raridadeMin: number }
  | { tipo: 'elemental'; base: number }
  | { tipo: 'fusao'; base: number }
  | { tipo: 'galaxia' };

const FORMAS: readonly Forma[] = [
  { tipo: 'abate', base: 120, setorRel: 0 },
  { tipo: 'setor', base: 4 },
  { tipo: 'coleta', base: 60 },
  { tipo: 'elemental', base: 90 },
  { tipo: 'chefe', base: 3, setorRel: 0 },
  { tipo: 'item', base: 8, raridadeMin: 1 },
  { tipo: 'entrega', base: 120 },
  { tipo: 'abate', base: 320, setorRel: 5 },
  { tipo: 'fusao', base: 2 },
  { tipo: 'galaxia' },
  { tipo: 'coleta', base: 200 },
  { tipo: 'item', base: 5, raridadeMin: 2 },
  { tipo: 'chefe', base: 8, setorRel: 10 },
  { tipo: 'abate', base: 700, setorRel: 15 },
  { tipo: 'chefe', base: 12, setorRel: 20 },
];

export const MISSOES_POR_CADEIA = FORMAS.length;

/** Primeiro setor de uma galáxia, 1-based. */
const setorInicial = (galaxia: number): number => galaxia * 10 + 1;

/** O material-assinatura da galáxia do contato. */
function minerioDaGalaxia(galaxia: number): string {
  const r = RECURSOS.find((x) => x.escopo === 'galaxia' && x.galaxia === galaxia);
  return r?.id ?? 'ferrita';
}

/**
 * Quanto a recompensa cresce com a profundidade.
 *
 * Cresce com a GALÁXIA, e não com a posição na cadeia: uma missão da galáxia 25
 * acontece contra inimigos da galáxia 25, e pagar como a galáxia 1 faria o
 * conteúdo tardio ser recusado. A posição já governa a confiança, que é a outra
 * metade do prêmio.
 */
const escala = (galaxia: number): number => 1 + galaxia * 0.55;

function objetivo(forma: Forma, galaxia: number, elemento: string): Objetivo {
  const g = escala(galaxia);
  const inicio = setorInicial(galaxia);

  switch (forma.tipo) {
    case 'abate': {
      const setorMin = inicio + forma.setorRel;
      const alvo = Math.round(forma.base * (1 + galaxia * 0.12));
      return {
        fato: 'abate', alvo, filtro: { setorMin },
        texto: `Abater ${alvo} inimigos no setor ${setorMin} ou além`,
      };
    }
    case 'elemental': {
      const alvo = Math.round(forma.base * (1 + galaxia * 0.12));
      return {
        fato: 'abate', alvo, filtro: { elemento: elemento as never, setorMin: inicio },
        texto: `Abater ${alvo} inimigos de ${elemento} no setor ${inicio} ou além`,
      };
    }
    case 'setor':
      return {
        fato: 'setor', alvo: forma.base, filtro: { setorMin: inicio },
        texto: `Concluir ${forma.base} setores a partir do ${inicio}`,
      };
    case 'galaxia':
      return {
        fato: 'galaxia', alvo: 1, filtro: { galaxiaMin: galaxia },
        texto: `Concluir a galáxia ${galaxia + 1}`,
      };
    case 'coleta': {
      const id = minerioDaGalaxia(galaxia);
      const alvo = Math.round(forma.base * g);
      const nome = RECURSOS.find((r) => r.id === id)?.nome ?? id;
      return {
        fato: 'recurso', alvo, filtro: { recurso: id }, somaQuantidade: true,
        texto: `Reunir ${alvo} de ${nome}`,
      };
    }
    case 'entrega': {
      const id = minerioDaGalaxia(galaxia);
      const alvo = Math.round(forma.base * g);
      const nome = RECURSOS.find((r) => r.id === id)?.nome ?? id;
      return {
        fato: 'recurso', alvo, filtro: { recurso: id }, somaQuantidade: true,
        texto: `Entregar ${alvo} de ${nome}`,
      };
    }
    case 'chefe': {
      const setorMin = inicio + forma.setorRel;
      const alvo = forma.base + Math.floor(galaxia / 6);
      return {
        fato: 'chefe', alvo, filtro: { setorMin },
        texto: `Derrotar ${alvo} chefes no setor ${setorMin} ou além`,
      };
    }
    case 'item': {
      const rotulo = ['Comuns', 'Incomuns', 'Raras', 'Épicas', 'Lendárias'][forma.raridadeMin] ?? '';
      return {
        fato: 'item', alvo: forma.base, filtro: { raridadeMin: forma.raridadeMin as never },
        texto: `Recolher ${forma.base} peças ${rotulo} ou melhores`,
      };
    }
    case 'fusao':
      return {
        fato: 'fusao', alvo: forma.base, filtro: { subiu: true },
        texto: `Subir ${forma.base} peças de raridade na Fabricação`,
      };
  }
}

function recompensa(
  forma: Forma, galaxia: number, posicao: number, ultima: boolean, setorDoObjetivo: number,
): Recompensa {
  const g = escala(galaxia);
  const passo = 1 + posicao * 0.18;
  const r: Recompensa = {
    moedas: {
      sucata: Math.round(2_000 * g * passo),
      nucleo: Math.round(300 * g * passo),
    },
    xp: Math.round(500 * g * passo),
  };

  // Medalha em MARCOS, não em toda missão: recebê-la tem de ser evento.
  if (posicao === 4 || posicao === 9 || ultima) r.medalhas = ultima ? 2 : 1;

  /**
   * Cristal SÓ no fim da cadeia, pela curva da moeda paga.
   *
   * Eram três pagamentos por cadeia — 25 × (1 + 0,25 × galáxia), ainda
   * multiplicados pelo tier do contato — e as 33 cadeias somavam ~24 mil
   * cristais. O orçamento da campanha inteira agora é ~700. Ver
   * `balance/cristal.ts`.
   */
  if (ultima) (r.moedas as Record<string, number>).cristal = cristalDoFimDeCadeia(setorDoObjetivo);
  if (posicao === 5 || posicao === 11) r.baus = { prata: 1 };
  if (posicao === 9) r.baus = { ouro: 1 };
  if (ultima) r.baus = { ouro: 2 };

  // A entrega CONSOME o que pede: é o que separa "trazer" de "juntar".
  if (forma.tipo === 'entrega') {
    const id = minerioDaGalaxia(galaxia);
    (r as { materiais?: Record<string, number> }).materiais = { [id]: Math.round(30 * g) };
  }
  return r;
}

/** Expande uma semente nas quinze missões dela. */
export function expandirCadeia(semente: SementeDeCadeia): MissaoDef[] {
  const p = PERSONAGENS.find((x) => x.id === semente.contato);
  const galaxia = p?.galaxia ?? 0;
  const elemento = describeGalaxy(galaxia).element;

  const desloc = semente.desdeAForma ?? 0;

  return semente.batidas.map((batida, i) => {
    const forma = FORMAS[desloc + i] ?? FORMAS[FORMAS.length - 1]!;
    const ultima = i === semente.batidas.length - 1;
    const id = `${semente.prefixo}_${String(i + 1).padStart(2, '0')}`;
    const anterior = i === 0 ? semente.depoisDe : `${semente.prefixo}_${String(i).padStart(2, '0')}`;

    const alvo = objetivo(forma, galaxia, elemento);
    const filtro = (alvo as { filtro?: { setorMin?: number; galaxiaMin?: number } }).filtro;
    // Onde o objetivo acontece — é o que põe o cristal do fim da cadeia na
    // altura certa da curva.
    const setorDoObjetivo = filtro?.setorMin
      ?? (filtro?.galaxiaMin !== undefined ? (filtro.galaxiaMin + 1) * 10 : setorInicial(galaxia));

    const def: MissaoDef = {
      id,
      giverId: semente.contato,
      tipo: ultima ? 'especial' : i < 3 ? 'aliado' : 'galaxia',
      galaxiaId: galaxia,
      nome: batida[0],
      descricao: batida[1],
      categoria: forma.tipo === 'entrega' ? 'entrega'
        : forma.tipo === 'coleta' || forma.tipo === 'item' ? 'coleta'
          : forma.tipo === 'setor' || forma.tipo === 'galaxia' || forma.tipo === 'fusao' ? 'progressao'
            : 'eliminacao',
      ritmo: 'campanha',
      objetivos: [alvo],
      recompensa: recompensa(forma, galaxia, desloc + i, ultima, setorDoObjetivo),
      ...(anterior ? { requisitos: [{ tipo: 'missaoConcluida' as const, missaoId: anterior }] } : {}),
      ...(forma.tipo === 'entrega'
        ? { consomeNaEntrega: { [minerioDaGalaxia(galaxia)]: (objetivo(forma, galaxia, elemento) as { alvo: number }).alvo } }
        : {}),
      ...(ultima
        ? {
          recompensaExclusiva: {
            nome: semente.peca,
            de: p?.nome ?? semente.contato,
            slot: semente.slot,
            // Sem `raridadeMin`: o TIER do contato decide. Ver `balance/contatos.ts`.
          },
        }
        : {}),
    };
    return def;
  });
}

export const expandirTodas = (sementes: readonly SementeDeCadeia[]): MissaoDef[] =>
  sementes.flatMap(expandirCadeia);

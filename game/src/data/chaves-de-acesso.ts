import { BOSSES } from './bosses';
import { describeGalaxy } from './galaxies';
import type { ElementId } from '@sim/types';

/**
 * Chance por inimigo abatido em cada um dos nove setores pré-chefe.
 * A mesma curva se repete em todas as galáxias.
 */
export const CHANCES_DROP_CHAVE_POR_FASE = [
  0.001, 0.0015, 0.002, 0.0025, 0.003, 0.004, 0.0055, 0.0075, 0.01,
] as const;

export function chanceDropChavePorAbate(fase: number): number {
  return CHANCES_DROP_CHAVE_POR_FASE[Math.floor(fase) - 1] ?? 0;
}

export interface ChaveDeAcessoDef {
  id: string;
  galaxia: number;
  bossId: string;
  nome: string;
  elemento: ElementId;
  cor: string;
  arte: string;
  descricao: string;
}

/**
 * Trinta silhuetas autorais, na mesma ordem do atlas galáctico. O elemento
 * ainda orienta a luz, mas forma e material pertencem à identidade do domínio.
 */
const ARTES_DAS_CHAVES = [
  'chave-01-berco-vega.webp', 'chave-02-corte-ferro.webp', 'chave-03-mar-cinzas.webp',
  'chave-04-palio-verde.webp', 'chave-05-fenda-rhodes.webp', 'chave-06-coroa-quebrada.webp',
  'chave-07-longa-noite.webp', 'chave-08-alto-silencio.webp', 'chave-09-veu-ambar.webp',
  'chave-10-ultima-pagina.webp', 'chave-11-forja-fria.webp', 'chave-12-jardim-oxido.webp',
  'chave-13-anel-tetis.webp', 'chave-14-garganta-azul.webp', 'chave-15-espinha-vazio.webp',
  'chave-16-nona-aurora.webp', 'chave-17-campo-lazaro.webp', 'chave-18-trono-oco.webp',
  'chave-19-mare-prata.webp', 'chave-20-fim-linha.webp', 'chave-21-caldeira-asterion.webp',
  'chave-22-cemiterio-khepri.webp', 'chave-23-tear-nyx.webp', 'chave-24-lamina-carbono.webp',
  'chave-25-prisma-eos.webp', 'chave-26-colmeia-icaro.webp', 'chave-27-forja-antares.webp',
  'chave-28-coroa-caelum.webp', 'chave-29-dobra-janus.webp', 'chave-30-umbra-terminal.webp',
] as const;

/** Uma chave por galáxia; a posição acompanha a posição do chefe no catálogo. */
export const CHAVES_DE_ACESSO: readonly ChaveDeAcessoDef[] = BOSSES.map((boss, galaxia) => {
  const info = describeGalaxy(galaxia);
  return {
    id: `chave-galaxia-${galaxia + 1}`,
    galaxia,
    bossId: boss.id,
    nome: `Chave de ${info.name}`,
    elemento: boss.element,
    cor: info.color,
    arte: `chaves/${ARTES_DAS_CHAVES[galaxia] ?? ARTES_DAS_CHAVES[0]}`,
    descricao: `Autoriza uma tentativa contra ${boss.name}, no setor ${(galaxia + 1) * 10}. Só funciona nesta galáxia.`,
  };
});

export const CHAVE_POR_ID = new Map(CHAVES_DE_ACESSO.map((chave) => [chave.id, chave]));
export const chaveDaGalaxia = (galaxia: number): ChaveDeAcessoDef => CHAVES_DE_ACESSO[galaxia % CHAVES_DE_ACESSO.length] ?? CHAVES_DE_ACESSO[0]!;

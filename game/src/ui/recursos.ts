import type { ResourceId } from '@sim/types';

/**
 * Como cada recurso se apresenta.
 *
 * Vive num arquivo próprio, e não dentro do `Shell`, porque a barra superior e
 * o cockpit precisam da mesma tabela — e o `Shell` já importa o cockpit, então
 * importar de volta fecharia um ciclo. É metadado de apresentação, não de
 * regra: `data/` continua sendo só tabela de jogo.
 */
export const RESOURCE_META: Record<ResourceId, { label: string; icon: string; color: string }> = {
  sucata: { label: 'Sucata', icon: 'moeda_0', color: '#ffd98a' },
  nucleo: { label: 'Núcleos', icon: 'moeda_1', color: '#7fe4ff' },
  cristal: { label: 'Cristais', icon: 'moeda_2', color: '#c07dff' },
};

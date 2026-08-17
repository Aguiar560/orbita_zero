/**
 * Materiais — o Armazém, separado do Inventário de Itens (§29).
 *
 * A distinção não é de arrumação, é de NATUREZA. Um equipamento é uma escolha:
 * ocupa um slot, compete com outro, e guardá-lo custa espaço de loot. Um
 * material é um acúmulo: só existe para virar outra coisa no craft, e nunca se
 * "equipa". Misturados, uma corrida boa de mineração comeria o espaço das peças
 * — e a decisão que o inventário apertado (§28) existe para criar seria decidida
 * por sorte de drop de minério.
 *
 * Sucata, núcleo e cristal continuam FORA daqui: são moeda, moram na barra
 * superior e não ocupam espaço. Um recurso que se gasta comprando é diferente
 * de um que se gasta fabricando.
 *
 * ► O catálogo abaixo é pequeno de propósito. O craft é da Fase 5, e o que
 *   precisa existir agora é a FORMA — categoria, raridade, origem — para
 *   cadastrar cinquenta materiais depois ser acrescentar linhas, e não mexer em
 *   armazém, painel ou save.
 */

import type { Rarity } from '@sim/types';

export type CategoriaDeMaterial =
  /** Sai de desmanchar equipamento. A base de todo craft. */
  | 'sucata'
  /** Extraído de planetas e campos — o eixo que a camada de patrulha alimenta. */
  | 'planetario'
  /** Componente montado, de craft intermediário. */
  | 'componente'
  /** Essência elemental, para transmutar o elemento de uma peça. */
  | 'essencia'
  /** Só de chefe. É o gargalo dos craft de fim de jogo. */
  | 'relíquia';

export interface MaterialDef {
  /** Id estável e não-visual. Nunca reaproveitar um id retirado. */
  id: string;
  nome: string;
  categoria: CategoriaDeMaterial;
  /** Raridade, na mesma escala dos itens — decide cor e ordenação. */
  raridade: Rarity;
  /** Sprite do atlas. Vazio cai no ícone genérico da categoria. */
  icone: string;
  /** Frase curta de onde vem, para o painel não exigir wiki. */
  origem: string;
  /**
   * Quanto cabe numa pilha.
   *
   * O Armazém limita quantos TIPOS distintos se guarda (§28), não a quantidade
   * de cada um: a decisão interessante é "que materiais eu acompanho", não
   * "quantos cabem". O teto por pilha existe só para o número não virar
   * notação científica na tela.
   */
  pilhaMax: number;
}

export const MATERIAIS: readonly MaterialDef[] = [
  { id: 'liga_bruta', nome: 'Liga Bruta', categoria: 'sucata', raridade: 0, icone: '', origem: 'Desmanchar qualquer equipamento.', pilhaMax: 99_999 },
  { id: 'placa_composta', nome: 'Placa Composta', categoria: 'sucata', raridade: 2, icone: '', origem: 'Desmanchar equipamento Raro ou acima.', pilhaMax: 99_999 },
  { id: 'poeira_estelar', nome: 'Poeira Estelar', categoria: 'planetario', raridade: 1, icone: '', origem: 'Patrulha em campos de asteroide.', pilhaMax: 99_999 },
  { id: 'nucleo_frio', nome: 'Núcleo Frio', categoria: 'planetario', raridade: 3, icone: '', origem: 'Patrulha em biomas glaciais.', pilhaMax: 9_999 },
  { id: 'circuito_selado', nome: 'Circuito Selado', categoria: 'componente', raridade: 2, icone: '', origem: 'Fabricado a partir de Liga Bruta.', pilhaMax: 9_999 },
  { id: 'essencia_fogo', nome: 'Essência de Fogo', categoria: 'essencia', raridade: 3, icone: '', origem: 'Abater inimigos de fogo.', pilhaMax: 9_999 },
  { id: 'essencia_gelo', nome: 'Essência de Gelo', categoria: 'essencia', raridade: 3, icone: '', origem: 'Abater inimigos de gelo.', pilhaMax: 9_999 },
  { id: 'essencia_raio', nome: 'Essência de Raio', categoria: 'essencia', raridade: 3, icone: '', origem: 'Abater inimigos de raio.', pilhaMax: 9_999 },
  { id: 'essencia_quimica', nome: 'Essência Química', categoria: 'essencia', raridade: 3, icone: '', origem: 'Abater inimigos químicos.', pilhaMax: 9_999 },
  { id: 'essencia_cosmica', nome: 'Essência Cósmica', categoria: 'essencia', raridade: 3, icone: '', origem: 'Abater inimigos cósmicos.', pilhaMax: 9_999 },
  { id: 'fragmento_de_chefe', nome: 'Fragmento de Chefe', categoria: 'relíquia', raridade: 5, icone: '', origem: 'Derrotar um chefe de galáxia.', pilhaMax: 999 },
];

export const MATERIAL_POR_ID = new Map(MATERIAIS.map((m) => [m.id, m]));

/** Rótulo de cada categoria, para agrupar o painel. */
export const CATEGORIA_LABEL: Record<CategoriaDeMaterial, string> = {
  sucata: 'Sucata e ligas',
  planetario: 'Recursos planetários',
  componente: 'Componentes',
  essencia: 'Essências elementais',
  'relíquia': 'Relíquias',
};

/** Ordem em que as categorias aparecem — do mais comum ao mais raro. */
export const CATEGORIAS_ORDENADAS: readonly CategoriaDeMaterial[] = [
  'sucata', 'planetario', 'componente', 'essencia', 'relíquia',
];

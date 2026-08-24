import type { Item } from '@sim/types';

export type OperacaoDeModulacaoId =
  | 'remoldar'
  | 'ancorar'
  | 'lapidar'
  | 'dissolver'
  | 'imprimir_prefixo'
  | 'ascender'
  | 'imprimir_sufixo'
  | 'transpor'
  | 'eco_temporal'
  | 'primordial';

export interface OperacaoDeModulacao {
  id: OperacaoDeModulacaoId;
  nome: string;
  verbo: string;
  essencia: string;
  descricao: string;
  preserva: string;
  exigeLinha: boolean;
  custoEssencia: number;
  custoNucleos: number;
}

/**
 * Uma operação por essência da Provação.
 *
 * A ordem é também a ordem de aprendizagem: cada faixa da Provação abre uma
 * ferramenta mais específica. O custo-base da essência fica na receita; o
 * escalonamento por raridade mora em `custoDeModulacao`, num único lugar.
 */
export const OPERACOES_DE_MODULACAO: readonly OperacaoDeModulacao[] = [
  {
    id: 'remoldar', nome: 'Remoldar linha', verbo: 'REMOLDAR', essencia: 'po_lunar',
    descricao: 'Substitui a linha por outra naturalmente possível do mesmo tipo e tier.',
    preserva: 'Base, raridade, elemento, prefixo/sufixo e tier.', exigeLinha: true,
    custoEssencia: 3, custoNucleos: 300,
  },
  {
    id: 'ancorar', nome: 'Ancorar propriedade', verbo: 'ANCORAR', essencia: 'rolha_de_asteroide',
    descricao: 'Protege ou libera uma linha. Linhas ancoradas não podem ser alteradas por outras operações.',
    preserva: 'Toda a propriedade selecionada.', exigeLinha: true,
    custoEssencia: 4, custoNucleos: 450,
  },
  {
    id: 'lapidar', nome: 'Lapidar valor', verbo: 'LAPIDAR', essencia: 'areia_estelar',
    descricao: 'Rerrola apenas o valor da linha, mantendo identidade e tier.',
    preserva: 'Propriedade, tipo e tier.', exigeLinha: true,
    custoEssencia: 4, custoNucleos: 550,
  },
  {
    id: 'dissolver', nome: 'Dissolver linha', verbo: 'DISSOLVER', essencia: 'cinzas_cosmicas',
    descricao: 'Remove a linha selecionada e abre espaço para uma nova impressão.',
    preserva: 'Todas as demais linhas.', exigeLinha: true,
    custoEssencia: 5, custoNucleos: 700,
  },
  {
    id: 'imprimir_prefixo', nome: 'Imprimir prefixo', verbo: 'IMPRIMIR', essencia: 'crista_meteorica',
    descricao: 'Adiciona uma propriedade ofensiva compatível em um espaço vazio.',
    preserva: 'Todas as linhas existentes.', exigeLinha: false,
    custoEssencia: 6, custoNucleos: 1_100,
  },
  {
    id: 'ascender', nome: 'Ascender tier', verbo: 'ASCENDER', essencia: 'sangue_de_estrela',
    descricao: 'Eleva a linha em um tier e rerrola seu valor dentro da nova faixa.',
    preserva: 'Identidade e tipo da propriedade.', exigeLinha: true,
    custoEssencia: 8, custoNucleos: 1_350,
  },
  {
    id: 'imprimir_sufixo', nome: 'Imprimir sufixo', verbo: 'IMPRIMIR', essencia: 'lagrima_galactica',
    descricao: 'Adiciona uma propriedade defensiva ou utilitária compatível em um espaço vazio.',
    preserva: 'Todas as linhas existentes.', exigeLinha: false,
    custoEssencia: 6, custoNucleos: 1_100,
  },
  {
    id: 'transpor', nome: 'Transpor polaridade', verbo: 'TRANSPOR', essencia: 'atomo_raro',
    descricao: 'Converte prefixo em sufixo, ou sufixo em prefixo, mantendo o tier.',
    preserva: 'Tier, base, raridade e elemento.', exigeLinha: true,
    custoEssencia: 10, custoNucleos: 1_750,
  },
  {
    id: 'eco_temporal', nome: 'Eco temporal', verbo: 'REVERTER', essencia: 'fragmento_temporal',
    descricao: 'Troca o estado atual pelo estado anterior à última modulação.',
    preserva: 'Permite alternar entre os dois últimos estados.', exigeLinha: false,
    custoEssencia: 8, custoNucleos: 2_100,
  },
  {
    id: 'primordial', nome: 'Aperfeiçoar', verbo: 'APERFEIÇOAR', essencia: 'essencia_primordial',
    descricao: 'Rerrola todas as linhas livres com qualidade mínima de 75%, sem mudar a estrutura do item.',
    preserva: 'Identidades, tiers e linhas ancoradas.', exigeLinha: false,
    custoEssencia: 6, custoNucleos: 4_000,
  },
];

export const OPERACAO_DE_MODULACAO_POR_ID = new Map(OPERACOES_DE_MODULACAO.map((o) => [o.id, o]));

export interface CustoDeModulacao {
  nucleos: number;
  essencia: string;
  quantidade: number;
}

export function custoDeModulacao(item: Item, operacao: OperacaoDeModulacao): CustoDeModulacao {
  const raridade = 1 + item.rarity * 0.42;
  const nivel = 1 + Math.max(0, item.ilvl - 1) / 180;
  const nucleos = Math.ceil((operacao.custoNucleos * raridade * nivel) / 50) * 50;
  // As ferramentas finais já são muito raras. Somente as essências das faixas
  // iniciais crescem para 2/3 unidades em itens Épicos/Divinos.
  const escala = operacao.custoEssencia >= 6 || item.rarity < 3 ? 0 : Math.floor(item.rarity / 3);
  return { nucleos, essencia: operacao.essencia, quantidade: operacao.custoEssencia + escala };
}

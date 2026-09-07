import type { ElementId, Item } from '@sim/types';
import { minerioParaItem } from './minerio-elemental';

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
  /**
   * O minerio do ELEMENTO da peca, e quanto dele.
   *
   * `null` quando a peca nao tem elemento com minerio conhecido. A Engenharia
   * trata isso como "esta operacao nao pede minerio" em vez de travar: dado
   * ausente nao pode fechar uma tela inteira.
   */
  minerio: string | null;
  quantidadeDeMinerio: number;
}

/**
 * O TIER da linha pesa no preco.
 *
 * Uma linha T10 e o topo do que aquela propriedade pode ser; uma T1 e o piso.
 * Sem este fator, remoldar a melhor linha de uma peca custava o mesmo que
 * remoldar a pior -- e o jogador que ja chegou ao topo pagava o preco de quem
 * esta comecando.
 *
 * 12% por degrau: a T10 sai 2,08x mais cara que a T1, o suficiente para pesar
 * na decisao sem transformar a ferramenta em proibicao.
 *
 * Operacoes que NAO agem sobre uma linha -- imprimir, eco temporal, aperfeicoar
 * -- nao tem tier a consultar, e usam o do item mais alto: mexer numa peca de
 * linhas T10 e mais caro que numa de T1, que e a mesma ideia aplicada ao item.
 */
const fatorDeTier = (tier: number): number => 1 + Math.max(0, Math.min(10, tier) - 1) * 0.12;

const tierDeReferencia = (item: Item, linha: number): number => {
  const escolhida = item.affixes[linha]?.tier;
  if (typeof escolhida === 'number') return escolhida;
  return item.affixes.reduce((m, a) => Math.max(m, a.tier ?? 1), 1);
};

/**
 * Tres ingredientes: nucleos, essencia e o MINERIO DO ELEMENTO da peca.
 *
 * O minerio e o que fecha o buraco de 27 materiais que caiam sem destino -- ver
 * `minerio-elemental.ts`. Ele nao substitui a essencia: a essencia continua
 * sendo o material raro da Provacao que define QUAL ferramenta, e o minerio e o
 * insumo comum que define QUANTO custa usa-la naquela peca.
 *
 * As tres quantidades crescem com raridade, nivel e tier -- `linha` diz qual
 * linha esta selecionada, e -1 quer dizer "o item inteiro".
 */
export function custoDeModulacao(
  item: Item,
  operacao: OperacaoDeModulacao,
  linha = -1,
): CustoDeModulacao {
  const raridade = 1 + item.rarity * 0.42;
  const nivel = 1 + Math.max(0, item.ilvl - 1) / 180;
  const tier = fatorDeTier(tierDeReferencia(item, linha));

  const nucleos = Math.ceil((operacao.custoNucleos * raridade * nivel * tier) / 50) * 50;

  // As ferramentas finais já são muito raras. Somente as essências das faixas
  // iniciais crescem para 2/3 unidades em itens Épicos/Divinos.
  const escala = operacao.custoEssencia >= 6 || item.rarity < 3 ? 0 : Math.floor(item.rarity / 3);

  /**
   * O minerio e o ingrediente que mais escala, e de proposito.
   *
   * A essencia sobe pouco porque vem da Provacao, que e conteudo de fim de
   * campanha e ja e escasso por natureza. O minerio vem do chao da galaxia: o
   * jogador junta 6 a 12 por setor, e e ele que pode absorver a diferenca entre
   * ajustar uma peca comum T1 e uma divina T10 sem virar proibicao.
   *
   * O peso da operacao entra por `custoEssencia`, que ja e a medida de quao
   * poderosa cada uma das dez e.
   */
  const minerio = minerioParaItem((item.element ?? 'padrao') as ElementId, item.ilvl);
  const quantidadeDeMinerio = Math.max(
    1,
    Math.round(operacao.custoEssencia * 1.5 * raridade * tier),
  );

  return {
    nucleos,
    essencia: operacao.essencia,
    quantidade: operacao.custoEssencia + escala,
    minerio,
    quantidadeDeMinerio: minerio ? quantidadeDeMinerio : 0,
  };
}

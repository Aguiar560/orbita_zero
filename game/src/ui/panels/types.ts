import type { Sim } from '@sim/index';

export interface Panel {
  id: string;
  title: string;
  /** Sprite do atlas usado como ícone da aba. */
  icon: string;
  /** Constrói o conteúdo do painel. Chamado a cada re-render. */
  render(sim: Sim): HTMLElement;
  /** Marcador numérico na aba (itens novos, baús por abrir…). */
  badge?(sim: Sim): number;
  /**
   * Abre como CAMADA por cima da tela, não dentro do trilho.
   *
   * O trilho tem ~350 px, o que basta para uma lista e não basta para um painel
   * de TRABALHO — a Fabricação tem três colunas próprias e ficava espremida. A
   * camada foge da grade do layout inteira, o que também evita a briga de
   * cascata que tentar alargar a coluna provocou.
   */
  overlay?: boolean;
}

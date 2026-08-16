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
}

import { fmt } from '@core/format';
import { HULLS, type Hull } from '@data/hulls';
import { getElement } from '@data/elements';
import { AXES, especialidadeLabel, shipProfile } from '@sim/ships';
import type { Sim } from '@sim/index';
import { h, spriteIcon } from '../dom';
import { nivelExigido } from '@data/balance/curvas';
import type { Panel } from './types';

export class FleetPanel implements Panel {
  id = 'frota';
  title = 'Hangar';
  icon = 'aba/hangar';
  /** Abre em camada: a coluna direita é do inventário. */
  overlay = true;

  badge(sim: Sim): number {
    return HULLS.filter(
      (hull) => !sim.state.fleet.includes(hull.id)
        && sim.state.universe.bestSectorEver >= hull.requiresSector
        && sim.state.command.nivel >= nivelExigido(hull.requiresSector)
        && sim.can('cristal', hull.cost),
    ).length;
  }

  render(sim: Sim): HTMLElement {
    return h('.panel-body', {},
      h('p.muted.hint', {
        text: 'Cada casco tem um perfil próprio: a nota resume a ficha, as barras mostram onde ele é extremo, '
          + 'e o elemento define o tipo de dano quando não há arma principal equipada.',
      }),
      h('.fleet-grid', {}, ...HULLS.map((hull) => {
        const owned = sim.state.fleet.includes(hull.id);
        const active = sim.state.hull === hull.id;
        const revealed = sim.state.universe.bestSectorEver >= hull.requiresSector;

        if (!revealed && !owned) {
          return h('.fleet-card.locked', {},
            h('.fleet-art', {}, spriteIcon(hull.sprite, 64, 'silhouette')),
            h('strong', { text: '???' }),
            h('span.muted', {
              // Diz QUAL requisito falta, não só que falta algum: um botão
              // cinza sem motivo manda o jogador adivinhar.
              text: sim.state.universe.bestSectorEver < hull.requiresSector
                ? `Alcance o setor ${hull.requiresSector}`
                : `Requer nível ${nivelExigido(hull.requiresSector)} de comando`,
            }),
          );
        }

        return h(`.fleet-card${active ? '.active' : ''}${owned ? '' : '.unowned'}`, {},
          h('.fleet-art', {}, spriteIcon(hull.sprite, 72)),
          h('.fleet-head', {},
            h('strong', { text: hull.name }),
            h('span.tier', { text: `T${hull.tier}` }),
          ),
          shipBadges(hull),
          h('p.muted.tiny', { text: hull.blurb }),
          shipBars(hull),
          owned
            ? active
              ? h('.fleet-action.active', { text: 'EM USO' })
              : h('button.btn', { text: 'Ativar', onclick: () => { sim.selectHull(hull.id); } })
            : h('button.btn.buy', {
                disabled: !sim.can('cristal', hull.cost),
                onclick: () => { sim.buyHull(hull.id); },
              }, h('span', { text: `${fmt(hull.cost)} cristais` })),
        );
      })),
    );
  }
}

/** Nota, patente, especialidade e elemento — a linha de identidade do casco. */
function shipBadges(hull: Hull): HTMLElement {
  const perfil = shipProfile(hull);
  const el = getElement(hull.element);

  return h('.ship-badges', {},
    h('.ship-nota', { title: 'Nota geral, ponderada entre os cinco eixos' },
      h('strong', { text: String(perfil.nota) }),
      h('span.ship-patente', { text: perfil.patente }),
    ),
    h('.ship-tags', {},
      h('span.ship-espec', { text: especialidadeLabel(perfil) }),
      h('span.ship-elem', { style: { color: el.color, borderColor: el.color }, title: el.blurb },
        h('span.elem-sigla', { text: el.sigla, style: { background: el.color } }),
        el.name,
      ),
    ),
  );
}

/**
 * Cinco barras em vez da ficha de atributos.
 *
 * A tabela antiga mostrava seis números crus e nenhuma comparação: 240 de casco
 * só quer dizer alguma coisa ao lado dos outros dezenove cascos. As barras são
 * normalizadas contra a frota inteira, então uma barra cheia significa "o melhor
 * que existe nesse eixo" — que é a pergunta que o jogador está fazendo.
 */
function shipBars(hull: Hull): HTMLElement {
  const perfil = shipProfile(hull);
  return h('.ship-axes', {}, ...AXES.map((axis) => {
    const v = perfil.axes[axis.id];
    const fill = h('.ship-axis-fill');
    fill.style.width = `${v}%`;
    fill.style.background = axis.color;
    return h('.ship-axis', { title: `${axis.name}: ${v}/100` },
      h('span.ship-axis-name', { text: axis.name }),
      h('.ship-axis-bar', {}, fill),
      h('span.ship-axis-val', { text: String(v) }),
    );
  }));
}

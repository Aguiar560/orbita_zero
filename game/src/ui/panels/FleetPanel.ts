import { fmt } from '@core/format';
import { HULLS, type Hull } from '@data/hulls';
import {
  HULL_ARCHETYPES, HULL_TUNINGS, HULL_WEAPONS, SPACESHIPS2_HULL_SPEC_BY_ID,
} from '@data/hulls-spaceships2';
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
  iconUrl = '/assets/ui/menu/hangar.webp';
  /** Abre em camada: a coluna direita é do inventário. */
  overlay = true;

  badge(sim: Sim): number {
    return HULLS.filter(
      (hull) => !hull.prototype
        && !hull.piloto
        && !sim.frotaDisponivel.includes(hull.id)
        && sim.alcanceLiberado >= hull.requiresSector
        && sim.state.command.nivel >= nivelExigido(hull.requiresSector)
        && sim.can('cristal', hull.cost),
    ).length;
  }

  render(sim: Sim): HTMLElement {
    return h('.panel-body', {},
      h('p.muted.hint', {
        text: `${HULLS.length} cascos cadastrados. Cada casco tem um perfil próprio: a nota resume a ficha, as barras mostram onde ele é extremo, `
          + 'e o elemento define o tipo de dano quando não há arma principal equipada.',
      }),
      // Os cascos dos OUTROS três personagens não entram na lista. Eles não
      // são compráveis, então apareceriam como uma fileira permanente de
      // "bloqueado" sem nenhuma forma de desbloquear — a pior espécie de
      // cadeado, o que não tem chave.
      h('.fleet-grid', {}, ...HULLS.filter((hull) => !hull.piloto || sim.frotaDisponivel.includes(hull.id)).map((hull) => {
        const owned = sim.frotaDisponivel.includes(hull.id);
        const active = sim.state.hull === hull.id;
        const revealed = sim.alcanceLiberado >= hull.requiresSector;

        if (!revealed && !owned) {
          return h('.fleet-card.locked', {},
            h('.fleet-art', {}, spriteIcon(hull.sprite, 64, 'silhouette')),
            h('strong', { text: '???' }),
            h('span.muted', {
              // Diz QUAL requisito falta, não só que falta algum: um botão
              // cinza sem motivo manda o jogador adivinhar.
              text: sim.alcanceLiberado < hull.requiresSector
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
          shipBuild(hull),
          h('p.muted.tiny', { text: hull.blurb }),
          shipBars(hull),
          owned
            ? active
              ? h('.fleet-action.active', { text: 'EM USO' })
              : h('button.btn', { text: 'Ativar', onclick: () => { sim.selectHull(hull.id); } })
            : h('button.btn.buy', {
                disabled: !sim.can('cristal', hull.cost),
                onclick: () => { sim.buyHull(hull.id); },
              }, h('span', { text: hull.cost > 0 ? `${fmt(hull.cost)} cristais` : 'Adicionar ao hangar' })),
        );
      })),
    );
  }
}

/** Arquétipo, calibração e arma vêm da ficha autoral, não de inferência visual. */
function shipBuild(hull: Hull): HTMLElement {
  const spec = SPACESHIPS2_HULL_SPEC_BY_ID.get(hull.id);
  if (!spec) return h('.ship-build.core', { text: 'Linha original · configuração histórica' });
  const archetype = HULL_ARCHETYPES.find((entry) => entry.id === spec.archetype)?.name ?? spec.archetype;
  const tuning = HULL_TUNINGS.find((entry) => entry.id === spec.tuning)?.name ?? spec.tuning;
  const weapon = HULL_WEAPONS.find((entry) => entry.id === spec.weapon)?.name ?? spec.weapon;
  return h('.ship-build', { text: `${archetype} · ${tuning} · ${weapon}` });
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

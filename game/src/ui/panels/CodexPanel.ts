import { duration, fmt } from '@core/format';
import { BOSSES, BOSS_INTERVAL } from '@data/bosses';
import { ENEMIES } from '@data/enemies';
import type { Sim } from '@sim/index';
import { h, spriteIcon } from '../dom';
import type { Panel } from './types';

export class CodexPanel implements Panel {
  id = 'codex';
  title = 'Códex';
  icon = 'aba/codex';
  /** Abre em camada: a coluna direita é do inventário. */
  overlay = true;

  render(sim: Sim): HTMLElement {
    const st = sim.state.stats;

    return h('.panel-body', {},
      h('h3.section', { text: 'Registro de campanha' }),
      h('.stat-grid', {},
        row('Tempo de jogo', duration(sim.state.playtime)),
        row('Abates', fmt(st.kills)),
        row('Chefes derrotados', fmt(st.bossKills)),
        row('Cascos perdidos', fmt(st.deaths)),
        row('Itens encontrados', fmt(st.itemsFound)),
        row('Baús abertos', fmt(st.chestsOpened)),
        row('Melhor setor', fmt(sim.alcanceLiberado)),
        row('Distância de patrulha', `${fmt(sim.state.bar.distance)} km`),
        row('Sucata acumulada', fmt(sim.state.lifetime.sucata)),
        row('Núcleos acumulados', fmt(sim.state.lifetime.nucleo)),
      ),

      h('h3.section', { text: `Chefes · a cada ${BOSS_INTERVAL} setores` }),
      h('.codex-grid', {}, ...BOSSES.map((boss, i) => {
        const known = sim.state.codex.includes(boss.id);
        return h(`.codex-card${known ? '' : '.locked'}`, {},
          h('.codex-art', {}, spriteIcon(boss.sprite, 56, known ? '' : 'silhouette')),
          h('strong', { text: known ? boss.name : '???' }),
          h('span.muted.tiny', { text: known ? boss.title : `Setor ${(i + 1) * BOSS_INTERVAL}` }),
          known ? h('span.tiny', { text: `${boss.phases.length} fases` }) : null,
        );
      })),

      h('h3.section', { text: 'Bestiário' }),
      h('.bestiary', {}, ...ENEMIES.map((def) => {
        const seen = sim.alcanceLiberado >= def.sectors[0];
        return h(`.bestiary-row${seen ? '' : '.locked'}`, {},
          spriteIcon(def.sprite, 30, seen ? '' : 'silhouette'),
          h('.bestiary-main', {},
            h('strong', { text: seen ? def.name : '???' }),
            h('span.muted.tiny', { text: seen ? `${MOVE_LABEL[def.move]} · ${ATTACK_LABEL[def.attack]}` : `Aparece no setor ${def.sectors[0]}` }),
          ),
          def.elite ? h('span.tag.elite', { text: 'ELITE' }) : null,
        );
      })),
    );
  }
}

const MOVE_LABEL: Record<string, string> = {
  mergulho: 'Mergulha',
  senoide: 'Zigue-zague',
  pairar: 'Paira e estrafeia',
  deriva: 'À deriva',
  investida: 'Investe',
  orbita: 'Orbita',
};

const ATTACK_LABEL: Record<string, string> = {
  nenhum: 'não atira',
  direto: 'tiro reto',
  mirado: 'tiro mirado',
  leque: 'leque',
  espiral: 'espiral',
  teleguiado: 'teleguiado',
  explosivo: 'detona por proximidade',
};

function row(label: string, value: string): HTMLElement {
  return h('.stat', {}, h('span.muted', { text: label }), h('strong', { text: value }));
}

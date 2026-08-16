import { assets } from '@render/Assets';
import { fmt } from '@core/format';
import { clamp } from '@core/math';
import { describeGalaxy, galaxyOfSector, galaxyPhases, phaseOfSector, PHASES_PER_GALAXY } from '@data/galaxies';
import { counterOf, getElement } from '@data/elements';
import { sectorBounty, sectorHp } from '@sim/progression';
import type { Sim } from '@sim/index';
import { h, spriteIcon, progressBar } from '../dom';
import type { Panel } from './types';

/**
 * Mapa de mundo.
 *
 * Cada galáxia é uma janela de dez fases sobre a progressão de setores que já
 * existia — não há estado novo salvo, só uma forma de LER e NAVEGAR `run.sector`.
 * O jogador pode voltar a qualquer fase já vencida (farmar itens de um chefe
 * específico, por exemplo) e vê a próxima galáxia como um destino concreto em
 * vez de um número que sobe.
 */
export class GalaxyPanel implements Panel {
  id = 'galaxia';
  title = 'Galáxia';
  icon = 'aba/galaxia';

  /** Galáxia sendo olhada; pode diferir daquela em que a frota está. */
  private viewing = -1;
  /** Última galáxia da frota, para acompanhar a viagem sem prender o jogador. */
  private followed = -1;
  private portraitsReady = false;

  badge(sim: Sim): number {
    // Sinaliza quando há uma galáxia nova liberada e ainda não visitada.
    const reached = galaxyOfSector(sim.state.universe.bestSectorEver);
    const current = galaxyOfSector(sim.state.run.sector);
    return reached > current ? 1 : 0;
  }

  render(sim: Sim): HTMLElement {
    if (!this.portraitsReady) {
      // Atlas preguiçoso: só este painel usa os retratos.
      void assets.loadAtlas('retratos').then(() => { this.portraitsReady = true; sim.touch(); });
    }

    // Segue a frota quando ela muda de galáxia, mas não rouba a navegação de
    // volta se o jogador estiver só olhando outra região do mapa.
    const here = galaxyOfSector(sim.state.run.sector);
    if (this.viewing < 0 || here !== this.followed) this.viewing = here;
    this.followed = here;

    const best = sim.state.universe.bestSectorEver;
    const unlockedGalaxies = galaxyOfSector(best);
    const info = describeGalaxy(this.viewing);
    const phases = galaxyPhases(this.viewing);

    const body = h('.panel-body.galaxy-body', {},
      // ── seletor de galáxia ────────────────────────────────────────────────
      h('.galaxy-nav', {},
        h('button.mini', {
          text: '‹',
          disabled: this.viewing <= 0,
          onclick: () => { this.viewing = Math.max(0, this.viewing - 1); sim.touch(); },
        }),
        h('.galaxy-nav-title', {},
          h('span.muted.tiny', { text: `Galáxia ${this.viewing + 1}` }),
          h('strong', { text: info.name, style: { color: info.color } }),
        ),
        h('button.mini', {
          text: '›',
          // Deixa espiar uma galáxia à frente da liberada: saber o que vem
          // adiante é metade da razão para continuar.
          disabled: this.viewing >= unlockedGalaxies + 1,
          onclick: () => { this.viewing = this.viewing + 1; sim.touch(); },
        }),
      ),

      // ── cabeçalho com fundo e comandante ──────────────────────────────────
      h('.galaxy-hero', { style: { backgroundImage: `url(assets/${info.backdrop})`, borderColor: info.color } },
        h('.galaxy-hero-shade'),
        h('.galaxy-hero-body', {},
          this.portraitsReady ? spriteIcon(info.portrait, 62, 'galaxy-face') : h('.galaxy-face-holder'),
          h('.galaxy-hero-text', {},
            h('strong', { text: info.name, style: { color: info.color } }),
            h('span.tiny', { text: `Domínio ${info.fleet}` }),
            h('span.muted.tiny', { text: `Setores ${info.firstSector}–${info.lastSector}` }),
            // Ameaça elemental da região e a resposta a ela: é a informação que
            // faz o jogador trocar de escudo ANTES de viajar, e não depois de
            // morrer duas vezes.
            (() => {
              const ameaca = getElement(info.element);
              const contra = counterOf(info.element);
              return h('span.galaxy-threat', { style: { color: ameaca.color, borderColor: ameaca.color } },
                h('span.elem-sigla', { text: ameaca.sigla, style: { background: ameaca.color } }),
                contra
                  ? `Frota de ${ameaca.name.toLowerCase()} · leve ${getElement(contra).name.toLowerCase()}`
                  : `Frota de ${ameaca.name.toLowerCase()}`,
              );
            })(),
          ),
          spriteIcon(info.sprite, 66, 'galaxy-spiral'),
        ),
      ),

      // ── progresso da galáxia ──────────────────────────────────────────────
      h('.galaxy-progress', {},
        h('span.muted.tiny', { text: `${clamp(best - info.firstSector + 1, 0, PHASES_PER_GALAXY)} / ${PHASES_PER_GALAXY} fases vencidas` }),
        progressBar(clamp((best - info.firstSector + 1) / PHASES_PER_GALAXY, 0, 1), info.color, 5),
      ),

      // ── fases ─────────────────────────────────────────────────────────────
      h('.phase-grid', {}, ...phases.map((p) => {
        const cleared = best > p.sector;
        const reachable = best >= p.sector;
        const active = sim.state.run.sector === p.sector;
        const hp = sectorHp(p.sector);
        const bounty = sectorBounty(p.sector);

        const title = p.isBoss
          ? `${p.bossName}\nSetor ${p.sector} · vida ${fmt(hp)} · recompensa ${fmt(bounty)}`
          : `Fase ${p.phase} · setor ${p.sector}\nvida ${fmt(hp)} · recompensa ${fmt(bounty)}`;

        const cell = h(
          `.phase${active ? '.atual' : ''}${cleared ? '.vencida' : ''}${reachable ? '' : '.travada'}${p.isBoss ? '.chefe' : ''}`,
          { title, style: p.isBoss ? { borderColor: info.color } : {} },
          h('.phase-art', {}, spriteIcon(p.icon, p.isBoss ? 46 : 36, reachable ? '' : 'silhouette')),
          h('span.phase-num', { text: p.isBoss ? 'CHEFE' : String(p.phase) }),
          ...(p.isBoss && reachable ? [h('span.phase-boss', { text: p.bossName ?? '' })] : []),
        );

        if (reachable) {
          cell.addEventListener('click', () => {
            sim.jumpSector(p.sector);
            this.viewing = galaxyOfSector(p.sector);
          });
        }
        return cell;
      })),

      // ── rodapé ────────────────────────────────────────────────────────────
      h('.galaxy-foot', {},
        h('span.muted.tiny', {
          text: this.viewing > unlockedGalaxies
            ? `Bloqueada — vença o setor ${describeGalaxy(this.viewing).firstSector - 1} para abrir.`
            : 'Clique numa fase liberada para viajar até ela.',
        }),
        ...(here !== this.viewing
          ? [h('button.mini', {
              text: `Ir para a frota (fase ${phaseOfSector(sim.state.run.sector)})`,
              onclick: () => { this.viewing = here; sim.touch(); },
            })]
          : []),
      ),
    );

    return body;
  }
}

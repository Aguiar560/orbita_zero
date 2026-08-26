import { assets } from '@render/Assets';
import { iconeDeElemento } from '../elementos';
import { bus } from '@app/Bus';
import { fmt } from '@core/format';
import { clamp } from '@core/math';
import { describeGalaxy, galaxyOfSector, galaxyPhases, phaseOfSector, PHASES_PER_GALAXY } from '@data/galaxies';
import { getElement } from '@data/elements';
import { iconeDeRecurso, recursoDaGalaxia } from '@data/recursos';
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
  iconUrl = '/assets/ui/menu/galaxia.webp';
  /** Abre em camada: a coluna direita é do inventário. */
  overlay = true;

  /** Galáxia sendo olhada; pode diferir daquela em que a frota está. */
  private viewing = -1;
  /** Última galáxia da frota, para acompanhar a viagem sem prender o jogador. */
  private followed = -1;
  private portraitsReady = false;

  badge(sim: Sim): number {
    // Sinaliza quando há uma galáxia nova liberada e ainda não visitada.
    const reached = galaxyOfSector(sim.alcanceLiberado);
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

    const best = sim.alcanceLiberado;
    const unlockedGalaxies = galaxyOfSector(best);
    const info = describeGalaxy(this.viewing);
    const phases = galaxyPhases(this.viewing);
    const recursoLocal = recursoDaGalaxia(this.viewing);

    // ── coluna da esquerda: que região é esta ────────────────────────────
    const coluna_regiao = h('.painel-col.galaxy-regiao', {},
      h('.painel-secao', { text: 'REGIÃO' }),

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
      h('.galaxy-hero', { style: { backgroundImage: `url(assets/${info.backdrop})`, '--gal-cor': info.color } as Partial<CSSStyleDeclaration> },
        h('.galaxy-hero-shade'),
        h('.galaxy-hero-body', {},
          this.portraitsReady ? spriteIcon(info.portrait, 62, 'galaxy-face') : h('.galaxy-face-holder'),
          h('.galaxy-hero-text', {},
            h('strong', { text: info.name, style: { color: info.color } }),
            h('span.tiny', { text: `Domínio ${info.fleet}` }),
            h('span.muted.tiny', { text: info.identity, title: info.hazard }),
            h('span.muted.tiny', { text: `Setores ${info.firstSector}–${info.lastSector}` }),
            // Ameaça elemental da região e a resposta a ela: é a informação que
            // faz o jogador trocar de escudo ANTES de viajar, e não depois de
            // morrer duas vezes.
            (() => {
              const ameaca = getElement(info.element);
              return h('span.galaxy-threat', { style: { color: ameaca.color, borderColor: ameaca.color } },
                iconeDeElemento(ameaca.id, 16),
                // Só a AMEAÇA. O "· leve químico" que vinha atrás entregava a
                // resposta junto com a pergunta: o anel elemental deixava de ser
                // algo que o jogador aprende e virava etiqueta que ele obedece.
                // Quem quiser a conta tem o painel de elemento no trilho.
                `Frota de ${ameaca.name.toLowerCase()}`,
              );
            })(),
            ...(recursoLocal ? [h('.galaxy-resource', { title: recursoLocal.funcao },
              spriteIcon(iconeDeRecurso(recursoLocal), 24),
              h('span', {},
                h('small', { text: 'RECURSO DA GALÁXIA' }),
                h('strong', { text: recursoLocal.nome }),
              ),
            )] : []),
          ),
          spriteIcon(info.sprite, 66, 'galaxy-spiral'),
        ),
      ),
    );

    // ── coluna do meio: as dez fases ─────────────────────────────────────
    const coluna_fases = h('.painel-col.rola.galaxy-fases', {},
      h('.painel-secao', { text: 'SETORES' }),

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
          // O número é o SETOR ABSOLUTO, não a posição dentro da galáxia.
          //
          // Mostrava 1..10 em toda galáxia, então a galáxia 2 tinha uma "fase 1"
          // que era o setor 11 — e o jogador via 1 na tela, 11 na HUD e 11 no
          // placar. Três números para a mesma coisa, e nenhum deles errado
          // sozinho.
          //
          // O chefe também mostra o número. Ele já se distingue por três outras
          // marcas (arte maior, borda na cor da galáxia e o nome embaixo);
          // trocar o número por "CHEFE" custava a única informação que a
          // célula não repete em outro lugar.
          h('span.phase-num', { text: String(p.sector) }),
          ...(p.isBoss && reachable ? [h('span.phase-boss', { text: p.bossName ?? '' })] : []),
        );

        if (reachable) {
          cell.addEventListener('click', () => {
            sim.jumpSector(p.sector);
            this.viewing = galaxyOfSector(p.sector);
            // Escolher a fase FECHA o mapa. Ele é uma camada em tela cheia:
            // ficava aberto por cima do combate que o próprio clique acabou de
            // começar, e o jogador tinha de fechá-lo para ver o que pediu.
            bus.emit('panel:close');
          });
        }
        return cell;
      })),
    );

    // ── coluna da direita: a incursão ────────────────────────────────────
    const coluna_incursao = h('.painel-col.galaxy-incursao', {},
      h('.painel-secao', { text: 'INCURSÃO' }),

      // ── progresso da galáxia ──────────────────────────────────────────────
      h('.galaxy-progress', {},
        h('span.muted.tiny', { text: `${clamp(best - info.firstSector + 1, 0, PHASES_PER_GALAXY)} / ${PHASES_PER_GALAXY} fases vencidas` }),
        progressBar(clamp((best - info.firstSector + 1) / PHASES_PER_GALAXY, 0, 1), info.color, 5),
      ),

      // ── travar a fase ─────────────────────────────────────────────────────
      // Fica aqui, e não só nos ajustes, porque é a mesma decisão que o mapa
      // resolve: onde farmar. O chefe é feito para exigir voltar atrás, e sem
      // esta trava voltar atrás custaria reclicar a fase a cada volta.
      h(`button.mini.trava-setor${sim.state.settings.repetirSetor ? '.ativa' : ''}`, {
        text: sim.state.settings.repetirSetor
          ? `⟲ Repetindo a fase ${phaseOfSector(sim.state.run.sector)}`
          : '→ Avançando de fase ao vencer',
        title: sim.state.settings.repetirSetor
          ? 'A incursão fica nesta fase ao vencê-la. Recompensa, XP e itens continuam iguais, e a fase seguinte continua liberando.'
          : 'Ao vencer a fase, a incursão segue para a próxima. Clique para travar e farmar esta.',
        onclick: () => {
          sim.state.settings.repetirSetor = !sim.state.settings.repetirSetor;
          sim.touch();
        },
      }),

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

    return h('.panel-body.galaxy-body', {},
      h('.painel-corpo', {}, coluna_regiao, coluna_fases, coluna_incursao),
    );
  }
}

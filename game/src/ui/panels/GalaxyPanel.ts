import { assets } from '@render/Assets';
import { bus } from '@app/Bus';
import { buscarPlacar, type EstadoDaBusca } from '@app/placar';
import { fmt } from '@core/format';
import { clamp } from '@core/math';
import { describeGalaxy, galaxyOfSector, galaxyPhases, PHASES_PER_GALAXY } from '@data/galaxies';
import { getElement } from '@data/elements';
import { HULLS } from '@data/hulls';
import { retratoInimigoDaGalaxia } from '@data/personagens';
import { iconeDeRecurso, recursoDaGalaxia } from '@data/recursos';
import { buildEncounter, sectorBounty, sectorDamage, WAVES_PER_SECTOR } from '@sim/progression';
import type { Sim } from '@sim/index';
import { h, progressBar, spriteIcon } from '../dom';
import { iconeDeElemento } from '../elementos';
import type { Panel } from './types';

const RANK_PORTRAITS = ['retrato/11_1', 'retrato/11_0', 'retrato/14_5', 'retrato/5_0', 'retrato/5_5'] as const;

/** Ícone raster da central de comando, separado dos sprites de gameplay. */
function galaxyIcon(name: string, extraClass = ''): HTMLElement {
  return h('i.galaxy-command-ui-icon', {
    class: extraClass,
    style: { backgroundImage: `url('/assets/ui/galaxy/${name}.png')` },
    'aria-hidden': 'true',
  });
}

/** Mapa de mundo em formato de central de comando. */
export class GalaxyPanel implements Panel {
  id = 'galaxia';
  title = 'Galáxia';
  icon = 'aba/galaxia';
  iconUrl = '/assets/ui/menu/galaxia.webp';
  overlay = true;

  private viewing = -1;
  private followed = -1;
  /** Setor que alimenta a ficha grande no centro da tela. */
  private selectedSector = -1;
  private portraitsReady = false;

  badge(sim: Sim): number {
    return galaxyOfSector(sim.alcanceLiberado) > galaxyOfSector(sim.state.run.sector) ? 1 : 0;
  }

  render(sim: Sim): HTMLElement {
    if (!this.portraitsReady) {
      void Promise.all([assets.loadAtlas('retratos'), assets.loadAtlas('characters')])
        .then(() => { this.portraitsReady = true; sim.touch(); });
    }

    const here = galaxyOfSector(sim.state.run.sector);
    if (this.viewing < 0 || here !== this.followed) this.viewing = here;
    this.followed = here;

    const best = sim.alcanceLiberado;
    const unlockedGalaxies = galaxyOfSector(best);
    const info = describeGalaxy(this.viewing);
    const phases = galaxyPhases(this.viewing);
    const recursoLocal = recursoDaGalaxia(this.viewing);
    const defaultSector = this.viewing === here
      ? sim.state.run.sector
      : phases.find((phase) => best >= phase.sector)?.sector ?? info.firstSector;
    if (!phases.some((phase) => phase.sector === this.selectedSector)) this.selectedSector = defaultSector;

    const selected = phases.find((phase) => phase.sector === this.selectedSector) ?? phases[0]!;
    const selecionavel = best >= selected.sector;
    const preview = buildEncounter(sim.state, selected.sector, 1);
    const setorAtual = sim.state.run.sector === selected.sector;
    const setoresVencidos = clamp(best - info.firstSector + 1, 0, PHASES_PER_GALAXY);
    const ameaca = getElement(info.element);
    const cascoDaRegiao = HULLS
      .filter((casco) => !casco.prototype && !casco.piloto)
      .filter((casco) => casco.requiresSector >= info.firstSector && casco.requiresSector <= info.lastSector)
      .sort((a, b) => a.requiresSector - b.requiresSector)[0]
      ?? HULLS
        .filter((casco) => !casco.prototype && !casco.piloto && casco.requiresSector >= info.firstSector)
        .sort((a, b) => a.requiresSector - b.requiresSector)[0];

    const olhar = (galaxy: number): void => {
      this.viewing = galaxy;
      const next = galaxyPhases(galaxy);
      this.selectedSector = galaxy === here
        ? sim.state.run.sector
        : next.find((phase) => best >= phase.sector)?.sector ?? next[0]!.sector;
      sim.touch();
    };
    const selecionarSetor = (): void => {
      if (!selecionavel) return;
      sim.jumpSector(selected.sector);
      this.viewing = galaxyOfSector(selected.sector);
      bus.emit('panel:close');
    };

    const colunaRegiao = h('.galaxy-command-col.galaxy-command-region', {},
      this.sectionTitle('REGIÃO'),
      h('.galaxy-command-nav', {},
        h('button.mini', { text: '‹', disabled: this.viewing <= 0, onclick: () => olhar(this.viewing - 1) }),
        h('.galaxy-command-nav-name', {}, h('span', { text: `Galáxia ${this.viewing + 1}` }), h('strong', { text: info.name, style: { color: info.color } })),
        h('button.mini', { text: '›', disabled: this.viewing >= unlockedGalaxies + 1, onclick: () => olhar(this.viewing + 1) }),
      ),
      h('.galaxy-command-hero', { style: {
        backgroundImage: `url(assets/${info.backdrop})`,
        '--gal-cor': info.color,
        '--galaxy-planet-hue': `${(info.index * 43) % 360}deg`,
        '--galaxy-planet-x': `${48 + (info.index * 17) % 43}%`,
        '--galaxy-planet-y': `${38 + (info.index * 13) % 25}%`,
        '--galaxy-planet-size': `${108 + (info.index * 7) % 34}%`,
      } as Partial<CSSStyleDeclaration> },
        h('.galaxy-command-planet-art', { 'aria-hidden': 'true' }),
        h('.galaxy-command-hero-shade'),
        h('.galaxy-command-hero-body', {},
          this.portraitsReady ? spriteIcon(retratoInimigoDaGalaxia(info.index), 62, 'galaxy-command-face') : h('.galaxy-command-face'),
          h('.galaxy-command-hero-copy', {},
            h('strong', { text: info.name }), h('span', { text: `Domínio ${info.fleet}` }), h('p', { text: info.identity }),
            h('small', { text: `Setores ${info.firstSector} – ${info.lastSector}` }),
            h('.galaxy-command-danger', { style: { color: ameaca.color, borderColor: ameaca.color } as Partial<CSSStyleDeclaration> },
              iconeDeElemento(ameaca.id, 17, 'galaxy-command-danger-icon'),
              `Perigo da região: ${ameaca.name}`,
            ),
          ),
        ),
      ),
      recursoLocal ? h('.galaxy-command-resource', {}, spriteIcon(iconeDeRecurso(recursoLocal), 32), h('span', {}, h('small', { text: 'RECURSO DA GALÁXIA' }), h('strong', { text: recursoLocal.nome }))) : null,
      h('.galaxy-command-region-info', {},
        this.sectionTitle('INFORMAÇÕES DA REGIÃO'),
        ...[
          ['Fação dominante', info.fleet], ['Ambiente', info.hazard], ['Atividade inimiga', 'Em monitoramento'],
          ['Rotas comerciais', 'Instáveis'], ['Chance de eventos', 'Alta'],
        ].map(([label, value], index) => h('.galaxy-command-info-row', {}, galaxyIcon(['region-faction', 'region-environment', 'region-activity', 'region-trade', 'region-event'][index]!, 'galaxy-command-region-icon'), h('span', {}, h('small', { text: label }), h('b', { text: value })))),
      ),
      h('.galaxy-command-tip', {}, galaxyIcon('region-tip', 'galaxy-command-tip-icon'), h('span', {}, h('small', { text: 'DICAS DA REGIÃO' }), h('p', { text: 'Conclua os setores para liberar novas recompensas e ampliar o alcance da frota.' }))),
    );

    const colunaCentral = h('.galaxy-command-center', {},
      h('.galaxy-command-sectors', {},
        this.sectionTitle('SETORES'),
        h('.galaxy-command-grid', {}, ...phases.map((phase) => {
          const reachable = best >= phase.sector;
          const active = selected.sector === phase.sector;
          const cleared = best > phase.sector;
          const bloqueio = `Vença o setor ${phase.sector - 1} para desbloquear`;
          return h(`button.galaxy-command-sector${active ? '.selected' : ''}${cleared ? '.cleared' : ''}${reachable ? '' : '.locked'}${phase.isBoss ? '.boss' : ''}`, {
            disabled: !reachable,
            title: reachable ? `Selecionar setor ${phase.sector}` : bloqueio,
            'aria-label': reachable ? `Selecionar setor ${phase.sector}` : `Setor ${phase.sector} bloqueado. ${bloqueio}`,
            onclick: () => { this.selectedSector = phase.sector; sim.touch(); },
            style: active ? { '--sector-cor': info.color } as Partial<CSSStyleDeclaration> : {},
          }, reachable
            ? spriteIcon(phase.icon, phase.isBoss ? 60 : 54, 'galaxy-command-sector-art')
            : h('img.galaxy-command-lock', {
              src: '/assets/ui/provacao/icons/prv_icone_cadeado.png',
              alt: '',
              'aria-hidden': 'true',
            }), h('span', { text: String(phase.sector) }), phase.isBoss && reachable ? h('small', { text: phase.bossName ?? 'Chefe' }) : null);
        })),
      ),
      h('.galaxy-command-sector-detail', { style: { '--gal-cor': info.color } as Partial<CSSStyleDeclaration> },
        h('img.galaxy-command-sector-scenery', { src: '/assets/ui/galaxy/sector-hero-v1.png', alt: '', 'aria-hidden': 'true' }),
        h('.galaxy-command-detail-shade'),
        h('.galaxy-command-detail-content', {},
          h('.galaxy-command-detail-title', {}, h('strong', { text: selected.isBoss ? selected.bossName ?? `SETOR ${selected.sector}` : `SETOR ${selected.sector}` }), h('span', { text: selected.isBoss ? 'OPERAÇÃO DE CHEFE' : `FASE ${selected.phase} · INCURSÃO` })),
          h('.galaxy-command-detail-body', {},
            h('.galaxy-command-threats', {},
              h('small', { text: 'INIMIGOS PRINCIPAIS' }),
              h('.galaxy-command-enemies', {}, ...(preview.boss ? [h('.galaxy-command-enemy', {}, spriteIcon(preview.boss.sprite, 46), h('span', { text: preview.boss.name }))] : preview.squad.slice(0, 3).map(({ def }) => h('.galaxy-command-enemy', {}, spriteIcon(def.sprite, 46), h('span', { text: def.name }))))),
              h('small', { text: 'TIPOS DE AMEAÇA' }),
              h('.galaxy-command-threat-tags', {}, ...['Aérea', preview.perfil, ameaca.name, selected.isBoss ? 'Chefe' : 'Patrulha'].map((name, index) => {
                const elemental = index === 2;
                return h('.galaxy-command-threat-tag', {
                  dataset: { tone: String(index) },
                },
                elemental
                  ? iconeDeElemento(ameaca.id, 13, 'galaxy-command-threat-icon')
                  : galaxyIcon(['threat-aerial', 'threat-vanguard', '', 'threat-patrol'][index]!, 'galaxy-command-threat-icon'),
                name,
                );
              })),
            ),
            h('.galaxy-command-sector-stats', {},
              h('small', { text: 'DETALHES DO SETOR' }),
              ...[
                ['Nível recomendado', `${Math.max(1, Math.floor(selected.sector / 3))} – ${Math.max(3, Math.ceil(selected.sector / 2) + 2)}`],
                ['Onda máxima', selected.isBoss ? 'Chefe' : String(WAVES_PER_SECTOR)], ['Objetivo', selected.isBoss ? 'Eliminar o comandante' : 'Sobreviva às ondas'],
                ['Poder inimigo', fmt(sectorDamage(selected.sector))], ['Recompensa base', fmt(sectorBounty(selected.sector))],
              ].map(([label, value]) => h('.galaxy-command-stat-row', {}, h('span', { text: label }), h('b', { text: value }))),
            ),
          ),
          h('button.galaxy-command-select', { disabled: !selecionavel, onclick: selecionarSetor, text: selecionavel ? (setorAtual ? 'SETOR ATUAL' : 'SELECIONAR SETOR') : 'SETOR BLOQUEADO' }),
        ),
      ),
      h('.galaxy-command-bottom', {},
        h('.galaxy-command-modifiers', {}, this.sectionTitle('MODIFICADORES DA REGIÃO'),
          ...[['Ondas mais agressivas', `+${Math.max(5, Math.round(selected.phase * 2.5))}% inimigos`], ['Regeneração inimiga', `+${Math.max(2, selected.phase)}% vida dos inimigos`], ['Tempo de recarga reduzido', `-${Math.max(4, selected.phase)}% tempo entre ondas`]].map(([label, value], index) => h('.galaxy-command-modifier', {}, galaxyIcon(['threat-aerial', 'region-activity', 'region-environment'][index]!, 'galaxy-command-modifier-icon'), h('span', {}, h('b', { text: label }), h('small', { text: value })))),
        ),
        h('.galaxy-command-rewards', {}, this.sectionTitle('RECOMPENSAS DA REGIÃO'),
          h('.galaxy-command-reward-list', {},
            h('.galaxy-command-reward', {}, galaxyIcon('reward-xp', 'galaxy-command-reward-icon'), h('span', { text: 'Experiência' }), h('small', { text: `+${Math.max(25, selected.sector * 25)}%` })),
            h('.galaxy-command-reward', {}, spriteIcon(iconeDeRecurso(recursoLocal ?? recursoDaGalaxia(0)!), 34), h('span', { text: recursoLocal?.nome ?? 'Material local' }), h('small', { text: 'Recurso' })),
            h('.galaxy-command-reward', {}, galaxyIcon('reward-core', 'galaxy-command-reward-icon'), h('span', { text: 'Núcleo de setor' }), h('small', { text: 'Raro' })),
          ),
        ),
      ),
    );

    const colunaDireita = h('.galaxy-command-col.galaxy-command-sidebar', {},
      h('.galaxy-command-progress-card', {}, this.sectionTitle('PROGRESSO DA GALÁXIA'), this.progressMetric('Setores concluídos', setoresVencidos, PHASES_PER_GALAXY, info.color), this.progressMetric('Incursões vencidas', setoresVencidos, PHASES_PER_GALAXY, '#27b8f2')),
      h('.galaxy-command-statistics', {}, this.sectionTitle('ESTATÍSTICAS'), ...[['Setor mais alto', String(best)], ['Inimigos destruídos', fmt(sim.state.stats.kills)], ['Chefes derrotados', fmt(sim.state.stats.bossKills)], ['Naves perdidas', fmt(sim.state.stats.deaths)], ['Créditos obtidos', fmt(sim.state.lifetime.sucata)]].map(([label, value]) => h('.galaxy-command-statistics-row', {}, h('span', { text: label }), h('b', { text: value })))),
      h('.galaxy-command-ranking', {},
        this.sectionTitle('PLACAR DA GALÁXIA'),
        ...this.placar(),
        h('button.mini.galaxy-command-ranking-button', {
          text: 'Ver ranking completo',
          onclick: () => bus.emit('panel:open', { id: 'ranking', galaxy: this.viewing }),
        }),
      ),
      h('.galaxy-command-unlocks', {}, this.sectionTitle('DESBLOQUEIOS'),
        cascoDaRegiao
          ? h('.galaxy-command-unlock', {},
            spriteIcon(cascoDaRegiao.sprite, 42, 'galaxy-command-unlock-ship'),
            h('span', {}, h('b', { text: cascoDaRegiao.name }), h('small', { text: `Disponível no Hangar ao alcançar o setor ${cascoDaRegiao.requiresSector}` })),
          )
          : h('p.muted.tiny', { text: 'Nenhum casco novo previsto nesta região.' }),
      ),
    );

    return h('.panel-body.galaxy-body.galaxy-command', {}, colunaRegiao, colunaCentral, colunaDireita);
  }

  /**
   * O topo do placar de galáxia, do SERVIDOR.
   *
   * ## O que estava aqui
   *
   * Cinco nomes escritos no código — Kael'Thas, NovaStrike, Vektor-07 — com a
   * pontuação inventada por fórmula: `(5 - i) * 145000 + melhorSetor * 880`.
   * Ela seguia o progresso do próprio jogador, então os "adversários" subiam
   * junto com ele e ficavam sempre à frente. Era um placar que garantia a
   * derrota de quem o olhasse.
   *
   * A aba "Amigos" também saiu: não existe sistema de amigos, e uma aba que não
   * faz nada ensina a não clicar nas outras.
   *
   * ## Por que reusa a busca do painel de Ranking
   *
   * É o MESMO placar — `galaxia` mede `bestSectorEver`. Duas buscas dariam dois
   * números para a mesma coisa, e o jogador acharia que uma das telas mente.
   */
  private placar(): HTMLElement[] {
    const estado = this.buscaDoPlacar();

    if (estado.fase === 'sem-conta') {
      return [h('p.galaxy-command-rank-vazio', { text: 'Entre na sua conta para ver o placar.' })];
    }
    if (estado.fase !== 'pronto') {
      return [h('p.galaxy-command-rank-vazio', { text: 'Buscando o placar…' })];
    }
    if (!estado.dados.meuApelido) {
      return [h('p.galaxy-command-rank-vazio', { text: 'Escolha seu nome no Ranking para entrar no placar.' })];
    }
    if (!estado.dados.linhas.length) {
      return [h('p.galaxy-command-rank-vazio', { text: 'Ninguém marcou ainda. Você pode ser o primeiro.' })];
    }

    return estado.dados.linhas.slice(0, 5).map((l, i) => h(
      `.galaxy-command-rank-row${l.voce ? '.eu' : ''}`, {},
      h('b', { text: String(l.posicao) }),
      spriteIcon(RANK_PORTRAITS[i % RANK_PORTRAITS.length]!, 18, 'galaxy-command-rank-avatar'),
      // `text:` e nunca marcação: é nome escrito por OUTRO jogador.
      h('span', { text: l.voce ? `${l.apelido} (você)` : l.apelido }),
      h('strong', { text: fmt(l.valor) }),
    ));
  }

  /**
   * A busca, guardada e reeemitida quando envelhece.
   *
   * Mesma validade do painel de Ranking, e pelo mesmo motivo: o painel se
   * redesenha a ~5 Hz, e uma requisição por desenho acabaria com a cota da
   * camada gratuita numa tarde.
   */
  private buscaDoPlacar(): EstadoDaBusca {
    const agora = Date.now();
    if (this.placarBuscado && agora - this.placarEm < 20_000) return this.placarBuscado;
    if (this.placarBuscado?.fase === 'buscando') return this.placarBuscado;

    this.placarBuscado = { fase: 'buscando' };
    this.placarEm = agora;
    void buscarPlacar('galaxia').then((r) => {
      this.placarBuscado = r;
      this.placarEm = Date.now();
      bus.emit('state:changed');
    });
    return this.placarBuscado;
  }

  private placarBuscado: EstadoDaBusca | null = null;
  private placarEm = 0;

  private sectionTitle(text: string): HTMLElement {
    return h('.galaxy-command-section-title', {}, h('i'), h('span', { text }));
  }

  private progressMetric(label: string, value: number, total: number, color: string): HTMLElement {
    return h('.galaxy-command-progress-metric', {}, h('.galaxy-command-progress-label', {}, h('span', { text: label }), h('b', { text: `${value} / ${total}` })), progressBar(value / total, color, 6));
  }
}

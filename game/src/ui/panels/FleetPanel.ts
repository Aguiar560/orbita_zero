import { iconeDeElemento } from '../elementos';
import { autonomiaDoCasco, podeDecolar, recargaDoCasco } from '@sim/combustivel';
import { duration, fmt } from '@core/format';
import { HULLS, type Hull } from '@data/hulls';
import { loreDeCasco } from '@data/hulls-lore';
import {
  HULL_ARCHETYPES, HULL_TUNINGS, HULL_WEAPONS, SPACESHIPS2_HULL_SPEC_BY_ID,
} from '@data/hulls-spaceships2';
import { getElement } from '@data/elements';
import { AXES, especialidadeLabel, shipProfile } from '@sim/ships';
import type { Sim } from '@sim/index';
import { h, progressBar, spriteIcon } from '../dom';
import { nivelExigido } from '@data/balance/curvas';
import { curvaXpNave, NIVEL_MAX } from '@data/balance/curvas';
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

  /**
   * Casco em detalhe. Vazio = o ativo.
   *
   * Mora na instância e não no save: é onde o jogador estava olhando, não uma
   * preferência que mereça sobreviver a dois dias fechado.
   */
  private vendo = '';

  /** Filtro de tier. `-1` = todos. */
  private tier = -1;

  /** Mostrar só o que já está no hangar. */
  private soMinhas = false;

  /**
   * Hangar: LISTA à esquerda, ficha à direita.
   *
   * Era uma grade de cartões de 376x381, um por casco. Medido com 49 deles:
   * 4.413px de rolagem contra 648 de tela — **6,8 telas**. Com os 50+ que o
   * catálogo vai ter, comparar duas naves significaria rolar, memorizar e
   * rolar de volta.
   *
   * A lista compacta cabe muitas naves por tela e a ficha completa fica parada
   * ao lado, no mesmo lugar sempre — trocar de nave troca só o painel direito.
   * É a mesma gramática que a Central de Serviços já usa, e a familiaridade
   * vale mais aqui do que qualquer invenção.
   */
  render(sim: Sim): HTMLElement {
    // Os cascos dos OUTROS três personagens não entram. Não são compráveis,
    // então seriam uma fileira permanente de "bloqueado" sem forma de
    // desbloquear — a pior espécie de cadeado, o que não tem chave.
    const catalogo = HULLS.filter((hull) => !hull.piloto || sim.frotaDisponivel.includes(hull.id));
    const lista = catalogo
      .filter((hull) => this.tier < 0 || hull.tier === this.tier)
      .filter((hull) => !this.soMinhas || sim.frotaDisponivel.includes(hull.id))
      .sort((a, b) => a.tier - b.tier || a.requiresSector - b.requiresSector || a.name.localeCompare(b.name));

    // O casco em foco tem de existir na lista FILTRADA: se o filtro tirou o que
    // estava selecionado, a ficha ao lado mostraria uma nave que a lista não
    // tem, e clicar em nada a traria de volta.
    const foco = lista.find((hull) => hull.id === this.vendo)
      ?? lista.find((hull) => hull.id === sim.state.hull)
      ?? lista[0];

    const tiers = [...new Set(catalogo.map((hull) => hull.tier))].sort((a, b) => a - b);
    const minhas = catalogo.filter((hull) => sim.frotaDisponivel.includes(hull.id)).length;

    return h('.panel-body.hangar', {},
      h('.hangar-topo', {},
        h('.filters', {},
          h(`button.chip${this.tier < 0 ? '.active' : ''}`, {
            text: 'Tudo', onclick: () => { this.tier = -1; sim.touch(); },
          }),
          ...tiers.map((t) => h(`button.chip${this.tier === t ? '.active' : ''}`, {
            text: `T${t}`,
            onclick: () => { this.tier = t; sim.touch(); },
          })),
        ),
        h(`button.mini${this.soMinhas ? '.ativa' : ''}`, {
          text: this.soMinhas ? `Só as minhas · ${minhas}` : `Catálogo · ${catalogo.length}`,
          title: 'O catálogo inteiro mostra também o que ainda não dá para comprar — é como saber o que existe para perseguir.',
          onclick: () => { this.soMinhas = !this.soMinhas; sim.touch(); },
        }),
      ),

      h('.hangar-corpo', {},
        h('.hangar-lista', { role: 'listbox' }, ...(lista.length
          ? lista.map((hull) => this.linha(sim, hull, hull.id === foco?.id))
          : [h('.armazem-vazio', {}, h('strong', { text: 'Nenhuma nave neste filtro.' }))])),

        foco ? this.ficha(sim, foco) : h('.hangar-ficha'),
      ),
    );
  }

  /**
   * Uma linha da lista: o mínimo para escolher, e nada além.
   *
   * Sprite, nome, tier e ESTADO. O estado é o que a grade de cartões não
   * conseguia dar de relance — com 49 cartões era preciso ler cada um para
   * saber qual estava em uso, qual tinha combustível e qual dava para comprar.
   */
  private linha(sim: Sim, hull: Hull, ativo: boolean): HTMLElement {
    const tem = sim.frotaDisponivel.includes(hull.id);
    const emUso = sim.state.hull === hull.id;
    const revelado = sim.alcanceLiberado >= hull.requiresSector;
    const tanque = sim.combustivelDe(hull.id);
    const el = getElement(hull.element);
    const progresso = sim.state.naves[hull.id] ?? { nivel: 1, xp: 0 };

    return h(`button.hangar-linha${ativo ? '.ativa' : ''}${tem ? '' : '.bloqueada'}`, {
      role: 'option',
      'aria-selected': String(ativo),
      onclick: () => { this.vendo = hull.id; sim.touch(); },
    },
      spriteIcon(hull.sprite, 32, tem ? 'hangar-linha-art' : 'hangar-linha-art silhouette'),
      h('.hangar-linha-txt', {},
        h('strong', { text: revelado || tem ? hull.name : `Registro do setor ${hull.requiresSector}` }),
        h('span.tiny', {
          text: `T${hull.tier} · ${el.name} · NV. ${progresso.nivel}`,
          style: { color: el.color } as Partial<CSSStyleDeclaration>,
        }),
      ),
      // Só as naves que o jogador TEM mostram tanque. Numa nave à venda a barra
      // não diz nada: ela sai da loja cheia.
      ...(tem
        ? [h('.hangar-linha-fuel', {}, progressBar(
            tanque,
            tanque < 0.15 ? '#ff5d7a' : tanque < 0.4 ? '#ffb638' : '#6ee49a',
            3,
          ))]
        : [h('span.hangar-linha-preco.tiny', { text: revelado ? `${fmt(hull.cost)}◈` : '—' })]),
      ...(emUso ? [h('i.hangar-pip', { title: 'Em uso' })] : []),
    );
  }

  /** A ficha completa, parada no mesmo lugar enquanto a lista muda ao lado. */
  private ficha(sim: Sim, hull: Hull): HTMLElement {
    const tem = sim.frotaDisponivel.includes(hull.id);
    const emUso = sim.state.hull === hull.id;
    const revelado = sim.alcanceLiberado >= hull.requiresSector;
    const tanque = sim.combustivelDe(hull.id);
    const custo = sim.custoParaEncher(hull.id);
    const progresso = sim.state.naves[hull.id] ?? { nivel: 1, xp: 0 };

    return h('.hangar-ficha', {},
      // A ficha guarda o mesmo SEGREDO que a lista. Ela dizia o nome real de um
      // casco que a lista ao lado mostrava como "Registro do setor 198" — o
      // sigilo da lista ficava sem efeito, bastando clicar ao lado.
      h('.hangar-ficha-topo', {},
        h('.fleet-art', {}, spriteIcon(hull.sprite, 84, revelado || tem ? '' : 'silhouette')),
        h('.hangar-ficha-id', {},
          h('strong', { text: revelado || tem ? hull.name : 'Registro selado' }),
          h('span.tier', { text: `T${hull.tier}` }),
          ...(revelado || tem ? [shipBuild(hull)] : []),
        ),
      ),
      ...(revelado || tem
        ? [shipBadges(hull), h('p.muted.tiny', { text: hull.blurb })]
        : [h('p.muted.tiny', { text: `Os registros deste casco abrem ao alcançar o setor ${hull.requiresSector}.` })]),

      ...(tem ? [shipXp(progresso.nivel, progresso.xp)] : []),

      shipBars(hull),

      ...(tem
        ? [h('.fleet-fuel', {},
            h('span.tiny.muted', { text: `Combustível ${Math.round(tanque * 100)}% · autonomia ${duration(autonomiaDoCasco(hull.id))}` }),
            progressBar(
              tanque,
              tanque < 0.15 ? '#ff5d7a' : tanque < 0.4 ? '#ffb638' : '#6ee49a',
              5,
            ),
            // Reabastecer só aparece com tanque incompleto: um botão que não faz
            // nada é convite a clicar e não entender.
            ...(custo > 0
              ? [h('button.mini.fleet-reabastecer', {
                  disabled: !sim.can('nucleo', custo),
                  title: `Encher agora custa ${fmt(custo)} núcleos. No hangar ela enche sozinha em ${duration(recargaDoCasco(hull.id))}, de graça.`,
                  onclick: () => { sim.reabastecer(hull.id); },
                }, h('span', { text: `Reabastecer · ${fmt(custo)}` }))]
              : []),
          )]
        : []),

      tem
        ? emUso
          ? h('.fleet-action.active', { text: 'EM USO' })
          : h('button.btn', {
              text: 'Ativar',
              disabled: !podeDecolar(sim.state, hull.id),
              title: podeDecolar(sim.state, hull.id) ? undefined : 'Sem combustível para decolar',
              onclick: () => { sim.selectHull(hull.id); },
            })
        : revelado
          ? h('button.btn.buy', {
              disabled: !sim.can('cristal', hull.cost),
              onclick: () => { sim.buyHull(hull.id); },
            }, h('span', { text: hull.cost > 0 ? `${fmt(hull.cost)} cristais` : 'Adicionar ao hangar' }))
          : h('.fleet-action', { text: `Alcance o setor ${hull.requiresSector}` }),

      // A lore vem DEPOIS da ação, no fim da ficha. Ela é o que se lê depois de
      // decidir, não o que decide — quem abriu o Hangar para trocar de nave não
      // deve passar por dois parágrafos até achar o botão. Medido: com ela no
      // meio, o botão ficava abaixo de 6 linhas de prosa.
      //
      // Só para casco revelado: a história de uma nave que o jogador ainda não
      // pode ver é justamente o que o selo do registro guarda.
      ...(revelado || tem ? [this.lore(hull)] : []),
    );
  }

  /**
   * História e curiosidade, no fim da ficha.
   *
   * Duas peças com pesos diferentes: a história é parágrafo corrido, a
   * curiosidade é uma linha destacada. Dar o mesmo tratamento às duas faria a
   * segunda parecer continuação da primeira — e ela existe justamente por ser
   * o fato que sobra, o que o jogador repetiria para alguém.
   */
  private lore(hull: Hull): HTMLElement {
    const texto = loreDeCasco(hull.id);
    if (!texto) return h('.hangar-lore.vazia');
    return h('.hangar-lore', {},
      h('h4.hangar-lore-titulo', { text: 'REGISTRO' }),
      h('p', { text: texto.historia }),
      h('.hangar-curiosidade', {},
        h('span.hangar-curiosidade-selo', { text: 'CURIOSIDADE' }),
        h('span', { text: texto.curiosidade }),
      ),
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
        iconeDeElemento(el.id, 16),
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

/** XP próprio do casco: uma segunda nave progride somente quando é pilotada. */
function shipXp(nivel: number, xp: number): HTMLElement {
  const maximo = nivel >= NIVEL_MAX;
  const alvo = maximo ? 1 : curvaXpNave(nivel);
  const progresso = maximo ? 1 : Math.max(0, Math.min(1, xp / alvo));
  return h('.hangar-xp', {},
    h('.hangar-xp-head', {},
      h('span', { text: 'EXPERIÊNCIA DO CASCO' }),
      h('strong', { text: `NÍVEL ${nivel}` }),
    ),
    progressBar(progresso, '#40d7ff', 7),
    h('small', { text: maximo ? 'NÍVEL MÁXIMO' : `${fmt(xp, 0)} / ${fmt(alvo, 0)} XP` }),
  );
}

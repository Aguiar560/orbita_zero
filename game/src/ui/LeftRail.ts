import { iconeDeElemento } from './elementos';
import { autonomiaDoCasco } from '@sim/combustivel';
import { bus } from '@app/Bus';
import { fmt, duration, pct } from '@core/format';
import { clamp01 } from '@core/math';
import { ELEMENTOS_RESISTIVEIS, counterOf, getElement, matchup } from '@data/elements';
import { dps, effectiveHp } from '@sim/stats';
import { especialidadeLabel, shipProfile } from '@sim/ships';
import type { Sim } from '@sim/index';
import { WAVES_PER_SECTOR } from '@data/balance/curvas';
import { RESOURCE_IDS } from '@sim/types';
import { h, clear, spriteIcon, progressBar } from './dom';
import { RESOURCE_META } from './recursos';

/**
 * Três posturas, sem meio-termo. A quarta (`EQU`) saiu porque não era uma
 * escolha: nunca era a melhor, nunca era a errada, e por isso ficava sempre.
 */
const PILOTS = [
  { id: 'agressivo', label: 'AGR' },
  { id: 'evasivo', label: 'EVA' },
  { id: 'coletor', label: 'COL' },
] as const;

/**
 * Coluna esquerda: o "cockpit".
 *
 * Existe para que o estado que importa a cada segundo — casco, escudo,
 * equipamento, conjuntos, política do piloto — fique sempre visível, sem
 * competir com as abas da direita. Antes essa metade da tela era vazia e o
 * jogador precisava abrir um painel para ver se a nave estava inteira.
 *
 * As barras vivas (casco/escudo) são atualizadas por referência direta aos nós,
 * a 10 Hz; o resto só é reconstruído quando o estado muda de verdade.
 */
export class LeftRail {
  readonly root = h('aside.rail-left');

  private readonly hpFill = h('.bar-fill');
  private readonly shFill = h('.bar-fill');
  private readonly hpText = h('span.tiny');
  private readonly body = h('.rail-body');

  private dirty = true;
  private timer = 0;

  constructor(private readonly sim: Sim) {
    this.hpFill.style.background = '#ff5d7a';
    this.shFill.style.background = '#38a9ff';
    this.root.append(this.body);
    bus.on('state:changed', () => { this.dirty = true; });
    this.build();
  }

  /** Chame todo quadro; reconstrói no máximo a 10 Hz e só quando sujo. */
  update(dt: number): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.1;
      if (this.dirty) {
        this.dirty = false;
        this.build();
      }
    }
    this.live();
  }

  /** Valores que mudam a cada quadro, escritos direto no DOM já montado. */
  private live(): void {
    const v = this.sim.vitals;
    this.hpFill.style.width = `${clamp01(v.hp / Math.max(1, v.hpMax)) * 100}%`;
    this.shFill.style.width = `${clamp01(v.shield / Math.max(1, v.shieldMax)) * 100}%`;
    this.hpText.textContent = `${fmt(v.hp, 0)} / ${fmt(v.hpMax, 0)}`;
  }

  private build(): void {
    const sim = this.sim;
    const stats = sim.stats;
    const hull = sim.hull;

    clear(this.body).append(
      // ── nave ──────────────────────────────────────────────────────────────
      h('.rail-hull', {},
        h('.rail-hull-art', {}, spriteIcon(hull.sprite, 56)),
        h('.rail-hull-info', {},
          h('.rail-hull-name', {},
            h('strong', { text: hull.name }),
            h('span.ship-patente', {
              text: `${shipProfile(hull).patente} ${shipProfile(hull).nota}`,
              title: `${especialidadeLabel(shipProfile(hull))} · nota ${shipProfile(hull).nota}/100`,
            }),
          ),
          h('.rail-bars', {},
            h('.bar', { style: { height: '7px' } }, this.hpFill),
            h('.bar', { style: { height: '5px' } }, this.shFill),
          ),
          this.hpText,
        ),
      ),

      // Equipamento e conjuntos moram na COLUNA DE ANATOMIA, e só lá. Tinham
      // cópia aqui: a grade de dez slots e a lista de conjuntos ativos. Com o
      // equipamento passando a ser por nave, o trilho mostraria sempre o da
      // nave em campo enquanto a anatomia mostra a que se está montando — duas
      // leituras divergentes do mesmo dado, na mesma tela.

      // ── leitura de combate ────────────────────────────────────────────────
      h('.rail-section', { text: 'Combate' }),
      h('.rail-stats', {},
        row('DPS', fmt(dps(stats)), '#ff9a4d'),
        row('Vida efetiva', fmt(effectiveHp(stats)), '#38a9ff'),
        row('Limpar', duration(sim.clearTime), '#7ed957'),
        row('Sobrevive', duration(sim.survivalWindow), sim.isStalled ? '#ff5d7a' : '#9fe8ff'),
        row('Crítico', `${pct(stats.critChance)} / +${pct(stats.critDano, 0)}`, '#ffe08a'),
        row('Sorte', `+${pct(stats.sorte)}`, '#c060ff'),
      ),
      ...(sim.isStalled ? [h('.rail-warn', { text: 'Progresso travado neste encontro.' })] : []),

      // ── carga da incursão ─────────────────────────────────────────────────
      // Precisa estar à vista: perder a carga só é RISCO se o jogador souber o
      // tamanho dela antes de morrer. Escondida, viraria surpresa.
      h('.rail-section', { text: 'Carga da incursão' }),
      this.cargoBoard(),

      // ── elementos ─────────────────────────────────────────────────────────
      h('.rail-section', { text: 'Elementos' }),
      this.elementBoard(),

      // ── piloto / comando manual ──────────────────────────────────────────
      h('.rail-section', { text: 'Piloto' }),
      h('.rail-control', { role: 'group', 'aria-label': 'Modo de pilotagem' },
        h(`button.rail-control-mode${sim.state.settings.controlMode === 'idle' ? '.active' : ''}`, {
          text: 'IDLE', title: 'A IA pilota a nave', 'aria-pressed': String(sim.state.settings.controlMode === 'idle'),
          onclick: () => { sim.state.settings.controlMode = 'idle'; sim.touch(); },
        }),
        h(`button.rail-control-mode.manual${sim.state.settings.controlMode === 'manual' ? '.active' : ''}`, {
          text: 'PILOTAR', title: 'Controlar com WASD ou setas', 'aria-pressed': String(sim.state.settings.controlMode === 'manual'),
          onclick: () => { sim.state.settings.controlMode = 'manual'; sim.touch(); },
        }),
      ),
      h('span.tiny.muted.rail-control-help', { text: sim.state.settings.controlMode === 'manual' ? 'WASD / setas · disparo automático' : 'IA no comando' }),
      h('.rail-pilots', {}, ...PILOTS.map((p) =>
        h(`button.rail-pilot${sim.state.settings.pilot === p.id ? '.active' : ''}`, {
          text: p.label,
          title: p.id,
          onclick: () => { sim.state.settings.pilot = p.id; sim.touch(); },
        }),
      )),
      h('.rail-sync', {},
        h('span.tiny.muted', { text: `Sincronia ${pct(stats.iaSkill)}` }),
        progressBar(stats.iaSkill, '#7fe4ff', 4),
      ),

      // Combustível fica no trilho, e não só no Hangar, porque é a única
      // informação do jogo que expira SOZINHA — o jogador precisa ver a nave
      // secando antes de ela secar, não descobrir depois que já trocou.
      ...(() => {
        const tanque = sim.combustivelDe();
        const restam = tanque * autonomiaDoCasco(sim.state.hull);
        // Vermelho abaixo de 15%: é aproximadamente o ponto em que uma sessão
        // comum não termina antes de o tanque acabar.
        const cor = tanque < 0.15 ? '#ff5d7a' : tanque < 0.4 ? '#ffb638' : '#6ee49a';
        return [h('.rail-sync.rail-fuel', {},
          h('span.tiny.muted', { text: `Combustível ${pct(tanque)} · ${duration(restam)}` }),
          progressBar(tanque, cor, 4),
        )];
      })(),

      // As missões rastreadas moram SOBRE o campo de combate (`.mission-hud`,
      // em `Shell`), e só lá. Tinham cópia aqui também, e duas listas do mesmo
      // conteúdo na mesma tela competem pelo olhar sem acrescentar nada — o
      // trilho é da nave e dos recursos.

      // ── patrulha ──────────────────────────────────────────────────────────
      h('.rail-section', { text: 'Patrulha' }),
      h('.rail-stats', {},
        row('Nível', String(sim.state.bar.patrol), '#9fe8ff'),
        row('Sucata/s', fmt(sim.patrolScrapRate, 1), '#ffd98a'),
      ),
      h('.rail-cache', {},
        h('span.tiny.muted', { text: 'Próxima cápsula' }),
        progressBar(sim.state.bar.cacheProgress, '#ffb638', 4),
      ),
    );
  }

  /**
   * O que a incursão juntou e ainda não é seu.
   *
   * Só vira saldo quando o setor inteiro cai; morrer antes disso perde tudo.
   * Mostrar quanto está em jogo, e quantas ondas faltam para garantir, é o que
   * transforma a punição em decisão — dá para ver que vale a pena arriscar mais
   * uma onda, ou que já passou da hora de fechar o setor.
   */
  private cargoBoard(): HTMLElement {
    const sim = this.sim;
    const carga = sim.state.run.carga;
    const vazia = RESOURCE_IDS.every((id) => carga[id] < 1);
    const faltam = WAVES_PER_SECTOR + 1 - sim.state.run.wave;

    return h('.rail-cargo', {},
      vazia
        ? h('span.muted.tiny', { text: 'Nada em risco no momento.' })
        : h('.cargo-itens', {}, ...RESOURCE_IDS.filter((id) => carga[id] >= 1).map((id) =>
            h('.cargo-item', {},
              spriteIcon(RESOURCE_META[id].icon, 16),
              h('strong.tiny', { text: fmt(carga[id]) }),
            ))),
      h('span.muted.tiny', {
        text: faltam > 0
          ? `Garante ao vencer mais ${faltam} ${faltam === 1 ? 'onda' : 'ondas'}.`
          : 'Última onda — vença para depositar.',
      }),
    );
  }

  /**
   * Painel elemental: o que você atira, o que enfrenta e o que aguenta.
   *
   * A linha do meio é a que importa — ela responde "estou com vantagem aqui?"
   * antes de o jogador precisar comparar duas cores na tela de combate. As seis
   * resistências ficam embaixo em pip, porque são consulta ocasional.
   */
  private elementBoard(): HTMLElement {
    const sim = this.sim;
    const meu = getElement(sim.element);
    const alvo = getElement(sim.threatElement);
    const defesa = getElement(sim.defenseElement);

    const ataque = matchup(sim.element, sim.threatElement);
    const recebido = matchup(sim.threatElement, sim.defenseElement);
    const contra = counterOf(sim.threatElement);

    const chip = (info: ReturnType<typeof getElement>, label: string) =>
      h('.elem-chip', { style: { borderColor: info.color }, title: info.blurb },
        iconeDeElemento(info.id, 22),
        h('.elem-chip-text', {},
          h('span.muted.tiny', { text: label }),
          h('strong.tiny', { text: info.name, style: { color: info.color } }),
        ),
      );

    const veredito = (mul: number, bom: string, ruim: string) =>
      h('strong.tiny', {
        text: mul > 1.01 ? bom : mul < 0.99 ? ruim : 'neutro',
        style: { color: mul > 1.01 ? '#7ed957' : mul < 0.99 ? '#ff8a9a' : '#9fb0c8' },
      });

    return h('.rail-elements', {},
      h('.elem-row', {}, chip(meu, 'seu tiro'), chip(alvo, 'ameaça')),
      h('.rail-row', {},
        h('span.muted.tiny', { text: `Dano ×${ataque.toFixed(2)}` }),
        veredito(ataque, 'vantagem', 'resistido'),
      ),
      h('.rail-row', {},
        h('span.muted.tiny', { text: `Escudo ${defesa.name} ×${recebido.toFixed(2)}` }),
        veredito(recebido, 'você absorve', 'você sofre'),
      ),
      ...(contra && contra !== sim.element
        ? [h('.elem-dica', { style: { color: getElement(contra).color } },
            `Contra ${alvo.name.toLowerCase()}: leve ${getElement(contra).name.toLowerCase()}.`)]
        : []),
      h('.elem-res', {}, ...ELEMENTOS_RESISTIVEIS.map((e) => {
        const v = sim.resistance(e.id);
        return h('.elem-pip', {
          title: `Resistência a ${e.name.toLowerCase()}: ${pct(v)}`,
          style: { borderColor: e.color, opacity: String(0.35 + clamp01(v / 0.75) * 0.65) },
        },
          h('span', { text: e.sigla, style: { color: e.color } }),
          h('span.tiny', { text: pct(v, 0) }),
        );
      })),
    );
  }

}

function row(label: string, value: string, color: string): HTMLElement {
  return h('.rail-row', {},
    h('span.muted.tiny', { text: label }),
    h('strong.tiny', { text: value, style: { color } }),
  );
}

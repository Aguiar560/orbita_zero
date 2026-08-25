import { bus } from '@app/Bus';
import { fmt, duration, pct } from '@core/format';
import { clamp, clamp01 } from '@core/math';
import { ITEM_SETS, SLOTS, SLOT_BY_ID } from '@data/items';
import { rarityInfo } from '@data/rarity';
import { ELEMENTOS_RESISTIVEIS, counterOf, getElement, matchup } from '@data/elements';
import { dps, effectiveHp, setCounts } from '@sim/stats';
import { especialidadeLabel, shipProfile } from '@sim/ships';
import type { Item, SlotId } from '@sim/types';
import type { Sim } from '@sim/index';
import { WAVES_PER_SECTOR } from '@data/balance/curvas';
import { RESOURCE_IDS } from '@sim/types';
import { h, clear, spriteIcon, progressBar } from './dom';
import { RESOURCE_META } from './recursos';
import { buildEquippedCard } from './ItemCard';

const PILOTS = [
  { id: 'agressivo', label: 'AGR' },
  { id: 'equilibrado', label: 'EQU' },
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

  /** Cartão de item do hover. Vive no `body` para não ser cortado pela coluna. */
  private readonly card = h('.item-card-float.hidden');

  constructor(private readonly sim: Sim) {
    this.hpFill.style.background = '#ff5d7a';
    this.shFill.style.background = '#38a9ff';
    this.root.append(this.body);
    document.body.append(this.card);
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
    const counts = setCounts(sim.state);

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

      // ── equipamento ───────────────────────────────────────────────────────
      h('.rail-section', { text: 'Equipamento' }),
      h('.paperdoll', {}, ...SLOTS.map((slot) => this.slotCell(slot.id))),

      // ── conjuntos ─────────────────────────────────────────────────────────
      ...(counts.size
        ? [
            h('.rail-section', { text: 'Conjuntos' }),
            h('.rail-sets', {}, ...ITEM_SETS.filter((s) => (counts.get(s.id) ?? 0) > 0).map((set) => {
              const n = counts.get(set.id) ?? 0;
              const active = set.bonuses.filter((b) => n >= b.pieces).length;
              return h('.rail-set', { style: { color: set.color }, title: set.bonuses.map((b) => `${b.pieces}: ${b.label}`).join('\n') },
                h('strong', { text: set.name }),
                h('span.tiny', { text: `${n}/${set.slots.length} · ${active} bônus` }),
              );
            })),
          ]
        : []),

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
        h('span.elem-sigla', { text: info.sigla, style: { background: info.color } }),
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

  private slotCell(slot: SlotId): HTMLElement {
    const info = SLOT_BY_ID.get(slot)!;
    const item = this.sim.state.equipped[slot];

    if (!item) {
      const cell = h('.doll-cell.empty', { title: `${info.name} — vazio` }, spriteIcon(info.icon, 22, 'dim'));
      cell.addEventListener('click', () => bus.emit('panel:open', { id: 'inventario' }));
      return cell;
    }

    const rarity = rarityInfo(item.rarity);
    const cell = h('.doll-cell', {
      style: { borderColor: rarity.color, boxShadow: `inset 0 0 14px ${rarity.glow}` },
    }, spriteIcon(item.icon, 34));
    if (item.set) cell.append(h('i.doll-set'));

    // Cartão completo no hover, em vez do tooltip nativo: o `title` do navegador
    // demora, não formata e some ao mover o mouse um pixel.
    cell.addEventListener('mouseenter', () => this.showCard(item, cell));
    cell.addEventListener('mouseleave', () => this.card.classList.add('hidden'));
    cell.addEventListener('click', () => bus.emit('panel:open', { id: 'inventario' }));
    return cell;
  }

  /** Posiciona o cartão à direita do slot, preso à janela. */
  private showCard(item: Item, cell: HTMLElement): void {
    this.card.replaceChildren(buildEquippedCard(this.sim, item));
    this.card.classList.remove('hidden');

    const spot = cell.getBoundingClientRect();
    const height = this.card.offsetHeight || 200;
    this.card.style.left = `${spot.right + 10}px`;
    this.card.style.top = `${clamp(spot.top - 12, 8, Math.max(8, window.innerHeight - height - 8))}px`;
  }
}

function row(label: string, value: string, color: string): HTMLElement {
  return h('.rail-row', {},
    h('span.muted.tiny', { text: label }),
    h('strong.tiny', { text: value, style: { color } }),
  );
}

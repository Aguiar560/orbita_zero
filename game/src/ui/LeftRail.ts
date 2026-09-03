import { iconeDeElemento } from './elementos';
import { autonomiaDoCasco } from '@sim/combustivel';
import { bus } from '@app/Bus';
import { fmt, duration, pct } from '@core/format';
import { clamp01 } from '@core/math';
import { ELEMENTOS_RESISTIVEIS, getElement, matchup } from '@data/elements';
import { dps, effectiveHp } from '@sim/stats';
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
    const nivelDaNave = sim.state.naves[sim.state.hull]?.nivel ?? 1;

    clear(this.body).append(
      // ── nave ──────────────────────────────────────────────────────────────
      h('.rail-hull', {},
        h('.rail-hull-art', {}, spriteIcon(hull.sprite, 56)),
        h('.rail-hull-info', {},
          h('.rail-hull-name', {},
            h('strong', { text: hull.name }),
            h('span.ship-patente', {
              text: `NV. ${nivelDaNave}`,
              title: `Nível atual de ${hull.name}`,
            }),
          ),
          h('.rail-bars', {},
            h('.bar.rail-vital.rail-vital-hp', { style: { height: '7px' }, title: 'Integridade do casco' }, this.hpFill),
            h('.bar.rail-vital.rail-vital-shield', { style: { height: '5px' }, title: 'Escudo' }, this.shFill),
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
      h('.rail-module.rail-module-stats', {},
        h('.rail-stats', {},
          row('DPS', fmt(dps(stats)), '#ff9a4d'),
          row('Vida efetiva', fmt(effectiveHp(stats)), '#38a9ff'),
          row('Limpar', duration(sim.clearTime), '#7ed957'),
          row('Sobrevive', duration(sim.survivalWindow), sim.isStalled ? '#ff5d7a' : '#9fe8ff'),
          row('Crítico', `${pct(stats.critChance)} / +${pct(stats.critDano, 0)}`, '#ffe08a'),
          row('Sorte', `+${pct(stats.sorte)}`, '#c060ff'),
        ),
      ),
      // Nao ha aviso de "progresso travado" aqui, e a ausencia e deliberada.
      //
      // As linhas 'Limpar' e 'Sobrevive' logo acima ja dizem tudo em numeros: no
      // setor 40 com um casco inicial sao 2399s contra 1,2s. O jogador le os
      // dois e decide — lutar num setor acima do proprio poder e uma ESCOLHA
      // legitima, e o jogo nao opina sobre ela.
      //
      // `sim.isStalled` continua existindo e ainda pinta 'Sobrevive' de vermelho:
      // isso e marcar um fato, nao dar conselho.

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
      h('.rail-module.rail-module-pilot', {},
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
      ),

      // As missões rastreadas moram SOBRE o campo de combate (`.mission-hud`,
      // em `Shell`), e só lá. Tinham cópia aqui também, e duas listas do mesmo
      // conteúdo na mesma tela competem pelo olhar sem acrescentar nada — o
      // trilho é da nave e dos recursos.

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
      // Um RÓTULO, não um conselho. A linha dizia "Contra químico: leve raio" e
      // entregava a resposta junto com a pergunta — o anel elemental deixava de
      // ser algo que o jogador aprende e virava etiqueta que ele obedece. As duas
      // linhas acima já mostram o multiplicador do tiro e o do escudo; com elas à
      // vista, a conta é dele.
      h('span.muted.tiny.elem-titulo', { text: 'RESISTÊNCIAS' }),
      h('.elem-res', {}, ...ELEMENTOS_RESISTIVEIS.map((e) => {
        const v = sim.resistance(e.id);
        // A intensidade vai no FUNDO e na borda, nunca na opacidade do bloco.
        //
        // Era `opacity: 0.35 + resistência × 0.65`, e a conta se voltava contra o
        // próprio propósito: com 0% de resistência — o começo de jogo inteiro, e
        // exatamente quando saber que se está exposto importa mais — os cinco
        // pips ficavam a 35% e não se liam. Apagar o ícone esconde QUAL elemento
        // é, que é a informação que nunca deveria sumir.
        //
        // Agora o ícone fica sempre nítido e quem cresce é o preenchimento: um
        // pip vazio lê como "nenhuma resistência", não como "não olhe para mim".
        const forca = clamp01(v / 0.75);
        return h(`.elem-pip${v > 0 ? '.tem' : ''}`, {
          title: `Resistência a ${e.name.toLowerCase()}: ${pct(v)}`,
          style: {
            borderColor: `color-mix(in srgb, ${e.color} ${Math.round(35 + forca * 65)}%, transparent)`,
            background: `color-mix(in srgb, ${e.color} ${Math.round(forca * 22)}%, rgba(255,255,255,.05))`,
          } as Partial<CSSStyleDeclaration>,
        },
          // Ícone e não sigla, como no resto do jogo. Aqui a letra era pior que
          // em qualquer outro lugar: cinco delas lado a lado, em 14px, e o
          // jogador tinha de traduzir cada uma antes de comparar os números.
          iconeDeElemento(e.id, 14),
          // O número é o valor exato; ele acende com a resistência, mas nunca
          // abaixo do que se lê.
          h('span.tiny', {
            text: pct(v, 0),
            style: { color: v > 0 ? e.color : undefined } as Partial<CSSStyleDeclaration>,
          }),
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

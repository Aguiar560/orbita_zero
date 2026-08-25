import { bus } from '@app/Bus';
import { HULL_BY_ID } from '@data/hulls';
import { SLOTS, SLOT_BY_ID } from '@data/items';
import { rarityInfo } from '@data/rarity';
import { equipamentoDe } from '@sim/stats';
import type { Sim } from '@sim/index';
import type { SlotId } from '@sim/types';
import { buildItemCard } from './ItemCard';
import { clear, h, spriteIcon } from './dom';

/**
 * Como os dez slots se distribuem ao redor do chassi.
 *
 * Duas colunas que ladeiam a nave, lidas de cima para baixo, e a ordem é
 * ANATÔMICA: armas na proa, asas e escudo no meio, motor e utilitários na
 * popa. Não é decoração — é o que faz o jogador achar o slot sem ler o rótulo,
 * do mesmo jeito que num boneco de RPG a mão fica onde a mão está.
 *
 * `upgrade` fica por último à direita de propósito: é o único slot sem lugar
 * no corpo da nave, e empurrá-lo para a ponta é mais honesto do que fingir uma
 * posição anatômica para ele.
 */
const ESQUERDA: readonly SlotId[] = ['principal', 'asas', 'reator', 'blindagem', 'suporte'];
const DIREITA: readonly SlotId[] = ['secundaria', 'escudo', 'controle', 'motor', 'upgrade'];

const ART = (nome: string): string => `/assets/ui/anatomia/${nome}.webp`;

/**
 * A coluna de anatomia — o "boneco" da nave.
 *
 * Mora entre o palco e o inventário, e abre e fecha. Não foi para dentro da
 * coluna do inventário porque as duas competiriam: medido, a anatomia ocupa
 * 290px dos 668 disponíveis, e os itens à vista cairiam de 35 para 15. Coluna
 * própria custa largura do palco — que se adapta sozinho, com piso de 480
 * unidades lógicas só atingido com o palco abaixo de 334px.
 *
 * Tem seletor de nave porque o equipamento passou a ser POR CASCO: sem ele não
 * haveria onde montar o conjunto de uma nave que não está em campo.
 */
export class Anatomia {
  readonly root = h('aside.anatomia');

  private readonly corpo = h('.anat-corpo');
  /** Casco em exibição; pode não ser o que está voando. */
  private vendo = '';
  private dirty = true;
  private timer = 0;

  /** Ficha do item sob o cursor. No `body` para não ser cortada pela coluna. */
  private ficha: HTMLElement | null = null;

  private readonly alca = h('button.anat-alca', {
    'aria-label': 'Abrir ou fechar a anatomia',
    onclick: () => this.alternar(),
  });

  constructor(private readonly sim: Sim) {
    this.root.append(this.alca, this.corpo);
    bus.on('state:changed', () => { this.dirty = true; });
    this.build();
  }

  get aberta(): boolean {
    return this.sim.state.settings.anatomiaAberta !== false;
  }

  alternar(): void {
    this.sim.state.settings.anatomiaAberta = !this.aberta;
    // Repinta AGORA, sem esperar o laço. `update` só roda dentro do `draw`, e
    // o `draw` para com a aba oculta — mas o custo real é outro: mesmo com a
    // aba à vista o rebuild é amostrado a cada 0,2s, e um clique de alça
    // ficava até 200ms sem resposta visível. Clique é entrada direta; quem
    // espera o relógio é a atualização por mudança de estado.
    this.dirty = false;
    this.build();
    this.sim.touch();
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.2;
    if (!this.dirty) return;
    this.dirty = false;
    this.build();
  }

  private build(): void {
    const sim = this.sim;
    this.root.classList.toggle('fechada', !this.aberta);
    this.alca.textContent = this.aberta ? '›' : '‹';
    this.alca.title = this.aberta ? 'Fechar a anatomia' : 'Abrir a anatomia';
    if (!this.aberta) return;
    // Segue a nave em campo enquanto o jogador não escolher outra: abrir a
    // coluna e ver o conjunto de uma nave guardada seria desorientador.
    if (!this.vendo || !sim.state.fleet.includes(this.vendo)) this.vendo = sim.state.hull;

    const casco = HULL_BY_ID.get(this.vendo);
    if (!casco) return;
    const emCampo = this.vendo === sim.state.hull;

    clear(this.corpo).append(
      h('.painel-secao', { text: 'ANATOMIA' }),
      this.seletor(),
      h(`.anat-quadro${emCampo ? '.em-campo' : ''}`, {},
        h('.anat-coluna', {}, ...ESQUERDA.map((s) => this.soquete(s, 'esq'))),
        h('.anat-chassi', {},
          h('img.anat-chassi-art', { src: ART('chassi'), alt: '', 'aria-hidden': true, draggable: false }),
          spriteIcon(casco.sprite, 54, 'anat-nave'),
        ),
        h('.anat-coluna', {}, ...DIREITA.map((s) => this.soquete(s, 'dir'))),
      ),
      emCampo
        ? h('span.anat-nota.tiny', { text: 'Nave em campo' })
        : h('button.mini.anat-ir', {
            text: 'Levar esta nave a campo',
            onclick: () => { sim.trocarCasco?.(this.vendo); sim.touch(); },
          }),
    );
  }

  /** Escolhe qual nave montar. Só as que o jogador tem. */
  private seletor(): HTMLElement {
    const sim = this.sim;
    const frota = sim.state.fleet
      .map((id) => HULL_BY_ID.get(id))
      .filter((h): h is NonNullable<typeof h> => !!h)
      .sort((a, b) => a.requiresSector - b.requiresSector || a.name.localeCompare(b.name));

    const sel = h('select.anat-seletor', {
      'aria-label': 'Nave a equipar',
      onchange: (e: Event) => {
        this.vendo = (e.target as HTMLSelectElement).value;
        this.dirty = true;
        this.build();
      },
    }, ...frota.map((casco) => {
      const nave = sim.state.naves[casco.id];
      const n = nave ? Object.keys(nave.equipped ?? {}).length : 0;
      const o = h('option', { value: casco.id, text: `${casco.name} · ${n}/${SLOTS.length}` }) as HTMLOptionElement;
      if (casco.id === this.vendo) o.selected = true;
      return o;
    }));
    return sel;
  }

  private soquete(slot: SlotId, lado: 'esq' | 'dir'): HTMLElement {
    const sim = this.sim;
    const nave = sim.state.naves[this.vendo];
    const item = nave?.equipped?.[slot];
    const def = SLOT_BY_ID.get(slot)!;

    const cel = h(`.anat-soquete.${lado}${item ? '.cheio' : ''}`, {
      title: item ? undefined : `${def.name} — vazio\n${def.hint}`,
      style: item ? { '--rarity': rarityInfo(item.rarity).color } as Partial<CSSStyleDeclaration> : {},
    },
      h('img.anat-moldura', {
        src: ART(item ? 'soquete_aceso' : 'soquete_vazio'),
        alt: '', 'aria-hidden': true, draggable: false,
      }),
      item
        ? spriteIcon(item.icon, 30, 'anat-item')
        : h('img.anat-slot-art', {
            src: ART(`slot_${slot}`), alt: '', 'aria-hidden': true, draggable: false,
            // A arte da secundária ainda não existe. Some em vez de virar
            // ícone quebrado; o soquete vazio já diz que ali não há nada.
            onerror: (e: Event) => { (e.target as HTMLElement).style.display = 'none'; },
          }),
    );

    if (item) {
      cel.addEventListener('mouseenter', () => this.mostrarFicha(item, cel));
      cel.addEventListener('mouseleave', () => this.esconderFicha());
      cel.addEventListener('click', () => {
        sim.unequip(slot, this.vendo);
        this.esconderFicha();
        sim.touch();
      });
    }
    return cel;
  }

  private mostrarFicha(item: NonNullable<ReturnType<typeof equipamentoDe>[SlotId]>, alvo: HTMLElement): void {
    if (!this.ficha) {
      this.ficha = h('.item-card-float.hidden');
      document.body.append(this.ficha);
    }
    const ficha = this.ficha;
    ficha.replaceChildren(buildItemCard(this.sim, item, { compare: false }));
    ficha.classList.remove('hidden');

    const spot = alvo.getBoundingClientRect();
    const largura = ficha.offsetWidth || 236;
    const altura = ficha.offsetHeight || 220;
    // Abre para o lado com espaço; a coluna é estreita e fica no meio da tela.
    const direita = spot.right + 10;
    const cabe = direita + largura <= window.innerWidth - 8;
    ficha.style.left = `${cabe ? direita : Math.max(8, spot.left - largura - 10)}px`;
    ficha.style.top = `${Math.min(Math.max(8, spot.top - 12), Math.max(8, window.innerHeight - altura - 8))}px`;
  }

  private esconderFicha(): void {
    this.ficha?.classList.add('hidden');
  }
}

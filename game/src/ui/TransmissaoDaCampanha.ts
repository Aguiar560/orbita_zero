import { bus } from '@app/Bus';
import type { TransmissaoDaCampanha } from '@data/narrativa-campanha';
import { clear, h, portraitIcon, spriteIcon } from './dom';
import { assets } from '@render/Assets';

/** Fila modal das cenas curtas da campanha. */
export class TransmissoesDaCampanha {
  private readonly fila: TransmissaoDaCampanha[] = [];
  private atual: TransmissaoDaCampanha | null = null;
  private indice = 0;
  private camada: HTMLElement | null = null;
  private aoTeclar: ((evento: KeyboardEvent) => void) | null = null;
  private retratos: Promise<void> | null = null;

  constructor(private readonly host: HTMLElement) {}

  enfileirar(transmissao: TransmissaoDaCampanha | null): void {
    if (!transmissao) return;
    if (this.atual?.id === transmissao.id || this.fila.some((item) => item.id === transmissao.id)) return;
    this.fila.push(transmissao);
    if (!this.atual) this.abrirProxima();
  }

  private abrirProxima(): void {
    const proxima = this.fila.shift();
    if (!proxima) {
      bus.emit('narrativa:estado', { aberta: false });
      return;
    }
    this.atual = proxima;
    this.indice = 0;
    this.camada = null;
    this.aoTeclar = (evento) => {
      if (evento.key === 'Escape') this.encerrarAtual();
      if (evento.key === 'Enter' || evento.key === ' ') { evento.preventDefault(); this.avancar(); }
    };
    addEventListener('keydown', this.aoTeclar);
    bus.emit('narrativa:estado', { aberta: true });

    // `characters` e `retratos` são atlas lazy. A cena era montada antes de
    // eles chegarem, então `portraitIcon` não encontrava o frame e a moldura
    // ficava vazia para sempre. O combate já está pausado pelo evento acima;
    // esperamos os atlas antes de inserir o modal para o primeiro quadro já
    // conter a arte correta.
    void this.carregarRetratos().then(() => {
      if (this.atual !== proxima) return;
      this.camada = h('.narrativa-camada', { role: 'dialog', 'aria-modal': 'true', 'aria-label': proxima.titulo });
      this.host.append(this.camada);
      this.render();
    });
  }

  private carregarRetratos(): Promise<void> {
    if (!this.retratos) {
      this.retratos = Promise.all([
        assets.loadAtlas('characters'),
        assets.loadAtlas('retratos'),
      ]).then(() => undefined).catch((error) => {
        // A narrativa continua legível mesmo se um pack opcional falhar; o
        // importante é não deixar uma rejeição interromper a fila da cena.
        console.warn('[narrativa] retratos indisponíveis; seguindo com texto', error);
      });
    }
    return this.retratos;
  }

  private render(): void {
    if (!this.atual || !this.camada) return;
    const fala = this.atual.falas[this.indice]!;
    const ultima = this.indice === this.atual.falas.length - 1;
    clear(this.camada).append(
      h(`section.narrativa-console.tom-${fala.tom}`, {},
        h('header.narrativa-topo', {},
          h('div', {}, h('span', { text: this.atual.titulo }), h('b', { text: this.atual.subtitulo })),
          h('small', { text: `${String(this.indice + 1).padStart(2, '0')} / ${String(this.atual.falas.length).padStart(2, '0')}` }),
        ),
        h('.narrativa-conteudo', {},
          h('.narrativa-retrato', {}, fala.tipoDeArte === 'retrato' ? portraitIcon(fala.arte, 122, 144) : spriteIcon(fala.arte, 122)),
          h('.narrativa-fala', {},
            h('span', { text: fala.cargo }),
            h('h2', { text: fala.autor }),
            h('p', { text: fala.texto }),
          ),
        ),
        h('footer.narrativa-rodape', {},
          h('.narrativa-objetivo', {}, h('span', { text: 'OBJETIVO ATUALIZADO' }), h('b', { text: this.atual.objetivo })),
          h('.narrativa-acoes', {},
            h('button.btn.narrativa-pular', { onclick: () => this.encerrarAtual() }, h('span', { text: 'PULAR CENA' })),
            h('button.btn.primary.narrativa-avancar', { autofocus: true, onclick: () => this.avancar() }, h('span', { text: ultima ? 'RETOMAR MISSÃO' : 'CONTINUAR ›' })),
          ),
        ),
      ),
    );
  }

  private avancar(): void {
    if (!this.atual) return;
    if (this.indice < this.atual.falas.length - 1) {
      this.indice += 1;
      this.render();
      return;
    }
    this.encerrarAtual();
  }

  private encerrarAtual(): void {
    if (this.aoTeclar) removeEventListener('keydown', this.aoTeclar);
    this.aoTeclar = null;
    this.camada?.remove();
    this.camada = null;
    this.atual = null;
    this.abrirProxima();
  }
}

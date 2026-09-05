import { MUSICA_POR_ID, MUSICAS, musicaAnterior, proximaMusica, type MusicaDef } from '@data/musicas';
import type { Settings } from '@sim/types';

/**
 * A trilha de fundo.
 *
 * ## Por que `<audio>` e não Web Audio, ao contrário do resto do som
 *
 * `AudioCombate` decodifica em `AudioBuffer` porque os efeitos são curtos,
 * repetem muito e precisam de latência baixa. Música é o oposto: são arquivos
 * de 7 a 8 MB, e `decodeAudioData` os expande para PCM cru — perto de 40 MB
 * **cada** na memória, para tocar uma faixa por vez.
 *
 * Um `<audio>` transmite, decodifica em pedaços e libera o que já passou. Com
 * `preload="none"` ele também não baixa nada até alguém dar play: quem joga com
 * a música desligada não paga os 23 MB.
 *
 * ## Por que ele não entra no `AudioContext`
 *
 * `createMediaElementSource` daria um volume unificado com os efeitos, e custa
 * duas coisas: o elemento passa a depender do contexto estar ativo (que só
 * acontece depois de um gesto), e o áudio some por completo se a criação do
 * contexto falhar. Um `.volume` no elemento é uma linha e não tem nenhuma das
 * duas dependências.
 *
 * ## O gesto do navegador
 *
 * Nenhum navegador deixa tocar som antes de o usuário interagir com a página.
 * `tentarTocar` engole a recusa e a classe fica armada: o primeiro clique ou
 * tecla dispara de novo. Sem isso, quem entra com a música ligada ouve silêncio
 * para sempre, porque a primeira tentativa aconteceu no boot e foi negada.
 */
export class MusicaDeFundo {
  private readonly elemento = new Audio();
  private atualId: string | undefined;
  private encerrado = false;

  constructor(
    private readonly preferencias: () => Pick<Settings, 'muted' | 'volumeMestre' | 'volumeMusica'>,
    private readonly aoTrocar?: (id: string) => void,
  ) {
    this.elemento.preload = 'none';
    // Sem laço: ao acabar, vai para a PRÓXIMA. Repetir a mesma faixa por horas
    // num jogo ocioso é o caminho mais curto para o jogador desligar o som.
    this.elemento.loop = false;
    this.elemento.addEventListener('ended', () => this.proxima());
    window.addEventListener('pointerdown', this.destravar);
    window.addEventListener('keydown', this.destravar);
    document.addEventListener('visibilitychange', this.visibilidade);
  }

  /** O gesto que o navegador exige. Roda uma vez e não estorva depois. */
  private readonly destravar = (): void => {
    if (this.encerrado || this.elemento.paused === false) return;
    if (this.atualId) void this.tentarTocar();
  };

  private readonly visibilidade = (): void => {
    // Aba escondida NÃO pausa a música: o jogo continua rodando e o som de
    // fundo é justamente o que acompanha quem deixou a aba aberta noutra
    // janela. Só o combate se cala, e isso é decisão do `AudioCombate`.
    if (!document.hidden && this.atualId) void this.tentarTocar();
  };

  /** Volume efetivo: mestre × música, zerado no silêncio. */
  atualizar(): void {
    const p = this.preferencias();
    const vol = p.muted ? 0 : Math.max(0, Math.min(1, p.volumeMestre * p.volumeMusica));
    this.elemento.volume = vol;
    // Silenciar PAUSA em vez de só zerar o volume: um `<audio>` mudo continua
    // baixando o arquivo inteiro, e o jogador que desligou o som não deveria
    // pagar a banda.
    if (vol <= 0) this.elemento.pause();
    else if (this.atualId && this.elemento.paused) void this.tentarTocar();
  }

  /** A faixa em cena, se houver. */
  get atual(): MusicaDef | null {
    return this.atualId ? MUSICA_POR_ID.get(this.atualId) ?? null : null;
  }

  get tocando(): boolean {
    return !this.elemento.paused && !this.elemento.ended;
  }

  /**
   * Toca uma faixa pelo id. Id desconhecido cai na primeira da lista.
   *
   * Trocar para a faixa que já está tocando não reinicia: o jogador que abre os
   * Ajustes e clica na faixa atual espera que nada aconteça, não que a música
   * volte ao começo.
   */
  tocar(id: string | undefined): void {
    const def = (id ? MUSICA_POR_ID.get(id) : undefined) ?? MUSICAS[0];
    if (!def) return;
    if (this.atualId === def.id && this.tocando) return;

    this.atualId = def.id;
    this.elemento.src = def.arquivo;
    this.aoTrocar?.(def.id);
    this.atualizar();
    void this.tentarTocar();
  }

  proxima(): void { this.tocar(proximaMusica(this.atualId).id); }
  anterior(): void { this.tocar(musicaAnterior(this.atualId).id); }

  /** Pausa sem esquecer a faixa — retomar continua de onde parou. */
  pausar(): void { this.elemento.pause(); }

  private async tentarTocar(): Promise<void> {
    if (this.encerrado) return;
    const p = this.preferencias();
    if (p.muted || p.volumeMestre * p.volumeMusica <= 0) return;
    try {
      await this.elemento.play();
    } catch {
      // Recusa do navegador por falta de gesto, ou arquivo indisponível. Nos
      // dois casos o jogo segue: `destravar` tenta de novo no primeiro clique.
    }
  }

  dispose(): void {
    this.encerrado = true;
    this.elemento.pause();
    this.elemento.src = '';
    window.removeEventListener('pointerdown', this.destravar);
    window.removeEventListener('keydown', this.destravar);
    document.removeEventListener('visibilitychange', this.visibilidade);
  }
}

import { definirApelido } from '@app/placar';
import { clear, h } from './dom';

/**
 * Portão de identidade para toda conta que entra no jogo.
 *
 * Não é só uma preferência visual do placar: o jogo não inicia enquanto o
 * apelido público não estiver gravado no servidor. Isso também recupera contas
 * antigas, cujo piloto já existia antes de a identidade ser exigida.
 */
export class IdentidadeObrigatoria {
  private readonly root = h('.escolha-piloto.escolha-identidade-obrigatoria');
  private apelido = '';
  private erro = '';
  private enviando = false;

  constructor(private readonly host: HTMLElement) {}

  mostrar(): Promise<void> {
    return new Promise((resolver) => {
      this.render(() => {
        this.root.remove();
        resolver();
      });
      this.host.append(this.root);
    });
  }

  private render(aoConcluir: () => void): void {
    const campo = h('input.escolha-apelido-campo', {
      type: 'text', maxlength: '16', autofocus: true,
      placeholder: 'Seu apelido de piloto',
      'aria-label': 'Apelido de piloto obrigatório',
      value: this.apelido,
      oninput: (evento: Event) => {
        this.apelido = (evento.target as HTMLInputElement).value;
        this.erro = '';
      },
      onkeydown: (evento: KeyboardEvent) => {
        if (evento.key === 'Enter') { evento.preventDefault(); void this.confirmar(aoConcluir); }
      },
    }) as HTMLInputElement;

    clear(this.root).append(
      h('.escolha-fundo'),
      h('.escolha-corpo.escolha-identidade-corpo', {},
        h('header.escolha-topo', {},
          h('h1', { text: 'IDENTIDADE DE PILOTO' }),
          h('p.escolha-chamada', { text: 'Escolha como a galáxia vai conhecer você.' }),
        ),
        h('.escolha-apelido.escolha-apelido-obrigatorio', {},
          h('label.escolha-apelido-rotulo', { text: 'APELIDO OBRIGATÓRIO' }),
          campo,
          h('span.tiny.muted', { text: this.erro || 'De 3 a 16 caracteres. Este nome aparece no jogo e na comunidade.' }),
        ),
        h('button.btn.primary.big.escolha-confirmar', {
          disabled: this.enviando,
          text: this.enviando ? 'REGISTRANDO…' : 'CONTINUAR',
          onclick: () => { void this.confirmar(aoConcluir); },
        }),
      ),
    );
    if (!this.enviando) queueMicrotask(() => campo.focus());
  }

  private async confirmar(aoConcluir: () => void): Promise<void> {
    if (this.enviando) return;
    const escolhido = this.apelido.trim();
    if (!escolhido) {
      this.erro = 'Informe seu apelido para entrar no jogo.';
      this.render(aoConcluir);
      return;
    }

    this.enviando = true;
    this.render(aoConcluir);
    const resultado = await definirApelido(escolhido);
    this.enviando = false;
    if (resultado.ok) {
      aoConcluir();
      return;
    }

    this.erro = {
      invalido: 'Use de 3 a 16 caracteres, começando e terminando com letra ou número.',
      em_uso: 'Esse apelido já pertence a outro piloto. Escolha outro.',
      sem_conta: 'Sua sessão expirou. Entre novamente para definir o apelido.',
      rede: 'Não foi possível registrar agora. Confira a conexão e tente novamente.',
    }[resultado.erro];
    this.render(aoConcluir);
  }
}

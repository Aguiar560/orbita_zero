import { navegadorForaDoPortugues } from './ui/idioma';

const rootEncontrado = document.getElementById('app');
if (!rootEncontrado) throw new Error('#app não encontrado');
const root: HTMLElement = rootEncontrado;

async function iniciar(): Promise<void> {
  // Quem chega com o navegador fora do português lê um aviso, em inglês, de
  // onde fica o tradutor. Import sob demanda: o jogador brasileiro não baixa.
  if (navegadorForaDoPortugues()) {
    void import('./ui/AvisoDeIdioma').then((m) => m.mostrarAvisoDeIdioma())
      .catch((err: unknown) => console.warn('[idioma]', err));
  }

  // A wiki compartilha o domínio, mas não deve baixar a simulação, áudio e
  // renderização do jogo. A importação dinâmica mantém as duas experiências
  // isoladas em bundles próprios.
  if (location.pathname === '/wiki' || location.pathname.startsWith('/wiki/')) {
    const { montarWiki } = await import('./wiki/WikiApp');
    montarWiki(root);
    return;
  }

  await import('./styles/main.css');
  const [
    { Game },
    { bus },
    { finalizarLoginEmPopup },
    { vigiarErrosDoCliente },
  ] = await Promise.all([
    import('@app/Game'),
    import('@app/Bus'),
    import('@app/conta'),
    import('@app/erro-do-cliente'),
  ]);

  /**
   * O provedor devolve para a URL do jogo dentro da janelinha do login. Esta
   * guarda fecha a janela antes de montar a cena completa.
   */
  if (finalizarLoginEmPopup()) return;

  vigiarErrosDoCliente();
  const game = new Game(root);

  // A faixa muda a altura útil da cena vertical, então trocar sua visibilidade
  // exige recalcular o layout — não é só um `display: none`.
  bus.on('state:changed', () => game.relayout());
  await game.start();

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).oz = game;
  }
}

void iniciar().catch((err: unknown) => console.error('[boot]', err));

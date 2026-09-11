import '../styles/idioma.css';

/**
 * Aviso, em inglês, para quem abre o jogo com o navegador fora do português.
 *
 * O jogo só existe em português. Quem chega do itch.io ou de fora do Brasil
 * encontra uma tela que não lê — e o tradutor do navegador resolve boa parte
 * disso, mas só se a pessoa souber que ele está ali. O aviso diz onde fica.
 *
 * ## Por que não liga o tradutor sozinho
 *
 * Porque não dá: nenhuma página consegue ligar o tradutor do navegador por
 * quem visita. O que dá é dizer em uma linha como fazer.
 *
 * ## As escolhas pequenas
 *
 * - `translate="no"` e `lang="en"`: o aviso já está em inglês, e o tradutor,
 *   achando que a página inteira é português, estragaria a frase.
 * - Some sozinho quando a página foi traduzida (o Chrome marca o `<html>` com
 *   `translated-ltr`), porque aí o aviso já cumpriu o que tinha a fazer.
 * - Fechar vale para sempre neste navegador. Quem já sabe não precisa ser
 *   lembrado a cada visita.
 * - Canto inferior esquerdo, sem bloquear nada: aparece no meio do jogo também.
 * - Sem `dom.ts`: a wiki também mostra o aviso, e ela não baixa o `render/`.
 */
const CHAVE = 'oz.aviso-idioma.v1';

function jaFechado(): boolean {
  try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; }
}

export function mostrarAvisoDeIdioma(host: HTMLElement = document.body): void {
  if (jaFechado() || host.querySelector('.aviso-idioma')) return;

  const aviso = document.createElement('aside');
  aviso.className = 'aviso-idioma';
  aviso.setAttribute('role', 'note');
  aviso.setAttribute('lang', 'en');
  aviso.setAttribute('translate', 'no');

  const texto = document.createElement('div');
  texto.className = 'aviso-idioma-texto';
  const titulo = document.createElement('strong');
  titulo.textContent = 'THIS GAME IS IN PORTUGUESE';
  const corpo = document.createElement('p');
  corpo.textContent = 'To play in English, use your browser’s translator: right-click the page → Translate to English. On mobile: browser menu → Translate.';
  texto.append(titulo, corpo);

  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'aviso-idioma-ok';
  ok.textContent = 'GOT IT';
  ok.addEventListener('click', () => {
    try { localStorage.setItem(CHAVE, '1'); } catch { /* sem armazenamento: some só nesta visita */ }
    aviso.remove();
  });

  aviso.append(texto, ok);
  host.append(aviso);
}

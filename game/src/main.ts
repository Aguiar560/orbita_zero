import './styles/main.css';
import { Game } from '@app/Game';
import { bus } from '@app/Bus';
import { finalizarLoginEmPopup } from '@app/conta';

/**
 * A janela do login fecha ANTES de qualquer coisa carregar.
 *
 * O provedor devolve para a URL do jogo, entao esta MESMA pagina roda dentro
 * da janelinha do login. Sem esta guarda ela carregaria o jogo inteiro —
 * assets, som, cena — so para ser fechada meio segundo depois.
 */
if (finalizarLoginEmPopup()) {
  // Nao ha mais pagina: qualquer coisa abaixo rodaria num documento fechando.
  throw new Error('janela de login encerrada');
}

const root = document.getElementById('app');
if (!root) throw new Error('#app não encontrado');

const game = new Game(root);

// A faixa muda a altura útil da cena vertical, então trocar sua visibilidade
// exige recalcular o layout — não é só um `display: none`.
bus.on('state:changed', () => game.relayout());

void game.start().catch((err: unknown) => console.error('[boot]', err));

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).oz = game;
}

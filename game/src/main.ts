import './styles/main.css';
import { Game } from '@app/Game';
import { bus } from '@app/Bus';

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

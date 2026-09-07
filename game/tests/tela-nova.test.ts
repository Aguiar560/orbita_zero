import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCREEN_UNLOCKS } from '@data/screen-unlocks';
import { temTutorial } from '@data/tutoriais';

/**
 * A tela que liberou avisa até ser visitada.
 *
 * O anúncio de desbloqueio era só um toast, e toast dura segundos. Num jogo
 * idle o jogador costuma estar longe: sobe de patente durante a ausência,
 * volta, e o aviso já passou — ou nunca aconteceu, porque `registrarMarcosAtuais`
 * silencia no boot tudo que já estava liberado. A Fabricação abria na patente 10
 * e ficava lá, muda, esperando ser descoberta por acaso.
 *
 * A marca fica na aba até a visita. É o que transforma "aconteceu" em "há algo
 * a fazer".
 */

const fonte = (...p: string[]): string =>
  readFileSync(join(process.cwd(), 'src', ...p), 'utf8');

describe('a marca de tela recém-liberada', () => {
  it('toda tela que desbloqueia tem tutorial — é dele que vem o "já entrei"', () => {
    /**
     * O teste que sustenta a decisão de NÃO criar um campo no save.
     *
     * A marca some quando o id entra em `guiasVistos`, e quem o põe lá é o
     * fechamento do tutorial da tela. Uma tela que desbloqueie sem tutorial
     * nunca sairia da lista: a marca ficaria acesa para sempre, e marca que não
     * some ensina a ignorar marca.
     *
     * Se um dia uma tela nova entrar em `SCREEN_UNLOCKS` sem tutorial, é aqui
     * que isso aparece — antes de virar uma aba piscando eternamente.
     */
    const semTutorial = Object.keys(SCREEN_UNLOCKS).filter((id) => !temTutorial(id));
    expect(semTutorial).toEqual([]);
  });

  it('e a marca depende de estar liberada E não visitada', () => {
    const shell = fonte('ui', 'Shell.ts');
    const metodo = shell.slice(shell.indexOf('private telaNova('));
    const corpo = metodo.slice(0, metodo.indexOf('\n  }'));

    // Sem desbloqueio não há novidade: a tela sempre esteve lá.
    expect(corpo).toContain('if (!unlock || !this.temAcessoAoPainel(panel, unlock)) return false;');
    expect(corpo).toContain("guiasVistos.includes(panel.id)");
  });

  it('e a barra é redesenhada quando o conjunto muda, nos dois sentidos', () => {
    /**
     * Liberar ACRESCENTA a marca; fechar o tutorial a TIRA. Um `if (mudou)` só
     * cobria o primeiro — a marca ficaria na aba depois de o jogador entrar.
     */
    const shell = fonte('ui', 'Shell.ts');
    expect(shell).toContain('agora !== this.telasNovasNaBarra');
    expect(shell).toContain('this.telasNovasNaBarra = agora;');
  });

  it('e o contador de itens vence a marca, quando os dois cabem', () => {
    // Os dois dizem "olhe aqui" no mesmo canto. Um número é informação de
    // agora; a marca volta assim que ele zerar.
    const shell = fonte('ui', 'Shell.ts');
    const ordem = shell.slice(shell.indexOf("h('span.badge'"), shell.indexOf("h('span.tab-nova'"));
    expect(ordem.length).toBeGreaterThan(0); // badge aparece ANTES no ternário
  });

  it('e a marca tem estilo, com o pulso desligável', () => {
    /**
     * O pulso é reforço, não o recado: quem pede movimento reduzido continua
     * vendo a marca e a borda acesa.
     */
    const css = readFileSync(join(process.cwd(), 'src', 'styles', 'main.css'), 'utf8');
    expect(css).toContain('.tab-nova {');
    expect(css).toContain('.tab.nova {');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.tab\.nova \{ animation: none; \}/);
  });
});

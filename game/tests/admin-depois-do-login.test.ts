import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * O que é de admin aparece DEPOIS do login, e não só na próxima recarga.
 *
 * A ordem do boot é a causa de uma família inteira de defeitos neste projeto: a
 * interface é montada, e só então a tela de login aparece por cima dela. Todo
 * estado lido uma vez no construtor é lido num instante em que ainda não há
 * conta — e fica errado até alguém recarregar a página.
 *
 * Já aconteceu três vezes:
 *
 * 1. o topo dizia "Sem conta" depois do login;
 * 2. o Laboratório não aparecia para quem administra;
 * 3. o selo de quem está online esperava o relógio de um minuto.
 *
 * O aviso `oz:conta` existe desde o começo e é disparado por `guardar` e por
 * `sair`. O que faltava era escutá-lo. Estes testes leem a FONTE porque o que
 * precisa ser guardado é a ASSINATURA do aviso — montar Shell e PerfilMenu de
 * verdade exigiria o jogo inteiro, e o defeito nunca esteve no desenho.
 */

const fonte = (...p: string[]): string =>
  readFileSync(join(process.cwd(), 'src', ...p), 'utf8');

describe('o que a conta destrava, depois que a conta chega', () => {
  it('o Shell repõe o Laboratório quando a conta muda', () => {
    const shell = fonte('ui', 'Shell.ts');
    expect(shell).toContain("window.addEventListener('oz:conta', () => { this.ajustarPaineisDeAdmin(); });");
    expect(shell).toContain('private ajustarPaineisDeAdmin(): void {');
  });

  it('e a lista de painéis deixou de ser definitiva', () => {
    /**
     * `readonly` aqui era o próprio defeito: uma lista imutável decidida num
     * instante em que a resposta ainda não existia.
     */
    const shell = fonte('ui', 'Shell.ts');
    expect(shell).toContain('private panels: Panel[] = [');
    expect(shell).not.toContain('private readonly panels: Panel[] = [');
  });

  it('e TIRA os painéis administrativos de quem saiu da conta, fechando-os se estiverem abertos', () => {
    /**
     * Tirar importa tanto quanto pôr: sair da conta de admin numa aba que
     * continua aberta deixaria dados operacionais na mão de quem entrar depois.
     * Um painel que some da barra estando ABERTO continua desenhado, sem aba
     * que o feche.
     */
    const shell = fonte('ui', 'Shell.ts');
    const metodo = shell.slice(shell.indexOf('private ajustarPaineisDeAdmin'));
    const corpo = metodo.slice(0, metodo.indexOf('\n  private buildTabs'));

    expect(corpo).toContain("const idsAdmin = new Set(['laboratorio', 'admin-dashboard']);");
    expect(corpo).toContain('if (idsAdmin.has(this.active.id)) this.voltarDaCamada();');
    expect(corpo).toContain('this.panels = this.panels.filter((p) => !idsAdmin.has(p.id));');
    // E redesenha a barra: sem isto a aba continua na tela depois de removida.
    expect(corpo).toContain('this.buildTabs();');
  });

  it('e o selo de online não espera o relógio de um minuto', () => {
    const perfil = fonte('ui', 'PerfilMenu.ts');
    expect(perfil).toContain("window.addEventListener('oz:conta', () => { this.render(); this.carregarApelido(); olharOnline(); });");
  });

  it('e o aviso é disparado ao entrar, sair e receber a sessão da janela Google', () => {
    /**
     * Escutar não vale nada se ninguém falar. `guardar` cobre entrar; `sair`
     * cobre o inverso; e a terceira emissão leva à página principal a sessão
     * que foi gravada pela janela auxiliar do Google.
     */
    const conta = fonte('app', 'conta.ts');
    expect(conta.split("window.dispatchEvent(new Event('oz:conta'))").length - 1).toBe(3);
  });
});

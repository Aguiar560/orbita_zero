import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * O nome no placar é pedido na tela de escolha do piloto.
 *
 * Antes ele só era cobrado ao abrir o placar — e quem nunca o abria seguia sem
 * nome, sem aparecer no ranking e **sem poder falar no chat**, sem nunca saber
 * por quê. Os dois recados ficavam justamente nas telas que o nome destrava, e
 * que quem não tem nome não tem motivo para visitar.
 *
 * O que estes testes guardam não é a aparência do campo. É a ORDEM entre duas
 * gravações, e o fato de o campo ser opcional — as duas coisas que, se
 * quebrarem, quebram calado.
 */

const fonte = (rel: string): string =>
  readFileSync(join(process.cwd(), 'src', rel), 'utf8');

describe('o nome pedido junto com o piloto', () => {
  const tela = fonte('ui/EscolhaDePiloto.ts');

  it('grava o apelido ANTES de gravar o piloto', () => {
    /**
     * `escolherPiloto` é irreversível: grava a escolha no save e faz esta tela
     * nunca mais aparecer. Se ele viesse primeiro e o apelido fosse recusado
     * (nome em uso, rede fora), não haveria mais tela onde corrigir — o jogador
     * cairia no jogo sem nome e sem saber que chegou a tentar ter um.
     */
    const confirmar = tela.slice(tela.indexOf('private async confirmar'));
    const corpo = confirmar.slice(0, confirmar.indexOf('\n  private cartao'));

    const ondeApelido = corpo.indexOf('await definirApelido');
    const ondePiloto = corpo.indexOf('this.sim.escolherPiloto');

    expect(ondeApelido).toBeGreaterThan(-1);
    expect(ondePiloto).toBeGreaterThan(-1);
    expect(ondeApelido).toBeLessThan(ondePiloto);
  });

  it('e desiste da partida quando o nome é recusado, em vez de seguir sem ele', () => {
    // O `return` dentro do `if (!r.ok)` é o que impede a tela de continuar para
    // o `escolherPiloto` depois de uma recusa.
    expect(tela).toMatch(/if \(!r\.ok\) \{[\s\S]*?return;\n\s*\}/);
  });

  it('e nome em branco não impede partir', () => {
    /**
     * A tela existe para uma decisão irreversível. Emendar nela uma segunda
     * obrigação é o jeito de fazer alguém desistir logo na primeira tela — e o
     * placar continua sabendo pedir o nome depois.
     */
    expect(tela).toContain('const quer = this.apelidoDigitado.trim();');
    expect(tela).toContain('if (quer && sessaoGuardada() && !apelidoAtual()) {');
  });

  it('e não pede nome a quem não tem onde gravá-lo, nem a quem já tem um', () => {
    // Sem conta o apelido não tem servidor onde morar; com apelido já escolhido
    // a pergunta é ruído — e esta tela reaparece quando o jogador apaga o
    // progresso, que a conta sobrevive.
    expect(tela).toContain('if (!sessaoGuardada() || apelidoAtual()) return [];');
  });

  it('e o campo tem estilo, senão entra sem forma nenhuma', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'styles', 'main.css'), 'utf8');
    expect(css).toContain('.escolha-apelido-campo {');
    expect(css).toContain('.escolha-apelido-rotulo {');
  });
});

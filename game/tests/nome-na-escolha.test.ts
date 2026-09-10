import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A identidade é resolvida antes da escolha do piloto.
 *
 * Antes ele só era cobrado ao abrir o placar — e quem nunca o abria seguia sem
 * nome, sem aparecer no ranking e **sem poder falar no chat**, sem nunca saber
 * por quê. Os dois recados ficavam justamente nas telas que o nome destrava, e
 * que quem não tem nome não tem motivo para visitar.
 *
 * O que estes testes guardam é a separação das duas decisões. O apelido vem
 * primeiro e nunca é uma segunda ação escondida dentro da escolha irreversível
 * da nave.
 */

const fonte = (rel: string): string =>
  readFileSync(join(process.cwd(), 'src', rel), 'utf8');

describe('escolha de piloto depois da identidade', () => {
  const tela = fonte('ui/EscolhaDePiloto.ts');

  it('não volta a oferecer um apelido opcional na escolha da nave', () => {
    /**
     * `escolherPiloto` é irreversível: grava a escolha no save e faz esta tela
     * nunca mais aparecer. Se ele viesse primeiro e o apelido fosse recusado
     * (nome em uso, rede fora), não haveria mais tela onde corrigir — o jogador
     * cairia no jogo sem nome e sem saber que chegou a tentar ter um.
     */
    expect(tela).not.toContain('Pode deixar em branco');
    expect(tela).not.toContain('definirApelido');
    expect(tela).toContain('this.sim.escolherPiloto');
  });

  it('mantém o campo de identidade com estilo próprio', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'styles', 'main.css'), 'utf8');
    expect(css).toContain('.escolha-apelido-campo {');
    expect(css).toContain('.escolha-apelido-rotulo {');
  });

  it('abre a história antes de registrar a escolha irreversível', () => {
    expect(tela).toContain("private etapa: 'selecao' | 'dossie'");
    expect(tela).toContain('Conhecer a história de');
    expect(tela).toContain('SEUS PRÓXIMOS PASSOS');
    expect(tela).toContain('ASSUMIR O COMANDO COMO');
    expect(tela.indexOf("this.etapa = 'dossie'")).toBeLessThan(tela.indexOf('this.sim.escolherPiloto'));
  });
});

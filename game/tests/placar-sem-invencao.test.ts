/**
 * Nenhuma tela pode inventar adversário.
 *
 * Já houve dois: a lista de demonstração do painel de Ranking e o widget da
 * Galáxia, com cinco nomes escritos no código e a pontuação por fórmula —
 * `(5 - i) * 145000 + melhorSetor * 880`. Aquela fórmula seguia o progresso do
 * PRÓPRIO jogador, então os "adversários" subiam junto e ficavam sempre à
 * frente: um placar que garantia a derrota de quem o olhasse.
 *
 * O teste é sobre o CÓDIGO e não sobre o comportamento de propósito. Um placar
 * falso não quebra nada, não dá erro e passa em qualquer teste de render — a
 * única forma de pegá-lo é procurar os nomes.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const arquivosDeTela = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? arquivosDeTela(p) : (e.name.endsWith('.ts') ? [p] : []);
  });

const TELAS = arquivosDeTela('src/ui');

/**
 * A fonte sem comentários.
 *
 * Necessário porque o comentário que EXPLICA a remoção cita os nomes
 * removidos — e sem isto o teste falha justamente no arquivo consertado,
 * acusando a própria documentação do conserto.
 */
const semComentarios = (fonte: string): string => fonte
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** Nomes que já apareceram inventados numa tela. */
const NOMES_INVENTADOS = [
  'Kael', 'NovaStrike', 'Vektor-07', 'ShadowPulse',
  'Lupus', 'Corvo Ômega', 'Sirius Nove',
];

describe('nenhum placar inventa adversário', () => {
  it('os nomes fabricados não voltaram', () => {
    const achados: string[] = [];
    for (const f of TELAS) {
      const fonte = semComentarios(readFileSync(f, 'utf8'));
      for (const n of NOMES_INVENTADOS) {
        if (fonte.includes(n)) achados.push(`${path.basename(f)}: ${n}`);
      }
    }
    expect(achados, achados.join(' · ')).toEqual([]);
  });

  it('o widget da Galáxia lê o placar de verdade', () => {
    const fonte = semComentarios(readFileSync('src/ui/panels/GalaxyPanel.ts', 'utf8'));
    expect(readFileSync('src/ui/panels/GalaxyPanel.ts', 'utf8'), 'o widget parou de buscar o placar').toContain('buscarPlacar');
    // A fórmula que inventava pontuação a partir do progresso do jogador.
    expect(fonte).not.toContain('145000');
  });

  it('o gerador de placar de demonstração não existe mais', () => {
    // Ele foi apagado quando o servidor entrou. Um arquivo dormente voltaria a
    // ser usado por quem procurasse "como preencho esta lista".
    let existe = true;
    try { readFileSync('src/sim/ranking-demo.ts', 'utf8'); } catch { existe = false; }
    expect(existe, 'ranking-demo.ts voltou').toBe(false);
  });
});

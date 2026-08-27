/**
 * A tela de Configurações.
 *
 * ## O que estes testes protegem
 *
 * Uma tela de ajustes cresce por adição, e o defeito que ela atrai é o
 * CONTROLE-FANTASMA: um interruptor bonito que não está ligado em nada. Ele não
 * quebra, não dá erro, e ensina o jogador a desconfiar de todos os outros.
 *
 * Por isso a regra aqui é: todo campo de `Settings` ou é LIDO por alguém, ou é
 * declaradamente inerte com o motivo escrito.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createState } from '@sim/state';

const fonte = (p: string): string => readFileSync(p, 'utf8');

const PAINEL = fonte('src/ui/panels/SettingsPanel.ts');

/**
 * Campos que NÃO são lidos por ninguém hoje, e por quê.
 *
 * O jogo não tem som: não existe `Audio`, `AudioContext` nem arquivo de áudio.
 * Os volumes são guardados para o dia em que existir, e a aba diz isso em
 * letras — controle que finge funcionar é pior que controle ausente.
 */
const INERTES_COM_MOTIVO = new Set([
  'volumeMestre', 'volumeMusica', 'volumeEfeitos', 'muted',
]);

/** Campos que são estado interno, não controle de tela. */
const NAO_SAO_CONTROLES = new Set([
  'guiaVisto', 'pinnedMissions', 'speed',
]);

describe('configurações', () => {
  const campos = Object.keys(createState(7).settings);

  it('todo ajuste é lido por alguém, ou é inerte declarado', () => {
    // Varre o código do jogo — não o painel — atrás de quem CONSOME o campo.
    const consumidores = [
      'src/modes/vertical/VerticalMode.ts',
      'src/sim/index.ts',
      'src/app/Game.ts',
      'src/ui/Shell.ts',
      'src/ui/LeftRail.ts',
      'src/ui/Anatomia.ts',
      'src/render/Surface.ts',
      'src/sim/tree.ts',
      'src/app/admin.ts',
    ].map(fonte).join('\n');

    const fantasmas = campos.filter((c) =>
      !INERTES_COM_MOTIVO.has(c) && !NAO_SAO_CONTROLES.has(c) && !consumidores.includes(c));

    expect(fantasmas, `ajustes que ninguém lê: ${fantasmas.join(', ')}`).toEqual([]);
  });

  it('a aba de Teste é a última', () => {
    // Ela muda o jogo inteiro, e não pode ser a primeira coisa que alguém acha.
    const abas = [...PAINEL.matchAll(/\{ id: '(\w+)', nome:/g)].map((m) => m[1]);
    expect(abas.length).toBeGreaterThanOrEqual(5);
    expect(abas[abas.length - 1]).toBe('teste');
  });

  it('os nomes das abas são curtos', () => {
    // Rótulo de aba é lido de relance: palavra curta acha mais rápido que
    // palavra certa. "Jogabilidade" virou "Jogo" por isso.
    const nomes = [...PAINEL.matchAll(/nome: '([^']+)', icone:/g)].map((m) => m[1]);
    expect(nomes.length).toBeGreaterThanOrEqual(5);
    for (const n of nomes) {
      expect(n.length, `"${n}" é longo demais para uma aba`).toBeLessThanOrEqual(10);
      expect(n.includes(' '), `"${n}" tem mais de uma palavra`).toBe(false);
    }
  });

  it('a aba de Teste só existe para admin', () => {
    // Duas metades: a aba some da fileira, e quem estava nela cai para outra.
    expect(PAINEL).toContain("a.id !== 'teste' || ehAdmin()");
    expect(PAINEL).toContain("if (this.aba === 'teste' && !ehAdmin())");
  });

  /**
   * A regra que DEFINE a largura dos ajustes.
   *
   * Achar por `lastIndexOf('.menu-settings {')` não serve: existe um
   * `.menu-settings` mais abaixo, dentro de um `@media (max-width: 760px)`, que
   * só mexe em borda e recuo. Procurar o último dá esse, que não tem `width`.
   */
  const regraDeTamanho = (): { antes: string; largura: number } | null => {
    const css = fonte('src/styles/main.css');
    for (let i = css.indexOf('.menu-settings {'); i >= 0; i = css.indexOf('.menu-settings {', i + 1)) {
      const bloco = css.slice(i, css.indexOf('}', i));
      const m = bloco.match(/width: min\((\d+)px/);
      if (m) return { antes: css.slice(Math.max(0, i - 400), i).trimEnd(), largura: Number(m[1]) };
    }
    return null;
  };

  it('o painel de ajustes é menor que os de trabalho', () => {
    const r = regraDeTamanho();
    expect(r, 'a regra de largura dos ajustes sumiu').not.toBeNull();
    expect(r!.largura, 'ajustes voltou ao tamanho das telas de trabalho')
      .toBeLessThanOrEqual(1000);
  });

  it('a regra de tamanho dos ajustes não é compartilhada', () => {
    /*
     * O defeito que isto pega, e ele já aconteceu: `.menu-settings` era o ÚLTIMO
     * seletor de uma LISTA com Galáxia, Armazém, Missões, Matriz, Hangar,
     * Ranking e Laboratório. Encolher "só os ajustes" encolheu as oito telas.
     *
     * E o bloco lê como se fosse só dos ajustes quando a leitura começa na
     * última linha da lista — foi exatamente assim que passou.
     */
    const r = regraDeTamanho();
    expect(r).not.toBeNull();
    // Vírgula antes da regra quer dizer que ela é o rabo de uma lista.
    expect(r!.antes.endsWith(','), 'a regra dos ajustes voltou a ser compartilhada')
      .toBe(false);
  });
  it('escala e resolução têm faixa saneada na carga', () => {
    // Zoom 0 some com a tela; qualidade 20 tenta alocar um canvas gigante. Save
    // adulterado ou de versão futura não pode chegar nesses valores.
    const state = fonte('src/sim/state.ts');
    expect(state).toContain("'escalaDaInterface'");
    expect(state).toContain("'qualidade'");
  });
});

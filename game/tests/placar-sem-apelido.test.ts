import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Ver o placar não depende de ter nome. Aparecer nele, sim.
 *
 * O pedido de apelido ocupava o lugar da lista inteira: quem ainda não tinha
 * escolhido um nome via um placar vazio. O efeito era o pior possível para quem
 * acabou de chegar — um jogo que parece não ter ninguém jogando, mostrado
 * exatamente para a pessoa que ainda está decidindo se fica.
 *
 * Este arquivo lê a FONTE porque o painel monta DOM, e montar o painel exige o
 * `Sim` inteiro. O que precisa ser guardado aqui não é pintura: é a ordem das
 * decisões dentro de uma função — que a lista seja calculada antes de qualquer
 * desvio pelo apelido, e que o pedido entre como item ao lado dela.
 */

const fonte = (rel: string): string =>
  readFileSync(join(process.cwd(), 'src', rel), 'utf8');

describe('o placar de quem ainda não escolheu nome', () => {
  const painel = fonte('ui/panels/RankingPanel.ts');

  it('não devolve o pedido de apelido no lugar da lista', () => {
    /**
     * A linha do defeito, escrita como ela era:
     *
     *     if (!estado.dados.meuApelido) return h('.ranking-lista', {}, cabecalho, this.pedirApelido(sim));
     *
     * Um `return` com `pedirApelido` e sem `ranking-linhas` é a porta na frente
     * da lista voltando. É essa forma que o teste proíbe.
     */
    const retornosCurtos = painel
      .split('\n')
      .filter((l) => l.includes('return') && l.includes('pedirApelido'));

    expect(retornosCurtos).toEqual([]);
  });

  it('e o pedido entra como convite, ao lado das linhas', () => {
    // `convite` é espalhado nos dois desfechos: o com marcas e o sem nenhuma.
    expect(painel).toContain('const convite = semNome ? [this.pedirApelido(sim)] : [];');
    expect(painel).toMatch(/cabecalho, \.\.\.convite,\n\s+h\('\.ranking-linhas'/);
    expect(painel).toContain("cabecalho, ...convite, this.aviso(");
  });

  it('e a linha "você" continua exigindo apelido', () => {
    /**
     * O outro lado da regra. A linha do próprio jogador vem de uma marca no
     * servidor, e o servidor recusa marca de quem não tem apelido — mostrá-la
     * sem nome inventaria uma posição que não existe.
     */
    expect(painel).toContain('...(estado.dados.meuApelido && !estouNoTopo && minhaPosicao');
  });

  it('e o servidor continua sendo quem exige o nome para aparecer', () => {
    /**
     * A tela ficou mais permissiva; a regra de verdade não. O `JOIN apelidos`
     * é o que garante que ninguém entre na lista sem nome, e ele mora no
     * servidor — onde o cliente não alcança.
     */
    const placar = readFileSync(join(process.cwd(), 'server', 'src', 'placar.ts'), 'utf8');
    expect(placar).toMatch(/FROM marcas m JOIN apelidos a ON a\.usuario = m\.usuario/);
  });
});

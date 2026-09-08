import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MISSOES } from '@data/missoes';
import { createState } from '@sim/state';
import { Sim } from '@sim/index';
import { raridadeExclusivaDoTier, tierDoContatoPorId } from '@data/balance/contatos';

/**
 * A prévia: ver a peça ANTES de decidir se vale o trabalho.
 *
 * Duas telas mostravam prêmio sem mostrar peça. A Provação dizia "3 itens" e
 * nada mais — o jogador vencia um piso, lia um número, e só descobria o que
 * tinha caído indo ao inventário procurar entre trinta peças parecidas. E o
 * contrato de missão mostrava o nome da peça e o dono, sem nenhuma pista do que
 * ela poderia fazer.
 */

const fonte = (...p: string[]): string =>
  readFileSync(join(process.cwd(), 'src', ...p), 'utf8');

describe('as peças ganhas na Provação', () => {
  it('viajam até a tela de resultado, e não só a contagem', () => {
    const sim = fonte('sim', 'index.ts');
    expect(sim).toContain('pecas: Item[];');
    expect(sim).toContain('pecas.push(peca);');
    expect(sim).toContain('pecas.push(reliquia);');
  });

  it('e a derrota devolve a lista vazia, sem furo', () => {
    // Derrota não paga nada. O campo precisa existir mesmo assim: um `undefined`
    // aqui derrubaria a tela de resultado no momento mais frágil do jogo.
    const sim = fonte('sim', 'index.ts');
    expect(sim).toContain('materiais: {}, pecas: [] }');
  });

  it('e a contagem só aparece quando as peças não vieram', () => {
    /**
     * Save antigo, ou repetição de piso, que não paga item. Mostrar "3 itens"
     * ao lado de três ícones seria contar a mesma coisa duas vezes.
     */
    const tela = fonte('ui', 'ProvacaoResultado.ts');
    expect(tela).toContain("r.ganhos.itens > 0 && !r.ganhos.pecas.length");
  });
});

describe('a prévia do item prometido pela missão', () => {
  it('mostra a raridade que o contrato realmente vai pagar', () => {
    const sim = new Sim(createState(9));
    for (const def of MISSOES) {
      if (!def.recompensaExclusiva) continue;
      const esperado = def.recompensaExclusiva.raridadeMin
        ?? raridadeExclusivaDoTier(def.giverId ? tierDoContatoPorId(def.giverId) : 1);
      expect(sim.raridadePrometida(def), def.nome).toBe(esperado);
    }
  });

  it('e devolve 0 para missão sem peça prometida, em vez de estourar', () => {
    const sim = new Sim(createState(10));
    const semExclusiva = MISSOES.find((m) => !m.recompensaExclusiva)!;
    expect(sim.raridadePrometida(semExclusiva)).toBe(0);
  });

  it('e a INTERFACE continua sem ler o tier do contato', () => {
    /**
     * A prévia precisava da raridade, que vem do tier — e a saída óbvia seria
     * importar `tierDoContatoPorId` no painel. Isso quebraria a regra de que o
     * tier é escondido, e o teste que a guarda pegou a tentativa.
     *
     * A resposta certa foi mover a decisão para o `sim`: a tela pergunta a
     * raridade, e o tier nunca sai da camada que tem o direito de conhecê-lo.
     * É a regra 2 do projeto — `ui/` não decide regra de jogo.
     */
    const arquivos: string[] = [];
    const varrer = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) varrer(p);
        else if (e.name.endsWith('.ts')) arquivos.push(p);
      }
    };
    varrer(join(process.cwd(), 'src', 'ui'));

    const usam = arquivos.filter((f) => /tierDoContato|raridadeExclusivaDoTier/.test(readFileSync(f, 'utf8')));
    expect(usam, `interface não deve calcular tier: ${usam.join(', ')}`).toEqual([]);
  });

  it('e a prévia promete IDENTIDADES, nunca valores', () => {
    /**
     * A peça é rolada na entrega. Listar valores seria prometer o que o dado
     * ainda não decidiu — e o jogador leria a lista como garantia.
     */
    const painel = fonte('ui', 'panels', 'MissoesPanel.ts');
    expect(painel).toContain('affixCandidates(molde');
    expect(painel).toContain('não as garantidas');
  });
});

describe('a ficha flutuante', () => {
  it('é um módulo só, e não uma cópia por painel', () => {
    /**
     * Este código nasceu dentro do painel de Baús. Quando a Provação e as
     * Missões passaram a mostrar itens, copiá-lo daria três posicionadoras — e a
     * terceira já nasceria diferente das duas primeiras, porque ninguém revisa
     * os três lugares ao ajustar um deles.
     */
    const baus = fonte('ui', 'panels', 'ChestsPanel.ts');
    expect(baus).toContain("from '../FichaDeItem'");
    expect(baus).not.toContain("this.ficha = h('.item-card-float.hidden')");
  });

  it('e abre no foco além do mouse', () => {
    // Quem navega por Tab também precisa ver o que a peça faz — e é o tipo de
    // coisa que se esquece quando cada tela liga o próprio ouvinte.
    const ficha = fonte('ui', 'FichaDeItem.ts');
    expect(ficha).toContain("el.addEventListener('focus', abrir);");
    expect(ficha).toContain("el.addEventListener('blur', esconderFicha);");
  });
});

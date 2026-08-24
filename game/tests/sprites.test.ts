import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEM_BASES, SLOTS, iconeDeItem } from '@data/items';
import { RARITIES } from '@data/rarity';
import { HULLS } from '@data/hulls';
import { ALL_ENEMIES } from '@data/enemies';
import { CHESTS } from '@data/chests';
import { RECURSOS, iconeDeRecurso } from '@data/recursos';
import { CHEFES_DA_PROVACAO } from '@data/provacao-chefes';
import { PERSONAGENS } from '@data/personagens';

/**
 * Todo nome de sprite que os dados citam existe no atlas gerado.
 *
 * **A armadilha mais cara do projeto, e a terceira reincidência.** Um nome de
 * sprite é uma string: ele passa por `tsc`, passa pelas 530 asserções, e só a
 * TELA revela que não existe — geralmente semanas depois, quando alguém abre o
 * painel certo.
 *
 * Já aconteceu com `cat/alvo` (inventado do nada), com `tiro/gelo_3` (o atlas
 * encolheu e a tabela não soube) e agora com `item/upgrade_0..7`: a folha
 * `Itens.png` tem NOVE colunas, `upgrade` foi a décima categoria criada depois,
 * e as oito bases dela pediam arte que nunca existiu. Oito ícones vazios no
 * Códex desde a 3.6.
 *
 * Testes por atlas já existiam (`arte-elemental`, `itens-novos`), mas cada um
 * olha o SEU atlas. Este olha o inverso: parte dos DADOS e cobra o atlas, que é
 * a direção em que o erro acontece.
 */
const DIR = new URL('../public/assets/atlas/', import.meta.url);

const IDS = new Set<string>(
  readdirSync(DIR).filter((f) => f.endsWith('.json')).flatMap((f) => {
    const j = JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as Record<string, unknown>;
    return Object.keys((j.frames as Record<string, unknown>) ?? j);
  }),
);

/** Sprites animados são citados pelo PREFIXO; o atlas guarda `prefixo0`, `1`… */
const existe = (id: string): boolean =>
  IDS.has(id) || IDS.has(`${id}0`) || IDS.has(`${id}1`) || [...IDS].some((k) => k.startsWith(id));

const cobrar = (rotulo: string, nomes: readonly (string | undefined)[]) => {
  const faltando = [...new Set(nomes.filter((n): n is string => !!n))].filter((n) => !existe(n));
  expect(faltando, `${rotulo}: ${faltando.join(', ')}`).toEqual([]);
};

describe('nenhum sprite citado pelos dados está faltando no atlas', () => {
  it('o atlas foi gerado', () => {
    expect(IDS.size).toBeGreaterThan(500);
  });

  it('bases de item', () => cobrar('bases', ITEM_BASES.map((b) => b.icon)));
  it('slots', () => cobrar('slots', SLOTS.map((s) => s.icon)));
  it('raridades', () => cobrar('raridades', RARITIES.map((r) => r.gem)));
  it('cascos', () => cobrar('cascos', HULLS.flatMap((h) => [h.sprite, h.barSprite, h.shot.sprite])));
  it('inimigos', () => cobrar('inimigos', ALL_ENEMIES.map((e) => e.sprite)));
  it('baús', () => cobrar('baús', CHESTS.map((c) => (c as { icon?: string }).icon)));
  it('recursos', () => cobrar('recursos', RECURSOS.map((r) => iconeDeRecurso(r))));
  it('chefes da Provação', () => cobrar('chefes', CHEFES_DA_PROVACAO.map((c) => (c as { sprite?: string }).sprite)));
  it('contatos', () => cobrar('contatos', PERSONAGENS.map((p) => (p as { retrato?: string }).retrato)));

  /**
   * O ícone do item é COMPOSTO em tempo de execução a partir de slot, raridade e
   * tier — 10 × 7 × 2 combinações. Uma folha que perca uma coluna quebra só
   * algumas delas, e nenhuma tabela denuncia.
   */
  it('todo ícone de item que a combinação pode gerar', () => {
    const nomes: string[] = [];
    for (const base of ITEM_BASES) {
      for (let r = 0; r < RARITIES.length; r++) nomes.push(iconeDeItem(base.slot, r as never, base.tier));
    }
    cobrar('ícones compostos', nomes);
  });

  /**
   * Os corpos contínuos são cortados no VALE, não em partes iguais.
   *
   * Anéis e nebulosas se tocam pelo halo na folha, então `sliceRow` não os
   * separa nem com piso de alfa em 245 — a divisão em partes iguais era o
   * recurso, e ela cortava. Medido no bloco `anel`: o passo caía nas colunas
   * 147 e 295, de brilho 18 e 30, enquanto os vales reais estão em 177 e 310,
   * de brilho 5 e 10. O corte passava POR CIMA da galáxia e ainda levava um
   * pedaço da vizinha para dentro do quadro.
   *
   * O sintoma some do olho mas volta fácil no código. Este teste guarda a
   * assinatura do conserto: cortando no vale as células saem com larguras
   * DIFERENTES; com divisão igual, todas iguais.
   */
  it('anéis e nebulosas não saem de uma divisão em partes iguais', () => {
    const orbe = JSON.parse(
      readFileSync(new URL('orbe.json', DIR), 'utf8'),
    ) as { frames?: Record<string, number[]> } & Record<string, unknown>;
    const quadros = (orbe.frames ?? orbe) as Record<string, number[]>;
    for (const bloco of ['anel', 'nebulosa']) {
      const larguras = Object.entries(quadros)
        .filter(([k]) => k.startsWith(bloco + "/"))
        .map(([, q]) => q[6]!);
      expect(larguras.length, bloco).toBeGreaterThan(1);
      expect(new Set(larguras).size, bloco + ": " + larguras.join(", ")).toBeGreaterThan(1);
    }
  });
});

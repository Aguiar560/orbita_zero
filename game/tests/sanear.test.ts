/**
 * O save não pode entrar absurdo.
 *
 * "Absurdo" e "exagerado" são coisas diferentes, e só a primeira é bug. Um save
 * editado com um milhão de sucata é escolha de quem joga sozinho; um save com
 * `Infinity` de sucata quebra toda conta que o toque depois, e um item com slot
 * inexistente derruba o painel de anatomia. Este arquivo trata da primeira.
 *
 * A regra do projeto — "save malformado não pode travar o boot" — já dizia
 * metade disso. Aqui ela vale também para VALORES, e não só para forma.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SAVE_VERSION, migrate } from '@sim/state';
import { itemUtilizavel, numeroSao, recursosSaos, frotaSa } from '@sim/sanear';

const saveBase = (extra: Record<string, unknown> = {}): unknown =>
  ({ version: SAVE_VERSION, ...extra });

describe('números', () => {
  it('recusa os três venenos: NaN, Infinity e negativo', () => {
    expect(numeroSao(NaN)).toBe(0);
    // Infinity cai no PADRAO, nao no teto: devolver o teto premiaria quem
    // escreveu Infinity no save com o maior valor possivel. O padrao e a
    // resposta segura — quem mandou lixo recebe o comeco, nao o topo.
    expect(numeroSao(Infinity)).toBe(0);
    expect(numeroSao(-Infinity)).toBe(0);
    expect(numeroSao(-5)).toBe(0);
  });

  it('NaN não escapa por comparação de faixa', () => {
    // `NaN > 0` e `NaN < 0` são AMBOS falsos, então uma checagem escrita só com
    // comparações deixa passar exatamente o valor que mais estraga a tela.
    // Este teste existe para o dia em que alguém "simplificar" `numeroSao`.
    expect(Number.isNaN(numeroSao(NaN))).toBe(false);
  });

  it('preserva valor legítimo', () => {
    expect(numeroSao(1234.5)).toBe(1234.5);
  });
});

describe('recursos', () => {
  it('sai exatamente com as chaves canônicas', () => {
    const r = recursosSaos({ sucata: 10, lixo: 999 } as never);
    expect(Object.keys(r).sort()).toEqual(['cristal', 'nucleo', 'sucata']);
    expect(r.sucata).toBe(10);
  });

  it('chave desconhecida não entra no estado', () => {
    expect('lixo' in recursosSaos({ lixo: 1 } as never)).toBe(false);
  });
});

describe('itens', () => {
  const bom = {
    uid: 'x1', baseId: 'b', slot: 'principal', rarity: 1, ilvl: 10,
    affixes: [], icon: 'i', origin: 0,
  };

  it('aceita uma peça íntegra', () => {
    expect(itemUtilizavel(bom)).toBe(true);
  });

  it('recusa slot que não existe', () => {
    expect(itemUtilizavel({ ...bom, slot: 'bota_magica' })).toBe(false);
  });

  it('recusa ilvl NaN — é ele que faz os atributos virarem NaN', () => {
    expect(itemUtilizavel({ ...bom, ilvl: NaN })).toBe(false);
  });

  it('recusa raridade fora da tabela', () => {
    expect(itemUtilizavel({ ...bom, rarity: 99 })).toBe(false);
  });

  it('recusa afixos que não são lista', () => {
    expect(itemUtilizavel({ ...bom, affixes: 'muitos' })).toBe(false);
  });
});

describe('frota', () => {
  it('descarta casco que não existe no catálogo', () => {
    expect(frotaSa(['aurora1', 'nave_inventada'])).toEqual(['aurora1']);
  });

  it('não repete', () => {
    expect(frotaSa(['aurora1', 'aurora1'])).toEqual(['aurora1']);
  });
});

describe('migrate sanea de ponta a ponta', () => {
  it('save hostil entra são, sem travar o boot', () => {
    const s = migrate(saveBase({
      resources: { sucata: Infinity, nucleo: NaN, cristal: -10 },
      inventory: [
        { uid: 'ok', baseId: 'b', slot: 'principal', rarity: 1, ilvl: 5, affixes: [], icon: 'i', origin: 0 },
        { uid: 'mau', slot: 'inexistente', rarity: 1, ilvl: 5, affixes: [] },
        null,
      ],
      fleet: ['aurora1', 'nave_que_nao_existe'],
      medalhas: Infinity,
    }));

    expect(s, 'save malformado não pode travar o boot').not.toBeNull();
    expect(Number.isFinite(s!.resources.sucata)).toBe(true);
    expect(Number.isFinite(s!.resources.nucleo)).toBe(true);
    expect(s!.resources.cristal).toBeGreaterThanOrEqual(0);
    expect(s!.inventory).toHaveLength(1);
    expect(s!.fleet).not.toContain('nave_que_nao_existe');
    expect(Number.isFinite(s!.medalhas)).toBe(true);
  });
});

describe('a marca de contaminação', () => {
  it('save limpo não nasce marcado', () => {
    expect(migrate(saveBase())?.contaminado).toBe(false);
  });

  it('a marca sobrevive à migração', () => {
    expect(migrate(saveBase({ contaminado: true }))?.contaminado).toBe(true);
  });
});

describe('nenhum caminho de HTML cru', () => {
  /**
   * `h()` aceitava `html:` e jogava em `innerHTML`. Ninguém usava — e é
   * exatamente por isso que dava para remover antes de custar alguma coisa.
   *
   * O teste não é sobre hoje: é sobre o dia em que o placar mostrar um nome
   * escolhido por outro jogador. Aí o sink existir ou não decide se há XSS.
   */
  it('`h()` não tem sink de innerHTML', () => {
    const fonte = readFileSync(join(process.cwd(), 'src/ui/dom.ts'), 'utf8');
    expect(fonte).not.toContain('innerHTML');
  });
});

import { describe, expect, it } from 'vitest';
import { HULLS } from '@data/hulls';
import { LORE_DE_CASCO } from '@data/hulls-lore';

/**
 * "Sempre que criar uma nave, criar a história junto" é uma convenção — e
 * convenção que depende de memória se perde na terceira nave.
 *
 * Este arquivo é a convenção virando obrigação: acrescentar um casco sem lore
 * quebra o build, e a mensagem diz exatamente qual casco falta.
 */

const jogaveis = HULLS.filter((h) => !h.prototype);

describe('lore de casco', () => {
  it('TODO casco jogável tem história e curiosidade', () => {
    const semLore = jogaveis.filter((h) => !LORE_DE_CASCO[h.id]).map((h) => h.id);
    expect(semLore, `cascos sem lore: ${semLore.join(', ')}`).toEqual([]);
  });

  it('nenhum texto está vazio ou é só um resto de espaço', () => {
    for (const h of jogaveis) {
      const lore = LORE_DE_CASCO[h.id]!;
      expect(lore.historia.trim().length, `${h.id}: história vazia`).toBeGreaterThan(40);
      expect(lore.curiosidade.trim().length, `${h.id}: curiosidade vazia`).toBeGreaterThan(20);
    }
  });

  it('não há lore órfã — texto de casco que não existe mais', () => {
    // Apagar um casco e esquecer a lore dele deixa texto morto que ninguém vai
    // ler nem manter, e que engana quem procurar o casco pelo id.
    const ids = new Set(HULLS.map((h) => h.id));
    const orfas = Object.keys(LORE_DE_CASCO).filter((id) => !ids.has(id));
    expect(orfas, `lore sem casco: ${orfas.join(', ')}`).toEqual([]);
  });

  it('a curiosidade não repete a história em outras palavras', () => {
    // Ela é o fato que SOBRA depois da história — o que o jogador repetiria
    // para alguém. Se as duas começam igual, a segunda não acrescentou nada.
    for (const h of jogaveis) {
      const lore = LORE_DE_CASCO[h.id]!;
      const inicio = (t: string) => t.trim().slice(0, 24).toLowerCase();
      expect(inicio(lore.curiosidade), `${h.id}: curiosidade repete a história`)
        .not.toBe(inicio(lore.historia));
    }
  });

  it('cada texto é único — nenhum copiar-e-colar entre cascos', () => {
    const historias = jogaveis.map((h) => LORE_DE_CASCO[h.id]!.historia);
    const curiosidades = jogaveis.map((h) => LORE_DE_CASCO[h.id]!.curiosidade);
    expect(new Set(historias).size).toBe(historias.length);
    expect(new Set(curiosidades).size).toBe(curiosidades.length);
  });
});

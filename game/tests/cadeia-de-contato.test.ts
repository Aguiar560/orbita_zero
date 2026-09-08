import { describe, expect, it } from 'vitest';
import { MISSAO_POR_ID, MISSOES } from '@data/missoes';
import { PERSONAGENS, CONFIANCA_MAX } from '@data/personagens';
import { cadeiaDoContato, confiancaDaCadeia, confiancaDaMissao } from '@data/balance/confianca';

/**
 * A cadeia de um contato é uma LINHA, e a ordem sai dos próprios elos.
 *
 * A primeira tentativa derivava o peso da ordem de declaração no arquivo, e
 * estava errada: as missões de um contato não são escritas em sequência — as
 * sete antigas de Kael Voss estavam espalhadas entre missões de outros
 * contatos, e as novas entraram no fim. O peso saía embaralhado, com
 * "Fronteira Interior" — que vem logo depois de "Batismo de Fogo" na história —
 * em quarto lugar.
 *
 * A ordem verdadeira já existia, escrita nos requisitos. Derivar dali faz uma
 * missão inserida no meio da cadeia acertar o lugar só por declarar o elo.
 */

describe('a cadeia de Kael Voss', () => {
  const cadeia = cadeiaDoContato('char_kael_voss');

  it('é uma linha: cada missão exige exatamente a anterior', () => {
    expect(cadeia.length).toBeGreaterThanOrEqual(15);

    cadeia.forEach((m, i) => {
      if (i === 0) return;
      const elos = (m.requisitos ?? [])
        .filter((r) => r.tipo === 'missaoConcluida')
        .map((r) => (r as { missaoId: string }).missaoId);
      expect(elos, `${m.nome} deveria exigir ${cadeia[i - 1]!.nome}`).toContain(cadeia[i - 1]!.id);
    });
  });

  it('e a confiança sobe do começo ao fim, somando o teto', () => {
    expect(confiancaDaCadeia('char_kael_voss')).toBeCloseTo(CONFIANCA_MAX, 6);
    for (let i = 1; i < cadeia.length; i++) {
      expect(confiancaDaMissao(cadeia[i]!), cadeia[i]!.nome)
        .toBeGreaterThan(confiancaDaMissao(cadeia[i - 1]!));
    }
  });

  it('e termina numa peça exclusiva, uma só', () => {
    /**
     * O prêmio de fechar a cadeia. Uma só: se duas missões da mesma cadeia
     * pagassem peça exclusiva, a última deixaria de ser o fim de alguma coisa.
     */
    const comExclusiva = cadeia.filter((m) => m.recompensaExclusiva);
    expect(comExclusiva).toHaveLength(1);
    expect(comExclusiva[0]!.id).toBe(cadeia[cadeia.length - 1]!.id);
  });
});

describe('as 33 cadeias', () => {
  it('todas têm ao menos 15 missões e fecham no teto de confiança', () => {
    for (const p of PERSONAGENS) {
      const c = cadeiaDoContato(p.id);
      expect(c.length, p.nome).toBeGreaterThanOrEqual(15);
      expect(confiancaDaCadeia(p.id), p.nome).toBeCloseTo(CONFIANCA_MAX, 6);
    }
  });

  it('e a ÚLTIMA missão de cada uma paga a peça do contato', () => {
    /**
     * É o fecho do arco: o guardião entrega o próprio instrumento a quem tomou
     * o lugar dele. Uma cadeia sem isso é quinze missões sem desfecho.
     */
    for (const p of PERSONAGENS) {
      const c = cadeiaDoContato(p.id);
      expect(c[c.length - 1]!.recompensaExclusiva, `${p.nome} termina sem peça`).toBeTruthy();
    }
  });

  it('e peça exclusiva fora do fim só em contrato ESPECIAL', () => {
    /**
     * O Núcleo Ferrugem tem duas: o contrato especial escrito à mão, na posição
     * 2, e a peça de assinatura no fim. É legítimo — contrato especial é uma
     * peça com razão própria —, mas só para quem se declara `especial`.
     *
     * Foi ao montar a cadeia que apareceu o problema de verdade: aquele
     * contrato pedia piso MÍTICO, e na posição 2 de um contato tier 1 isso
     * atropelava a escada de raridade, a fusão e a Provação de uma vez. O piso
     * saiu; quem decide é o tier.
     */
    for (const p of PERSONAGENS) {
      const c = cadeiaDoContato(p.id);
      c.slice(0, -1).filter((m) => m.recompensaExclusiva).forEach((m) => {
        expect(m.tipo, `${m.nome} paga exclusiva no meio sem ser especial`).toBe('especial');
      });
    }
  });

  it('e nenhuma peça exclusiva declara raridade fixa', () => {
    /**
     * O tier do contato decide — Épico até o tier 2, Lendário nos 3 e 4, Mítico
     * no 5. Uma raridade escrita à mão sobrevive a mudanças de tier e vira
     * mentira silenciosa: foi exatamente o que aconteceu com o Núcleo Ferrugem.
     */
    const comPiso = MISSOES
      .filter((m) => m.recompensaExclusiva?.raridadeMin !== undefined)
      .map((m) => m.nome);
    expect(comPiso, `peças com raridade fixa: ${comPiso.join(', ')}`).toEqual([]);
  });
});

describe('toda cadeia do jogo', () => {
  it('não tem elo apontando para missão de OUTRO contato', () => {
    /**
     * Um elo cruzado faria a missão esperar uma entrega que o jogador talvez
     * nunca faça — e faria a ordenação da cadeia ignorar o requisito, porque
     * ela só enxerga as missões do próprio contato.
     */
    const cruzados: string[] = [];
    for (const m of MISSOES) {
      if (!m.giverId) continue;
      for (const r of m.requisitos ?? []) {
        if (r.tipo !== 'missaoConcluida') continue;
        const outra = MISSAO_POR_ID.get(r.missaoId);
        if (outra && outra.giverId && outra.giverId !== m.giverId) {
          cruzados.push(`${m.nome} → ${outra.nome}`);
        }
      }
    }
    expect(cruzados).toEqual([]);
  });

  it('e nenhum elo aponta para missão inexistente', () => {
    // Um id errado travaria a cadeia para sempre, em silêncio.
    const quebrados: string[] = [];
    for (const m of MISSOES) {
      for (const r of m.requisitos ?? []) {
        if (r.tipo === 'missaoConcluida' && !MISSAO_POR_ID.get(r.missaoId)) {
          quebrados.push(`${m.nome} → ${r.missaoId}`);
        }
      }
    }
    expect(quebrados).toEqual([]);
  });

  it('e nenhuma cadeia tem ciclo', () => {
    /**
     * Ciclo é erro de conteúdo, e `cadeiaDoContato` o tolera de propósito —
     * despeja o resto no fim em vez de travar o jogo. O lugar de gritar é aqui.
     *
     * A detecção é simples: se a ordenação topológica devolveu todas, não há
     * ciclo; a função só "despeja" quando não consegue avançar.
     */
    for (const p of PERSONAGENS) {
      const cadeia = cadeiaDoContato(p.id);
      if (cadeia.length < 2) continue;

      const posicao = new Map(cadeia.map((m, i) => [m.id, i]));
      for (const [i, m] of cadeia.entries()) {
        for (const r of m.requisitos ?? []) {
          if (r.tipo !== 'missaoConcluida') continue;
          const antes = posicao.get(r.missaoId);
          if (antes === undefined) continue;
          expect(antes, `${p.nome}: ${m.nome} exige algo que vem depois dela`).toBeLessThan(i);
        }
      }
    }
  });
});

/**
 * Toda tela tem tutorial, e todo tutorial aponta para uma tela.
 *
 * ## Por que isto precisa de teste
 *
 * A regra é "cada tela, ao ser habilitada, tem um tutorial disponível". Ela se
 * quebra do jeito mais silencioso possível: alguém acrescenta um painel, ele
 * aparece na barra de abas, libera numa patente, e simplesmente não explica
 * nada. Ninguém percebe — a tela funciona.
 *
 * O teste torna isso um erro de build. Uma tela nova ou ganha tutorial, ou é
 * declarada como exceção aqui, com o motivo escrito.
 *
 * ## E o contrário também
 *
 * Um tutorial cujo id não casa com painel nenhum é código morto que parece
 * vivo: ele nunca abre, e a única pista é a tela nunca explicar nada. Um erro
 * de digitação no id produz exatamente isso.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { TUTORIAIS, temTutorial } from '@data/tutoriais';

/** Ids declarados pelos painéis, lidos da fonte — é onde eles moram de fato. */
function idsDosPaineis(): string[] {
  const dir = new URL('../src/ui/panels/', import.meta.url);
  const ids: string[] = [];
  for (const arquivo of readdirSync(dir)) {
    if (!arquivo.endsWith('.ts') || arquivo === 'types.ts') continue;
    const m = /^ {2}id = '([^']+)';/m.exec(readFileSync(new URL(arquivo, dir), 'utf8'));
    if (m) ids.push(m[1]!);
  }
  return ids;
}

/**
 * Telas sem tutorial, e por quê.
 *
 * Ficam nomeadas em vez de simplesmente ausentes: uma lista de exceções que
 * ninguém precisa justificar volta a crescer sozinha.
 */
const SEM_TUTORIAL: Readonly<Record<string, string>> = {
  // Os Ajustes SÃO a explicação: cada controle tem rótulo e descrição ao lado,
  // e é de lá que se reabre o passeio de entrada. Um guia sobre a tela de
  // configuração seria configuração sobre configuração.
  ajustes: 'a própria tela já é texto explicativo, e é de onde os guias se reabrem',
  // Ferramenta interna, restrita a contas administrativas. Quem chega nela sabe
  // o que está fazendo — e explicá-la ao jogador comum seria anunciar uma tela
  // que ele não deve abrir.
  laboratorio: 'ferramenta interna, só para conta administrativa',
};

describe('cada tela tem tutorial', () => {
  it('nenhum painel fica sem explicação', () => {
    const faltando = idsDosPaineis()
      .filter((id) => !temTutorial(id) && !(id in SEM_TUTORIAL));
    // A mensagem cita os ids porque o erro chega para quem acabou de criar o
    // painel, e o conserto é acrescentar uma entrada em `TUTORIAIS`.
    expect(faltando, `sem tutorial: ${faltando.join(', ')}`).toEqual([]);
  });

  it('e nenhum tutorial aponta para uma tela que não existe', () => {
    // Erro de digitação no id produz um tutorial que nunca abre, e a única
    // pista seria a tela nunca explicar nada.
    const paineis = new Set(idsDosPaineis());
    const orfaos = Object.keys(TUTORIAIS).filter((id) => !paineis.has(id));
    expect(orfaos, `tutorial sem painel: ${orfaos.join(', ')}`).toEqual([]);
  });
});

describe('a forma de cada tutorial', () => {
  it('começa por um passo SEM alvo, que diz para que a tela serve', () => {
    /**
     * O primeiro passo é a resposta a "o que é isto?", e ela não pertence a
     * nenhum canto da tela. Amarrá-lo a um elemento faria o guia abrir já
     * apontando para um detalhe antes de dizer do que se trata.
     */
    for (const [id, passos] of Object.entries(TUTORIAIS)) {
      expect(passos[0]?.alvo, `${id}: o primeiro passo não pode ter alvo`).toBeUndefined();
    }
  });

  it('tem de três a cinco passos', () => {
    // O limite não é estético. Um passeio longo demais é pulado INTEIRO, e aí
    // o jogador perde também os dois passos que realmente importavam.
    for (const [id, passos] of Object.entries(TUTORIAIS)) {
      expect(passos.length, `${id} tem ${passos.length} passos`).toBeGreaterThanOrEqual(2);
      expect(passos.length, `${id} tem ${passos.length} passos`).toBeLessThanOrEqual(5);
    }
  });

  it('e todo passo tem título e texto', () => {
    for (const [id, passos] of Object.entries(TUTORIAIS)) {
      passos.forEach((p, i) => {
        expect(p.titulo.length, `${id}[${i}] sem título`).toBeGreaterThan(0);
        expect(p.texto.length, `${id}[${i}] sem texto`).toBeGreaterThan(20);
      });
    }
  });
});

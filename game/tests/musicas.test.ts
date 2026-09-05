/**
 * O catálogo de trilhas e a navegação entre faixas.
 *
 * ## O que é testável aqui, e o que não é
 *
 * `MusicaDeFundo` é `HTMLAudioElement` puro: a suíte roda em Node, sem `Audio`,
 * então tocar de verdade não se testa aqui — foi verificado no navegador.
 *
 * O que se testa é a parte que decide QUAL faixa toca, que é dado puro e é
 * também onde os erros silenciosos moram: um id repetido faz duas faixas
 * competirem pela mesma entrada do save, e uma navegação que não circula deixa
 * o jogador preso na última.
 */

import { describe, expect, it } from 'vitest';

import { MUSICAS, MUSICA_POR_ID, musicaAnterior, musicaDaGalaxia, proximaMusica } from '@data/musicas';

describe('o catálogo', () => {
  it('tem faixa', () => {
    expect(MUSICAS.length).toBeGreaterThan(0);
  });

  it('e nenhum id se repete', () => {
    // Id repetido faz duas faixas disputarem a mesma entrada de `settings`, e o
    // sintoma seria "escolhi uma e voltou a outra".
    expect(new Set(MUSICAS.map((m) => m.id)).size).toBe(MUSICAS.length);
  });

  it('todas apontam para um arquivo servido', () => {
    for (const m of MUSICAS) {
      expect(m.arquivo, `${m.id}`).toMatch(/^assets\/musica\/.+\.mp3$/);
      expect(m.titulo.length).toBeGreaterThan(0);
      expect(m.artista.length).toBeGreaterThan(0);
    }
  });
});

describe('a navegação circula', () => {
  it('a próxima da última é a primeira', () => {
    // Sem isto o jogador chega ao fim da lista e o botão para de responder.
    const ultima = MUSICAS[MUSICAS.length - 1]!;
    expect(proximaMusica(ultima.id).id).toBe(MUSICAS[0]!.id);
  });

  it('e a anterior da primeira é a última', () => {
    expect(musicaAnterior(MUSICAS[0]!.id).id).toBe(MUSICAS[MUSICAS.length - 1]!.id);
  });

  it('avança uma de cada vez', () => {
    for (let i = 0; i < MUSICAS.length - 1; i++) {
      expect(proximaMusica(MUSICAS[i]!.id).id).toBe(MUSICAS[i + 1]!.id);
    }
  });
});

describe('id desconhecido não trava o som', () => {
  /**
   * O caso do save antigo, ou da faixa retirada do catálogo. A regra é cair na
   * primeira — nunca ficar sem música, porque o jogador não teria como saber
   * que a preferência guardada é que está impedindo o som.
   */
  it('a próxima de um id que não existe é a primeira', () => {
    expect(proximaMusica('faixa_que_nao_existe').id).toBe(MUSICAS[0]!.id);
    expect(proximaMusica(undefined).id).toBe(MUSICAS[0]!.id);
  });

  it('e o mapa simplesmente não o encontra', () => {
    expect(MUSICA_POR_ID.get('faixa_que_nao_existe')).toBeUndefined();
    expect(MUSICA_POR_ID.get(MUSICAS[0]!.id)).toBeDefined();
  });
});

describe('cada galáxia começa com uma faixa', () => {
  it('galáxias vizinhas soam diferente', () => {
    // O ponto do pedido: entrar numa galáxia nova troca a trilha. Com menos
    // faixas que galáxias elas se repetem, mas nunca em sequência.
    for (let g = 0; g < MUSICAS.length * 3; g++) {
      expect(musicaDaGalaxia(g).id, `galáxia ${g}`).not.toBe(musicaDaGalaxia(g + 1).id);
    }
  });

  it('e a mesma galáxia soa sempre igual', () => {
    // Determinismo é o que amarra música a LUGAR. Sorteio faria a galáxia 3
    // soar diferente a cada visita, e aí a trilha não diria nada sobre onde se
    // está.
    for (const g of [0, 1, 7, 29]) {
      expect(musicaDaGalaxia(g).id).toBe(musicaDaGalaxia(g).id);
      expect(musicaDaGalaxia(g).id).toBe(MUSICAS[g % MUSICAS.length]!.id);
    }
  });

  it('índice negativo ou quebrado não derruba o som', () => {
    expect(musicaDaGalaxia(-5).id).toBe(MUSICAS[0]!.id);
    expect(musicaDaGalaxia(2.7).id).toBe(MUSICAS[2 % MUSICAS.length]!.id);
  });
});

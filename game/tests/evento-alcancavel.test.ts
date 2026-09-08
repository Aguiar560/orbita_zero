import { describe, expect, it } from 'vitest';
import { EVENTOS, eventosDoRitmo } from '@data/eventos';
import { ELEMENTS } from '@data/elements';
import { buildEncounter, WAVES_PER_SECTOR } from '@sim/progression';
import { createState } from '@sim/state';

/**
 * Todo objetivo de evento tem de ser ALCANÇÁVEL, e o teste mede — não acredita.
 *
 * A primeira versão dos diários pedia "abater 60 inimigos de fogo" a partir do
 * setor 1. Dois erros, os dois encontrados quando o Rafael perguntou quantos
 * inimigos de fogo morrem numa galáxia:
 *
 * 1. **60 era um quarto de um setor.** Uma passada de galáxia mata de 3.400 a
 *    5.100 inimigos; numa galáxia que tem o elemento, morrem de 100 a 145 dele
 *    por setor. Um diário deve pedir uns dois setores.
 *
 * 2. **O de gelo era IMPOSSÍVEL.** Gelo só aparece em quantidade a partir da
 *    galáxia 3, e o evento liberava no setor 1. O jogador aceitaria a diretiva
 *    e nunca veria o contador andar.
 *
 * Este arquivo percorre os encontros de verdade — os mesmos que o jogo monta —
 * e recusa objetivo que não caiba no mundo.
 */

const state = createState(1);

/** Quantas unidades de cada elemento morrem numa galáxia, de verdade. */
function porElementoNaGalaxia(g: number): Map<string, number> {
  const conta = new Map<string, number>();
  for (let s = g * 10 + 1; s <= g * 10 + 10; s++) {
    for (let w = 1; w <= WAVES_PER_SECTOR; w++) {
      for (const { def, count } of buildEncounter(state, s, w).squad) {
        conta.set(def.element, (conta.get(def.element) ?? 0) + count);
      }
    }
  }
  return conta;
}

/** A partir do setor `min`, quantas unidades daquele elemento existem. */
function disponivelApartirDe(elemento: string, setorMinimo: number): number {
  const primeiraGalaxia = Math.floor((setorMinimo - 1) / 10);
  let total = 0;
  for (let g = primeiraGalaxia; g < 30; g++) total += porElementoNaGalaxia(g).get(elemento) ?? 0;
  return total;
}

describe('os diários elementais', () => {
  it('cada um abre onde o elemento dele EXISTE', () => {
    /**
     * O teste que o gelo não passava. Ele exige mais que "existe": exige que
     * haja uma galáxia inteira com pelo menos o alvo do evento a partir do
     * setor mínimo — senão o jogador precisaria varrer meia campanha para um
     * evento que dura 24 horas.
     */
    for (const e of eventosDoRitmo('diario')) {
      const elemento = e.objetivo.filtro?.elemento;
      expect(elemento, `${e.id} não filtra elemento`).toBeTruthy();

      const primeiraGalaxia = Math.floor((e.setorMinimo - 1) / 10);
      const naPrimeira = porElementoNaGalaxia(primeiraGalaxia).get(elemento!) ?? 0;

      expect(
        naPrimeira,
        `${e.id}: a galáxia ${primeiraGalaxia + 1} tem só ${naPrimeira} de ${elemento}, e o alvo é ${e.objetivo.alvo}`,
      ).toBeGreaterThanOrEqual(e.objetivo.alvo);
    }
  });

  it('e o alvo vale cerca de dois setores, nem um quarto nem uma galáxia', () => {
    /**
     * A faixa é larga de propósito — os elementos têm densidades diferentes, e
     * apertar isso exigiria um alvo por elemento calibrado à mão. O que o teste
     * impede é o extremo: 60 (um quarto de setor) e 2.000 (meia galáxia).
     */
    for (const e of eventosDoRitmo('diario')) {
      expect(e.objetivo.alvo, `${e.id} é fácil demais`).toBeGreaterThanOrEqual(150);
      expect(e.objetivo.alvo, `${e.id} é longo demais para 24h`).toBeLessThanOrEqual(400);
    }
  });

  it('e há um diário por elemento do jogo', () => {
    const cobertos = new Set(eventosDoRitmo('diario').map((e) => e.objetivo.filtro?.elemento));
    for (const el of ELEMENTS) {
      expect(cobertos.has(el.id), `nenhum diário pede ${el.id}`).toBe(true);
    }
  });
});

describe('todo evento, de qualquer ritmo', () => {
  it('tem alvo positivo e setor mínimo dentro da campanha', () => {
    for (const e of EVENTOS) {
      expect(e.objetivo.alvo, e.id).toBeGreaterThan(0);
      expect(e.setorMinimo, e.id).toBeGreaterThanOrEqual(1);
      expect(e.setorMinimo, `${e.id} exige setor além da campanha`).toBeLessThanOrEqual(300);
    }
  });

  it('e o que pede abate elemental tem o elemento disponível de sobra', () => {
    // Fora do diário também: um semanal que filtre elemento cai na mesma
    // armadilha, e a próxima pessoa a escrever um não vai lembrar disso.
    for (const e of EVENTOS) {
      const elemento = e.objetivo.fato === 'abate' ? e.objetivo.filtro?.elemento : undefined;
      if (!elemento) continue;
      const disponivel = disponivelApartirDe(elemento, e.setorMinimo);
      expect(
        disponivel,
        `${e.id}: só ${disponivel} de ${elemento} a partir do setor ${e.setorMinimo}, alvo ${e.objetivo.alvo}`,
      ).toBeGreaterThan(e.objetivo.alvo * 5);
    }
  });
});

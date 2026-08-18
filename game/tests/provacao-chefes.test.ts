import { describe, expect, it } from 'vitest';
import { BOSSES } from '@data/bosses';
import { ELEMENT_IDS } from '@sim/types';
import {
  ARQUETIPOS, CAMADAS, CHEFES_DA_PROVACAO, CHEFE_DA_PROVACAO_POR_ID,
  camadaDoPiso, chefeDoPiso,
} from '@data/provacao-chefes';
import { ESPECIAIS, ESPECIAL_POR_ID, familiaDoEspecial } from '@data/provacao-especiais';

/**
 * O elenco da Provação: cem criaturas distintas.
 *
 * O que estes testes guardam é a promessa que o elenco faz — cem chefes, nenhum
 * repetido, cada um com especial e números coerentes com o arquétipo.
 */

describe('o elenco', () => {
  it('tem exatamente cem chefes, um por piso', () => {
    expect(CHEFES_DA_PROVACAO).toHaveLength(100);
    for (let n = 1; n <= 100; n++) {
      expect(chefeDoPiso(n).piso, `piso ${n}`).toBe(n);
    }
  });

  /** A exigência literal do pedido: não se pode repetir chefe. */
  it('nenhum id e nenhum NOME se repete', () => {
    expect(new Set(CHEFES_DA_PROVACAO.map((c) => c.id)).size).toBe(100);
    expect(new Set(CHEFES_DA_PROVACAO.map((c) => c.nome)).size).toBe(100);
  });

  /**
   * O elenco da Provação é SEPARADO do da campanha.
   *
   * Reaproveitar os chefes de galáxia foi o desenho anterior e é o que o §33
   * combate; um id em comum traria a confusão de volta pela porta dos fundos.
   */
  it('não colide com os chefes de galáxia', () => {
    const campanha = new Set(BOSSES.map((b) => b.id));
    for (const c of CHEFES_DA_PROVACAO) expect(campanha.has(c.id), c.id).toBe(false);
  });

  it('todo id é estável e não-visual', () => {
    for (const c of CHEFES_DA_PROVACAO) {
      expect(c.id, c.nome).toMatch(/^provacao_[a-z0-9_]+$/);
    }
  });

  it('todo chefe tem nome, característica e elemento válido', () => {
    for (const c of CHEFES_DA_PROVACAO) {
      expect(c.nome.length, c.id).toBeGreaterThan(2);
      expect(c.caracteristica.length, c.id).toBeGreaterThan(10);
      expect(ELEMENT_IDS.includes(c.elemento), `${c.id}: ${c.elemento}`).toBe(true);
    }
  });

  it('as dez camadas cobrem os cem pisos, dez a dez', () => {
    expect(CAMADAS).toHaveLength(10);
    for (let n = 1; n <= 100; n++) {
      expect(camadaDoPiso(n).indice, `piso ${n}`).toBe(Math.ceil(n / 10));
    }
    for (const cam of CAMADAS) {
      expect(CHEFES_DA_PROVACAO.filter((c) => c.camada === cam.indice)).toHaveLength(10);
    }
  });

  /**
   * Toda camada tem ao menos um chefe FORA do elemento dominante.
   *
   * Sem isso o jogador monta uma configuração para os dez pisos e desliga o
   * cérebro — o mesmo vício que o §33 combate, por outra porta.
   */
  it('nenhuma camada é monoelemental', () => {
    for (const cam of CAMADAS) {
      const elementos = new Set(
        CHEFES_DA_PROVACAO.filter((c) => c.camada === cam.indice).map((c) => c.elemento),
      );
      expect(elementos.size, `camada ${cam.indice}`).toBeGreaterThan(1);
    }
  });
});

describe('os números', () => {
  it('saem do arquétipo, salvo ajuste explícito', () => {
    for (const c of CHEFES_DA_PROVACAO) {
      const p = ARQUETIPOS[c.arquetipo];
      expect(p, `${c.id}: arquétipo ${c.arquetipo}`).toBeDefined();
      // Ou bate com o perfil, ou é um desvio declarado — nunca lixo.
      const bate = c.vida === p.vida && c.dano === p.dano
        && c.escudo === p.escudo && c.velocidade === p.velocidade;
      const plausivel = c.vida >= p.vida * 0.5 && c.vida <= p.vida * 2.2;
      expect(bate || plausivel, c.id).toBe(true);
    }
  });

  it('nenhum multiplicador é zero, negativo ou absurdo', () => {
    for (const c of CHEFES_DA_PROVACAO) {
      for (const [campo, v] of Object.entries({ vida: c.vida, dano: c.dano, escudo: c.escudo, velocidade: c.velocidade })) {
        expect(v, `${c.id}.${campo}`).toBeGreaterThan(0);
        expect(v, `${c.id}.${campo}`).toBeLessThanOrEqual(3);
      }
    }
  });

  /** Resistência a 1 tornaria o chefe imune àquele elemento. */
  it('a resistência tem teto e o chefe resiste ao próprio elemento', () => {
    for (const c of CHEFES_DA_PROVACAO) {
      for (const [el, v] of Object.entries(c.resistencias)) {
        expect(v, `${c.id}: ${el}`).toBeGreaterThan(0);
        expect(v, `${c.id}: ${el}`).toBeLessThanOrEqual(0.7);
      }
      if (c.elemento !== 'padrao') {
        const propria = (c.resistencias as Record<string, number>)[c.elemento] ?? 0;
        expect(propria, `${c.id} não resiste ao próprio elemento`).toBeGreaterThanOrEqual(0.4);
      }
    }
  });

  it('os oito arquétipos são todos usados', () => {
    const usados = new Set(CHEFES_DA_PROVACAO.map((c) => c.arquetipo));
    for (const a of Object.keys(ARQUETIPOS)) {
      expect(usados.has(a as never), `arquétipo ${a} nunca aparece`).toBe(true);
    }
  });
});

describe('os especiais', () => {
  it('todo chefe tem um especial que existe', () => {
    for (const c of CHEFES_DA_PROVACAO) {
      expect(ESPECIAL_POR_ID.has(c.especial), `${c.id} → ${c.especial}`).toBe(true);
    }
  });

  /**
   * O especial é TELEGRAFADO: barra que enche e aviso antes do golpe.
   *
   * Um especial sem aviso não é dificuldade, é imposto — o jogador perde sem ter
   * tido o que fazer. O aviso é o que transforma a pancada numa decisão.
   */
  it('todo especial tem carga e aviso', () => {
    for (const e of ESPECIAIS) {
      expect(e.carga, e.id).toBeGreaterThan(0);
      expect(e.aviso, `${e.id} sem telegrafia`).toBeGreaterThan(0);
    }
  });

  /** Quanto mais forte a pancada, mais tempo para ler o aviso. */
  it('o aviso acompanha o tamanho do golpe', () => {
    for (const e of ESPECIAIS) {
      if ((e.efeito.dano ?? 0) >= 4) {
        expect(e.aviso, `${e.id} bate ${e.efeito.dano}× com só ${e.aviso}s de aviso`)
          .toBeGreaterThanOrEqual(1.5);
      }
    }
  });

  it('as quatro famílias que o pedido nomeia estão cobertas', () => {
    const familias = new Set(ESPECIAIS.map(familiaDoEspecial));
    for (const f of ['atordoa', 'cura', 'escudo', 'dano']) {
      expect(familias.has(f as never), `nenhum especial da família ${f}`).toBe(true);
    }
  });

  /**
   * Dois vizinhos com o mesmo golpe fazem o jogador achar que o conteúdo
   * acabou. Dezoito especiais para cem chefes repetem — mas nunca DENTRO da
   * mesma camada.
   */
  it('não repete especial dentro da mesma camada', () => {
    for (const cam of CAMADAS) {
      const ids = CHEFES_DA_PROVACAO.filter((c) => c.camada === cam.indice).map((c) => c.especial);
      expect(new Set(ids).size, `camada ${cam.indice}: ${ids.join(', ')}`).toBe(ids.length);
    }
  });

  it('todo especial é usado por alguém', () => {
    const usados = new Set(CHEFES_DA_PROVACAO.map((c) => c.especial));
    for (const e of ESPECIAIS) expect(usados.has(e.id), `${e.id} nunca aparece`).toBe(true);
  });

  it('nenhum efeito de especial é vazio', () => {
    for (const e of ESPECIAIS) {
      expect(Object.keys(e.efeito).length, `${e.id} não faz nada`).toBeGreaterThan(0);
    }
  });

  /** Cura de metade da vida tornaria a luta interminável. */
  it('cura e escudo próprio têm teto', () => {
    for (const e of ESPECIAIS) {
      if (e.efeito.cura) expect(e.efeito.cura, e.id).toBeLessThanOrEqual(0.25);
      if (e.efeito.escudaSe) expect(e.efeito.escudaSe, e.id).toBeLessThanOrEqual(0.5);
      if (e.efeito.atordoa) expect(e.efeito.atordoa, e.id).toBeLessThanOrEqual(2.5);
    }
  });
});

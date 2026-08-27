/**
 * A arte dos cem chefes da Provação.
 *
 * Antes eram seis sprites de CENÁRIO em ciclo — torre de reator, anel, rocha.
 * Dois defeitos numa constante só: o piso 7 e o piso 13 mostravam a mesma
 * torre, e a torre não tinha relação com o elemento anunciado ao lado dela. Um
 * chefe de gelo com arte de reator em chamas desmente a própria ficha.
 */

import { describe, expect, it } from 'vitest';

import { PROVACAO_PISOS } from '@data/provacao';
import { CHEFES_DA_PROVACAO, chefeDoPiso } from '@data/provacao-chefes';
import { ELEMENTS } from '@data/elements';

/** O elemento que a arte de cada chefe representa, pela pasta de origem. */
const ELEMENTO_DA_ARTE: Readonly<Record<string, string>> = {
  tita_rochoso: 'padrao', almirante_argenteo: 'padrao', escaravelho_khepri: 'padrao',
  nucleo_ferrugem: 'fogo', mina_prima: 'fogo', heliarca_nove: 'fogo',
  fundidor_asterion: 'fogo', martelo_antares: 'fogo',
  destroco_vivo: 'gelo', arquiteto: 'gelo', marechal_nival: 'gelo',
  leviata_tetis: 'gelo', soberano_caelum: 'gelo',
  anel_kessler: 'cosmico', obelisco: 'cosmico', vertebrador: 'cosmico',
  regente_sem_rosto: 'cosmico', refracao_eos: 'cosmico', janus_bifronte: 'cosmico',
  umbra_terminal: 'cosmico',
  sentinela_vazia: 'raio', sereia_ions: 'raio', terminal_zero: 'raio', gume_negro: 'raio',
  colmeia_verdante: 'quimico', devorador: 'quimico', catedral_corrosao: 'quimico',
  lazaro_refeito: 'quimico', tecela_nyx: 'quimico', icaro_coletivo: 'quimico',
};

describe('arte dos chefes da Provação', () => {
  it('todo piso aponta para arte de chefe', () => {
    for (let piso = 1; piso <= PROVACAO_PISOS; piso++) {
      const { sprite } = chefeDoPiso(piso);
      expect(sprite, `piso ${piso}`).toMatch(/^chefe\//);
      // Nenhuma chave emprestada de cenário: era daí que vinha a torre de
      // reator servindo de chefe de gelo.
      expect(sprite.startsWith('prop/'), `piso ${piso} usa cenário`).toBe(false);
    }
  });

  it('a arte concorda com o elemento do chefe', () => {
    // É a afirmação que importa: o jogador vê o ícone do elemento e a nave lado
    // a lado, e uma desmentindo a outra é pior que arte repetida.
    const divergentes: string[] = [];
    for (let piso = 1; piso <= PROVACAO_PISOS; piso++) {
      const c = chefeDoPiso(piso);
      const arte = c.sprite.replace('chefe/', '');
      const elementoDaArte = ELEMENTO_DA_ARTE[arte];
      expect(elementoDaArte, `arte desconhecida no piso ${piso}: ${arte}`).toBeDefined();
      if (elementoDaArte !== c.elemento) {
        divergentes.push(`piso ${piso}: chefe ${c.elemento}, arte ${elementoDaArte}`);
      }
    }
    expect(divergentes, divergentes.slice(0, 5).join(' · ')).toEqual([]);
  });

  it('usa muito mais que as seis artes de antes', () => {
    const usadas = new Set(CHEFES_DA_PROVACAO.map((c) => c.sprite));
    // Trinta artes para cem pisos ainda repete três ou quatro vezes cada uma —
    // a saída definitiva é mais arte, não mais código. O que não pode voltar é
    // o ciclo de seis.
    expect(usadas.size).toBeGreaterThanOrEqual(24);
  });

  it('o mesmo piso mostra sempre a mesma nave', () => {
    // A escolha vem do número do piso, não de sorteio: um chefe que troca de
    // cara a cada abertura da tela não é um chefe, é ruído.
    for (const piso of [1, 37, 64, 100]) {
      expect(chefeDoPiso(piso).sprite).toBe(chefeDoPiso(piso).sprite);
      expect(chefeDoPiso(piso).sprite).toBe(CHEFES_DA_PROVACAO[piso - 1]!.sprite);
    }
  });

  it('todo elemento do jogo tem arte', () => {
    // Se um elemento ficasse sem grupo, a busca cairia no neutro e aquela
    // camada inteira apareceria cinza sem ninguém notar.
    const comArte = new Set(Object.values(ELEMENTO_DA_ARTE));
    for (const e of ELEMENTS) {
      expect(comArte.has(e.id), `elemento sem arte de chefe: ${e.id}`).toBe(true);
    }
  });
});

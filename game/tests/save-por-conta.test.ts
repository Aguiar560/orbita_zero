import { describe, expect, it, beforeEach } from 'vitest';
import {
  apagarSaveSemConta, createState, definirCofre, lerSaveSemConta,
  loadFromStorage, SAVE_KEY, saveToStorage, usarSlot,
} from '@sim/state';

/**
 * Cada conta tem o próprio save NESTE navegador.
 *
 * Havia uma chave só para todo mundo. Duas pessoas no mesmo computador
 * dividiam a mesma partida: quem entrasse depois encontrava a do outro, e quem
 * gravasse por último apagava a do primeiro. Num alfa em que amigos testam na
 * mesma máquina, esse não é o caso raro — é o comum.
 *
 * Houve uma tentativa anterior de resolver isso PERGUNTANDO ao jogador se a
 * partida encontrada era dele. Não serve: a pergunta administra o vazamento em
 * vez de fechá-lo, e continua expondo a partida de uma pessoa a outra. O que
 * fecha é o save deixar de ser compartilhado.
 *
 * Estes testes usam `definirCofre`, que existe para o Worker e para testar sem
 * navegador — então o isolamento é exercitado de verdade, e não lido na fonte.
 */

function cofreDeTeste(): Map<string, string> {
  const mapa = new Map<string, string>();
  definirCofre({
    ler: (c) => mapa.get(c) ?? null,
    gravar: (c, v) => { mapa.set(c, v); },
    apagar: (c) => { mapa.delete(c); },
  });
  return mapa;
}

/** Um save reconhecível, para saber de quem é o que voltou. */
function partida(setor: number, minutos: number) {
  const s = createState(1, 'piloto_vektor');
  s.run.sector = setor;
  s.playtime = minutos * 60;
  return s;
}

describe('o save local, por conta', () => {
  let mapa: Map<string, string>;
  beforeEach(() => { mapa = cofreDeTeste(); usarSlot(''); });

  it('uma conta não enxerga o save da outra', () => {
    usarSlot('ana');
    saveToStorage(partida(40, 300));

    usarSlot('bruno');
    expect(loadFromStorage()).toBeNull();
  });

  it('e gravar por uma não apaga o da outra', () => {
    /**
     * A metade destrutiva do defeito. Antes as duas escreviam na mesma chave,
     * então a segunda pessoa a jogar apagava a partida da primeira sem que
     * ninguém percebesse — não havia nem conflito visível, só perda.
     */
    usarSlot('ana');
    saveToStorage(partida(40, 300));

    usarSlot('bruno');
    saveToStorage(partida(2, 5));

    usarSlot('ana');
    expect(loadFromStorage()?.state.run.sector).toBe(40);

    usarSlot('bruno');
    expect(loadFromStorage()?.state.run.sector).toBe(2);
  });

  it('e quem está sem conta continua na chave antiga', () => {
    /**
     * Não é detalhe: mudar a chave do save sem conta apagaria, na prática, a
     * partida de quem já jogava sem entrar. Ela fica exatamente onde estava.
     */
    usarSlot('');
    saveToStorage(partida(7, 60));
    expect(mapa.has(SAVE_KEY)).toBe(true);
    expect([...mapa.keys()]).toEqual([SAVE_KEY]);
  });

  it('e a conta enxerga a partida sem conta — mas só para adotar', () => {
    /**
     * O único caso legítimo de herança: a pessoa jogou sem entrar, gostou, e
     * criou uma conta. Sem isto, criar a conta jogaria fora o que ela acabou
     * de fazer.
     */
    usarSlot('');
    saveToStorage(partida(9, 120));

    usarSlot('ana');
    expect(loadFromStorage()).toBeNull();          // o slot dela está vazio
    expect(lerSaveSemConta()?.run.sector).toBe(9); // mas a oferta existe
  });

  it('e a partida adotada some, para não ser oferecida à próxima pessoa', () => {
    /**
     * Uma partida sem dono passa a ter um. Deixá-la para trás faria a próxima
     * conta criada nesta máquina receber a mesma oferta — que é exatamente a
     * confusão entre pessoas que este arquivo fecha.
     */
    usarSlot('');
    saveToStorage(partida(9, 120));

    usarSlot('ana');
    apagarSaveSemConta();

    usarSlot('bruno');
    expect(lerSaveSemConta()).toBeNull();
  });

  it('e estando SEM conta não há o que adotar: o save já está aberto', () => {
    usarSlot('');
    saveToStorage(partida(9, 120));
    expect(lerSaveSemConta()).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { casarCascoComAFrota, createState } from '@sim/state';
import { montarEstado, type DadosDoServidor } from '../server/src/estado';
import { HULLS } from '@data/hulls';

/**
 * Qual nave está EM CAMPO é do servidor, e não do save.
 *
 * ## Por que isto mudou
 *
 * A tabela `frota` responde "quais cascos são desta pessoa". Ela nunca
 * respondeu "qual deles está em campo" — isso vivia só no `GameState`. E o save
 * que sobe para a nuvem tem a frota ARRANCADA (`semODinheiro`), porque casco é
 * poder e a lista não pode ser escrita pelo cliente.
 *
 * O resultado, relatado pelo Rafael em 08/09: "sempre que atualizo a página,
 * volta pra nave núcleo vektor". A regra "casco em campo tem de estar na frota"
 * era cobrada contra uma frota que chegava vazia por construção — e depois,
 * contra uma frota do servidor que legitimamente não continha a nave que ele
 * pilotava, porque ele a usava pelo MODO DE TESTE.
 */

const casco = HULLS[0]!.id;
const outro = HULLS.find((h) => h.id !== casco)!.id;

const base = (extra: Partial<DadosDoServidor> = {}): DadosDoServidor => ({
  saldos: { sucata: 0, nucleo: 0, cristal: 0 },
  xp: 0, nivel: 1, matriz: [], melhorSetor: 10,
  materiais: {}, naves: {}, frota: [casco, outro], itens: [],
  ...extra,
});

describe('a regra "casco em campo tem de estar na frota"', () => {
  it('não vale no modo de teste, porque lá a frota é o catálogo inteiro', () => {
    /**
     * `selectHull` pergunta a `frotaDisponivel`, que devolve todos os cascos no
     * modo de teste. Esta função perguntava só a `state.fleet`. Duas regras
     * para a mesma pergunta: o admin escolhia uma nave, a tela aceitava, e a
     * primeira sincronização a tirava dele em silêncio.
     */
    const s = createState(1);
    s.fleet = [casco];
    s.hull = outro;
    s.settings.testMode = true;

    casarCascoComAFrota(s);
    expect(s.hull, 'o modo de teste deixa pilotar o que não é seu — de propósito')
      .toBe(outro);
  });

  it('mas continua valendo fora dele', () => {
    // O outro lado: sem esta asserção o conserto viraria um buraco, e bastaria
    // editar `hull` no save para voar com qualquer casco do jogo.
    const s = createState(1);
    s.fleet = [casco];
    s.hull = outro;
    s.settings.testMode = false;

    casarCascoComAFrota(s);
    expect(s.hull).toBe(casco);
  });
});

describe('o casco guardado no servidor', () => {
  it('decide a ausência quando o cliente não informa nada', () => {
    /**
     * Antes só havia duas origens: o que o cliente informava e o primeiro da
     * frota. Quem abrisse o jogo depois de dias — justamente o caso da
     * ausência — caía no primeiro da frota, que é quase sempre o casco do
     * piloto. É a nave errada farmando as horas todas.
     */
    const e = montarEstado(base({ cascoEmCampo: outro }), {});
    expect(e.hull).toBe(outro);
  });

  it('e o que o cliente informa vence, porque é a intenção mais recente', () => {
    // Ele pode ter trocado de nave neste boot, antes de a troca ser drenada.
    const e = montarEstado(base({ cascoEmCampo: outro }), { hull: casco });
    expect(e.hull).toBe(casco);
  });

  it('mas nenhuma das duas passa por cima da frota', () => {
    // A conferência que já existia não pode ter se perdido: casco que não é da
    // pessoa é troca de atributos de graça.
    const alheio = HULLS.find((h) => h.id !== casco && h.id !== outro)!.id;
    const e = montarEstado(base({ cascoEmCampo: alheio }), { hull: alheio });
    expect(e.hull).toBe(casco);
    expect(e.fleet).not.toContain(alheio);
  });

  it('e vazio significa "nunca escolheu", não um casco chamado ""', () => {
    // Save de antes da coluna. Cair na frota é o comportamento de sempre.
    const e = montarEstado(base({ cascoEmCampo: '' }), {});
    expect(e.hull).toBe(casco);
  });
});

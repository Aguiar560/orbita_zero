import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { BALDES, podeUsar, type Balde, type NomeDeBalde } from '../server/src/ritmo';

/**
 * O limitador de ritmo tem de caber o jogo REAL e recusar o laço.
 *
 * ## O defeito que isto pega
 *
 * O balde nasceu em 03/09 chamado `carteira`, dimensionado para UMA rota: um
 * depósito por setor, ~20 por hora. Foram sendo penduradas nele mais cinco —
 * inventário, lote, progressão, missões, ausência — e mais três ações do
 * jogador: fundir, comprar casco, comprar passe. O nome ficou; o
 * dimensionamento também.
 *
 * O resultado apareceu em 08/09 como **"clico em FABRICAR e não acontece
 * nada"**. O anel tinha dez peças, os núcleos estavam lá, o botão estava aceso
 * — e a volta era `rapido_demais`, porque o fim de setor tinha acabado de
 * levar quatro fichas e o boot antes dele, seis.
 *
 * ## A separação que isto fixa
 *
 * Sincronização de fundo e ação deliberada são de naturezas opostas. A
 * primeira é automática e tolerante: recusada, tenta de novo e ninguém vê. A
 * segunda acontece com o jogador olhando: recusada, é um botão que não
 * funciona. Dividindo balde, a segunda paga pela primeira — e paga justamente
 * no pior momento, porque o jogador abre a Fabricação logo depois de um setor
 * cair, que é quando as peças chegam.
 */

const cheio = (): Balde | null => null;

/** Gasta `n` fichas em sequência, no mesmo instante. Devolve quantas passaram. */
function rajada(nome: NomeDeBalde, n: number, agora = 1_000_000): number {
  let balde: Balde | null = cheio();
  let passaram = 0;
  for (let i = 0; i < n; i++) {
    const v = podeUsar(nome, balde, agora);
    if (!v.pode) break;
    passaram++;
    balde = { fichas: v.fichasRestantes, em: agora };
  }
  return passaram;
}

/** Quantas rotas de fundo disparam juntas no boot, contadas em `Game.boot`. */
const ROTAS_NO_BOOT = 6;
/** E no fim de setor, contadas em `aoFecharSetor`. */
const ROTAS_NO_SETOR = 4;

describe('o balde da sincronização de fundo', () => {
  it('cabe um boot inteiro sem recusar nada', () => {
    // ausência, carteira, lote, inventário, progresso, missões — todas de uma
    // vez, no primeiro segundo. Recusar aqui deixa o espelho de alguma delas
    // parado, e o sintoma é sempre "sumiu", nunca "falhou".
    expect(rajada('sincronia', ROTAS_NO_BOOT)).toBe(ROTAS_NO_BOOT);
  });

  it('e cabe DOIS boots seguidos — quem testa recarrega a página', () => {
    /**
     * Era aqui que quebrava. Com capacidade 6, o segundo boot dentro de meio
     * minuto era recusado em bloco, e o inventário ficava mostrando o save
     * local enquanto o servidor tinha outra coisa.
     */
    expect(rajada('sincronia', ROTAS_NO_BOOT * 2)).toBe(ROTAS_NO_BOOT * 2);
  });

  it('e o ritmo de um setor cabe com folga sobre o refil', () => {
    // Um setor leva ~3 min e gasta 4 fichas. O refil precisa repor isso muito
    // antes do setor seguinte, senão a folga se esgota ao longo da sessão.
    const reposto = 180 / BALDES.sincronia.refil;
    expect(reposto).toBeGreaterThan(ROTAS_NO_SETOR);
  });

  it('mas ainda recusa um laço em série', () => {
    // A defesa continua existindo: o estouro é finito, e um cliente que chama
    // a rota em série bate na parede na mesma hora.
    expect(rajada('sincronia', 100)).toBe(BALDES.sincronia.capacidade);
  });
});

describe('o balde da ação deliberada', () => {
  it('não é o mesmo da sincronização — é essa a correção', () => {
    /**
     * Se um dia alguém apontar `/sintetizar` de volta para o balde de fundo,
     * o defeito volta inteiro: FABRICAR aceso e recusado logo depois de um
     * setor. O teste guarda a separação, não os números.
     */
    expect(Object.keys(BALDES)).toContain('acao');
    expect(BALDES.acao).not.toBe(BALDES.sincronia);
  });

  it('e uma sessão de fusões seguidas passa', () => {
    // Fundir três vezes em sequência é uso normal de quem juntou trinta peças.
    expect(rajada('acao', 3)).toBe(3);
  });

  it('e o laço continua sendo recusado', () => {
    expect(rajada('acao', 100)).toBe(BALDES.acao.capacidade);
  });

  it('e a ficha volta em segundos, não em minutos', () => {
    // Recusar é aceitável; recusar por dois minutos numa ação que o jogador
    // está olhando não é.
    const vazio: Balde = { fichas: 0, em: 1_000_000 };
    const v = podeUsar('acao', vazio, 1_000_000);
    expect(v.pode).toBe(false);
    if (!v.pode) expect(v.esperar).toBeLessThanOrEqual(30);
  });
});

describe('cada rota está no balde da natureza dela', () => {
  const fonte = readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8');

  /** O nome do balde que um handler consome. */
  const baldeDe = (handler: string): string => {
    const i = fonte.indexOf(`async function ${handler}(`);
    expect(i, `${handler} sumiu`).toBeGreaterThan(0);
    const m = /consumirFicha\(env, [a-z.]+, '([a-z]+)'/.exec(fonte.slice(i, i + 900));
    expect(m, `${handler} deixou de consumir ficha`).not.toBeNull();
    return m![1]!;
  };

  it('o que o jogo faz sozinho vai para `sincronia`', () => {
    for (const h of ['movimentar', 'entregarLote', 'aplicarComandos',
      'gravarMissoes', 'gravarProgresso', 'creditarAusencia']) {
      expect(baldeDe(h), h).toBe('sincronia');
    }
  });

  it('e o que o jogador clica vai para `acao`', () => {
    // `sintetizar` é o caso que originou tudo isto.
    for (const h of ['sintetizar', 'adquirirCasco', 'comprarVip']) {
      expect(baldeDe(h), h).toBe('acao');
    }
  });
});

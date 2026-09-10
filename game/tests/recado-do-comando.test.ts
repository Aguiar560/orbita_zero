import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import { buscarRecados, marcarRecadosLidos } from '@app/recados';

/**
 * O recado do comando — uma mensagem do operador para UM jogador.
 *
 * ## Por que ele existe
 *
 * Não havia nenhum caminho entre quem opera o jogo e quem está jogando. Uma
 * compensação, um agradecimento a quem testou, um aviso de manutenção: tudo
 * dependia de o jogador estar no Discord. O chat não serve — ele exige uma
 * conta de remetente com sessão viva, vive noutro Worker e noutro banco, e
 * mensagem de chat se perde na rolagem.
 *
 * ## As três coisas que podem dar errado
 *
 * 1. **Entregar o recado de outra pessoa** — os ids são sequenciais.
 * 2. **Repetir para sempre** — sem confirmação de leitura, ele volta em todo
 *    boot até o jogador desistir.
 * 3. **Sumir sem ser lido** — marcar na chegada apaga o recado de quem estava
 *    com a aba em outra janela.
 */

const fonte = (...p: string[]): string => readFileSync(join(process.cwd(), ...p), 'utf8');
const worker = fonte('server', 'src', 'index.ts');
const game = fonte('src', 'app', 'Game.ts');

const corpoDe = (nome: string): string => {
  const t = worker.slice(worker.indexOf(`async function ${nome}`));
  return t.slice(0, t.indexOf('\n}\n'));
};

const resposta = (dados: unknown, ok = true): Response =>
  ({ ok, status: ok ? 200 : 500, json: async () => dados }) as Response;

describe('a entrega, do lado da tela', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('traz os recados por entregar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta({
      recados: [{ id: 4, texto: 'Obrigado por testar.', criado_em: 1_700_000_000 }],
    })));

    const r = await buscarRecados();
    expect(r).toEqual([{ id: 4, texto: 'Obrigado por testar.', criadoEm: 1_700_000_000 }]);
  });

  it('e engole linha torta em vez de quebrar o boot', async () => {
    /**
     * Um aviso de cortesia não pode ser motivo para o jogo não abrir. Falha de
     * rede, JSON estranho e campo faltando terminam todos na mesma lista vazia.
     */
    vi.stubGlobal('fetch', vi.fn(async () => resposta({
      recados: [{ id: 'quatro', texto: 'x' }, null, { id: 5 }, { id: 6, texto: 'vale' }],
    })));
    expect(await buscarRecados()).toEqual([{ id: 6, texto: 'vale', criadoEm: undefined }]);

    vi.stubGlobal('fetch', vi.fn(async () => resposta({ recados: 'nenhum' })));
    expect(await buscarRecados()).toEqual([]);

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await buscarRecados()).toEqual([]);

    vi.stubGlobal('fetch', vi.fn(async () => resposta({}, false)));
    expect(await buscarRecados()).toEqual([]);
  });

  it('e não fala com o servidor à toa', async () => {
    const chamadas = vi.fn(async () => resposta({ marcados: 0 }));
    vi.stubGlobal('fetch', chamadas);
    await marcarRecadosLidos([]);
    expect(chamadas).not.toHaveBeenCalled();
  });
});

describe('a leitura é confirmada ao FECHAR, não ao aparecer', () => {
  it('o cartão confirma no fechamento', () => {
    // Ver não é ler. Marcar na chegada apagaria o recado de quem estava com a
    // aba em outra janela quando ele apareceu.
    const cartao = fonte('src', 'ui', 'RecadoDoComando.ts');
    expect(cartao).toContain('const fechar = ()');
    expect(cartao).toContain('aoFechar(recado.id);');
    // E ANTES da animação de saída terminar: fechar a aba no meio dela não
    // pode fazer o recado voltar como se nunca tivesse sido lido.
    expect(cartao.indexOf('aoFechar(recado.id);'))
      .toBeLessThan(cartao.indexOf('cartao.remove()'));
  });

  it('e o jogo entrega um por vez', () => {
    // Dois cartões empilhados viram um bloco que ninguém lê inteiro, e o
    // segundo — em geral o mais recente — é o que se perde.
    const t = game.slice(game.indexOf('private async entregarRecados'));
    const corpo = t.slice(0, t.indexOf('\n  }\n'));
    expect(corpo).toContain('fila.shift()');
    expect(corpo).toContain('void marcarRecadosLidos([id]);');
    expect(corpo).toContain('proximo();');
  });

  it('e não segura o boot', () => {
    // Cortesia não atrasa o início do jogo: rede lenta aqui não pode deixar o
    // jogador olhando uma tela parada.
    expect(game).toContain('void this.entregarRecados();');
  });
});

describe('a mensagem chega SEM o jogador fazer nada', () => {
  it('tem relógio próprio, mais curto que o da nuvem', () => {
    /**
     * Entregar só no boot deixava a mensagem esperando quem estivesse com a
     * aba aberta — que num idle é a maioria, e por horas. E o ciclo da nuvem,
     * de 150 s, seria a carona de graça: o atraso dele é exatamente o que faz
     * a mensagem não parecer do servidor.
     */
    expect(game).toContain('const INTERVALO_DO_RECADO = 30;');
    expect(game).toContain('private tickRecado(dt: number)');
    expect(game).toContain('this.tickRecado(dt);');
  });

  it('e não gasta nada com a aba escondida', () => {
    // Um cartão que aparece para ninguém não foi entregue — e num idle a aba
    // passa a maior parte do tempo assim.
    const t = game.slice(game.indexOf('private tickRecado'));
    const corpo = t.slice(0, t.indexOf('\n  }\n'));
    expect(corpo).toContain('if (document.hidden || this.entregandoRecado) return;');
  });

  it('e pergunta assim que a aba volta', () => {
    const t = game.slice(game.indexOf('private readonly onVisibility'));
    const corpo = t.slice(0, t.indexOf('\n  };\n'));
    expect(corpo).toContain('void this.entregarRecados();');
  });

  it('e dois ciclos seguidos não empilham cartão', () => {
    /**
     * A leitura só é confirmada ao fechar, então o mesmo recado continua
     * pendente enquanto o jogador lê. Sem a trava, o ciclo seguinte o buscaria
     * de novo e mostraria uma segunda cópia por cima da primeira.
     */
    const t = game.slice(game.indexOf('private async entregarRecados'));
    const corpo = t.slice(0, t.indexOf('\n  }\n'));
    expect(corpo).toContain('if (this.entregandoRecado) return;');
    expect(corpo).toContain('this.entregandoRecado = true;');
    // E solta quando a fila acaba, senão a trava fecharia a porta para sempre.
    expect((corpo.match(/this\.entregandoRecado = false;/g) ?? []).length).toBe(2);
  });
});

describe('o servidor não entrega o recado de outra pessoa', () => {
  it('a leitura filtra pelo dono e pelo que falta entregar', () => {
    const corpo = corpoDe('recadosDe');
    expect(corpo).toContain('WHERE usuario = ? AND lido_em IS NULL');
    // Teto: a lista é escrita à mão, e um engano de operação não pode virar
    // mil cartões na tela de alguém.
    expect(corpo).toContain('LIMIT 5');
  });

  it('e a marcação também', () => {
    /**
     * Os ids são sequenciais e visíveis. Sem `AND usuario = ?`, mandar
     * `{ lidos: [1] }` apagaria da fila o recado de outra pessoa — que nunca o
     * veria, e ninguém descobriria por quê.
     */
    const corpo = corpoDe('marcarRecadosLidos');
    expect(corpo).toContain('WHERE id = ? AND usuario = ? AND lido_em IS NULL');
  });

  it('e um id inválido não derruba os outros', () => {
    // Mesma regra do inventário: um comando ruim não derruba o lote, senão o
    // cliente reenvia para sempre.
    const corpo = corpoDe('marcarRecadosLidos');
    expect(corpo).toContain('Number.isInteger(n)');
    expect(corpo).not.toMatch(/return json\([^)]*'id_invalido'/);
  });

  it('e a rota exige token, como todas as do jogador', () => {
    expect(worker.indexOf("url.pathname === '/recados'"))
      .toBeGreaterThan(worker.indexOf('const usuario = await usuarioDoToken('));
  });
});

import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import {
  DISTINTOS_MAX, MOTIVO_MAX, esquecerErrosRelatados, motivoDoErro, vigiarErrosDoCliente,
} from '@app/erro-do-cliente';
import { motivoSaneado } from '../server/src/index';
import { BALDES, podeUsar, type Balde } from '../server/src/ritmo';

/**
 * O erro de JavaScript do navegador — o último buraco da observabilidade.
 *
 * ## O que era invisível
 *
 * O servidor conta tudo o que ELE recusa e avisa a cada cinco minutos. Um
 * `TypeError` num painel acontece inteiro na máquina do jogador: a tela quebra,
 * ele fecha a aba, e do lado de cá não sobra rastro nenhum. É a classe de
 * defeito **mais visível para quem joga e menos visível para quem conserta** —
 * e os quatro defeitos de 08/09 foram todos de interação.
 *
 * ## As três coisas que podem dar errado aqui, e que os testes guardam
 *
 * 1. **Vazar dado do jogador** numa mensagem de erro.
 * 2. **Gastar a cota** — um erro dentro do laço de quadros dispara sessenta
 *    vezes por segundo.
 * 3. **O relator estourar**, virando laço infinito de erro dentro do tratador.
 */

describe('a pilha nunca sobe, e a mensagem sobe saneada', () => {
  it('a frase útil sobrevive', () => {
    // É ela que localiza o defeito. Sanear não pode ser o mesmo que apagar.
    expect(motivoDoErro('TypeError', "Cannot read properties of undefined (reading 'hull')"))
      .toBe("TypeError: Cannot read properties of undefined (reading 'hull')");
  });

  it('mas id, token, e-mail e caminho não', () => {
    /**
     * O conteúdo de uma variável aparece em mensagem de erro com frequência, e
     * um livro de operação não é lugar para dado de jogador. Cortar dígito e
     * símbolo tira id, token, e-mail e URL sem precisar adivinhar o formato de
     * cada um.
     */
    const sujo = motivoDoErro('Error', 'falhou para aguiar560@gmail.com id 0a069f4f-254d em /save?u=9');
    expect(sujo).not.toContain('@gmail');
    expect(sujo).not.toMatch(/\d/);
    expect(sujo).not.toContain('?');
    expect(sujo).toContain('falhou para');
  });

  it('e o motivo tem tamanho de coluna, não de romance', () => {
    expect(motivoDoErro('Error', 'a'.repeat(500)).length).toBeLessThanOrEqual(MOTIVO_MAX);
  });

  it('e erro sem nome nenhum ainda vira uma chave', () => {
    // Erro de script de outra origem chega sem `name` e sem `message`. Contar
    // "aconteceu algo" é melhor que perder a ocorrência.
    expect(motivoDoErro('', '')).toBe('erro_sem_nome');
  });
});

describe('o servidor saneia DE NOVO', () => {
  it('porque o cliente é a parte do sistema que não se confia', () => {
    /**
     * O saneador do cliente não vale nada contra um envio forjado, e esta é a
     * única coluna do banco alimentada por texto que veio de fora. É a mesma
     * regra que sustenta a Fase 3 inteira: o que o cliente manda é pedido, não
     * verdade.
     */
    expect(motivoSaneado("TypeError'; DROP TABLE recusas;--")).not.toContain(';');
    expect(motivoSaneado('a'.repeat(999)).length).toBeLessThanOrEqual(100);
    expect(motivoSaneado('id 12345 <script>')).not.toMatch(/[<>0-9]/);
  });

  it('e recusa o que não descreve erro nenhum', () => {
    expect(motivoSaneado('')).toBe('');
    expect(motivoSaneado('!!!')).toBe('');
    expect(motivoSaneado('ab')).toBe('');
    expect(motivoSaneado('TypeError')).toBe('TypeError');
  });
});

describe('um erro no laço de quadros não gasta a cota', () => {
  beforeEach(() => {
    esquecerErrosRelatados();
    vi.unstubAllGlobals();
  });

  it('o MESMO erro sobe uma vez por sessão, não sessenta por segundo', async () => {
    /**
     * É o caso real que importa: um `TypeError` dentro do desenho dispara a
     * cada quadro. Sem a trava, a primeira tela quebrada gastaria a cota de
     * escrita do dia — o mesmo raciocínio do livro, que agrega em vez de
     * gravar ocorrência a ocorrência.
     */
    const chamadas = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal('fetch', chamadas);
    const alvos: EventListener[] = [];
    vi.stubGlobal('window', {
      addEventListener: (_: string, f: EventListener) => alvos.push(f),
    });

    vigiarErrosDoCliente();
    for (let i = 0; i < 200; i++) {
      alvos[0]!({ error: new TypeError('sempre o mesmo') } as unknown as Event);
    }
    await vi.waitFor(() => expect(chamadas).toHaveBeenCalled());

    expect(chamadas).toHaveBeenCalledOnce();
  });

  it('e uma sessão que só quebra também tem teto de tipos distintos', async () => {
    const chamadas = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal('fetch', chamadas);
    const alvos: EventListener[] = [];
    vi.stubGlobal('window', {
      addEventListener: (_: string, f: EventListener) => alvos.push(f),
    });

    vigiarErrosDoCliente();
    for (let i = 0; i < DISTINTOS_MAX + 20; i++) {
      alvos[0]!({ error: new TypeError(`erro numero ${'a'.repeat(i)}`) } as unknown as Event);
    }
    await vi.waitFor(() => expect(chamadas).toHaveBeenCalled());

    expect(chamadas.mock.calls.length).toBeLessThanOrEqual(DISTINTOS_MAX);
  });

  it('e o balde do servidor é o mais apertado de todos', () => {
    // É a única rota onde o CORPO vira conteúdo de coluna. Um minuto entre
    // envios não atrapalha quem relata defeito de verdade.
    expect(BALDES.cliente.refil).toBeGreaterThanOrEqual(BALDES.acao.refil);

    let balde: Balde | null = null;
    let passaram = 0;
    for (let i = 0; i < 50; i++) {
      const v = podeUsar('cliente', balde, 1_000);
      if (!v.pode) break;
      passaram++;
      balde = { fichas: v.fichasRestantes, em: 1_000 };
    }
    expect(passaram).toBe(BALDES.cliente.capacidade);
  });
});

describe('o relator nunca derruba a página', () => {
  beforeEach(() => { esquecerErrosRelatados(); vi.unstubAllGlobals(); });

  it('rede fora não vira um segundo erro', async () => {
    // Um erro dentro do tratador de erros vira laço infinito. É o único lugar
    // do projeto onde engolir é a resposta certa e final.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const alvos: EventListener[] = [];
    vi.stubGlobal('window', {
      addEventListener: (_: string, f: EventListener) => alvos.push(f),
    });

    vigiarErrosDoCliente();
    expect(() => alvos[0]!({ error: new Error('x') } as unknown as Event)).not.toThrow();
  });

  it('e escuta as DUAS portas, não só a síncrona', () => {
    /**
     * `error` pega a exceção síncrona; `unhandledrejection` pega a promessa que
     * ninguém tratou. Num código cheio de `await` de rede, a segunda é a mais
     * comum das duas — ficar só com a primeira deixaria de fora justamente o
     * formato de defeito que este projeto mais produz.
     */
    const nomes: string[] = [];
    vi.stubGlobal('window', { addEventListener: (n: string) => nomes.push(n) });
    vigiarErrosDoCliente();
    expect(nomes).toEqual(['error', 'unhandledrejection']);
  });
});

describe('a vigilância começa antes de tudo', () => {
  it('no `main`, acima do `Game` — o boot é onde quebrar dói mais', () => {
    // Um `TypeError` durante o boot é o pior de todos: a tela nem chega a
    // existir. Um tratador instalado depois do `Game` perderia exatamente esse.
    const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
    expect(main).toContain('vigiarErrosDoCliente()');
    expect(main.indexOf('vigiarErrosDoCliente()'))
      .toBeLessThan(main.indexOf('new Game(root)'));
  });

  it('e a rota existe, com balde próprio', () => {
    const index = readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8');
    expect(index).toContain("url.pathname === '/erro-do-cliente'");
    expect(index).toContain("consumirFicha(env, id, 'cliente', agora)");
    // Sem `usuario`: a pergunta é o que está quebrado, nunca quem quebrou.
    expect(index).toContain("anotarMotivo(env, '/cliente', motivo, 500)");
  });
});

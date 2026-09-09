import { readFileSync, readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  CABECALHO_DE_RECUSA, CAMPOS_DE_RECUSA, contarRecusas, lerRecusas,
} from '../server/src/recusa-no-corpo';
import { acumular, novoLivro } from '../server/src/recusas';

/**
 * O erro escondido DENTRO de um 200.
 *
 * ## O que estava invisível
 *
 * Quatro rotas respondem "deu certo" carregando o que não deu:
 *
 * | rota | campo | o que sumia |
 * |---|---|---|
 * | `/inventario` | `recusados` | equipar recusado — peça não é sua, nave não aceita, slot errado |
 * | `/inventario` | `faltaram` | o pote deu menos do que o cliente pediu |
 * | `/missoes` | `recusadas` | entrega barrada pela validação B |
 * | `/marcas` | `recusadas` | marca de ranking implausível |
 * | `/progresso` | `recusados` | encontro declarado que não cabe naquele mundo |
 *
 * Todas de propósito — **um comando ruim não derruba o lote**, que foi a lição
 * que custou o dia 08/09. Só que isso as escondia duas vezes: o status é 200,
 * então o livro das recusas não olhava, e o cliente ignorava os campos.
 *
 * Erro escondido dentro de sucesso é o pior lugar para um erro estar: ninguém
 * procura ali. Um jogador cuja peça é recusada em todo envio não veria nada, e
 * do lado do servidor também não apareceria nada.
 */

describe('a contagem sai do objeto, antes de virar texto', () => {
  it('conta uma lista de recusas pelo motivo de cada uma', () => {
    const h = contarRecusas({
      itens: [],
      recusados: [
        { uid: 'a', motivo: 'nave_nao_aceita' },
        { uid: 'b', motivo: 'nave_nao_aceita' },
        { uid: 'c', motivo: 'slot_errado' },
      ],
    });
    expect(h).toContain('nave_nao_aceita=2');
    expect(h).toContain('slot_errado=1');
  });

  it('e um mapa de contagem vira um motivo por chave', () => {
    // `faltaram: { onda: 3 }` quer dizer "o pote da onda deu 3 a menos". O
    // nome do pote importa: chefe seco e onda seca são problemas diferentes.
    expect(contarRecusas({ faltaram: { onda: 3, chefe: 1 } }))
      .toBe('faltaram_onda=3,faltaram_chefe=1');
  });

  it('e a FORMA sai do valor, não de uma tabela por campo', () => {
    /**
     * `recusados` é vetor em `/inventario` e número em `/progresso`. Fixar a
     * forma na tabela faria uma das duas ser ignorada em silêncio — que é
     * exatamente o defeito que este arquivo existe para acabar.
     */
    expect(contarRecusas({ recusados: 4 })).toBe('recusados=4');
    expect(contarRecusas({ recusados: [{ motivo: 'x' }] })).toBe('x=1');
  });

  it('e resposta limpa não ganha cabeçalho — silêncio é a boa notícia', () => {
    expect(contarRecusas({ itens: [1, 2, 3] })).toBe('');
    expect(contarRecusas({ recusados: [], faltaram: {} })).toBe('');
    expect(contarRecusas({ recusados: 0 })).toBe('');
    expect(contarRecusas(null)).toBe('');
  });

  it('e um motivo forjado não vira coluna estranha no banco', () => {
    // O motivo pode nascer de dado do cliente em algum caminho futuro. Sanear
    // aqui é mais barato que descobrir depois que o livro tem lixo dentro.
    const h = contarRecusas({ recusados: [{ motivo: "x'; DROP TABLE recusas;--" }] });
    expect(h).toMatch(/^[a-z0-9_]+=1$/i);
  });
});

describe('o cabeçalho volta a virar contagem', () => {
  it('ida e volta preserva motivo e número', () => {
    const ida = contarRecusas({ recusadas: [{ motivo: 'passos_insuficientes' }] });
    expect(lerRecusas(ida)).toEqual([{ motivo: 'passos_insuficientes', n: 1 }]);
  });

  it('e o que vier deformado é ignorado, não estoura', () => {
    expect(lerRecusas(null)).toEqual([]);
    expect(lerRecusas('lixo')).toEqual([]);
    expect(lerRecusas('a=0,b=-3,c=x')).toEqual([]);
    expect(lerRecusas('bom=2,quebrado')).toEqual([{ motivo: 'bom', n: 2 }]);
  });
});

describe('dez recusas numa resposta contam dez', () => {
  it('porque a ordem de grandeza é o que separa "aconteceu" de "sempre"', () => {
    /**
     * Um `equipar` pode barrar dez peças de uma vez. Contar uma perderia
     * justamente o sinal: "uma peça recusada" é um jogador clicando errado,
     * "quarenta por minuto" é a Anatomia quebrada.
     */
    const livro = novoLivro();
    expect(acumular(livro, { rota: '/inventario', motivo: 'slot_errado', status: 200 }, 1_000, 10))
      .toBe(10);
  });

  it('e o acúmulo continua segurando a tempestade', () => {
    const livro = novoLivro();
    acumular(livro, { rota: '/x', motivo: 'y', status: 200 }, 1_000, 5);
    for (let i = 0; i < 50; i++) acumular(livro, { rota: '/x', motivo: 'y', status: 200 }, 1_010, 9);
    // Uma escrita só, com a soma inteira — nada se perde e a cota não sofre.
    expect(acumular(livro, { rota: '/x', motivo: 'y', status: 200 }, 1_100, 1)).toBe(451);
  });
});

describe('nenhum campo de recusa ficou de fora da lista', () => {
  /**
   * O conserto vale zero no campo que alguém esquecer de declarar — e o
   * esquecido seria justo o que ninguém ia procurar. Esta varredura lê o
   * servidor atrás de campo com cara de recusa e cobra que ele esteja em
   * `CAMPOS_DE_RECUSA`.
   */
  const dir = new URL('../server/src/', import.meta.url);
  const fontes = readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => [f, readFileSync(new URL(f, dir), 'utf8')] as const);

  it('varre o servidor inteiro — e são vários arquivos', () => {
    expect(fontes.length).toBeGreaterThanOrEqual(10);
  });

  /**
   * Comentário não é código.
   *
   * A primeira versão desta varredura acusou `ignorados` e `barradas` — as
   * duas em PROSA, dentro de comentários que explicavam outra coisa. Um teste
   * que grita por engano ensina a ignorá-lo, que é o mesmo defeito do aviso que
   * aparece sempre.
   */
  const semComentarios = (s: string): string =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  it('todo campo `recusad*`/`faltar*` que entra numa resposta está declarado', () => {
    // Só posição de PROPRIEDADE — `recusados:` —, nunca a palavra solta.
    const suspeitos = new Set<string>();
    for (const [, fonte] of fontes) {
      for (const m of semComentarios(fonte)
        .matchAll(/\b(recusad[oa]s|faltaram|barrad[oa]s|ignorad[oa]s)\s*:/g)) {
        suspeitos.add(m[1]!);
      }
    }

    const forasDaLista = [...suspeitos].filter((s) => !CAMPOS_DE_RECUSA.includes(s));
    expect(
      forasDaLista.join(', '),
      'campo de recusa que o livro não conta — declare em CAMPOS_DE_RECUSA',
    ).toBe('');
  });
});

describe('o interceptador lê o cabeçalho, e não o corpo', () => {
  const index = readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8');

  it('porque reabrir o corpo custaria um parse nos 512 KB do save', () => {
    expect(index).toContain('lerRecusas(resposta.headers.get(CABECALHO_DE_RECUSA))');
    expect(CABECALHO_DE_RECUSA).toMatch(/^x-/);
  });

  it('e `json()` marca o cabeçalho num lugar só', () => {
    // Marcar rota por rota seriam dezenas de chamadas para alguém esquecer na
    // próxima que entrar.
    const i = index.indexOf('const json = (dados: unknown');
    const bloco = index.slice(i, i + 1600);
    expect(bloco).toContain('contarRecusas(dados)');
  });
});

describe('a auditoria que engole o erro passa a contá-lo', () => {
  const index = readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8');

  it('nos dois lugares que rodam DEPOIS do pagamento', () => {
    /**
     * `registrarExcedentes` e a precificação de encontros não podem transformar
     * uma falha delas num erro para quem já recebeu — engolir é o certo. Mas
     * engolir EM SILÊNCIO foi o que deixou a auditoria de teto meses sem gravar
     * uma linha, com um `SELECT setor` numa coluna chamada `melhor_setor`.
     */
    expect(index).toContain("anotarExcecaoDeAuditoria(env, '/carteira:excedentes', erro)");
    expect(index).toContain("anotarExcecaoDeAuditoria(env, '/progresso:encontros', erro)");
  });

  it('e nenhum `catch` do servidor volta mudo para o meio de uma rota', () => {
    /**
     * Um `catch` que só retorna um 4xx está reportando — o livro pega pelo
     * status. O que não pode existir é o que engole e SEGUE, sem 4xx e sem
     * anotar. Esta varredura cobra que todo `catch` faça uma das três coisas.
     */
    const mudos: string[] = [];
    const linhas = index.split('\n');

    linhas.forEach((linha, i) => {
      if (!/\}\s*catch\b/.test(linha)) return;
      const bloco = linhas.slice(i, i + 8).join('\n');
      const reporta = /return json\(|anotarExcecaoDeAuditoria|anotarMotivo|erro:/.test(bloco);
      // Comentário na mesma linha marca o engolir deliberado e explicado.
      const explicado = /\/\*|\/\//.test(linha) || /\/\*|\/\//.test(linhas[i + 1] ?? '');
      if (!reporta && !explicado) mudos.push(`index.ts:${i + 1} — ${linha.trim()}`);
    });

    expect(mudos.join('\n'), 'catch que engole e segue sem contar').toBe('');
  });
});

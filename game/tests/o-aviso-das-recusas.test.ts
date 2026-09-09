import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import {
  LIMIAR_URGENTE, LINHAS_MAX, corpoDoAviso, enviarAviso, hostDoAviso, montarAviso,
  type LinhaDeRecusa,
} from '../server/src/alerta';

/**
 * O aviso — como alguém FICA SABENDO sem precisar consultar.
 *
 * ## O que faltava depois do livro
 *
 * A tabela `recusas` respondeu "o que está quebrado" em cinco segundos. Ela não
 * resolvia o problema de fundo, que é o mesmo desde 08/09: **alguém precisa
 * suspeitar e ir olhar**. Enquanto o Rafael for o único jogador isso quase
 * funciona; com testadores dentro, quem descobre o defeito é sempre a pessoa
 * errada, e horas depois.
 *
 * ## A armadilha que estes testes guardam
 *
 * "Todo erro precisa ser avisado" e "toda ocorrência vira uma mensagem" são
 * coisas diferentes, e a segunda destrói a primeira: uma rota quebrada gera
 * milhares de recusas por hora, e mil mensagens avisam MENOS que uma, porque
 * ninguém lê a milésima e o canal deixa de ser olhado.
 *
 * Então todo TIPO entra no resumo, sempre. O que se agrupa é a repetição.
 */

const linha = (p: Partial<LinhaDeRecusa> = {}): LinhaDeRecusa => ({
  rota: '/inventario',
  motivo: 'lote_esgotado',
  hora: 7_200,
  n: 5,
  avisado: 0,
  // Por padrão, um tipo que já existia antes desta hora: nada de "NOVO".
  primeiraHora: 3_600,
  ...p,
});

describe('o que entra no aviso', () => {
  it('nada a avisar não vira mensagem — silêncio é a boa notícia', () => {
    // Um canal que recebe "tudo bem" a cada cinco minutos vira ruído, e aí o
    // aviso de verdade chega no meio de 288 mensagens por dia.
    expect(montarAviso([])).toBeNull();
    expect(montarAviso([linha({ n: 5, avisado: 5 })])).toBeNull();
  });

  it('avisa só o DELTA, nunca o que já foi contado', () => {
    /**
     * É o defeito que a coluna `avisado` existe para evitar. As linhas são
     * baldes de uma hora e o gatilho roda a cada cinco minutos: sem o delta, a
     * mesma linha seria reavisada doze vezes antes de a hora virar.
     */
    const a = montarAviso([linha({ n: 40, avisado: 30 })])!;
    expect(a.total).toBe(10);
    expect(a.texto).toContain('×10');
  });

  it('e junta as horas do mesmo tipo numa linha só', () => {
    // O leitor quer saber "o inventário está recusando", não em qual balde de
    // hora cada ocorrência caiu.
    const a = montarAviso([
      linha({ hora: 3_600, n: 4 }),
      linha({ hora: 7_200, n: 6 }),
    ])!;
    expect(a.total).toBe(10);
    expect(a.texto.split('\n')).toHaveLength(2);
  });

  it('e ordena pelo que mais aconteceu', () => {
    const a = montarAviso([
      linha({ motivo: 'pouco', n: 2 }),
      linha({ motivo: 'muito', n: 90 }),
    ])!;
    const linhas = a.texto.split('\n');
    expect(linhas[1]).toContain('muito');
    expect(linhas[2]).toContain('pouco');
  });

  it('e uma tempestade de tipos não vira uma parede de texto', () => {
    // Uma mensagem que não cabe na tela não é lida. O corte diz quantos
    // ficaram de fora, e a consulta ao D1 continua tendo a lista inteira.
    const muitos = Array.from({ length: LINHAS_MAX + 8 }, (_, i) =>
      linha({ motivo: `motivo_${i}`, n: 1 }));
    const a = montarAviso(muitos)!;
    expect(a.texto).toContain('e mais 8');
    expect(a.texto.split('\n').length).toBeLessThanOrEqual(LINHAS_MAX + 2);
  });
});

describe('o que faz um aviso ser URGENTE', () => {
  it('uma exceção não tratada, que é a que ninguém previu', () => {
    // `http_5xx` só aparece quando algo estourou fora de todo `catch` escrito à
    // mão. É o mais provável de estar derrubando a rota inteira.
    expect(montarAviso([linha({ motivo: 'http_500', n: 1 })])!.urgente).toBe(true);
  });

  it('um motivo NOVO, que é a assinatura de um deploy que quebrou algo', () => {
    /**
     * Foi exatamente assim que `no such column: semente` apareceu em 08/09: um
     * erro que não existia passou a existir a partir de uma publicação. Sem
     * esta regra, ele chegaria com o mesmo peso de um conhecido.
     */
    const a = montarAviso([linha({ n: 1, hora: 7_200, primeiraHora: 7_200 })])!;
    expect(a.urgente).toBe(true);
    expect(a.texto).toContain('NOVO');
  });

  it('mas NOVO não se repete — senão a palavra perde o sentido', () => {
    /**
     * Achado ao rodar o gatilho de verdade: um erro contínuo era marcado NOVO
     * em todos os avisos da primeira hora de vida dele, porque as linhas são
     * baldes de uma hora e `primeiraHora` continuava igual a `hora`.
     *
     * "NOVO" quer dizer *um deploy acabou de quebrar alguma coisa*. Repetido, é
     * só barulho — e barulho no lugar do sinal foi o problema do dia inteiro.
     */
    const jaAvisado = linha({ hora: 7_200, primeiraHora: 7_200, n: 56, avisado: 47 });
    const a = montarAviso([jaAvisado])!;
    expect(a.texto).not.toContain('NOVO');
    expect(a.total).toBe(9);
  });

  it('e volume acima do limiar, que é um conhecido saindo do normal', () => {
    expect(montarAviso([linha({ n: LIMIAR_URGENTE })])!.urgente).toBe(true);
    expect(montarAviso([linha({ n: LIMIAR_URGENTE - 1 })])!.urgente).toBe(false);
  });

  it('mas o corriqueiro em pouca quantidade continua sendo avisado', () => {
    // "Não urgente" nunca quer dizer "não avisado". Todo tipo entra.
    const a = montarAviso([linha({ motivo: 'rapido_demais', n: 2 })])!;
    expect(a.urgente).toBe(false);
    expect(a.texto).toContain('rapido_demais');
  });
});

describe('o corpo, no formato que o destino entende', () => {
  it('o Discord recebe SÓ `content` — campo a mais ele recusa', () => {
    /**
     * Foi o defeito de 09/09, e ele é exemplar.
     *
     * A primeira versão mandava `{ content, text }` de uma vez, com o argumento
     * de que "uma carga só serve os dois e não custa nada". Custava: o Discord
     * devolve **400 `Unknown field`** para o `text`, e o aviso nunca saía.
     *
     * A esperteza de economizar um `if` transformou o sistema de avisos no
     * único componente do servidor incapaz de avisar que estava quebrado.
     */
    const c = corpoDoAviso('https://discord.com/api/webhooks/1/abc', 'oi');
    expect(c).toEqual({ content: 'oi' });
    expect(corpoDoAviso('https://discordapp.com/api/webhooks/1/abc', 'oi'))
      .toEqual({ content: 'oi' });
  });

  it('e o Slack recebe só `text`', () => {
    expect(corpoDoAviso('https://hooks.slack.com/services/T/B/x', 'oi')).toEqual({ text: 'oi' });
  });

  it('e um destino desconhecido leva os dois, que é a aposta com mais chance', () => {
    expect(corpoDoAviso('https://exemplo.com/hook', 'oi')).toEqual({ content: 'oi', text: 'oi' });
    // URL torta não pode derrubar o aviso: cai no genérico.
    expect(corpoDoAviso('nao-e-url', 'oi')).toEqual({ content: 'oi', text: 'oi' });
  });
});

describe('o envio devolve o STATUS, não um sim ou não', () => {
  it('porque `false` não distingue 400 de rede fora', async () => {
    /**
     * Com um booleano, o gatilho publicado e o segredo configurado davam o
     * mesmo silêncio de "o gatilho nunca rodou". O número é o que permite a
     * linha `envio_400` no livro dizer exatamente o que aconteceu.
     */
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 400 }) as Response));
    expect(await enviarAviso('https://x', { texto: 'x', urgente: true, total: 1 })).toBe(400);

    // O Discord responde 204 no sucesso, e 204 é entrega.
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 204 }) as Response));
    expect(await enviarAviso('https://x', { texto: 'x', urgente: true, total: 1 })).toBe(204);

    // Zero é "nem chegou a responder": rede fora, DNS, URL inválida.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await enviarAviso('https://x', { texto: 'x', urgente: true, total: 1 })).toBe(0);
    vi.unstubAllGlobals();
  });
});

describe('o gatilho, e a brecha que ele fecha', () => {
  const fonte = readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8');

  it('só marca como avisado DEPOIS do envio confirmado', () => {
    const i = fonte.indexOf('async function avisarDasRecusas');
    const bloco = fonte.slice(i, i + 2600);
    expect(bloco).toContain('const status = await enviarAviso(');
    expect(bloco.indexOf('enviarAviso'))
      .toBeLessThan(bloco.indexOf('UPDATE recusas SET avisado'));
  });

  it('e o aviso que NÃO sai também vira linha no livro', () => {
    /**
     * Sem isto, o sistema de avisos era o único componente do servidor incapaz
     * de avisar que estava quebrado — e foi o que aconteceu em 09/09: segredo
     * configurado, gatilho publicado, e nada chegando, sem jeito de distinguir
     * "não rodou" de "rodou e o destino recusou".
     *
     * Com a linha `/alerta envio_400`, a diferença se lê na tabela.
     */
    const i = fonte.indexOf('async function avisarDasRecusas');
    const bloco = fonte.slice(i, i + 2600);
    expect(bloco).toContain("anotarMotivo(env, '/alerta', `envio_${status}`");
    expect(bloco).toContain('status < 200 || status >= 300');
  });

  it('e não faz nada sem webhook configurado', () => {
    // O livro vale por si: sem a variável, a consulta ao D1 continua
    // respondendo tudo, e ligar o aviso é colar uma URL.
    expect(fonte).toContain('if (!env.ALERTA_WEBHOOK) return;');
  });

  it('e a exceção não tratada VIRA resposta, senão ela é a única invisível', () => {
    /**
     * `anotarRecusa` só enxerga o que vira resposta. Uma exceção escapava do
     * `fetch` inteiro: o runtime devolvia o erro dele, o livro não registrava
     * nada e o aviso nunca saía. Ou seja, a falha que ninguém previu — a única
     * sem um `catch` escrito à mão — era a única invisível.
     */
    const i = fonte.indexOf('async function responder');
    const bloco = fonte.slice(i, i + 700);
    expect(bloco).toContain('return await rotear(req, env);');
    expect(bloco).toContain('excecao_');
    expect(bloco, 'a pilha pode carregar dado do jogador').not.toContain('.stack');
  });

  it('e o gatilho está declarado no wrangler.toml', () => {
    const toml = readFileSync(new URL('../server/wrangler.toml', import.meta.url), 'utf8');
    expect(toml).toMatch(/\[triggers\]/);
    expect(toml).toMatch(/crons\s*=/);
  });

  it('e a coluna existe nas migrações', () => {
    const sql = readFileSync(
      new URL('../server/migrations/0016-recusa-avisada.sql', import.meta.url), 'utf8',
    );
    expect(sql).toContain('ALTER TABLE recusas ADD COLUMN avisado');
  });
});

describe('o host do destino, que é a parte que pode ser gravada', () => {
  it('sai da URL', () => {
    expect(hostDoAviso('https://discord.com/api/webhooks/1/token-secreto'))
      .toBe('discord.com');
  });

  it('e vazio quando a URL não é uma URL — que é o caso que interessa separar', () => {
    /**
     * `envio_0` diz que o `fetch` nem recebeu resposta, e isso tem duas causas
     * bem diferentes: a URL não é uma URL, ou é e o destino não respondeu. Sem
     * separar as duas, o diagnóstico volta a ser palpite — que é justamente o
     * que este dia inteiro foi feito para acabar.
     */
    expect(hostDoAviso('')).toBe('');
    expect(hostDoAviso('discord.com/api/webhooks/1/x')).toBe('');
    expect(hostDoAviso('  https://discord.com/x')).toBe('discord.com');
  });

  it('e o CAMINHO nunca sai junto — é nele que mora o token', () => {
    // O host não identifica ninguém e não abre porta nenhuma. O caminho abre:
    // quem o tem escreve no canal.
    const h = hostDoAviso('https://discord.com/api/webhooks/1547/uNEatPLPZyBQ');
    expect(h).not.toContain('uNEat');
    expect(h).not.toContain('/');
  });
});

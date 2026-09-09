import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  CHAVES_MAX, IGNORADOS, INTERVALO_DE_DESCARGA,
  acumular, chaveDe, horaDe, motivoDaResposta, novoLivro,
} from '../server/src/recusas';

/**
 * O livro das recusas — como o servidor conta que está quebrado.
 *
 * ## O defeito que isto fecha
 *
 * Em 08/09/2026 quatro defeitos ficaram horas no ar sem um único sintoma do
 * lado do servidor. Não foi distração de quem estava olhando: **uma recusa não
 * parece um erro**. `409` e `429` são respostas HTTP normais, o Cloudflare não
 * vê nada de errado nelas, e o cliente engole todas e mostra ao jogador um
 * número plausível.
 *
 * O pior deles — a coleta que derrubava o lote de comandos inteiro — respondeu
 * `409` milhares de vezes parecendo estar funcionando. O sistema só reportava
 * pelo Rafael; ele era o monitoramento.
 *
 * ## O que estes testes protegem
 *
 * Um livro de operação tem duas formas de não servir, e são opostas: ficar
 * calado no incidente, ou **afogar-se nele**. A cota do D1 é de escrita, e é
 * numa tempestade de recusas que se escreveria mais.
 */

const chave = (motivo = 'lote_esgotado', status = 409) =>
  ({ rota: '/inventario', motivo, status });

describe('a primeira recusa de uma chave desce na hora', () => {
  it('porque algo que nunca falhava começar a falhar é o que importa saber', () => {
    // Esperar um minuto para contar isso seria economizar no lugar errado: a
    // escrita é uma só, e é a mais informativa que o livro vai ter.
    expect(acumular(novoLivro(), chave(), 1_000)).toBe(1);
  });

  it('e cada par rota+motivo é uma chave própria', () => {
    const livro = novoLivro();
    expect(acumular(livro, chave('lote_esgotado'), 1_000)).toBe(1);
    expect(acumular(livro, chave('itens_nao_sao_seus'), 1_000)).toBe(1);
    expect(acumular(livro, { ...chave(), rota: '/sintetizar' }, 1_000)).toBe(1);
  });

  it('e o status não separa chaves — o mesmo motivo é o mesmo fato', () => {
    expect(chaveDe(chave('x', 409))).toBe(chaveDe(chave('x', 500)));
  });
});

describe('uma tempestade não afoga a cota', () => {
  it('mil recusas em dois segundos viram UMA escrita', () => {
    /**
     * É o caso real de 08/09. `derivarColeta` recusava o lote inteiro a cada
     * envio, para sempre — um livro com uma linha por ocorrência teria gasto a
     * cota de escrita do dia registrando o próprio incidente.
     */
    const livro = novoLivro();
    let escritas = 0;
    for (let i = 0; i < 1000; i++) {
      if (acumular(livro, chave(), 1_000 + (i % 2))) escritas++;
    }
    expect(escritas).toBe(1);
  });

  it('e o que passou não se perde: a descarga seguinte leva a conta inteira', () => {
    // Segurar a escrita não pode virar apagar o número. Quem lê precisa da
    // ordem de grandeza — "40 vezes" e "4 vezes" pedem reações diferentes.
    const livro = novoLivro();
    acumular(livro, chave(), 1_000);
    for (let i = 0; i < 40; i++) acumular(livro, chave(), 1_010);

    expect(acumular(livro, chave(), 1_000 + INTERVALO_DE_DESCARGA)).toBe(41);
  });

  it('e depois de descarregar, o contador recomeça do zero', () => {
    const livro = novoLivro();
    acumular(livro, chave(), 1_000);
    for (let i = 0; i < 5; i++) acumular(livro, chave(), 1_005);
    acumular(livro, chave(), 1_100);

    for (let i = 0; i < 3; i++) acumular(livro, chave(), 1_105);
    expect(acumular(livro, chave(), 1_200)).toBe(4);
  });

  it('e o mapa do isolado não cresce para sempre', () => {
    // Um isolado longevo com muitos motivos distintos viraria vazamento. É o
    // mesmo cuidado que `podeLer` já toma em `ritmo.ts`.
    const livro = novoLivro();
    for (let i = 0; i < CHAVES_MAX * 3; i++) {
      acumular(livro, chave(`motivo_${i}`), 1_000);
    }
    expect(livro.chaves.size).toBeLessThanOrEqual(CHAVES_MAX);
  });
});

describe('o que NÃO entra no livro', () => {
  it('token vencido, porque acontece com todo mundo o tempo todo', () => {
    // Ruído que esconde sinal é pior que silêncio: um livro cheio de 401 é um
    // livro que ninguém vai abrir na hora em que ele teria a resposta.
    expect(acumular(novoLivro(), chave('nao_autenticado', 401), 1_000)).toBe(0);
  });

  it('e rota inexistente, que é varredura de robô', () => {
    expect(acumular(novoLivro(), chave('nao_encontrado', 404), 1_000)).toBe(0);
  });

  it('mas 409, 429 e 500 entram — são os que ficaram horas invisíveis', () => {
    for (const status of [409, 413, 429, 500]) {
      expect(IGNORADOS.has(status), String(status)).toBe(false);
      expect(acumular(novoLivro(), chave('x', status), 1_000)).toBe(1);
    }
  });
});

describe('o motivo sai do corpo da resposta', () => {
  it('do campo `erro`, que é o vocabulário que as rotas já usam', () => {
    expect(motivoDaResposta({ erro: 'rapido_demais' }, 429)).toBe('rapido_demais');
  });

  it('e vira o status quando não houver corpo — `http_500` é melhor que nada', () => {
    // A exceção não tratada é justamente a que ninguém previu, e por isso a
    // que mais precisa aparecer.
    expect(motivoDaResposta(null, 500)).toBe('http_500');
    expect(motivoDaResposta({ }, 500)).toBe('http_500');
    expect(motivoDaResposta({ erro: 42 }, 500)).toBe('http_500');
  });

  it('e um `erro` gigante não vira coluna gigante', () => {
    expect(motivoDaResposta({ erro: 'x'.repeat(500) }, 500)).toBe('http_500');
  });
});

describe('a agregação por hora', () => {
  it('põe a linha no início da hora, que é o que mantém a tabela pequena', () => {
    // No pior caso são `rotas × motivos × 24` linhas por dia. No caso normal,
    // quase nenhuma — e uma tabela vazia aqui é uma boa notícia legível.
    expect(horaDe(3_600)).toBe(3_600);
    expect(horaDe(3_601)).toBe(3_600);
    expect(horaDe(7_199)).toBe(3_600);
    expect(horaDe(7_200)).toBe(7_200);
  });
});

describe('toda recusa passa por um lugar só', () => {
  const fonte = readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8');

  it('o `fetch` anota, e não cada rota — senão a próxima rota esquece', () => {
    /**
     * Anotar dentro de cada handler seriam dezenas de chamadas, e a que
     * faltasse seria justamente a que ninguém ia procurar. O teste guarda o
     * lugar, não o texto.
     */
    expect(fonte).toMatch(/resposta\.status >= 400/);
    expect(fonte, 'sem waitUntil o livro atrasa a resposta do jogador')
      .toContain('ctx.waitUntil(anotarRecusa(');
  });

  it('e o corpo é CLONADO antes de ser lido', () => {
    // Ler o corpo consome o fluxo, e este é o corpo que já está a caminho do
    // jogador. Sem o clone, o livro engoliria a resposta que veio registrar.
    expect(fonte).toContain('resposta.clone().json()');
  });

  it('e a tabela existe nas migrações', () => {
    const sql = readFileSync(
      new URL('../server/migrations/0015-recusas.sql', import.meta.url), 'utf8',
    );
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS recusas');
    expect(sql, 'a chave precisa agregar por hora').toMatch(/PRIMARY KEY \(rota, motivo, hora\)/);
  });
});

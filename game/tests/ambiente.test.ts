import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decidirApi } from '@data/servidor';

/**
 * O isolamento entre produção e staging.
 *
 * ## O defeito que estes testes guardam
 *
 * Até 13/09/2026 o endereço da API era uma constante apontando para a
 * produção. Consequência que ninguém tinha escrito: abrir o jogo em
 * `localhost` e entrar numa conta escrevia no D1 dos jogadores — save,
 * inventário, carteira. Não havia ambiente de teste; havia a produção e a
 * esperança de não estragar nada.
 *
 * A regra nova é pequena e a tentação de "só desta vez cair para produção" é
 * grande, porque fechar dá trabalho na primeira vez. Por isso ela está travada
 * aqui: a asserção que importa é a de que **host local sem variável NÃO fala
 * com a produção**, e ela vale mais que todas as outras juntas.
 */

const PRODUCAO = 'https://orbita-zero-api.orbitazero.workers.dev';

describe('para onde o cliente manda as requisições', () => {
  it('a variável declarada vence em qualquer host', () => {
    for (const host of ['localhost', 'orbitazero.com.br', 'orbita-zero-abc.vercel.app']) {
      const r = decidirApi('https://orbita-zero-api-staging.orbitazero.workers.dev', host);
      expect(r.origem).toBe('variavel');
      expect(r.url).toBe('https://orbita-zero-api-staging.orbitazero.workers.dev');
    }
  });

  it('barra no fim não vira barra dupla na rota', () => {
    // `${API_URL}/inventario` com barra sobrando daria `//inventario`, que o
    // Worker responderia com 404 — e o cliente engole 404 como perda de dado.
    expect(decidirApi('http://127.0.0.1:8787/', 'localhost').url).toBe('http://127.0.0.1:8787');
    expect(decidirApi('http://127.0.0.1:8787///', 'localhost').url).toBe('http://127.0.0.1:8787');
  });

  it('host local SEM variável fecha, e nunca cai para a produção', () => {
    for (const host of ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']) {
      const r = decidirApi(undefined, host);
      expect(r.origem, `${host} deveria fechar`).toBe('fechado');
      expect(r.url).not.toContain('orbitazero.workers.dev');
    }
  });

  it('variável vazia ou só espaço conta como ausente, e também fecha', () => {
    expect(decidirApi('', 'localhost').origem).toBe('fechado');
    expect(decidirApi('   ', 'localhost').origem).toBe('fechado');
  });

  it('sem `location` — Node, testes, ferramentas — também fecha', () => {
    // Uma ferramenta que importasse `@data/servidor` e fizesse `fetch` iria
    // direto à produção sem ninguém decidir isso. Fora do navegador, fecha.
    expect(decidirApi(undefined, null).origem).toBe('fechado');
  });

  it('o endereço fechado é loopback, não um domínio que demore a falhar', () => {
    // Precisa recusar NA HORA. Um domínio inexistente custaria espera de DNS em
    // toda chamada e o erro chegaria disfarçado de "rede instável".
    expect(decidirApi(undefined, 'localhost').url).toBe('http://127.0.0.1:1');
  });

  it('qualquer outro host usa a produção', () => {
    for (const host of ['orbitazero.com.br', 'www.orbitazero.com.br', 'orbita-zero.vercel.app']) {
      const r = decidirApi(undefined, host);
      expect(r.origem).toBe('producao');
      expect(r.url).toBe(PRODUCAO);
    }
  });
});

describe('as duas instalações não se cruzam', () => {
  const toml = readFileSync(new URL('../server/wrangler.toml', import.meta.url), 'utf8');
  const producao = toml.slice(0, toml.indexOf('[env.staging'));
  const staging = toml.slice(toml.indexOf('[env.staging'));

  it('o staging tem banco próprio', () => {
    const idDaProducao = /database_id = "([^"]+)"/.exec(producao)?.[1];
    const idDoStaging = /database_id = "([^"]+)"/.exec(staging)?.[1];
    expect(idDaProducao).toBeTruthy();
    expect(idDoStaging).toBeTruthy();
    expect(idDoStaging, 'o staging está apontando para o banco dos jogadores')
      .not.toBe(idDaProducao);
  });

  it('e o binding continua sendo `DB`, senão o deploy falha em vez de vazar', () => {
    // `d1_databases` não é herdado por ambiente nomeado. Faltando aqui, o
    // deploy quebra — que é o lado certo para errar.
    expect(staging).toContain('binding = "DB"');
  });

  it('o domínio de produção não pode falar com o staging', () => {
    const origens = /ORIGENS = "([^"]*)"/.exec(staging)?.[1] ?? '';
    expect(origens).not.toContain('orbitazero.com.br');
    expect(origens).toContain('localhost');
  });

  it('e nem `localhost` nem preview podem falar com a produção', () => {
    /**
     * A metade da separação que NÃO depende do cliente estar certo.
     *
     * As duas entradas estiveram nesta lista por um bom motivo — eram o único
     * jeito de testar antes de existir o staging — e a tentação de recolocar
     * "só para depurar uma coisa" é exatamente como elas voltariam. Depurar
     * contra dados reais continua possível; só não pode ser por esquecimento.
     */
    const origens = /ORIGENS = "([^"]*)"/.exec(producao)?.[1] ?? '';
    expect(origens, 'localhost voltou a poder escrever no banco dos jogadores')
      .not.toContain('localhost');
    expect(origens, 'as previews voltaram a poder escrever no banco dos jogadores')
      .not.toContain('orbita-zero-*');
    // O site continua entrando, senão a trava teria quebrado o jogo.
    expect(origens).toContain('https://www.orbitazero.com.br');
  });

  it('o staging não move dinheiro', () => {
    expect(staging).toContain('INDICACOES_ATIVAS = "0"');
  });

  it('e não dispara o gatilho de tempo', () => {
    // O cron avisa das recusas. Alerta vindo de banco sintético ensina a
    // ignorar alerta — e aí o alerta da produção morre junto.
    expect(staging).toMatch(/\[env\.staging\.triggers\][\s\S]*crons = \[\]/);
  });

  it('cada instalação se declara', () => {
    expect(producao).toContain('AMBIENTE = "producao"');
    expect(staging).toContain('AMBIENTE = "staging"');
  });
});

describe('a escolha de ambiente não entra no repositório', () => {
  it('`.env.local` é ignorado', () => {
    const ignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
    expect(ignore).toMatch(/^\.env\.local$/m);
  });

  it('e `.env.example` não aponta para a produção', () => {
    // Copiar o exemplo não pode ser um jeito de voltar a escrever no banco dos
    // jogadores sem perceber.
    const exemplo = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    const ativas = exemplo.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
    expect(ativas.join('\n')).not.toContain(PRODUCAO);
  });
});

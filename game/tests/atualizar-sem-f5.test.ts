import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  CAMINHO_DA_VERSAO, CHAVE_DA_TENTATIVA, INTERVALO_DA_CHECAGEM,
  devoRecarregar, marcarTentativa, mudouDeVersao, versaoPublicada, vigiarVersao,
} from '@app/versao';

/**
 * O deploy que alcança quem já está jogando.
 *
 * ## O problema
 *
 * Num idle a aba fica aberta por horas. O deploy sai, e quem está dentro
 * continua com o bundle antigo até recarregar — o que ninguém faz, porque
 * ninguém tem como saber que precisa. O jogador segue com o defeito que acabou
 * de ser corrigido e reporta o mesmo problema de novo.
 *
 * ## As três coisas que podem dar errado aqui
 *
 * 1. **Recarregar na hora errada** — no meio de um chefe, perdendo a partida.
 * 2. **Laço de recarga** — deploy meio propagado devolve o bundle velho, a
 *    versão discorda de novo, e a página pisca sem parar.
 * 3. **Perder o que não subiu** — a fila de movimentos ainda não drenada.
 *
 * As três estão guardadas abaixo.
 */

const fonte = (...p: string[]): string =>
  readFileSync(join(process.cwd(), ...p), 'utf8');

const game = fonte('src', 'app', 'Game.ts');

const respostaCom = (corpo: unknown, ok = true): Response =>
  ({ ok, status: ok ? 200 : 500, json: async () => corpo }) as Response;

/** Uma memória de aba de mentira, para não depender de `sessionStorage`. */
const memoria = (): Storage => {
  const mapa = new Map<string, string>();
  return {
    getItem: (k: string) => mapa.get(k) ?? null,
    setItem: (k: string, v: string) => void mapa.set(k, v),
    removeItem: (k: string) => void mapa.delete(k),
    clear: () => mapa.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
};

describe('descobrir que saiu versão nova', () => {
  it('compara o carimbo do bundle com o publicado', () => {
    expect(mudouDeVersao('abc', 'def')).toBe(true);
    expect(mudouDeVersao('abc', 'abc')).toBe(false);
  });

  it('e não inventa mudança quando não conseguiu perguntar', () => {
    // Rede fora, 404, JSON torto, deploy no meio do caminho: os quatro chegam
    // aqui como `null`, e nenhum deles é motivo para recarregar a página de
    // ninguém.
    expect(mudouDeVersao('abc', null)).toBe(false);
  });

  it('a busca devolve null em tudo que dá errado, e nunca estoura', async () => {
    expect(await versaoPublicada(vi.fn(async () => respostaCom({ versao: 'x9' })))).toBe('x9');
    expect(await versaoPublicada(vi.fn(async () => respostaCom({}, true)))).toBeNull();
    expect(await versaoPublicada(vi.fn(async () => respostaCom({ versao: 7 })))).toBeNull();
    expect(await versaoPublicada(vi.fn(async () => respostaCom({}, false)))).toBeNull();
    expect(await versaoPublicada(vi.fn(async () => { throw new Error('offline'); }))).toBeNull();
  });

  it('e pergunta com cache desligado, dos dois jeitos', async () => {
    /**
     * O cabeçalho `no-store` depende de a hospedagem estar configurada; a query
     * diferente funciona mesmo contra um proxy que ignore o cabeçalho. Uma
     * checagem de versão servida do cache é uma checagem que nunca acusa nada.
     */
    const buscar = vi.fn(async () => respostaCom({ versao: 'x9' }));
    await versaoPublicada(buscar);
    const [url, opcoes] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(CAMINHO_DA_VERSAO);
    expect(url).toMatch(/\?t=\d+/);
    expect(opcoes.cache).toBe('no-store');
  });
});

describe('o laço de recarga, e a guarda contra ele', () => {
  it('a primeira tentativa passa', () => {
    expect(devoRecarregar('v2', memoria())).toBe(true);
  });

  it('a segunda pela MESMA versão não', () => {
    /**
     * Deploy em CDN não propaga tudo no mesmo instante: existe uma janela em
     * que `/versao.json` já é o novo e o `index.html` ainda é o velho. Sem esta
     * guarda o bundle voltaria antigo, discordaria de novo, e a página piscaria
     * até a propagação terminar.
     */
    const m = memoria();
    marcarTentativa('v2', m);
    expect(devoRecarregar('v2', m)).toBe(false);
    expect(m.getItem(CHAVE_DA_TENTATIVA)).toBe('v2');
  });

  it('mas uma versão AINDA mais nova passa de novo', () => {
    const m = memoria();
    marcarTentativa('v2', m);
    expect(devoRecarregar('v3', m)).toBe(true);
  });

  it('e sem memória nenhuma ela ainda decide recarregar', () => {
    // Janela anônima com dados de site bloqueados. O pior caso é uma recarga a
    // mais; travar a atualização seria pior que isso.
    expect(devoRecarregar('v2', null as unknown as Storage)).toBe(true);
    expect(() => marcarTentativa('v2', null as unknown as Storage)).not.toThrow();
  });

  it('a memória é da ABA, não do navegador', () => {
    // Duas abas são duas partidas. Em `localStorage`, a primeira a recarregar
    // calaria a segunda, que ficaria velha sem nunca mais ser avisada.
    expect(fonte('src', 'app', 'versao.ts')).toContain('window.sessionStorage');
  });
});

describe('a vigia', () => {
  it('avisa quando a versão publicada difere', async () => {
    const avisos: string[] = [];
    let disparar = (): void => {};
    vigiarVersao((nova) => avisos.push(nova), {
      atual: 'v1',
      buscar: vi.fn(async () => respostaCom({ versao: 'v2' })),
      agendar: (f) => { disparar = f; return 1; },
      cancelar: () => {},
      aoVoltarParaAba: () => () => {},
    });

    disparar();
    await vi.waitFor(() => expect(avisos).toEqual(['v2']));
  });

  it('e cala quando é a mesma', async () => {
    const avisos: string[] = [];
    let disparar = (): void => {};
    vigiarVersao((nova) => avisos.push(nova), {
      atual: 'v1',
      buscar: vi.fn(async () => respostaCom({ versao: 'v1' })),
      agendar: (f) => { disparar = f; return 1; },
      cancelar: () => {},
      aoVoltarParaAba: () => () => {},
    });

    disparar();
    await new Promise((r) => setTimeout(r, 10));
    expect(avisos).toEqual([]);
  });

  it('e pergunta também quando a aba volta a aparecer', () => {
    /**
     * A parte que mais importa num idle: o navegador estrangula temporizadores
     * de fundo, então a checagem agendada pode simplesmente não acontecer numa
     * aba escondida por horas. Voltar para a aba é quando o jogador vai jogar
     * de novo — e é onde a pergunta tem de ser feita de qualquer jeito.
     */
    let registrou = false;
    vigiarVersao(() => {}, {
      buscar: vi.fn(async () => respostaCom({ versao: 'v1' })),
      agendar: () => 1,
      cancelar: () => {},
      aoVoltarParaAba: () => { registrou = true; return () => {}; },
    });
    expect(registrou).toBe(true);
  });

  it('e o desligador para de vez', async () => {
    const avisos: string[] = [];
    let disparar = (): void => {};
    const parar = vigiarVersao((nova) => avisos.push(nova), {
      atual: 'v1',
      buscar: vi.fn(async () => respostaCom({ versao: 'v2' })),
      agendar: (f) => { disparar = f; return 1; },
      cancelar: () => {},
      aoVoltarParaAba: () => () => {},
    });

    parar();
    disparar();
    await new Promise((r) => setTimeout(r, 10));
    expect(avisos).toEqual([]);
  });

  it('e o intervalo não bate na hospedagem a cada quadro', () => {
    // São trinta bytes, mas por jogador e por aba. Cinco minutos é atraso
    // aceitável para uma correção e ruído nenhum para a cota.
    expect(INTERVALO_DA_CHECAGEM).toBeGreaterThanOrEqual(60_000);
  });
});

describe('quando o jogo recarrega, e o que ele salva antes', () => {
  it('nunca no meio de um setor: espera o fim, ou a aba esconder', () => {
    /**
     * Recarregar durante um chefe troca um incômodo pequeno — versão velha —
     * por um grande: a partida atrapalhada. Os dois gatilhos são momentos em
     * que não há nada em voo.
     */
    expect(game).toContain("bus.on('sector:advanced', () => { if (this.versaoNova) this.recarregarParaAtualizar(); });");
    expect(game).toContain('if (this.versaoNova) this.recarregarParaAtualizar();');
    expect(game).toContain('if (document.hidden) return this.recarregarParaAtualizar();');
  });

  it('e grava o save LOCAL antes de trocar de página', () => {
    /**
     * A fila de movimentos mora dentro do save (`state.pendentes`), e o save é
     * local e síncrono. É isso que faz a recarga não perder nada mesmo com a
     * rede morta: o que não subiu agora sobe no próximo boot.
     */
    const t = game.slice(game.indexOf('private recarregarParaAtualizar'));
    const corpo = t.slice(0, t.indexOf('\n  }\n'));
    expect(corpo.indexOf('this.sim.save()')).toBeLessThan(corpo.indexOf('location.reload()'));
  });

  it('e marca a tentativa ANTES de recarregar', () => {
    // Depois do `reload` não existe "depois": a marca é o que impede o laço.
    const t = game.slice(game.indexOf('private recarregarParaAtualizar'));
    const corpo = t.slice(0, t.indexOf('\n  }\n'));
    expect(corpo.indexOf('marcarTentativa(')).toBeLessThan(corpo.indexOf('location.reload()'));
  });

  it('e não ESPERA a subida — rede morta não pode prender ninguém', () => {
    const t = game.slice(game.indexOf('private recarregarParaAtualizar'));
    const corpo = t.slice(0, t.indexOf('\n  }\n'));
    expect(corpo).toContain('void this.subirTratandoConflito(true);');
    expect(corpo).not.toMatch(/await\s+this\.subirTratandoConflito/);
  });

  it('e dois gatilhos ao mesmo tempo recarregam uma vez só', () => {
    const t = game.slice(game.indexOf('private recarregarParaAtualizar'));
    const corpo = t.slice(0, t.indexOf('\n  }\n'));
    expect(corpo).toContain('if (!this.versaoNova || this.recarregando) return;');
  });
});

describe('o build publica o carimbo, e a hospedagem não o guarda', () => {
  const vite = fonte('vite.config.ts');

  it('o mesmo valor entra no bundle e no arquivo', () => {
    // Dois carimbos gerados em momentos diferentes nunca casariam, e o jogo
    // recarregaria para sempre.
    expect(vite).toContain('const VERSAO_DO_BUILD =');
    expect(vite).toContain('__VERSAO_DO_BUNDLE__: JSON.stringify(VERSAO_DO_BUILD)');
    expect(vite).toContain("fileName: 'versao.json'");
    expect(vite).toContain('JSON.stringify({ versao: VERSAO_DO_BUILD })');
    expect(vite).toContain('versaoPlugin()');
  });

  it('e o arquivo não vive em public/, para ninguém ter de lembrar dele', () => {
    // Versionado no git, ele viraria um passo manual a cada deploy — e
    // esquecer significa o jogo inteiro parar de se atualizar, calado.
    expect(() => fonte('public', 'versao.json')).toThrow();
  });

  it('e a hospedagem manda não guardar', () => {
    const vercel = JSON.parse(fonte('vercel.json')) as {
      headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    const regra = vercel.headers.find((h) => h.source === '/versao.json');
    expect(regra?.headers[0]).toEqual({ key: 'Cache-Control', value: 'no-store' });
  });
});

import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@app/conta', () => ({ tokenValido: async () => 'token-de-teste' }));

import { abrirCobranca, conferirCompra, motivoLegivel } from '@app/compras';
import { carteira, esquecer } from '@app/carteira';
import { BALDES, podeUsar, type Balde } from '../server/src/ritmo';

/**
 * O caminho entre "abri o Pix" e "os cristais chegaram".
 *
 * ## O defeito que estes testes existem para impedir
 *
 * É sempre o mesmo, e tem nome: **paguei e não recebi**. Ele não se conserta
 * com deploy, porque o dinheiro já saiu da conta de alguém.
 *
 * O jeito de ele acontecer não é o crédito errado — esse já está guardado em
 * `a-compra-de-cristais.test.ts`. É o crédito que **nunca é disparado**: o
 * webhook depende de uma URL configurada certo no painel de outra empresa, de
 * o nosso Worker estar de pé no segundo em que ele sai, e de a assinatura
 * conferir. Os três falham calados.
 *
 * Por isso existem TRÊS caminhos até o mesmo crédito, e cada um cobre uma
 * falha dos outros:
 *
 * | caminho | quem dispara | cobre |
 * |---|---|---|
 * | webhook | o provedor | o caso normal, em segundos |
 * | `/compra` | a tela do Pix, de 5 em 5 s | webhook perdido, com o jogador olhando |
 * | varredura | o gatilho de 5 min | webhook perdido E aba fechada |
 *
 * O que se guarda aqui é a existência e a ordem desses caminhos.
 */

const painel = readFileSync(new URL('../src/ui/panels/ShopPanel.ts', import.meta.url), 'utf8');
const index = readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8');

/** O corpo de uma função de `index.ts`, para afirmar sobre ORDEM. */
function corpoDe(nome: string): string {
  const t = index.slice(index.indexOf(`async function ${nome}`));
  return t.slice(0, t.indexOf('\n}\n'));
}

const resposta = (dados: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: async () => dados, text: async () => JSON.stringify(dados) }) as Response;

describe('a tela pede a cobrança, e não o preço', () => {
  beforeEach(() => { esquecer(); vi.unstubAllGlobals(); });

  it('manda só o id do pacote', async () => {
    /**
     * O ataque é de uma linha: mandar `centavos: 1` junto do pacote de R$ 99,90.
     * A defesa de verdade está no servidor, que ignora o corpo e lê o catálogo
     * — mas o cliente não pode nem OFERECER o campo, porque no dia em que
     * alguém achar que "é mais prático mandar o preço junto", este teste cai.
     */
    const chamadas = vi.fn(async () => resposta({
      compra: 'c-1', cristais: 500, centavos: 2490, qr: '', copiaECola: '000201...',
    }));
    vi.stubGlobal('fetch', chamadas);

    await abrirCobranca('comando');

    const [, opcoes] = chamadas.mock.calls[0] as unknown as [string, RequestInit];
    const corpo = JSON.parse(String(opcoes.body)) as Record<string, unknown>;
    expect(Object.keys(corpo)).toEqual(['pacote']);
    expect(corpo.pacote).toBe('comando');
  });

  it('e uma resposta sem copia-e-cola é RECUSA, não sucesso', async () => {
    /**
     * Um 200 com o código vazio é a pior das respostas: a tela abriria o QR e
     * o jogador esperaria para sempre um pagamento que ele não tem como fazer.
     * Melhor dizer que não deu.
     */
    vi.stubGlobal('fetch', vi.fn(async () => resposta({
      compra: 'c-1', cristais: 500, centavos: 2490, qr: '', copiaECola: '',
    })));

    const r = await abrirCobranca('comando');
    expect(r.ok).toBe(false);
  });

  it('e toda recusa vira frase, nunca código cru', () => {
    // A regra do projeto é que a falha do servidor seja AUDÍVEL — e audível,
    // numa tela, quer dizer legível.
    expect(motivoLegivel('pagamento_indisponivel')).toMatch(/PAGAMENTO/);
    expect(motivoLegivel('rapido_demais')).toMatch(/ESPERE/);
    expect(motivoLegivel('um_erro_que_ainda_nao_existe')).toMatch(/TENTE DE NOVO/);
    expect(motivoLegivel('')).not.toBe('');
  });
});

describe('a confirmação traz o saldo, e o saldo é do servidor', () => {
  beforeEach(() => { esquecer(); vi.unstubAllGlobals(); });

  it('adota a carteira que veio junto', async () => {
    /**
     * O instante em que o jogador quer ver o saldo novo é exatamente este. Sem
     * adotar aqui, a tela diria "recebido!" com o número antigo no topo até o
     * fim do setor seguinte — que é quando a carteira drena.
     */
    vi.stubGlobal('fetch', vi.fn(async () => resposta({
      compra: 'c-1', estado: 'paga', cristais: 500, centavos: 2490, expirada: false,
      carteira: { saldos: { sucata: 10, nucleo: 20, cristal: 1_500 }, vipExpiraEm: 0 },
    })));

    const r = await conferirCompra('c-1');
    expect(r?.estado).toBe('paga');
    expect(carteira().saldos.cristal).toBe(1_500);
  });

  it('e uma recusa não mexe no espelho', async () => {
    // Indisponibilidade não pode se disfarçar de perda de saldo: é o defeito
    // que já apareceu como "a nave estava vazia de itens".
    vi.stubGlobal('fetch', vi.fn(async () => resposta({ erro: 'rapido_demais' }, false, 429)));

    expect(await conferirCompra('c-1')).toBeNull();
    expect(carteira().saldos.cristal).toBe(0);
  });

  it('e a rede fora também não', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await conferirCompra('c-1')).toBeNull();
    expect(carteira().saldos.cristal).toBe(0);
  });
});

describe('a rota que a tela pergunta', () => {
  const corpo = corpoDe('estadoDaCompra');

  it('exige token, ao contrário do webhook', () => {
    // O webhook é a única rota sem sessão, e é assim porque quem chama é o
    // provedor. Esta é do jogador: entrar sem token seria ler a compra alheia.
    expect(index.indexOf("url.pathname === '/compra'"))
      .toBeGreaterThan(index.indexOf('const usuario = await usuarioDoToken('));
  });

  it('e só devolve a compra de quem perguntou', () => {
    // `AND usuario = ?` é a autorização inteira: sem isso, um id vazado deixaria
    // qualquer conta ler a cobrança de outra pessoa.
    expect(corpo).toContain('lerCompra(env, id, usuario)');
    expect(index).toContain('SELECT * FROM compras WHERE id = ? AND usuario = ?');
  });

  it('e RELÊ a compra depois de tentar creditar', () => {
    /**
     * `creditarPagamento` pode ter acabado de marcar a compra como paga.
     * Responder com a linha lida antes mandaria a tela continuar esperando um
     * dinheiro que já entrou — e o jogador fecharia a aba achando que falhou.
     */
    expect(corpo.indexOf('creditarPagamento(')).toBeLessThan(corpo.indexOf('const atual = await lerCompra'));
  });

  it('e separa "vencida" de "recusada"', () => {
    // Um Pix pago depois da validade continua sendo creditado — `podePagar`
    // aceita a expirada de propósito. O campo só manda a tela parar de esperar.
    expect(corpo).toContain('expirada: expirou(');
  });
});

describe('os dois ritmos: a tela pergunta a nós, nós perguntamos ao provedor', () => {
  const corpo = corpoDe('estadoDaCompra');

  it('a pergunta da tela e a consulta ao provedor têm baldes diferentes', () => {
    /**
     * Se fossem o mesmo, cada pergunta da tela viraria uma chamada à API do
     * Mercado Pago: doze por minuto por jogador esperando. É assim que se toma
     * um bloqueio do provedor justamente na hora em que o dinheiro está
     * entrando.
     */
    expect(corpo).toContain("consumirFicha(env, usuario, 'cobranca', agora)");
    expect(corpo).toContain("consumirFicha(env, usuario, 'provedor', agora)");
    expect(BALDES.provedor.refil).toBeGreaterThan(BALDES.cobranca.refil);
  });

  it('e o balde da tela cabe a espera inteira, de cinco em cinco segundos', () => {
    // O ritmo é lido da TELA: se alguém acelerar o laço lá sem olhar o balde
    // daqui, o jogador vê `rapido_demais` no meio de um pagamento.
    const intervalo = Number(/INTERVALO_DA_ESPERA = (\d+)/.exec(painel)![1]) / 1000;
    expect(intervalo).toBeGreaterThan(0);

    let balde: Balde | null = { fichas: BALDES.cobranca.capacidade, em: 0 };
    let recusas = 0;
    // Trinta minutos é quanto a cobrança vale.
    for (let t = 0; t <= 30 * 60; t += intervalo) {
      const v = podeUsar('cobranca', balde, t);
      if (!v.pode) { recusas++; continue; }
      balde = { fichas: v.fichasRestantes, em: t };
    }
    expect(recusas).toBe(0);
  });

  it('e o balde do provedor recusa o laço, mesmo assim', () => {
    // Ele é a defesa contra a tela virar um martelo na API de outra empresa.
    let balde: Balde | null = { fichas: BALDES.provedor.capacidade, em: 0 };
    let passaram = 0;
    for (let i = 0; i < 60; i++) {
      const v = podeUsar('provedor', balde, 1_000);
      if (!v.pode) break;
      passaram++;
      balde = { fichas: v.fichasRestantes, em: 1_000 };
    }
    expect(passaram).toBeLessThanOrEqual(BALDES.provedor.capacidade);
  });
});

describe('o id do provedor é guardado na criação, e não na chegada do webhook', () => {
  const corpo = corpoDe('abrirCobranca');

  it('a cobrança criada já sabe por onde ser consultada', () => {
    /**
     * É o que torna os outros dois caminhos possíveis. Guardar o id só quando o
     * webhook chega faz a resposta depender da pergunta: sem webhook, não há
     * por onde consultar, e o jogador que pagou fica sem caminho automático.
     */
    expect(corpo).toContain('UPDATE compras SET provedor_id = ?');
    expect(corpo.indexOf('criarPixNoMP(')).toBeLessThan(corpo.indexOf('UPDATE compras SET provedor_id'));
  });
});

describe('a varredura, que é o caminho de quando ninguém está olhando', () => {
  const corpo = corpoDe('varrerCobrancas');

  it('roda no gatilho que já existe', () => {
    expect(index).toContain('await varrerCobrancas(env);');
  });

  it('e não pergunta sobre cobrança recém-criada', () => {
    // Essa é do webhook. Perguntar ao provedor sobre uma cobrança de segundos
    // atrás dobra o tráfego para não adiantar nada.
    expect(corpo).toContain('agora - 60');
  });

  it('e uma cobrança que estoura não derruba as outras', () => {
    // A próxima da lista pode ser justamente a que tem dinheiro parado. É a
    // mesma regra do lote: um comando ruim não derruba o lote inteiro.
    expect(corpo).toMatch(/for \(const linha of results\)[\s\S]*try \{[\s\S]*catch/);
  });

  it('e a lista não cresce para sempre', () => {
    // Sem fechar as velhas, a cada cinco minutos perguntaríamos ao provedor
    // sobre toda cobrança abandonada da semana.
    expect(corpo).toContain("UPDATE compras SET estado = 'expirada'");
  });

  it('e sem credencial ela não faz nada', () => {
    expect(corpo).toContain('if (!env.MP_ACCESS_TOKEN) return;');
  });
});

describe('a tela deixou de dizer EM BREVE', () => {
  it('o botão do pacote abre a cobrança', () => {
    expect(painel).not.toContain('EM BREVE');
    expect(painel).toContain('this.pedirCobranca(sim, pack.id)');
  });

  it('e o copia-e-cola aparece mesmo sem QR', () => {
    // Quem joga no celular não tem uma segunda câmera para ler a própria tela.
    expect(painel).toContain('CÓDIGO COPIA E COLA');
    expect(painel).toContain('USE O CÓDIGO AO LADO');
  });

  it('e o crédito confirmado espelha na hora', () => {
    /**
     * `state.resources` é ESPELHO do servidor, e quem o preenche é
     * `espelharNoSim`. Sem esta chamada, o topo da Loja mostraria o saldo
     * antigo até o fim do setor seguinte — no exato segundo em que o jogador
     * quer ver o número subir.
     */
    expect(painel).toContain('espelharNoSim(sim);');
  });
});

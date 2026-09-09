import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  VALIDADE_DA_COBRANCA, assinaturaConfere, expirou, manifestoDoMP, novaCompra,
  pacotePorId, partesDaAssinatura, podePagar, valorConfere, type Compra,
} from '../server/src/compras';
import { CRYSTAL_PACKAGES, cristaisDoPacote } from '@sim/vip';

/**
 * A compra de cristais com dinheiro de verdade.
 *
 * ## Por que estes testes são mais paranoicos que os outros
 *
 * É a única área do projeto onde um defeito não se conserta com um deploy.
 * Creditar errado significa que alguém pagou e não recebeu; aceitar errado
 * significa cristais de graça, e o pódio premiado deixa de valer.
 *
 * A regra que organiza tudo: **o jogador nunca é creditado por dizer que
 * pagou**. Ele pede a cobrança, o PROVEDOR confirma, e só então o livro-caixa
 * registra — a mesma forma do resto do servidor.
 */

const PACOTE = CRYSTAL_PACKAGES[3]!;
const compra = (p: Partial<Compra> = {}): Compra =>
  ({ ...novaCompra('c-1', 'u-1', PACOTE, 1_000), ...p });

describe('o preço é do servidor, nunca do cliente', () => {
  it('o pacote vem do catálogo, pelo id', () => {
    const p = pacotePorId(PACOTE.id)!;
    expect(p.priceCents).toBe(PACOTE.priceCents);
  });

  it('e um id inventado não vira cobrança', () => {
    // Sem isto, `pacote: 'gratis'` seria a compra mais barata do jogo.
    expect(pacotePorId('gratis')).toBeNull();
    expect(pacotePorId(null)).toBeNull();
    expect(pacotePorId({ priceCents: 1 })).toBeNull();
  });

  it('e a cobrança CONGELA cristais e centavos', () => {
    /**
     * Entre criar a cobrança e o Pix ser pago passam minutos, e o catálogo pode
     * mudar nesse intervalo — promoção, reajuste. O jogador precisa receber o
     * que foi anunciado quando pagou, não o que a tabela diz quando o webhook
     * chega.
     */
    const c = novaCompra('c-9', 'u-1', PACOTE, 1_000);
    expect(c.cristais).toBe(cristaisDoPacote(PACOTE));
    expect(c.centavos).toBe(PACOTE.priceCents);
    expect(c.estado).toBe('pendente');
    expect(c.pagaEm).toBeNull();
  });
});

describe('o valor pago é conferido contra o cobrado', () => {
  it('pagar menos NÃO credita', () => {
    /**
     * O ataque concreto: criar a cobrança do pacote de R$ 49,90 e pagar um
     * centavo. O Pix aceita valor diferente do combinado em várias
     * configurações, e sem esta conferência o webhook diria "pago" e o servidor
     * creditaria 1.100 cristais por R$ 0,01.
     */
    expect(valorConfere(compra(), 1)).toBe(false);
    expect(valorConfere(compra(), PACOTE.priceCents - 1)).toBe(false);
  });

  it('e pagar o valor certo credita', () => {
    expect(valorConfere(compra(), PACOTE.priceCents)).toBe(true);
  });

  it('e pagar A MAIS credita — o dinheiro entrou', () => {
    // Recusar aqui seria ficar com o dinheiro e não entregar nada, que é pior
    // que qualquer arredondamento.
    expect(valorConfere(compra(), PACOTE.priceCents + 100)).toBe(true);
  });

  it('e lixo no valor não passa', () => {
    for (const v of [null, undefined, 'muito', NaN, Infinity]) {
      expect(valorConfere(compra(), v), String(v)).toBe(false);
    }
  });
});

describe('uma compra só é paga uma vez', () => {
  it('a pendente aceita', () => {
    expect(podePagar(compra())).toBeNull();
  });

  it('e a já paga recusa — o provedor REENVIA o mesmo webhook', () => {
    // Não é caso raro: reenviar é o desenho do Mercado Pago. Se isto falhasse,
    // um pagamento creditaria a cada reenvio.
    expect(podePagar(compra({ estado: 'paga' }))).toBe('compra_ja_encerrada');
  });

  it('e a cancelada também', () => {
    expect(podePagar(compra({ estado: 'cancelada' }))).toBe('compra_ja_encerrada');
  });

  it('mas a EXPIRADA ainda aceita, e é de propósito', () => {
    /**
     * Parece contraditório e é a decisão certa. A validade existe para limpar o
     * painel, não para recusar dinheiro que entrou: se o Pix caiu, saiu da
     * conta de alguém. Recusar transformaria um atraso de trinta minutos num
     * jogador lesado.
     */
    const velha = compra({ criadaEm: 1_000 });
    expect(expirou(velha, 1_000 + VALIDADE_DA_COBRANCA + 1)).toBe(true);
    expect(podePagar(velha)).toBeNull();
  });

  it('e a recém-criada não está expirada', () => {
    expect(expirou(compra(), 1_000 + VALIDADE_DA_COBRANCA - 1)).toBe(false);
  });
});

describe('a assinatura do webhook', () => {
  const SEGREDO = 'segredo-de-teste-do-webhook';

  /** Assina como o Mercado Pago assina, para o teste não depender do provedor. */
  async function assinar(manifesto: string): Promise<string> {
    const enc = new TextEncoder();
    const chave = await crypto.subtle.importKey(
      'raw', enc.encode(SEGREDO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', chave, enc.encode(manifesto));
    return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  it('aceita a assinatura correta', async () => {
    const manifesto = manifestoDoMP('123', 'req-1', '1700000000');
    expect(await assinaturaConfere(SEGREDO, manifesto, await assinar(manifesto))).toBe(true);
  });

  it('e recusa a de outro segredo', async () => {
    // É a única autenticação do webhook: ele não tem token de jogador. Sem
    // isto, qualquer um que descobrisse a URL creditaria cristais de graça.
    const manifesto = manifestoDoMP('123', 'req-1', '1700000000');
    const v1 = await assinar(manifesto);
    expect(await assinaturaConfere('outro-segredo', manifesto, v1)).toBe(false);
  });

  it('e recusa quando QUALQUER parte do manifesto muda', async () => {
    /**
     * O manifesto amarra o id do pagamento, o id da requisição e o instante.
     * Sem essa amarração, uma assinatura válida de um pagamento de R$ 4,90
     * serviria para um de R$ 99,90 — bastaria trocar o id no corpo.
     */
    const v1 = await assinar(manifestoDoMP('123', 'req-1', '1700000000'));
    expect(await assinaturaConfere(SEGREDO, manifestoDoMP('999', 'req-1', '1700000000'), v1)).toBe(false);
    expect(await assinaturaConfere(SEGREDO, manifestoDoMP('123', 'req-2', '1700000000'), v1)).toBe(false);
    expect(await assinaturaConfere(SEGREDO, manifestoDoMP('123', 'req-1', '1700000001'), v1)).toBe(false);
  });

  it('e segredo vazio recusa, em vez de aceitar qualquer coisa', async () => {
    // Sem `MP_WEBHOOK_SECRET` configurado, a alternativa seria aceitar toda
    // requisição que chegue naquela URL. A resposta segura é recusar.
    const manifesto = manifestoDoMP('123', 'req-1', '1700000000');
    expect(await assinaturaConfere('', manifesto, await assinar(manifesto))).toBe(false);
  });

  it('e o cabeçalho deformado não estoura', async () => {
    for (const c of [null, '', 'lixo', 'ts=1', 'v1=abc', 'ts=1,v1=naoehex']) {
      expect(partesDaAssinatura(c), String(c)).toBeNull();
    }
    expect(partesDaAssinatura(`ts=1700000000,v1=${'a'.repeat(64)}`))
      .toEqual({ ts: '1700000000', v1: 'a'.repeat(64) });
  });
});

describe('a ordem das operações no servidor', () => {
  const index = readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8');
  const trecho = index.slice(index.indexOf('async function creditarPagamento'));
  const corpo = trecho.slice(0, trecho.indexOf('\n}\n'));

  it('o crédito vem ANTES de marcar a compra como paga', () => {
    /**
     * Se fosse o inverso e a escrita do livro falhasse, a compra ficaria paga
     * sem os cristais terem entrado — e o reenvio do webhook seria recusado por
     * `compra_ja_encerrada`. O jogador pagaria e não receberia, sem conserto
     * automático.
     *
     * Nesta ordem, uma falha no meio deixa o crédito feito e a compra pendente:
     * o reenvio tenta de novo, o livro recusa por `repetido`, e a marcação se
     * completa.
     */
    expect(corpo.indexOf('lancar(env, {')).toBeLessThan(corpo.indexOf("estado = 'paga'"));
  });

  it('e `repetido` do livro NÃO é tratado como erro', () => {
    // É o caminho normal quando o provedor reenvia. Tratar como falha faria a
    // compra nunca ser marcada como paga.
    expect(corpo).toContain("r.erro !== 'repetido'");
  });

  it('e a origem do lançamento é o id do PAGAMENTO', () => {
    // É o índice único `(motivo, origem)` que impede o crédito dobrado. Usar o
    // id da compra em vez do pagamento perderia a amarração com o provedor.
    expect(corpo).toContain('origem: pagamentoId');
    expect(corpo).toContain("motivo: 'compra'");
  });

  it('e o estado vem da API do provedor, não do corpo do webhook', () => {
    /**
     * O corpo diz só o id. Quem responde "foi pago, e de quanto" é a consulta
     * autenticada — acreditar no corpo seria aceitar que quem forjasse a
     * requisição declarasse o próprio pagamento.
     */
    expect(corpo).toContain('lerPagamentoNoMP(env, pagamentoId)');
    expect(corpo).toContain("pago.estado !== 'approved'");
  });
});

describe('o webhook, e por que ele é a rota mais perigosa', () => {
  const index = readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8');

  it('está ANTES da checagem de token — quem chama não tem sessão', () => {
    expect(index.indexOf("url.pathname === '/webhook/pagamento'"))
      .toBeLessThan(index.indexOf('const usuario = await usuarioDoToken('));
  });

  it('e por isso a assinatura é conferida antes de qualquer outra coisa', () => {
    const t = index.slice(index.indexOf('async function receberPagamento'));
    const corpo = t.slice(0, t.indexOf('\n}\n'));
    expect(corpo.indexOf('assinaturaConfere(')).toBeLessThan(corpo.indexOf('creditarPagamento('));
  });

  it('e responde 200 mesmo quando ignora', () => {
    // Um 4xx faz o Mercado Pago reenviar por horas. O que interessa registrar
    // fica no livro das recusas, não no status.
    const t = index.slice(index.indexOf('async function receberPagamento'));
    const corpo = t.slice(0, t.indexOf('\n}\n'));
    expect(corpo).toContain("const ok = json({ ok: true }, 200, '');");
    expect(corpo).not.toMatch(/return json\([^)]*4\d\d/);
  });

  it('e toda recusa dele entra no livro', () => {
    // Assinatura inválida é alguém tentando creditar de graça, ou o segredo
    // configurado errado. As duas precisam aparecer no aviso de cinco minutos.
    for (const motivo of ['assinatura_invalida', 'assinatura_ausente', 'valor_divergente']) {
      expect(index, motivo).toContain(`'${motivo}'`);
    }
  });
});

describe('o checkout', () => {
  const index = readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8');
  const t = index.slice(index.indexOf('async function abrirCobranca'));
  const corpo = t.slice(0, t.indexOf('\n}\n'));

  it('grava a compra ANTES de falar com o provedor', () => {
    /**
     * Se a cobrança fosse criada lá e a resposta se perdesse no caminho, o
     * webhook chegaria para uma compra que não existe — dinheiro pago sem dono.
     */
    expect(corpo.indexOf('INSERT INTO compras')).toBeLessThan(corpo.indexOf('criarPixNoMP('));
  });

  it('e não aceita valor nenhum do corpo', () => {
    // O corpo só traz o id do pacote. Aceitar `centavos` seria deixar o jogador
    // dizer quanto vai pagar.
    expect(corpo).toContain('pacotePorId(corpo.pacote)');
    expect(corpo).not.toContain('corpo.centavos');
    expect(corpo).not.toContain('corpo.cristais');
  });

  it('e sem credencial responde indisponível, em vez de estourar', () => {
    // O jogo inteiro funciona sem as chaves configuradas: é o que permite
    // construir e testar tudo antes de existir conta ativa no provedor.
    expect(corpo).toContain("json({ erro: 'pagamento_indisponivel' }, 503, origem)");
  });
});

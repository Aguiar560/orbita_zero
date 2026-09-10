import { describe, expect, it } from 'vitest';

import { ShopPanel } from '@ui/panels/ShopPanel';

/**
 * Reabrir a Loja volta à vitrine depois de uma compra terminada.
 *
 * Relato de 10/09/2026, na primeira compra real: "mesmo eu saindo e entrando na
 * loja, a tela do pix continua lá". A cobrança morava num campo do painel, que
 * sobrevive a fechar e abrir.
 */

type Interno = { cobranca: unknown; compraEstado: string };
const cobranca = { compra: 'c1', qr: '', copiaECola: 'x', cristais: 80, centavos: 490 };

describe('a Loja ao reabrir', () => {
  it('esquece a cobrança paga', () => {
    const loja = new ShopPanel();
    const p = loja as unknown as Interno;
    p.cobranca = cobranca;
    p.compraEstado = 'paga';
    loja.aoAbrir();
    expect(p.cobranca).toBeNull();
    expect(p.compraEstado).toBe('pendente');
  });

  it('esquece a vencida e a cancelada', () => {
    for (const estado of ['expirada', 'cancelada']) {
      const loja = new ShopPanel();
      const p = loja as unknown as Interno;
      p.cobranca = cobranca;
      p.compraEstado = estado;
      loja.aoAbrir();
      expect(p.cobranca, estado).toBeNull();
    }
  });

  it('mas guarda o Pix que ainda espera pagamento', () => {
    // Quem fechou a Loja no meio do pagamento precisa reencontrar o QR.
    const loja = new ShopPanel();
    const p = loja as unknown as Interno;
    p.cobranca = cobranca;
    p.compraEstado = 'pendente';
    loja.aoAbrir();
    expect(p.cobranca).toBe(cobranca);
  });
});

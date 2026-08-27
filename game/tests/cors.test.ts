/**
 * A lista de origens da API.
 *
 * Curinga em CORS é onde se erra feio: `https://*.vercel.app` deixaria qualquer
 * pessoa publicar um site naquele domínio e falar com esta API usando as
 * credenciais de quem abrisse a página. O padrão daqui exige o prefixo do
 * projeto, que só quem tem acesso ao projeto consegue produzir.
 *
 * O motivo de o curinga existir: os deploys de PREVIEW da Vercel ganham um host
 * por build, e sem eles testar numa branch batia em CORS — a sincronização
 * falhava calada e o save ficava preso no navegador sem nenhuma mensagem.
 */

import { describe, expect, it } from 'vitest';

import { casaComPadrao } from '../server/src/index';

const PADRAO = 'https://orbita-zero-*.vercel.app';

describe('origem por padrão', () => {
  it('aceita um preview do projeto', () => {
    for (const bom of [
      'https://orbita-zero-a1b2c3.vercel.app',
      'https://orbita-zero-git-main-aguiar.vercel.app',
    ]) {
      expect(casaComPadrao(bom, PADRAO), bom).toBe(true);
    }
  });

  it('recusa domínio de terceiro no mesmo host', () => {
    // O ataque óbvio: alguém publica em vercel.app e tenta passar.
    for (const mau of [
      'https://malicioso.vercel.app',
      'https://orbita-zeroX.vercel.app.malicioso.com',
      'https://orbita-zero-.vercel.app.mau.com',
    ]) {
      expect(casaComPadrao(mau, PADRAO), mau).toBe(false);
    }
  });

  it('o miolo é um rótulo de host, e nada além', () => {
    // Sem esta checagem, `a.b/../..` e `a@b` passariam pelo startsWith/endsWith
    // — que é exatamente como validação de origem por prefixo costuma falhar.
    for (const mau of [
      'https://orbita-zero-a/b.vercel.app',
      'https://orbita-zero-a.b.vercel.app',
      'https://orbita-zero-a@b.vercel.app',
      'https://orbita-zero-a:b.vercel.app',
    ]) {
      expect(casaComPadrao(mau, PADRAO), mau).toBe(false);
    }
  });

  it('o miolo não pode ser vazio', () => {
    // `https://orbita-zero-.vercel.app` não é preview de ninguém.
    expect(casaComPadrao('https://orbita-zero-.vercel.app', PADRAO)).toBe(false);
  });

  it('recusa http puro', () => {
    expect(casaComPadrao('http://orbita-zero-a1.vercel.app', PADRAO)).toBe(false);
  });

  it('padrão perigoso é recusado como PADRÃO', () => {
    // A defesa mais importante: mesmo que alguém escreva uma entrada larga
    // demais na configuração, ela não vale.
    for (const perigoso of ['https://*', '*', 'https://*.vercel.app*', '*.vercel.app']) {
      expect(casaComPadrao('https://qualquer-coisa.com', perigoso), perigoso).toBe(false);
    }
  });

  it('um curinga só', () => {
    expect(casaComPadrao('https://a-b-c.vercel.app', 'https://*-*.vercel.app')).toBe(false);
  });

  it('sem curinga, é comparação exata', () => {
    expect(casaComPadrao('https://orbita-zero.vercel.app', 'https://orbita-zero.vercel.app')).toBe(false);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('domínio oficial', () => {
  it('declara orbitazero.com.br como endereço canônico', () => {
    const pagina = readFileSync('index.html', 'utf8');
    expect(pagina).toContain('<link rel="canonical" href="https://orbitazero.com.br/"');
    expect(pagina).toContain('<meta property="og:url" content="https://orbitazero.com.br/"');
  });

  it('mantém o host antigo fora dos buscadores durante a transição', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      headers?: { has?: { type: string; value: string }[]; headers?: { key: string; value: string }[] }[];
    };
    const regra = config.headers?.find((item) => item.has?.some((condicao) =>
      condicao.type === 'host' && condicao.value === 'orbita-zero.vercel.app'));
    expect(regra?.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex' });
  });
});

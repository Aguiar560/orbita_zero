import { afterEach, describe, expect, it, vi } from 'vitest';
import { Assets } from '../src/render/Assets';

describe('carregamento inicial de assets', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('inicia todos os atlas obrigatórios em paralelo', async () => {
    const requisitadas: string[] = [];
    const imagens: FakeImage[] = [];

    class FakeImage {
      decoding = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 16;
      height = 16;

      set src(value: string) {
        requisitadas.push(value);
        imagens.push(this);
      }
    }

    const manifest = {
      version: 1,
      generated: 'teste',
      atlases: [
        { name: 'primeiro', image: 'atlas/primeiro.webp', data: 'atlas/primeiro.json', w: 16, h: 16, count: 0 },
        { name: 'segundo', image: 'atlas/segundo.webp', data: 'atlas/segundo.json', w: 16, h: 16, count: 0 },
      ],
      images: {}, parallax: {}, deepspace: [], skies: [], starfields: [],
    };
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.endsWith('manifest.json')
        ? manifest
        : {
            image: '', w: 16, h: 16,
            frames: { compartilhado: [0, 0, 8, 8, 0, 0, 8, 8] },
          },
    })));

    const assets = new Assets();
    const boot = assets.boot();

    // A implementação serial deixava apenas o primeiro pedido pendente aqui.
    await vi.waitFor(() => {
      expect(requisitadas).toEqual([
        'assets/atlas/primeiro.webp',
        'assets/atlas/segundo.webp',
      ]);
    });

    // O segundo termina primeiro para reproduzir rede/cache não deterministas.
    imagens[1]?.onload?.();
    imagens[0]?.onload?.();
    await boot;

    // Mesmo terminando por último, o primeiro do manifesto conserva precedência.
    expect(assets.atlases.lookup('compartilhado')?.atlas.name).toBe('primeiro');
  });
});

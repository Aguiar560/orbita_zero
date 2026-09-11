import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { navegadorForaDoPortugues } from '../src/ui/idioma';
import { listaDeNomesProprios, padraoDosNomes, partesDoTexto } from '../src/ui/nomes-proprios';

/**
 * Quem joga de fora do Brasil: um aviso em inglês de onde fica o tradutor, e
 * os nomes próprios protegidos dele.
 *
 * Pedido de 10/09/2026, com o jogo recém-publicado no itch.io. O tradutor do
 * navegador não pode ser ligado pela página; o que dá é avisar e não deixar
 * que ele troque o nome de nave, chefe e galáxia — que no combate, desenhado
 * no canvas, continua em português.
 */

const fonte = (...p: string[]): string => readFileSync(join(process.cwd(), ...p), 'utf8');

describe('navegadorForaDoPortugues', () => {
  it('avisa quem não tem português em lugar nenhum da lista', () => {
    expect(navegadorForaDoPortugues(['en-US', 'en'])).toBe(true);
    expect(navegadorForaDoPortugues(['es-ES'])).toBe(true);
  });

  it('e poupa quem tem, mesmo que não seja o primeiro', () => {
    expect(navegadorForaDoPortugues(['pt-BR'])).toBe(false);
    expect(navegadorForaDoPortugues(['en-US', 'pt-BR'])).toBe(false);
    expect(navegadorForaDoPortugues(['PT'])).toBe(false);
  });

  it('sem idioma declarado, não incomoda', () => {
    expect(navegadorForaDoPortugues([''])).toBe(false);
  });
});

describe('nomes próprios', () => {
  const nomes = listaDeNomesProprios();
  const re = padraoDosNomes(nomes);
  const protegidos = (texto: string): string[] => partesDoTexto(texto, re).filter((p) => p.nome).map((p) => p.texto);

  it('cobre a marca, as naves, os chefes e as galáxias', () => {
    for (const n of ['Órbita Zero', 'Núcleo Vektor', 'Coroa Quebrada', 'Anel de Kessler', 'Aurora Mk III']) {
      expect(nomes).toContain(n);
    }
    // 53 naves + 30 chefes + 30 galáxias + a marca, menos os repetidos.
    expect(new Set(nomes).size).toBeGreaterThan(100);
  });

  it('acha o nome no meio da frase, e só ele', () => {
    const partes = partesDoTexto('Galáxia 6 · Coroa Quebrada', re);
    expect(partes).toEqual([
      { texto: 'Galáxia 6 · ', nome: false },
      { texto: 'Coroa Quebrada', nome: true },
    ]);
  });

  it('em maiúsculas também, porque vários painéis gritam o nome', () => {
    expect(protegidos('A ROTA DE NÚCLEO FERRUGEM')).toEqual(['NÚCLEO FERRUGEM']);
  });

  it('o nome mais longo vence o prefixo', () => {
    expect(protegidos('Aurora Mk III · NV 2')).toEqual(['Aurora Mk III']);
  });

  it('e não corta palavra ao meio, nem com acento', () => {
    expect(protegidos('Vetor VC-12')).toEqual([]);
    expect(protegidos('Aurora Mk IIIa')).toEqual([]);
  });

  it('texto sem nome sai inteiro, num pedaço só', () => {
    expect(partesDoTexto('Inventário cheio', re)).toEqual([{ texto: 'Inventário cheio', nome: false }]);
  });

  it('os inimigos comuns ficam traduzíveis', () => {
    // "Dardo", "Enxame", "Cometa" são palavras de verdade, que aparecem em frase.
    expect(protegidos('Um enxame de dardos e um cometa')).toEqual([]);
  });
});

describe('ligado no lugar certo', () => {
  it('todo texto de `h()` passa pela proteção', () => {
    const dom = fonte('src', 'ui', 'dom.ts');
    expect(dom).toContain('escreverComNomesProtegidos(el, String(value));');
    expect(dom).toContain('el.append(...nosComNomesProtegidos(child));');
  });

  it('e em português ela nem roda', () => {
    expect(fonte('src', 'ui', 'nomes-proprios.ts')).toContain('navegadorForaDoPortugues() ? padraoDosNomes(listaDeNomesProprios()) : null');
  });

  it('o aviso sai antes da wiki e do jogo, e só fora do português', () => {
    const main = fonte('src', 'main.ts');
    expect(main.indexOf('navegadorForaDoPortugues()')).toBeLessThan(main.indexOf("location.pathname === '/wiki'"));
    expect(main).toContain("import('./ui/AvisoDeIdioma')");
  });

  it('o aviso é inglês, não é traduzido, e some quando a página foi', () => {
    const aviso = fonte('src', 'ui', 'AvisoDeIdioma.ts');
    expect(aviso).toContain("setAttribute('translate', 'no')");
    expect(aviso).toContain("setAttribute('lang', 'en')");
    expect(aviso).toContain('Translate to English');
    expect(fonte('src', 'styles', 'idioma.css')).toContain('html.translated-ltr .aviso-idioma');
  });
});

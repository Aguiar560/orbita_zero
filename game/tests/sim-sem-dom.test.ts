/**
 * `sim/` e `data/` não conhecem navegador.
 *
 * ## Por que isto virou teste
 *
 * É a regra de camada nº 1 do projeto, e ela existe por um motivo muito
 * concreto: o Worker importa os MESMOS arquivos que o navegador usa para jogar.
 * É o que permite o servidor rolar loot, conferir a Matriz e — na Fase 5 —
 * simular o combate, sem nenhuma cópia da fórmula. Cópia diverge; o mesmo
 * arquivo não.
 *
 * A regra estava escrita e não estava medida, e o resultado foi previsível:
 * `sim/state.ts` nomeava `localStorage` e ninguém percebeu até o Worker
 * recusar. Pior — eu li os erros de compilação e concluí que a Fase 5 estava
 * BLOQUEADA, quando eram erros de tipo e o código rodava. Duas horas de
 * conclusão errada por falta de um teste de dez linhas.
 *
 * ## Por que varre o TEXTO, e não tenta importar
 *
 * Importar não pega: `typeof localStorage` funciona em Node sem estourar, e
 * `document` só quebra quando a linha é executada. Um módulo pode estar cheio
 * de DOM e importar limpo. O que se quer proibir é a MENÇÃO.
 *
 * Comentário não conta, e a primeira versão deste teste contava: ela acusou
 * `sim/sanear.ts`, cujo cabeçalho EXPLICA que editar o `localStorage` continua
 * possível. Um teste que proíbe falar do problema é pior que não ter teste.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Os globais de navegador que não podem aparecer.
 *
 * `console` fica de fora de propósito: existe no Worker, em Node e no
 * navegador, e proibi-lo tiraria a única forma de diagnosticar produção.
 */
const PROIBIDOS = [
  'localStorage', 'sessionStorage', 'document', 'window',
  'navigator', 'requestAnimationFrame', 'HTMLElement', 'CanvasRenderingContext2D',
];

/**
 * Onde a menção é permitida, e por quê.
 *
 * `state.ts` alcança `localStorage` por `globalThis`, dentro de uma função que
 * detecta o cofre do navegador — o único ponto do módulo que sabe que navegador
 * existe, e ele devolve nulo quando não há. A alternativa seria pôr a detecção
 * em `app/` e injetar sempre, o que obrigaria todo teste e toda ferramenta a
 * montar um cofre antes de carregar um save.
 */
const PERMITIDOS = new Map<string, string[]>([
  ['src/sim/state.ts', ['localStorage']],
]);

/** O código sem comentários. Bloco e linha, na ordem que evita cruzamento. */
const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[^]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

function arquivos(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho));
    else if (nome.endsWith('.ts')) saida.push(caminho.replace(/\\/g, '/'));
  }
  return saida;
}

describe('sim/ e data/ rodam fora do navegador', () => {
  const fontes = [...arquivos('src/sim'), ...arquivos('src/data')];

  it('encontra os arquivos que deveria varrer', () => {
    // Guarda contra o teste passar por não estar olhando para nada.
    expect(fontes.length).toBeGreaterThan(30);
  });

  it('nenhum nomeia um global de navegador', () => {
    const faltas: string[] = [];
    for (const caminho of fontes) {
      const fonte = semComentarios(readFileSync(caminho, 'utf8'));
      const liberados = PERMITIDOS.get(caminho) ?? [];
      for (const proibido of PROIBIDOS) {
        if (liberados.includes(proibido)) continue;
        // Palavra inteira: `documentacao` não é `document`.
        if (new RegExp(`\\b${proibido}\\b`).test(fonte)) faltas.push(`${caminho}: ${proibido}`);
      }
    }
    expect(faltas, faltas.join(' · ')).toEqual([]);
  });

  it('nenhum importa de ui/, render/, modes/ ou app/ em VALOR', () => {
    // Importar TIPO é inofensivo — some na compilação. Importar valor traz o
    // módulo inteiro junto, e com ele o DOM que ele usa.
    //
    // `sim/index.ts` importa `@app/Bus` em valor e isso é aceito: `Bus.ts` só
    // importa tipos e não toca navegador. Medido em 03/09, ao levantar a Fase 5.
    /**
     * A exceção, e por que ela não é urgente.
     *
     * `data/clips.ts` importa `defineClip` de `@render/Anim`, que puxa
     * `render/Assets`, que usa `new Image()`. É violação de camada de verdade.
     *
     * Medido em 03/09: **nada em `sim/` importa `clips.ts`** — só
     * `app/Game.ts` importa. Então ele nunca entra no grafo que o Worker
     * carrega, e a violação não custa nada hoje.
     *
     * Fica na lista, e não some do teste, porque a conta muda no dia em que
     * alguém importar `clips` de dentro de `sim/`: aí o Worker passa a
     * carregar `Assets` e a quebra é em execução, não em compilação.
     */
    const EXCECOES = new Set(['src/data/clips.ts → @render/Anim']);

    const faltas: string[] = [];
    for (const caminho of fontes) {
      const fonte = semComentarios(readFileSync(caminho, 'utf8'));
      for (const m of fonte.matchAll(/^import\s+(?!type\s)([^;]*?)\s+from\s+'(@(?:ui|render|modes)\/[^']+)'/gm)) {
        const falta = `${caminho} → ${m[2]}`;
        if (!EXCECOES.has(falta)) faltas.push(falta);
      }
    }
    expect(faltas, faltas.join(' · ')).toEqual([]);
  });
});

describe('a exceção do clips continua inofensiva', () => {
  it('nada em sim/ importa clips', () => {
    // É o que torna a violação de camada de `clips.ts` gratuita: ele nunca
    // entra no grafo que o Worker carrega. No dia em que entrar, o Worker passa
    // a carregar `render/Assets` e `new Image()` — e a quebra é em EXECUÇÃO,
    // que é a pior hora de descobrir.
    const culpados = arquivos('src/sim')
      .filter((c) => /from\s+'(@data\/clips|\.\.\/data\/clips)'/.test(readFileSync(c, 'utf8')));
    expect(culpados, culpados.join(' · ')).toEqual([]);
  });
});
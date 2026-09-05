/**
 * Todo módulo importado precisa estar VERSIONADO.
 *
 * ## O defeito de 04/09, e por que nenhuma verificação local o pegava
 *
 * `VerticalMode.ts` foi commitado importando `@render/AudioCombate` — um
 * arquivo que existia no disco de quem commitou e **nunca entrou no git**.
 *
 * Localmente tudo passava: `tsc`, os 2.036 testes e o `vite build`, porque
 * todos leem o disco. Na Vercel, que clona o repositório, o build morreu em
 * `TS2307: Cannot find module '@render/AudioCombate'` — e ficou morrendo por
 * uma hora, com o site no ar preso numa versão antiga enquanto os commits
 * seguintes eram empurrados por cima.
 *
 * O sintoma é o pior possível: **o site simplesmente não muda**. Nada quebra,
 * nada avisa, e quem publicou continua vendo a própria máquina funcionar.
 *
 * ## Por que este teste é diferente dos outros
 *
 * Ele é o único que pergunta ao GIT em vez de ao disco. É essa diferença que o
 * torna capaz de ver o que a máquina de quem escreve nunca vê — e por isso ele
 * não pode ser substituído por `tsc`, por mais estrito que esteja.
 */

import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/** Arquivos versionados, do ponto de vista do git. */
function versionados(): Set<string> | null {
  try {
    const saida = execFileSync('git', ['ls-files'], {
      cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return new Set(saida.split('\n').map((l) => l.trim()).filter(Boolean));
  } catch {
    return null; // Sem git (tarball, sandbox): o teste se declara inaplicável.
  }
}

const ALIASES: Record<string, string> = {
  core: 'src/core', render: 'src/render', sim: 'src/sim',
  data: 'src/data', ui: 'src/ui', modes: 'src/modes', app: 'src/app',
};

describe('nada importado fica de fora do git', () => {
  it('todo `@alias/...` de src/ aponta para arquivo versionado', () => {
    const arquivos = versionados();
    if (!arquivos) return; // Sem git não há o que conferir.

    const fontes = [...arquivos].filter((f) => f.startsWith('src/') && f.endsWith('.ts'));
    expect(fontes.length, 'nenhuma fonte versionada encontrada').toBeGreaterThan(20);

    const faltando: string[] = [];
    const raiz = new URL('..', import.meta.url);

    for (const fonte of fontes) {
      const texto = readTexto(new URL(fonte, raiz));
      // `from '@alias/caminho'` e `import('@alias/caminho')`.
      for (const m of texto.matchAll(/['"]@(core|render|sim|data|ui|modes|app)\/([A-Za-z0-9/_.-]+)['"]/g)) {
        const base = `${ALIASES[m[1]!]}/${m[2]!}`;
        const achou = arquivos.has(`${base}.ts`) || arquivos.has(`${base}.json`)
          || arquivos.has(base) || arquivos.has(`${base}/index.ts`);
        if (!achou) faltando.push(`${fonte} → @${m[1]}/${m[2]}`);
      }
    }

    // A mensagem cita o par completo porque o conserto é sempre o mesmo —
    // `git add` no módulo — e quem lê precisa saber QUAL.
    expect(faltando, `import sem arquivo versionado:\n  ${faltando.join('\n  ')}`).toEqual([]);
  });
});

function readTexto(u: URL): string {
  // Import tardio para o teste não custar nada quando o git falta.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return (require('node:fs') as typeof import('node:fs')).readFileSync(u, 'utf8');
}

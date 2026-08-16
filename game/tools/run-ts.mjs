/**
 * Executa um arquivo TypeScript do projeto em Node, com os aliases do Vite.
 *
 *   node tools/run-ts.mjs tools/simular.ts curva 1 100
 *
 * O Vitest 4 deixou de publicar o binário `vite-node`, e instalar um pacote a
 * mais só para isto não se paga: o próprio Vite já é dependência e sabe
 * carregar um módulo com a configuração do projeto. `ssrLoadModule` resolve
 * `@sim`, `@data` e companhia exatamente como o navegador resolve, então o
 * arnês importa os mesmos arquivos que o jogo — sem cópia e sem divergir.
 */
import { createServer } from 'vite';

const alvo = process.argv[2];
if (!alvo) {
  console.error('uso: node tools/run-ts.mjs <arquivo.ts> [args...]');
  process.exit(1);
}

// O módulo alvo lê `process.argv.slice(2)`. Sem isto ele veria o próprio
// caminho como primeiro argumento e todo comando sairia deslocado.
process.argv.splice(1, 2, alvo);

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  await server.ssrLoadModule(alvo.startsWith('.') ? alvo : `./${alvo}`);
} finally {
  await server.close();
}

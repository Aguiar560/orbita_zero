import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Endpoint de desenvolvimento que grava um quadro do canvas em disco.
 *
 * A camada de render é canvas puro, então revisar visual sem isso significa
 * abrir o navegador e olhar. Com isso dá para capturar um quadro específico
 * (após N ticks determinísticos) e comparar entre mudanças.
 * Só existe em `vite dev`; não entra no build.
 */
function snapshotPlugin(): Plugin {
  return {
    name: 'orbita-snapshot',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__snap', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          try {
            const { name, data } = JSON.parse(Buffer.concat(chunks).toString()) as { name: string; data: string };
            const dir = path.resolve(process.cwd(), '.snapshots');
            mkdirSync(dir, { recursive: true });
            const safe = name.replace(/[^\w.-]/g, '_');
            writeFileSync(path.join(dir, safe), Buffer.from(data.split(',')[1] ?? '', 'base64'));
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: path.join(dir, safe) }));
          } catch (err) {
            res.statusCode = 400;
            res.end(String(err));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [snapshotPlugin()],
  server: { port: 5180, host: '127.0.0.1', open: false },
  resolve: {
    alias: {
      '@': r('./src'),
      '@app': r('./src/app'),
      '@core': r('./src/core'),
      '@render': r('./src/render'),
      '@sim': r('./src/sim'),
      '@data': r('./src/data'),
      '@ui': r('./src/ui'),
      '@modes': r('./src/modes'),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    // Sprites são referenciados por caminho em runtime (manifest.json), então
    // nada de assets pode virar data-URI embutido.
    assetsInlineLimit: 0,
  },
});

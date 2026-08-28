import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
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

interface StoredHitbox { width: number; height: number; offsetX: number; offsetY: number; scale: number }
interface HitboxCalibrationFile {
  players: Record<string, StoredHitbox>;
  enemies: Record<string, StoredHitbox>;
  bosses: Record<string, StoredHitbox>;
}

/**
 * Backend administrativo do Laboratório.
 *
 * Existe apenas no `vite dev`: uma aplicação publicada não pode reescrever o
 * próprio bundle. O alvo é um JSON versionado, importado pelas tabelas do jogo,
 * então salvar no Laboratório muda o padrão de todo novo save.
 */
function labCalibrationPlugin(): Plugin {
  return {
    name: 'orbita-lab-calibration',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__lab/hitboxes', (req, res) => {
        res.setHeader('content-type', 'application/json');
        res.setHeader('cache-control', 'no-store');
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end(JSON.stringify({ ok: false, error: 'Método não permitido.' }));
        }
        const origin = req.headers.origin;
        if (origin && origin !== 'http://127.0.0.1:5180' && origin !== 'http://localhost:5180') {
          res.statusCode = 403;
          return res.end(JSON.stringify({ ok: false, error: 'Origem administrativa não autorizada.' }));
        }
        if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
          res.statusCode = 415;
          return res.end(JSON.stringify({ ok: false, error: 'Content-Type deve ser application/json.' }));
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString()) as {
              action?: 'save' | 'restore';
              kind?: 'player' | 'enemy' | 'boss';
              id?: string;
              hitbox?: Partial<StoredHitbox>;
              scale?: number;
            };
            if (!body.action || !body.kind || !body.id || !/^[a-z0-9_]+$/.test(body.id)) {
              throw new Error('Ação, tipo ou id de calibração inválido.');
            }

            const file = path.resolve(process.cwd(), 'src/data/hitbox-calibrations.json');
            const data = JSON.parse(readFileSync(file, 'utf8')) as HitboxCalibrationFile;
            const group = body.kind === 'player' ? data.players : body.kind === 'enemy' ? data.enemies : data.bosses;

            if (body.action === 'restore') {
              delete group[body.id];
            } else {
              const finite = (value: unknown, fallback: number): number => {
                const parsed = Number(value);
                return Number.isFinite(parsed) ? parsed : fallback;
              };
              const round = (value: number): number => Math.round(value * 10) / 10;
              group[body.id] = {
                width: round(Math.min(220, Math.max(6, finite(body.hitbox?.width, 30)))),
                height: round(Math.min(260, Math.max(6, finite(body.hitbox?.height, 30)))),
                offsetX: round(Math.min(100, Math.max(-100, finite(body.hitbox?.offsetX, 0)))),
                offsetY: round(Math.min(120, Math.max(-120, finite(body.hitbox?.offsetY, 0)))),
                scale: Math.round(Math.min(4, Math.max(.05, finite(body.scale, 1))) * 1000) / 1000,
              };
            }

            data.players = Object.fromEntries(Object.entries(data.players).sort(([a], [b]) => a.localeCompare(b)));
            data.enemies = Object.fromEntries(Object.entries(data.enemies).sort(([a], [b]) => a.localeCompare(b)));
            data.bosses = Object.fromEntries(Object.entries(data.bosses).sort(([a], [b]) => a.localeCompare(b)));
            writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
            res.end(JSON.stringify({ ok: true, path: file, action: body.action, kind: body.kind, id: body.id }));
          } catch (error) {
            res.statusCode = 400;
            const detail = error instanceof Error ? error.message : String(error);
            res.end(JSON.stringify({ ok: false, error: detail }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [snapshotPlugin(), labCalibrationPlugin()],
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
  /**
   * Testes estatísticos precisam de mais que os 5s padrão.
   *
   * Vários testes daqui rolam 200 mil itens para medir distribuição — e o
   * número grande é o ponto, porque com mil rolagens o ruído esconde o que se
   * quer medir. Isolados eles levam 1 a 3 segundos; com a suíte inteira em
   * paralelo, ou com um build rodando ao lado, passam de 5s e a suíte falha por
   * TEMPO, nunca por asserção.
   *
   * Aconteceu quatro vezes seguidas, em arquivos diferentes a cada rodada — a
   * assinatura de disputa por CPU, não de defeito. Uma suíte que falha ao acaso
   * ensina a ignorar falha, que é o oposto do que ela serve.
   *
   * 30s é folgado de propósito: o timeout aqui existe para pegar laço infinito,
   * não para medir desempenho. Quem quiser vigiar desempenho tem
   * `npm run simular`.
   */
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },

  build: {
    target: 'es2022',
    outDir: 'dist',
    // Sprites são referenciados por caminho em runtime (manifest.json), então
    // nada de assets pode virar data-URI embutido.
    assetsInlineLimit: 0,
  },
});

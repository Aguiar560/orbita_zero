import { decidirApi, type OrigemDaApi } from '@data/servidor';

/**
 * Para onde ESTE cliente manda as requisições — decidido uma vez, no boot.
 *
 * ## Por que aqui e não em `@data/servidor`
 *
 * Porque `data/` é compilado também pelo Worker, que importa `ADMINS` e
 * `SUPABASE_URL` de lá. No Worker não existe `import.meta.env` nem `location`,
 * então ler qualquer um dos dois em `data/` quebra o `tsc` do servidor. A regra
 * é pura e mora lá (`decidirApi`, e é ela que o teste exercita); a LEITURA do
 * ambiente é do navegador e mora com o navegador.
 *
 * Também é a razão de `data/` continuar sendo tabela e não lógica, como manda a
 * terceira regra de camada do projeto.
 *
 * ## Uma vez, e não por chamada
 *
 * O destino não muda durante a sessão, e reavaliar a cada `fetch` abriria a
 * porta para duas rotas do mesmo jogo falarem com servidores diferentes — o
 * tipo de estado inconsistente que ninguém consegue reproduzir depois.
 */
const decidida = decidirApi(
  import.meta.env.VITE_API_URL as string | undefined,
  typeof location === 'undefined' ? null : location.hostname,
);

/** A API do jogo, no Cloudflare Workers — ou o endereço fechado. */
export const API_URL = decidida.url;

/** Como `API_URL` foi escolhida. A faixa de ambiente e o console mostram isto. */
export const API_ORIGEM: OrigemDaApi = decidida.origem;

/**
 * O nome do ambiente, para a faixa e para o diagnóstico.
 *
 * Declarado por `VITE_AMBIENTE` quando existe; senão deduzido da origem da API.
 * Só `producao` não mostra faixa — todo o resto precisa se anunciar na tela,
 * porque a pior confusão possível é achar que se está testando quando não se
 * está.
 */
export const AMBIENTE: string = (import.meta.env.VITE_AMBIENTE as string | undefined)?.trim()
  || (decidida.origem === 'producao' ? 'producao' : 'local');

/**
 * Endereços do servidor e a chave pública do Supabase.
 *
 * ## Por que isto pode ficar no repositório
 *
 * Nada aqui é segredo, e não é descuido — é o desenho.
 *
 * A chave `anon` é feita para ir no pacote do cliente: ela vai em toda
 * requisição de login, e qualquer pessoa que abrir o jogo pode lê-la. O que ela
 * permite é falar com a API de autenticação, que é o que se quer. Quem protege
 * os dados é a checagem de token no Worker, não o sigilo desta chave.
 *
 * A chave que NUNCA pode sair do painel é a `service_role`: ela ignora as
 * regras de acesso por linha e dá acesso total ao banco. Se algum dia alguém
 * for tentado a colar uma chave nova aqui, a pergunta é qual `role` está dentro
 * dela — dá para conferir decodificando o pedaço do meio, que é base64.
 */

export const SUPABASE_URL = 'https://vzsiorkeykcbcpmismyy.supabase.co';

/** Chave `anon`. Pública por desenho — ver acima. */
export const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6c2lvcmtleWtjYmNwbWlzbXl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MzEyODIsImV4cCI6MjEwMzQwNzI4Mn0.YUikvadmt2V2UcbMH51f65OV8HZ-iM2CBEM60vF7qiw';

/**
 * ## Onde o jogo fala com a API
 *
 * Este endereço era uma CONSTANTE apontando para a produção, e isso significava
 * uma coisa que não estava escrita em lugar nenhum: **abrir o jogo em
 * `localhost` não isolava nada.** Uma conta autenticada num servidor de
 * desenvolvimento escrevia no mesmo D1 dos jogadores — o mesmo save, o mesmo
 * inventário, a mesma carteira. Todo teste local até 13/09/2026 foi um teste em
 * produção sem ninguém ter decidido isso.
 *
 * A regra agora tem três degraus, nesta ordem:
 *
 * 1. **`VITE_API_URL` declarada** vence sempre, em qualquer lugar. É como a
 *    preview da Vercel aponta para o staging e como o sandbox aponta para um
 *    Worker local.
 * 2. **Host local sem a variável** → FECHA. Nunca cai para produção.
 * 3. **Qualquer outro host** → produção.
 *
 * ## Por que o degrau 2 fecha em vez de adivinhar
 *
 * Porque o erro que ele evita é silencioso e irreversível. Um `fetch` que sobe
 * save errado não avisa ninguém: o dado do jogador já foi sobrescrito quando
 * alguém percebe. Recusar a falar é a única resposta que não destrói nada — e
 * quem está desenvolvendo descobre na primeira tentativa, não na segunda
 * semana.
 */
export type OrigemDaApi = 'variavel' | 'producao' | 'fechado';

const API_PRODUCAO = 'https://orbita-zero-api.orbitazero.workers.dev';

/**
 * Fechado é `127.0.0.1` numa porta que nada escuta.
 *
 * As alternativas erram de formas conhecidas. String vazia viraria caminho
 * RELATIVO: o `fetch` bateria no servidor de dev, voltaria 404, e o cliente —
 * que engole erro de rede por desenho — mostraria isso como perda de dado. Um
 * domínio inexistente custaria espera de DNS em toda chamada e o erro chegaria
 * disfarçado de "rede instável". A porta 1 do loopback recusa na hora, sem
 * rede, com `ECONNREFUSED` legível no console, e não alcança produção nem por
 * engano — que é a única parte inegociável.
 */
const API_FECHADA = 'http://127.0.0.1:1';

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

/**
 * A decisão, pura, para o teste poder exercê-la sem navegador e sem build.
 *
 * `host` é `null` quando não existe `location` — Node, testes, ferramentas.
 * Isso conta como local: fora do navegador ninguém deveria estar falando com a
 * produção por causa de uma constante esquecida.
 */
export function decidirApi(
  declarada: string | undefined,
  host: string | null,
): { url: string; origem: OrigemDaApi } {
  const limpa = declarada?.trim().replace(/\/+$/, '');
  if (limpa) return { url: limpa, origem: 'variavel' };
  if (host === null || HOSTS_LOCAIS.has(host)) return { url: API_FECHADA, origem: 'fechado' };
  return { url: API_PRODUCAO, origem: 'producao' };
}

/**
 * Quem AVALIA a regra é `@app/api`, e a separação não é estilo.
 *
 * Este arquivo é compilado duas vezes: pelo cliente e pelo Worker, que importa
 * `ADMINS` e `SUPABASE_URL` daqui. No Worker não existe `import.meta.env` nem
 * `location` — ler qualquer um dos dois aqui quebra o `tsc` do servidor, que
 * foi exatamente o que aconteceu na primeira tentativa. A função acima é pura e
 * compila nos dois; a leitura do ambiente é do cliente e mora com o cliente.
 */

/**
 * Contas com acesso administrativo: modo de teste e Laboratório.
 *
 * ## Isto é um portão de INTERFACE, não de segurança
 *
 * Vale dizer com todas as letras, porque a diferença importa quando houver
 * testers de verdade. A lista está no pacote do cliente e a checagem roda no
 * navegador do jogador — quem abrir o devtools contorna em trinta segundos.
 *
 * O que ela resolve é o caso real: o tester que abre Configurações, vê "modo de
 * teste", liga por curiosidade e reporta um jogo que não é o jogo. Isso some.
 * O que ela NÃO resolve é o tester que quer trapacear.
 *
 * Quem impede trapaça é o servidor não confiar no cliente — e a conferência de
 * plausibilidade do save ainda não existe. Enquanto não existir, um save
 * inventado é aceito, com ou sem esta lista. Por isso o placar continua fora.
 *
 * ## Por que os ids podem ficar no repositório
 *
 * Pelo mesmo motivo da chave `anon` acima: um id de usuário não autentica
 * ninguém. Para se passar por um admin é preciso o token dele, que sai do login
 * e nunca daqui.
 *
 * Para descobrir o seu: entre na conta e abra o menu de perfil — o id aparece
 * embaixo do e-mail, pronto para copiar.
 */
/**
 * Uma pessoa pode ter mais de um id.
 *
 * Entrar por um provedor cria uma identidade NOVA quando a anterior não tinha
 * e-mail para casar — foi o que aconteceu com a conta anônima de maio quando o
 * Google entrou. Os dois ids abaixo são do Rafael, e o de baixo continua aqui
 * porque o save antigo ainda mora nele.
 */
export const ADMINS: readonly string[] = [
  // Rafael — conta do Google, em uso
  '0a069f4f-254d-49a8-b4df-dd4a9881c591',
  // Rafael — conta anônima de maio, onde está o progresso antigo
  '8d4be4e6-52d6-437c-ad4e-556cca3aa43b',
];

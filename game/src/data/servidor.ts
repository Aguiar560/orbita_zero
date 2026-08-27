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

/** A API do jogo, no Cloudflare Workers. */
export const API_URL = 'https://orbita-zero-api.orbitazero.workers.dev';

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
export const ADMINS: readonly string[] = [
  // Rafael
  '8d4be4e6-52d6-437c-ad4e-556cca3aa43b',
];

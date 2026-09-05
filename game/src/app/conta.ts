import { SUPABASE_ANON, SUPABASE_URL } from '@data/servidor';

/**
 * Conta do jogador, falando direto com a API de autenticação do Supabase.
 *
 * Mora em `app/` e não em `sim/` por causa da regra 1: `sim/` não conhece DOM,
 * e isto usa `localStorage`. Não é purismo — é o que mantém o balanceamento
 * mensurável em Node sem abrir navegador. `app/` é onde a infraestrutura que
 * fala com o mundo já vive, junto do `LabCalibrationAdmin`.
 *
 * ## Por que não o `@supabase/supabase-js`
 *
 * Porque `dependencies: {}` é a melhor propriedade de segurança deste projeto —
 * não existe cadeia de suprimento para comprometer — e o cliente oficial
 * arrasta junto Postgres, realtime e storage, que este jogo não usa.
 *
 * O que se ganha com ele são quatro chamadas HTTP. Elas estão abaixo, e cabem
 * em uma tela. É a regra do `CLAUDE.md` ("sem dependência nova sem motivo
 * forte") aplicada onde ela mais rende.
 *
 * ## Onde a sessão é guardada, e o que isso custa
 *
 * A auditoria recomendou cookie `HttpOnly`, e não é o que está aqui — por
 * impossibilidade, não por descuido. `HttpOnly` significa "o JavaScript não
 * lê", e só o SERVIDOR que emite o cookie pode marcá-lo assim. O jogo é uma
 * página estática que recebe o token em JSON; não há servidor nosso no caminho
 * do login para marcar cookie nenhum.
 *
 * Então a sessão vive no `localStorage`, e o custo é real: um XSS a lê. O que
 * compensa não é uma esperança, são duas medidas já tomadas:
 *
 * - o sink de `innerHTML` do `h()` foi removido, e um teste falha se voltar;
 * - não há dependência de terceiro no pacote, que é de onde XSS costuma vir.
 *
 * Se um dia o jogo mostrar texto escrito por OUTRO jogador — nome no placar —,
 * essa conta muda, e a hora de reavaliar é antes disso, não depois.
 */

const CHAVE = 'oz.sessao.v1';

export interface Sessao {
  accessToken: string;
  refreshToken: string;
  /** Epoch em segundos. */
  expiraEm: number;
  email: string;
  usuarioId: string;
  /**
   * Conta sem e-mail, criada para o jogador entrar sem cadastro.
   *
   * Existe porque estado no servidor precisa de DONO, e "jogar sem conta"
   * deixava o progresso sem um. Continua sendo entrar sem dar e-mail — o que
   * muda é que agora existe um id de verdade do outro lado.
   */
  anonima: boolean;
}

export type ResultadoDeConta =
  | { ok: true; sessao: Sessao }
  | { ok: false; erro: string };

interface RespostaDeToken {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string; is_anonymous?: boolean };
  error_description?: string;
  msg?: string;
  error_code?: string;
}

/**
 * Mensagens em português para o que o jogador pode consertar.
 *
 * O resto cai num texto genérico de propósito: repassar o erro cru do servidor
 * mostra detalhe de implementação a quem não pode fazer nada com ele, e às
 * vezes conta mais do que deveria sobre quais contas existem.
 */
const MENSAGENS: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_exists: 'Já existe uma conta com este e-mail.',
  user_already_exists: 'Já existe uma conta com este e-mail.',
  weak_password: 'Senha fraca demais. Use pelo menos seis caracteres.',
  over_email_send_rate_limit: 'Muitas tentativas. Espere um minuto.',
  email_not_confirmed: 'Confirme o e-mail antes de entrar.',
  validation_failed: 'Preencha e-mail e senha.',
};

const traduzir = (r: RespostaDeToken): string =>
  MENSAGENS[r.error_code ?? ''] ?? 'Não foi possível concluir. Tente de novo.';

async function chamar(rota: string, corpo: unknown): Promise<ResultadoDeConta> {
  let resposta: Response;
  try {
    resposta = await fetch(`${SUPABASE_URL}/auth/v1/${rota}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    });
  } catch {
    // Rede fora é diferente de credencial errada, e o jogador precisa saber
    // qual dos dois é: um se resolve tentando de novo, o outro não.
    return { ok: false, erro: 'Sem conexão com o servidor.' };
  }

  const dados = (await resposta.json().catch(() => ({}))) as RespostaDeToken;
  if (!resposta.ok) return { ok: false, erro: traduzir(dados) };

  if (!dados.access_token || !dados.refresh_token || !dados.user?.id) {
    // Cadastro com confirmação de e-mail ligada responde 200 SEM token: a conta
    // existe e ainda não pode entrar. Tratar isso como falha de rede confundiria
    // quem acabou de se cadastrar com sucesso.
    return { ok: false, erro: 'Conta criada. Confirme o e-mail para entrar.' };
  }

  const sessao: Sessao = {
    accessToken: dados.access_token,
    refreshToken: dados.refresh_token,
    expiraEm: Math.floor(Date.now() / 1000) + (dados.expires_in ?? 3600),
    email: dados.user.email ?? '',
    usuarioId: dados.user.id,
    // O Supabase carimba `is_anonymous`; a ausência de e-mail é a defesa para
    // o caso de uma versão não mandar o campo.
    anonima: dados.user.is_anonymous ?? !dados.user.email,
  };
  guardar(sessao);
  return { ok: true, sessao };
}

export const cadastrar = (email: string, senha: string): Promise<ResultadoDeConta> =>
  chamar('signup', { email, password: senha });

export const entrar = (email: string, senha: string): Promise<ResultadoDeConta> =>
  chamar('token?grant_type=password', { email, password: senha });

/**
 * A conta é OBRIGATÓRIA desde 04/09.
 *
 * Havia `entrarAnonimo`, que criava conta sem e-mail com um clique. Ele
 * resolvia a fricção da porta e criava outra coisa pior: o progresso ficava
 * amarrado ao `localStorage` daquele navegador, e limpar os dados do site
 * apagava o ACESSO a um save que continuava vivo no servidor — sem caminho
 * de volta, porque vincular a conta anônima a um e-mail nunca existiu.
 *
 * A decisão de tornar obrigatório só coube porque ainda não há ninguém
 * jogando: nenhuma conta anônima existente foi deixada órfã. Depois do
 * primeiro jogador isso seria uma migração, não uma escolha.
 */

// ── contas de provedor: Google e Facebook ──────────────────────────────────

/** Provedores aceitos. O id é o que o Supabase espera na URL. */
export type Provedor = 'google' | 'facebook';

export const NOME_DO_PROVEDOR: Record<Provedor, string> = {
  google: 'Google',
  facebook: 'Facebook',
};

/**
 * Para onde o provedor devolve o jogador.
 *
 * A origem atual, sem caminho nem busca: o jogo é uma página só, e devolver
 * numa URL com parâmetros deixaria lixo na barra de endereço do jogador.
 *
 * **Precisa estar na lista de Redirect URLs do painel do Supabase.** Fora
 * dela o provedor recusa, e a recusa acontece no site DELE — o jogo nem fica
 * sabendo. Ver `docs/SEGURANCA-E-CONTA.md`.
 */
const voltarPara = (): string => `${location.origin}${location.pathname}`;

/**
 * ENTRAR com um provedor. Cria conta nova, ou reabre a que já existe.
 *
 * ## O que isto NÃO faz
 *
 * Não junta contas. Quem já entrou por e-mail e depois vier por aqui recebe
 * um id de usuário DIFERENTE, com progresso próprio — o Supabase trata as
 * duas identidades como duas pessoas até alguém pedir o vínculo.
 *
 * Vincular exige `PUT /user/identities/authorize` com o token da sessão em
 * mãos, e não existe aqui porque ninguém precisou ainda. O dia em que um
 * jogador pedir "quero entrar pelo Google na minha conta de e-mail" é o dia
 * de escrever — e não antes, para não ficar código que ninguém exercita.
 */
export function entrarComProvedor(provedor: Provedor): void {
  const url = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set('provider', provedor);
  url.searchParams.set('redirect_to', voltarPara());
  location.href = url.toString();
}



/**
 * Recolhe a sessão que o provedor devolveu no fragmento da URL.
 *
 * O Supabase volta com `#access_token=…&refresh_token=…&expires_in=…`. O
 * fragmento NÃO vai ao servidor, que é o motivo de ele ser usado para isso —
 * o token não aparece em log de acesso nenhum.
 *
 * Limpa a barra de endereço depois. Um token visível ali é o que o jogador
 * copia sem pensar ao mandar o link do jogo para um amigo.
 *
 * Devolve `true` quando havia sessão para recolher — quem chama usa isso para
 * saber que a página voltou de um login, e não de uma abertura comum.
 */
export function recolherSessaoDaUrl(): boolean {
  const bruto = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  if (!bruto) return false;

  const p = new URLSearchParams(bruto);
  const access = p.get('access_token');
  const refresh = p.get('refresh_token');
  const limpar = (): void => {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  };

  // O provedor também volta por aqui quando o jogador RECUSA a permissão.
  // Limpar mesmo assim evita a barra ficar com um erro pendurado para sempre.
  if (!access || !refresh) { if (p.has('error') || p.has('error_description')) limpar(); return false; }

  const atual = sessaoGuardada();
  guardar({
    accessToken: access,
    refreshToken: refresh,
    expiraEm: Math.floor(Date.now() / 1000) + Number(p.get('expires_in') ?? 3600),
    email: atual?.email ?? '',
    usuarioId: atual?.usuarioId ?? '',
    // O token novo é de conta com provedor; anônima ela não é mais. O e-mail e
    // o id chegam certos na primeira renovação, que lê o usuário do servidor.
    anonima: false,
  });
  limpar();
  return true;
}

function guardar(sessao: Sessao): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(sessao));
  } catch {
    // Sessão que não persiste ainda serve para esta aba. Falhar o login por
    // causa do armazenamento seria trocar um problema pequeno por um grande.
  }
  window.dispatchEvent(new Event('oz:conta'));
}

export function sessaoGuardada(): Sessao | null {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return null;
    const s = JSON.parse(cru) as Partial<Sessao>;
    if (!s.accessToken || !s.refreshToken || !s.usuarioId) return null;
    return s as Sessao;
  } catch {
    return null;
  }
}

export function sair(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch { /* nada a fazer */ }
  window.dispatchEvent(new Event('oz:conta'));
}

/**
 * Devolve um token válido, renovando se estiver perto de vencer.
 *
 * A margem de 60s existe porque o token pode vencer ENTRE a checagem e a
 * chegada da requisição ao servidor. Sem ela, um save falharia com 401 de vez
 * em quando, sem padrão — o tipo de defeito que só aparece em produção e não
 * reproduz.
 */
export async function tokenValido(): Promise<string | null> {
  const sessao = sessaoGuardada();
  if (!sessao) return null;

  const agora = Math.floor(Date.now() / 1000);
  if (sessao.expiraEm - agora > 60) return sessao.accessToken;

  const r = await chamar('token?grant_type=refresh_token', { refresh_token: sessao.refreshToken });
  if (r.ok) return r.sessao.accessToken;

  // Renovação recusada quer dizer sessão morta: apagar é o que evita o jogo
  // ficar tentando renovar para sempre com um token que nunca mais vale.
  sair();
  return null;
}

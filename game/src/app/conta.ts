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

/**
 * Provedores aceitos. O id é o que o Supabase espera na URL.
 *
 * O Facebook saiu em 04/09. Ele exigia app em modo Ativo para aceitar
 * qualquer pessoa, e passar para Ativo pede URL de política de privacidade —
 * que o jogo não tem. Um botão que só funciona para quem está cadastrado como
 * testador do app é pior que botão nenhum.
 */
export type Provedor = 'google';

export const NOME_DO_PROVEDOR: Record<Provedor, string> = {
  google: 'Google',
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

/** Chave de aviso entre a janela do login e a que a abriu. */
const AVISO = 'oz:login-pronto';

/**
 * Nome da janela do login.
 *
 * É por ele que a janela se reconhece, e não por `window.opener`. O Google
 * responde com `Cross-Origin-Opener-Policy`, que **corta a ligação** entre a
 * janela e quem a abriu: ao voltar para cá, `window.opener` é `null`. O nome
 * atravessa a navegação e sobrevive ao corte.
 *
 * Reabrir com o MESMO nome não abre uma segunda janela: aponta a que já
 * existe. É isso que faz o segundo clique ser conserto, e não bagunça.
 */
const NOME_DA_JANELA = 'oz-login';

/**
 * Onde o login em curso está acontecendo: em janela própria ou nesta página.
 *
 * Existe por desconfiança do `window.name`. O nome atravessa a navegação em
 * tese, mas navegadores o limpam em salto entre origens por privacidade, e o
 * salto para o Google é exatamente isso. Se o nome se perder, a janela do
 * login não se reconheceria, carregaria o jogo inteiro e ficaria aberta.
 *
 * A marca não se perde: `localStorage` é da origem, e a origem é a mesma.
 *
 * O valor importa tanto quanto a presença. Quando o pop-up é bloqueado, o
 * login acontece NESTA página — e a volta não pode tentar se fechar sozinha,
 * porque `window.close()` numa aba comum não faz nada e o jogador ficaria
 * olhando para uma tela que não abre.
 *
 * Sozinha ela nunca decide nada: só conta junto com um token ou um erro na
 * URL. Uma marca esquecida por um login abandonado é, por isso, inofensiva.
 */
const EM_CURSO = 'oz:login-em-curso';

function marcar(onde: 'janela' | 'pagina'): void {
  try { localStorage.setItem(EM_CURSO, onde); } catch { /* segue sem marca. */ }
}

function estaNaJanelaDoLogin(): boolean {
  if (window.name === NOME_DA_JANELA) return true;
  try { return localStorage.getItem(EM_CURSO) === 'janela'; } catch { return false; }
}

/**
 * A espera em curso, se houver.
 *
 * Um só login por vez. Sem isto, cada clique no botão criaria outro relógio e
 * outro ouvinte para a mesma janela — e o botão AGORA aceita cliques repetidos
 * de propósito, porque é o único jeito de sair de uma espera morta.
 */
let pendente: Promise<ResultadoDeConta> | null = null;

/**
 * ENTRAR com um provedor, numa JANELA PRÓPRIA.
 *
 * ## Por que janela e não a mesma página
 *
 * Navegar a própria página descarrega o jogo: quem volta paga o boot inteiro
 * de novo, e quem desiste no meio do Google fica numa página que não é mais a
 * dele. Com janela, a página do jogo continua viva atrás e só recebe a
 * sessão.
 *
 * O bloqueio de pop-up não se aplica aqui: navegador bloqueia `window.open`
 * que NÃO nasce de um gesto do usuário, e este nasce do clique. Ainda assim,
 * quando o retorno é `null` — extensão agressiva, política corporativa — o
 * caminho antigo continua valendo, porque perder o login é pior que perder o
 * conforto.
 *
 * ## Como a sessão volta
 *
 * A janela carrega o jogo com o token no fragmento, `finalizarLoginEmPopup`
 * a grava e fecha. Como as duas janelas são da mesma origem, o
 * `localStorage` é compartilhado e o evento `storage` avisa a de trás — é
 * ele que dispensa ficar perguntando de tempos em tempos.
 *
 * ## O que isto NÃO faz
 *
 * Não junta contas. Quem já entrou por e-mail e depois vier por aqui recebe
 * um id de usuário DIFERENTE, com progresso próprio — o Supabase trata as
 * duas identidades como duas pessoas até alguém pedir o vínculo. Vincular
 * exige `PUT /user/identities/authorize`, e o dia de escrever isso é o dia em
 * que um jogador pedir.
 */
export function entrarComProvedor(provedor: Provedor): Promise<ResultadoDeConta> {
  const url = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set('provider', provedor);
  url.searchParams.set('redirect_to', voltarPara());

  const janela = window.open(
    url.toString(), NOME_DA_JANELA, 'popup=yes,width=480,height=680',
  );
  if (!janela) {
    // Bloqueado: cai no caminho antigo. A página é descarregada aqui, e a
    // marca diz "pagina" para que a volta não tente se fechar sozinha.
    marcar('pagina');
    location.href = url.toString();
    return Promise.resolve({ ok: false, erro: 'Redirecionando…' });
  }
  marcar('janela');

  // Clicar de novo com uma espera em curso reaponta a janela — mesmo nome, e
  // o `window.open` acima já a reaproveitou — e devolve a MESMA promessa.
  if (pendente) return pendente;

  const espera = new Promise<ResultadoDeConta>((resolve) => {
    let encerrado = false;
    const encerrar = (r: ResultadoDeConta): void => {
      if (encerrado) return;
      encerrado = true;
      pendente = null;
      window.removeEventListener('storage', aoStorage);
      clearInterval(vigia);
      resolve(r);
    };

    const aoStorage = (e: StorageEvent): void => {
      if (e.key !== AVISO && e.key !== CHAVE) return;
      const sessao = sessaoGuardada();
      if (sessao) return encerrar({ ok: true, sessao });
      // A janela pode ter fechado com ERRO, e aí o recado dela é o que a tela
      // mostra. Sem isto o jogador veria só "Login cancelado", que é mentira.
      const aviso = e.key === AVISO ? e.newValue ?? '' : '';
      if (aviso.startsWith('erro:')) encerrar({ ok: false, erro: aviso.slice(5) });
    };
    window.addEventListener('storage', aoStorage);

    /**
     * O relógio NÃO olha para `janela.closed`. Nenhuma vez.
     *
     * O Google responde com `Cross-Origin-Opener-Policy: same-origin`, que
     * corta a ligação entre as duas janelas. Do lado de cá o handle passa a
     * dizer `closed === true` **com a janela aberta na frente do jogador**,
     * escolhendo a conta. Era isso que produzia "Login cancelado" segundos
     * depois do clique.
     *
     * A tentativa anterior foi só desconfiar: `closed` valeria como
     * cancelamento apenas se a janela já tivesse sido vista aberta. Não
     * adiantou, e o motivo é a ORDEM do caminho. A janela nasce no Supabase,
     * que não tem COOP, e é vista aberta no primeiro tique; só então salta
     * para o Google e o corte acontece. A ressalva nunca chegava a valer.
     *
     * Não há remendo aqui: sob COOP, `closed` não responde a pergunta que se
     * quer fazer. Então a pergunta muda. A única evidência confiável é a
     * sessão aparecendo no armazenamento, que é da mesma origem nas duas
     * janelas e por isso atravessa a política.
     *
     * O preço é real e está pago de propósito: fechar a janela no X não é mais
     * percebido. Quem faz isso encontra a tela dizendo que ainda espera, e o
     * botão continua clicável para recomeçar — combinado com `Login.ts`.
     *
     * O teto de tempo existe para a promessa não viver para sempre, e é
     * generoso porque escolher conta, digitar senha e passar por dois fatores
     * leva minutos.
     */
    const limite = Date.now() + 5 * 60_000;

    const vigia = setInterval(() => {
      // A sessão é a verdade. Perguntar aqui cobre um `storage` que se perca.
      const sessao = sessaoGuardada();
      if (sessao) return encerrar({ ok: true, sessao });

      if (Date.now() > limite) {
        encerrar({ ok: false, erro: 'O login demorou demais. Tente de novo.' });
      }
    }, 400);
  });

  pendente = espera;
  return espera;
}

/**
 * Roda no BOOT, antes de tudo: se esta janela é a do login, encerra o serviço.
 *
 * A janela do provedor volta para a própria URL do jogo. Sem isto ela
 * carregaria o jogo inteiro — assets, som, cena — para ser fechada em seguida.
 *
 * ## Reconhece a si mesma pelo NOME, não pelo `opener`
 *
 * A primeira versão exigia `window.opener`, e o Google o apaga: a política
 * `Cross-Origin-Opener-Policy` corta a ligação, e ao voltar para cá o opener é
 * `null`. O resultado era a janelinha carregar o jogo inteiro e ficar aberta,
 * enquanto a página de trás dizia que o login tinha sido cancelado.
 *
 * O nome dado em `window.open` atravessa a navegação e sobrevive ao corte —
 * em tese. Como navegadores limpam o nome em salto entre origens, e o salto
 * para o Google é um, a marca em `localStorage` responde junto: basta uma das
 * duas dizer que sim. Ver `EM_CURSO`.
 *
 * Devolve `true` quando fechou. Quem chama deve PARAR: não há mais página.
 */
export function finalizarLoginEmPopup(): boolean {
  if (!estaNaJanelaDoLogin()) return false;

  const erro = erroDaUrl();
  const temSessao = recolherSessaoDaUrl();
  // Nem sessão nem erro: esta janela não veio de um login. Deixa o jogo abrir.
  if (!temSessao && !erro) return false;

  try {
    // Um valor sempre diferente: `storage` só dispara quando o valor MUDA, e
    // dois logins seguidos gravariam o mesmo e o segundo passaria calado.
    localStorage.setItem(AVISO, erro ? `erro:${erro}` : String(Date.now()));
  } catch { /* A sessão já está guardada; o aviso é conveniência. */ }

  window.close();
  return true;
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
/**
 * O erro que veio na volta do provedor, se veio.
 *
 * **Ele chega na QUERY, não no fragmento.** O token vem em `#` porque
 * fragmento não vai ao servidor; o erro vem em `?` porque não há segredo nele.
 * Eu li só o fragmento na primeira versão, e o resultado foi a janela do login
 * ficar aberta mostrando a tela de novo, calada, enquanto a página de trás
 * esperava para sempre. Falhar em silêncio é o pior desfecho possível aqui.
 */
export function erroDaUrl(): string | null {
  const daQuery = new URLSearchParams(location.search);
  const doHash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const codigo = daQuery.get('error') ?? doHash.get('error');
  if (!codigo) return null;

  const descricao = daQuery.get('error_description') ?? doHash.get('error_description');
  const detalhe = daQuery.get('error_code') ?? doHash.get('error_code');

  // A descrição do provedor vem com `+` no lugar de espaço.
  const legivel = descricao?.replace(/\+/g, ' ');

  /**
   * O código bruto ENTRA no texto, de propósito.
   *
   * `server_error` sozinho não diz nada ao jogador e diz tudo a quem publica —
   * e é quem publica que precisa da informação, porque a causa mora no painel
   * do Supabase ou do Google, não no jogo. Esconder o código faria o relato do
   * testador ser "não entrou" e nada mais.
   */
  return legivel ? `${legivel} (${detalhe ?? codigo})` : `Falha no login: ${detalhe ?? codigo}`;
}

export function recolherSessaoDaUrl(): boolean {
  const bruto = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  const limpar = (): void => {
    history.replaceState(null, '', location.pathname);
    // A volta foi consumida: o login deixou de estar em curso.
    try { localStorage.removeItem(EM_CURSO); } catch { /* nada a fazer. */ }
  };

  // Erro na query: nada a recolher, mas a barra tem de ser limpa — senão o
  // erro fica pendurado e reaparece a cada recarga da página.
  if (!bruto) { if (new URLSearchParams(location.search).has('error')) limpar(); return false; }

  const p = new URLSearchParams(bruto);
  const access = p.get('access_token');
  const refresh = p.get('refresh_token');

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

import { API_URL } from '@data/servidor';
import {
  codigoIndicacaoPendente, limparCodigoIndicacaoPendente, sessaoGuardada, tokenValido,
} from './conta';
import { relatarFalha, type Natureza } from './recusa';

export type ResultadoDaIndicacao =
  | { estado: 'vinculada' }
  | { estado: 'sem_indicacao' }
  | { estado: 'preexistente' }
  | { estado: 'codigo_invalido' }
  | { estado: 'conta_teste' };

type EstadoDaSessao =
  | { estado: 'ativa' }
  | { estado: 'conflito'; iniciadaEm: number; ultimaAtividade: number }
  | { estado: 'substituida' }
  | { estado: 'livre' }
  | { estado: 'email_nao_confirmado' }
  | { estado: 'confirmacao_email_nao_configurada' }
  | { estado: 'verificacao_email_indisponivel' }
  | { estado: 'erro' };

export type RespostaDaSessao = EstadoDaSessao & { indicacao?: ResultadoDaIndicacao };

const PREFIXO = 'oz-game:';
/**
 * De quanto em quanto tempo perguntar se esta aba ainda é a dona.
 *
 * Eram quinze segundos, e quinze segundos são 5.760 requisições por dia numa
 * aba deixada aberta — o preço de descobrir em quinze segundos, e não em
 * sessenta, que outro aparelho assumiu. Ninguém paga esse preço: quem foi
 * expulso está do outro lado da tela, sem ninguém olhando.
 */
const INTERVALO_DE_VERIFICACAO = 60_000;

/**
 * De quanto em quanto tempo dizer que esta aba continua viva.
 *
 * Este é o caro dos dois: é ESCRITA no D1, uma por pulso. Precisa caber com
 * folga dentro de `SESSAO_ATIVA_SEGUNDOS` (360s no servidor) — se o pulso
 * chegar depois da janela, a sessão passa por morta e outro aparelho entra sem
 * perguntar. 150s dá duas chances antes de a janela fechar, que é a margem que
 * cobre um temporizador estrangulado em aba de fundo.
 */
const INTERVALO_DO_PULSO = 150_000;

/** `window.name` pertence à aba, sobrevive ao reload e não é compartilhado entre dispositivos. */
export function instanciaDestaAba(): string {
  if (window.name.startsWith(PREFIXO) && window.name.length <= 88) return window.name.slice(PREFIXO.length);
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  window.name = `${PREFIXO}${id}`;
  return id;
}

/**
 * A recusa daqui NÃO pode ser muda, e foi por ser muda que custou caro.
 *
 * Em 12/09/2026 a cota diária de escrita do D1 estourou e TODA rota passou a
 * responder 500. Esta era a primeira que o jogo encontra — o portão do login —,
 * e ela devolvia `erro` sem dizer nada a ninguém: nem `console.warn`, nem
 * livro das recusas, nem status na tela. O que o jogador viu foi "não foi
 * possível verificar a sessão ativa", que culpa a sessão por um servidor
 * inteiro fora do ar.
 *
 * `reivindicar` é AÇÃO: tem gente parada na frente da tela esperando, e a
 * frase certa aparece na hora. Pulso e verificação são FUNDO: falam depois de
 * três seguidas, para uma queda de rede não virar carrossel de aviso.
 */
async function chamar(
  metodo: 'GET' | 'POST', corpo?: {
    acao: string; forcar?: boolean; codigoIndicacao?: string;
  }, manter = false, natureza: Natureza = 'fundo',
): Promise<RespostaDaSessao> {
  const token = manter ? sessaoGuardada()?.accessToken : await tokenValido();
  if (!token) return { estado: 'erro' };
  const instancia = instanciaDestaAba();
  const url = metodo === 'GET'
    ? `${API_URL}/sessao?instancia=${encodeURIComponent(instancia)}`
    : `${API_URL}/sessao`;
  try {
    const r = await fetch(url, {
      method: metodo,
      headers: {
        authorization: `Bearer ${token}`,
        ...(metodo === 'POST' ? { 'content-type': 'application/json' } : {}),
      },
      ...(metodo === 'POST' ? { body: JSON.stringify({ instancia, ...corpo }) } : {}),
      ...(manter ? { keepalive: true } : {}),
    });
    if (!r.ok) { await relatarFalha('/sessao', natureza, r);
      const dados = await r.clone().json().catch(() => ({})) as { erro?: string };
      if (dados.erro === 'email_nao_confirmado') return { estado: 'email_nao_confirmado' };
      if (dados.erro === 'confirmacao_email_nao_configurada') return { estado: 'confirmacao_email_nao_configurada' };
      if (dados.erro === 'verificacao_email_indisponivel') return { estado: 'verificacao_email_indisponivel' };
      return { estado: 'erro' };
    }
    const resposta = await r.json() as RespostaDaSessao;
    if (resposta.indicacao) limparCodigoIndicacaoPendente();
    return resposta;
  } catch {
    // Rede fora ou exceção: `relatarFalha` sabe ler isso do `null`.
    await relatarFalha('/sessao', natureza, null);
    return { estado: 'erro' };
  }
}

export const reivindicarSessao = (forcar = false): Promise<RespostaDaSessao> =>
  chamar('POST', {
    acao: 'reivindicar', forcar,
    codigoIndicacao: codigoIndicacaoPendente() ?? undefined,
  }, false, 'acao');

export function vigiarSessaoUnica(aoSubstituir: () => void): () => void {
  let viva = true;
  let ocupada = false;
  const parar = (): void => {
    viva = false;
    clearInterval(verificacao);
    clearInterval(pulso);
    document.removeEventListener('visibilitychange', aoVoltar);
    window.removeEventListener('pagehide', aoSair);
  };
  const verificar = async (): Promise<void> => {
    if (!viva || ocupada) return;
    ocupada = true;
    const r = await chamar('GET');
    ocupada = false;
    if (viva && r.estado === 'substituida') { parar(); aoSubstituir(); }
  };
  const pulsar = async (): Promise<void> => {
    if (!viva || ocupada) return;
    ocupada = true;
    const r = await chamar('POST', { acao: 'pulsar' });
    ocupada = false;
    if (viva && r.estado === 'substituida') { parar(); aoSubstituir(); }
  };
  const aoVoltar = (): void => { if (!document.hidden) void pulsar(); };
  const aoSair = (evento: PageTransitionEvent): void => {
    if (evento.persisted) return;
    void chamar('POST', { acao: 'encerrar' }, true);
  };
  const verificacao = window.setInterval(() => { void verificar(); }, INTERVALO_DE_VERIFICACAO);
  const pulso = window.setInterval(() => { void pulsar(); }, INTERVALO_DO_PULSO);
  document.addEventListener('visibilitychange', aoVoltar);
  window.addEventListener('pagehide', aoSair);
  return parar;
}

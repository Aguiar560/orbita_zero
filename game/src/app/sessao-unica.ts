import { API_URL } from '@data/servidor';
import { sessaoGuardada, tokenValido } from './conta';

export type RespostaDaSessao =
  | { estado: 'ativa' }
  | { estado: 'conflito'; iniciadaEm: number; ultimaAtividade: number }
  | { estado: 'substituida' }
  | { estado: 'livre' }
  | { estado: 'erro' };

const PREFIXO = 'oz-game:';
const INTERVALO_DE_VERIFICACAO = 15_000;
const INTERVALO_DO_PULSO = 60_000;

/** `window.name` pertence à aba, sobrevive ao reload e não é compartilhado entre dispositivos. */
export function instanciaDestaAba(): string {
  if (window.name.startsWith(PREFIXO) && window.name.length <= 88) return window.name.slice(PREFIXO.length);
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  window.name = `${PREFIXO}${id}`;
  return id;
}

async function chamar(
  metodo: 'GET' | 'POST', corpo?: { acao: string; forcar?: boolean }, manter = false,
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
    if (!r.ok) return { estado: 'erro' };
    return await r.json() as RespostaDaSessao;
  } catch { return { estado: 'erro' }; }
}

export const reivindicarSessao = (forcar = false): Promise<RespostaDaSessao> =>
  chamar('POST', { acao: 'reivindicar', forcar });

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

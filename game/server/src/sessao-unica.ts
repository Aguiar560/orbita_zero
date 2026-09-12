/**
 * Uma aba sem pulso por seis minutos deixa de bloquear uma nova entrada.
 *
 * Eram três, com pulso de um minuto. O pulso subiu para 150s em 12/09/2026 para
 * caber na cota de escrita do D1, e a janela subiu junto: ela precisa ser
 * múltipla do pulso, não igual a ele. Com 360s a aba erra dois pulsos seguidos
 * — rede ruim, temporizador estrangulado em segundo plano — e ainda assim
 * continua dona da sessão.
 *
 * O custo de esticar é o outro lado: quem fecha a aba no grito (queda de
 * energia, aba morta sem `pagehide`) espera até seis minutos para entrar de
 * outro aparelho sem ver a pergunta. Quem fecha normalmente não espera nada —
 * `encerrar` apaga a linha na saída.
 */
export const SESSAO_ATIVA_SEGUNDOS = 360;

export const instanciaValida = (valor: unknown): valor is string =>
  typeof valor === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(valor);

interface LinhaDeSessao {
  instancia: string;
  iniciada_em: number;
  atividade_em: number;
}

export type EstadoDaSessao =
  | { estado: 'ativa' }
  | { estado: 'conflito'; iniciadaEm: number; ultimaAtividade: number }
  | { estado: 'substituida' }
  | { estado: 'livre' };

export async function reivindicarSessao(
  env: { DB: D1Database }, usuario: string, instancia: string, forcar: boolean, agora: number,
): Promise<EstadoDaSessao> {
  const limite = agora - SESSAO_ATIVA_SEGUNDOS;
  const r = await env.DB.prepare(`
    INSERT INTO sessoes_ativas (usuario, instancia, iniciada_em, atividade_em)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(usuario) DO UPDATE SET
      instancia = excluded.instancia,
      iniciada_em = CASE
        WHEN sessoes_ativas.instancia = excluded.instancia THEN sessoes_ativas.iniciada_em
        ELSE excluded.iniciada_em
      END,
      atividade_em = excluded.atividade_em
    WHERE sessoes_ativas.instancia = excluded.instancia
       OR sessoes_ativas.atividade_em <= ?
       OR ? = 1
  `).bind(usuario, instancia, agora, agora, limite, forcar ? 1 : 0).run();

  if (Number(r.meta.changes ?? 0) === 1) return { estado: 'ativa' };
  const atual = await env.DB.prepare(
    'SELECT instancia, iniciada_em, atividade_em FROM sessoes_ativas WHERE usuario = ?',
  ).bind(usuario).first<LinhaDeSessao>();
  if (!atual || atual.atividade_em <= limite) return { estado: 'livre' };
  return { estado: 'conflito', iniciadaEm: atual.iniciada_em, ultimaAtividade: atual.atividade_em };
}

export async function verificarSessao(
  env: { DB: D1Database }, usuario: string, instancia: string, agora: number,
): Promise<EstadoDaSessao> {
  const atual = await env.DB.prepare(
    'SELECT instancia, iniciada_em, atividade_em FROM sessoes_ativas WHERE usuario = ?',
  ).bind(usuario).first<LinhaDeSessao>();
  if (!atual || atual.atividade_em <= agora - SESSAO_ATIVA_SEGUNDOS) return { estado: 'livre' };
  return atual.instancia === instancia ? { estado: 'ativa' } : { estado: 'substituida' };
}

export async function pulsarSessao(
  env: { DB: D1Database }, usuario: string, instancia: string, agora: number,
): Promise<EstadoDaSessao> {
  const r = await env.DB.prepare(
    'UPDATE sessoes_ativas SET atividade_em = ? WHERE usuario = ? AND instancia = ?',
  ).bind(agora, usuario, instancia).run();
  return Number(r.meta.changes ?? 0) === 1 ? { estado: 'ativa' } : { estado: 'substituida' };
}

export async function encerrarSessao(
  env: { DB: D1Database }, usuario: string, instancia: string,
): Promise<void> {
  await env.DB.prepare(
    'DELETE FROM sessoes_ativas WHERE usuario = ? AND instancia = ?',
  ).bind(usuario, instancia).run();
}

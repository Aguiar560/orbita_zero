import { VIP_SEGUNDOS } from './carteira';

/** Interruptor único para retirar a recompensa quando o período de teste acabar. */
export const VIP_TESTE_NIVEL_25_ATIVO = true;
export const NIVEL_DA_RECOMPENSA_VIP = 25;
export const CHAVE_DO_RECADO_VIP = 'vip_teste_nivel_25';
export const MENSAGEM_DA_RECOMPENSA_VIP =
  'Thank you for helping us test Órbita Zero! You reached Command Level 25 and received a free 30-day VIP Pass. Your time in the game is helping us make it better.';

/**
 * Concede uma única vez o passe de agradecimento do período de testes.
 *
 * A elegibilidade vem do nível calculado no servidor. O `UPDATE` condicional é
 * a trava contra duas abas: só uma consegue trocar o carimbo de zero. O recado
 * é tentado em toda leitura elegível e possui índice único; se a rede cair
 * depois do crédito e antes da mensagem, a próxima leitura repara a entrega.
 */
export async function concederVipDeTeste(
  env: { DB: D1Database }, usuario: string, nivel: number, agora: number,
): Promise<boolean> {
  if (!VIP_TESTE_NIVEL_25_ATIVO || nivel < NIVEL_DA_RECOMPENSA_VIP) return false;

  await env.DB.prepare(`
    INSERT OR IGNORE INTO assinaturas (usuario, expira_em, bonus_nivel_25_em)
    VALUES (?, 0, 0)
  `).bind(usuario).run();

  const concessao = await env.DB.prepare(`
    UPDATE assinaturas
       SET expira_em = MAX(expira_em, ?) + ?, bonus_nivel_25_em = ?
     WHERE usuario = ? AND bonus_nivel_25_em = 0
  `).bind(agora, VIP_SEGUNDOS, agora, usuario).run();

  await env.DB.prepare(`
    INSERT OR IGNORE INTO recados (usuario, texto, criado_em, chave)
    VALUES (?, ?, ?, ?)
  `).bind(usuario, MENSAGEM_DA_RECOMPENSA_VIP, agora, CHAVE_DO_RECADO_VIP).run();

  return Number(concessao.meta.changes ?? 0) === 1;
}

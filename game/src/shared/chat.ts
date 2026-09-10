/** Contrato independente de DOM, compartilhado pelo cliente e pelo Worker social. */
export const CHAT = {
  caracteres: 400, bytes: 1600, pacote: 4096, pagina: 50,
  globalDias: 7, privadaDias: 90, denunciaDias: 180,
  ticketMs: 30_000, autenticarMs: 5_000, sessaoMs: 15 * 60_000,
  conexoes: 500, porUsuario: 3,
} as const;

export interface PerfilChat { id: string; apelido: string; podeEnviar: boolean; moderador: boolean }
export interface MensagemChat {
  id: number; conversa: string; autor: string; apelido: string; texto: string;
  criado: number; removida: number; clienteId: string;
  /**
   * O autor tem passe ativo AGORA — não quando escreveu.
   *
   * É por isso que o campo não vive na tabela de mensagens: um selo gravado
   * junto do texto viraria histórico ("era VIP em março"), e a coroa passaria
   * a mentir nos dois sentidos — some de quem renovou e fica em quem deixou
   * vencer. O carimbo é aplicado na saída, a cada entrega.
   *
   * Opcional porque uma mensagem antiga, entregue por um Worker anterior a
   * este campo, continua sendo uma mensagem válida.
   */
  vip?: number;
}
export interface ConversaChat {
  id: string; outro: string; apelido: string; iniciador: string;
  estado: 'pendente' | 'aceita' | 'recusada'; naoLidas: number; ultima: number;
}
export interface DenunciaChat {
  id: string; mensagem: number; motivo: string; evidencia: string; criado: number; estado: string;
}
export type EventoChat =
  | { tipo: 'pronto'; perfil: PerfilChat }
  | { tipo: 'mensagem'; mensagem: MensagemChat }
  | { tipo: 'atualizar' }
  | { tipo: 'estado' }
  | { tipo: 'removida'; id: number }
  | { tipo: 'erro'; erro: string };

export function textoChat(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  // Impede controles invisíveis/bidirecionais; mantém ZWJ dos emojis e acentos.
  const texto = valor.normalize('NFC').replace(/[\u0000-\u0008\u000b-\u001f\u007f\u200b\u202a-\u202e\u2066-\u2069]/g, '').trim();
  if (!texto || [...texto].length > CHAT.caracteres || new TextEncoder().encode(texto).length > CHAT.bytes) return null;
  if (texto.split('\n').length > 5) return null;
  return texto;
}

export const idChatValido = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);

export function cursorChat(valor: unknown): number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0 ? valor : 0;
}

/**
 * A partir de quando (ms) o jogador enxerga o canal GLOBAL.
 *
 * Quem chega não herda a conversa de antes dele: o canal começa no momento em
 * que ele entrou no jogo. A entrada é o `criado_em` do apelido (segundos), e
 * não um carimbo novo do chat, por dois motivos: o apelido é obrigatório para
 * jogar, então a data dele É a chegada; e ela já existe para todo mundo — um
 * carimbo novo gravado no primeiro acesso ao chat esvaziaria o global de todos
 * os jogadores antigos no dia do deploy. Trocar de apelido não mexe na data.
 *
 * Sem apelido (visitante), a chegada é agora: vê o que for dito daqui em diante.
 * Uma data no futuro (relógio torto) também vira agora, para não esconder as
 * mensagens ao vivo que ele já está recebendo.
 */
export function chegadaNoGlobal(apelidoCriadoEm: unknown, agora: number): number {
  if (typeof apelidoCriadoEm !== 'number' || !Number.isFinite(apelidoCriadoEm) || apelidoCriadoEm <= 0) return agora;
  return Math.min(apelidoCriadoEm * 1000, agora);
}

export function origemChatPermitida(origem: string | null, lista: string): boolean {
  // Produção e previews precisam ser explicitamente cadastrados: sem curingas.
  if (!origem || origem === 'null') return false;
  return lista.split(',').map(v => v.trim()).includes(origem);
}

export class ErroChat extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export function participanteChat(c: { a: string; b: string } | null, usuario: string): boolean {
  return !!c && (c.a === usuario || c.b === usuario);
}

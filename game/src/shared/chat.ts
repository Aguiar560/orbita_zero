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

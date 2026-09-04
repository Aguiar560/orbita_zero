import { describe, expect, it } from 'vitest';
import { CHAT, cursorChat, idChatValido, origemChatPermitida, participanteChat, textoChat } from '../src/shared/chat';
import { corpoLimitado } from '../server/src/chat/worker';

describe('contrato do chat', () => {
  it('aceita texto e emojis, com normalização e sem interpretar HTML', () => {
    expect(textoChat('  Olá 🚀  ')).toBe('Olá 🚀');
    expect(textoChat('a\u0301')).toBe('á');
    expect(textoChat('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
    expect(textoChat('Oi\u202e\u0000!')).toBe('Oi!');
  });
  it('recusa vazio, controles, excesso de linhas e de caracteres', () => {
    for (const v of ['', '  ', null, {}, 15, '\u0000', 'a'.repeat(401), 'a\na\na\na\na\na']) expect(textoChat(v)).toBeNull();
    expect(textoChat('🚀'.repeat(400))).not.toBeNull();
    expect(textoChat('🚀'.repeat(401))).toBeNull();
  });
  it('não admite ids e cursores arbitrários', () => {
    expect(idChatValido('a-12_3')).toBe(true);
    expect(idChatValido('id/../../')).toBe(false);
    for (const v of [-1, Infinity, NaN, '15', 1.5, Number.MAX_SAFE_INTEGER + 1]) expect(cursorChat(v)).toBe(0);
    expect(cursorChat(15)).toBe(15);
  });
  it('origens são exatas e nunca aceitam null, prefixos ou curingas', () => {
    const lista = 'https://jogo.test,http://localhost:5180';
    expect(origemChatPermitida('https://jogo.test', lista)).toBe(true);
    for (const o of [null, 'null', 'https://jogo.test.evil.test', 'https://jogo.test/', 'https://outro.test']) expect(origemChatPermitida(o, lista)).toBe(false);
  });
  it('terceiro jogador não pertence à privada', () => {
    expect(participanteChat({ a: 'a', b: 'b' }, 'a')).toBe(true);
    expect(participanteChat({ a: 'a', b: 'b' }, 'b')).toBe(true);
    expect(participanteChat({ a: 'a', b: 'b' }, 'c')).toBe(false);
    expect(participanteChat(null, 'a')).toBe(false);
  });
  it('limita bytes mesmo sem Content-Length e valida o objeto JSON', async () => {
    const req = (body: string) => new Request('https://test', { method: 'POST', body });
    await expect(corpoLimitado(req(JSON.stringify({ texto: 'x'.repeat(CHAT.pacote) })))).rejects.toThrow('muito grande');
    for (const s of ['[]', 'null', '1', '{erro']) await expect(corpoLimitado(req(s))).rejects.toThrow('inválido');
    await expect(corpoLimitado(req('{"op":"ticket"}'))).resolves.toEqual({ op: 'ticket' });
  });
});

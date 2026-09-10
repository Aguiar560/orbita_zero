import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { chegadaNoGlobal } from '../src/shared/chat';

/**
 * Piloto novo não herda o canal global: ele começa na chegada dele.
 *
 * Pedido de 10/09/2026. A chegada é o `criado_em` do apelido, que é obrigatório
 * para jogar — e não um carimbo gravado no primeiro acesso ao chat, que
 * esvaziaria o global de todos os jogadores antigos no dia do deploy.
 *
 * O caminho de ponta a ponta (D1, Durable Object, JWT) está em
 * `tools/test-chat-integration.mjs`; aqui fica a regra e onde ela é aplicada.
 */

const agora = Date.UTC(2026, 8, 10, 12);
const central = readFileSync(join(process.cwd(), 'server', 'src', 'chat', 'CentralChat.ts'), 'utf8');

describe('chegadaNoGlobal', () => {
  it('é a data do apelido, em milissegundos', () => {
    const ontem = agora / 1000 - 86400;
    expect(chegadaNoGlobal(ontem, agora)).toBe(ontem * 1000);
  });

  it('sem apelido é agora: o visitante vê só o que vier depois', () => {
    for (const v of [undefined, null, 0, -5, Number.NaN, '1700000000']) expect(chegadaNoGlobal(v, agora)).toBe(agora);
  });

  it('uma data no futuro não esconde o que já está chegando ao vivo', () => {
    expect(chegadaNoGlobal(agora / 1000 + 3600, agora)).toBe(agora);
  });
});

describe('no servidor', () => {
  it('o histórico global corta pela chegada, e a privada não', () => {
    expect(central).toContain("const desde = d.conversa === 'global' ? await this.chegada(id) : 0;");
    expect(central).toContain('AND m.criado>=?');
  });

  it('e a chegada vem do banco do jogo, nunca do pedido', () => {
    expect(central).toContain('SELECT criado_em FROM apelidos WHERE usuario=?');
    expect(central).not.toMatch(/d\.(desde|chegada)/);
  });
});

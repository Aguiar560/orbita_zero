import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * A coroa que separa quem tem passe de quem não tem, no chat.
 *
 * ## A única coisa que pode dar errado aqui
 *
 * **A coroa vir do cliente.** Ela é um selo pago: se o `vip` viesse no que o
 * navegador envia, bastaria trocar um campo no console para usá-la de graça —
 * e um selo que qualquer um consegue não vale nada para quem pagou.
 *
 * Por isso o carimbo é aplicado na SAÍDA, pelo Worker social, lendo o banco do
 * jogo. E por isso ele não é gravado junto da mensagem: guardado ali viraria
 * histórico ("era VIP em março"), e a coroa passaria a mentir nos dois
 * sentidos — sumindo de quem renovou e ficando em quem deixou vencer.
 */

const fonte = (...p: string[]): string => readFileSync(join(process.cwd(), ...p), 'utf8');
const central = fonte('server', 'src', 'chat', 'CentralChat.ts');
const painel = fonte('src', 'ui', 'ChatPanel.ts');
const contrato = fonte('src', 'shared', 'chat.ts');

describe('a coroa é do servidor, e não do navegador', () => {
  it('o carimbo lê o banco do JOGO, onde mora a assinatura', () => {
    expect(central).toContain("SELECT usuario FROM assinaturas WHERE expira_em > ?");
    expect(central).toContain('private async vipsAtivos()');
  });

  it('e nada no chat aceita `vip` vindo de fora', () => {
    /**
     * O cliente manda `texto`, `conversa` e `clienteId`. Se algum dia ele
     * puder mandar `vip`, este teste cai — que é o ponto.
     */
    expect(central).not.toMatch(/d\.vip/);
    expect(central).not.toMatch(/INSERT INTO chat_mensagens[^;]*vip/);
  });

  it('e o selo NÃO é gravado na mensagem', () => {
    // Guardado junto do texto ele viraria histórico. O estado que interessa é
    // o de agora: quem renovou tem coroa, quem deixou vencer não tem.
    expect(fonte('server', 'chat-schema.sql')).not.toMatch(/chat_mensagens[\s\S]*?vip/);
  });
});

describe('todo caminho de saída carimba', () => {
  it('histórico, eco do envio e difusão', () => {
    /**
     * Faltando um deles a coroa fica intermitente — aparece ao rolar para cima
     * e some na mensagem nova, ou o contrário —, e um selo que pisca lê como
     * defeito, não como benefício.
     */
    expect((central.match(/this\.comCoroa\(/g) ?? []).length).toBe(3);
  });

  it('e o lote inteiro numa consulta só', () => {
    // Uma consulta por mensagem, num global movimentado, é ordens de grandeza
    // mais cara — e a resposta seria sempre a mesma lista.
    expect(central).toContain('await this.comCoroa(pendentes.results)');
    expect(central).toContain('private vips = new Set<string>()');
    expect(central).toContain('60_000');
  });

  it('e o banco do jogo fora do ar não derruba o chat', () => {
    // Sem coroa é pior que com coroa; sem chat é pior que os dois.
    const t = central.slice(central.indexOf('private async vipsAtivos'));
    const corpo = t.slice(0, t.indexOf('\n  }\n'));
    expect(corpo).toContain('} catch {');
    expect(corpo).toContain('return this.vips;');
  });
});

describe('na tela', () => {
  it('a coroa aparece antes do nome, e colada nele', () => {
    /**
     * Soltas como irmãs do `time`, as duas caíam em cantos opostos: o
     * `space-between` do cabeçalho empurrava a coroa para a esquerda e o nome
     * para o meio, e o selo parecia ser de outra pessoa. Elas são uma coisa só,
     * então moram no mesmo grupo.
     */
    expect(painel).toContain('chat-coroa');
    expect(painel).toContain("h('span.chat-quem', {}, coroa, autor)");

    const css = fonte('src', 'styles', 'chat.css');
    expect(css).toContain('.chat-quem { display: flex;');
    // O `space-between` continua, agora entre o GRUPO e a hora.
    expect(css).toContain('.chat-mensagem header { display: flex; align-items: baseline; justify-content: space-between;');
  });

  it('e só quando o servidor disse que sim', () => {
    expect(painel).toContain('const coroa = m.vip');
  });

  it('e o campo é opcional no contrato', () => {
    // Uma mensagem antiga, entregue por um Worker anterior a este campo,
    // continua sendo uma mensagem válida.
    expect(contrato).toMatch(/vip\?: number/);
  });

  it('e ela diz o que é para quem não vê o desenho', () => {
    expect(painel).toContain("'aria-label': 'VIP'");
    expect(painel).toContain("title: 'Passe VIP ativo'");
  });
});

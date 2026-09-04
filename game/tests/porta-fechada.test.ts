/**
 * Não se entra no jogo sem sessão.
 *
 * ## Por que isto precisa de teste
 *
 * Porque a regressão é invisível. Sem token, `garantirLote` desiste ANTES da
 * rede: o pote nunca chega e nenhum item cai — nunca. Abate, XP e recurso
 * continuam entrando, então a tela parece um jogo normal. A dívida de drop não
 * salva ninguém: tem teto de 100, mora só em memória e morre com a aba.
 *
 * O recuo que existia era exatamente esse buraco. `Login` resolvia com `null`
 * quando o cadastro anônimo falhava, "para um ajuste de painel esquecido não
 * impedir alguém de jogar". O argumento valia enquanto o loot rolava no
 * cliente; depois da Fase 3 ele passou a entregar calado um jogo sem item.
 *
 * ## Por que ler a fonte em vez de rodar a tela
 *
 * `Login` é DOM, e a suíte roda em Node puro sem jsdom. Montar um ambiente de
 * navegador inteiro para afirmar "não existe caminho para null" seria mais
 * frágil que ler as duas linhas que diriam o contrário — e a asserção é
 * literalmente sobre a forma do código, não sobre o comportamento em tela.
 *
 * A defesa real é o TIPO: `mostrar` devolve `Promise<Sessao>`, sem `| null`,
 * então um recuo novo não compila sem alguém mudar a assinatura de propósito.
 * Este teste é o segundo par de olhos para esse "de propósito".
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fonte = (f: string): string => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

describe('a porta de entrada exige sessão', () => {
  it('Login.mostrar não promete `null`', () => {
    // O tipo é a regra. Trocar por `Promise<Sessao | null>` reabre o recuo, e é
    // uma mudança que precisa ser deliberada.
    expect(fonte('ui/Login.ts')).toContain('async mostrar(host: HTMLElement): Promise<Sessao>');
  });

  it('e nenhum caminho resolve sem ela', () => {
    // `pronto(null)` era a linha exata do recuo antigo.
    expect(fonte('ui/Login.ts')).not.toContain('pronto(null)');
  });

  it('a falha do cadastro anônimo mantém a tela aberta', () => {
    // Falhar tem de virar recado + nova tentativa, não passagem livre.
    const s = fonte('ui/Login.ts');
    const trecho = s.slice(s.indexOf('const semCadastro'));
    expect(trecho).toContain('this.recado =');
    expect(trecho).toContain('this.render(pronto)');
  });

  it('o Game não trata mais "entrou sem conta"', () => {
    // Se voltasse a tratar, seria sinal de que o `null` voltou junto.
    expect(fonte('app/Game.ts')).not.toMatch(/mostrar\([^)]*\)[^;]*\?\?/);
  });
});

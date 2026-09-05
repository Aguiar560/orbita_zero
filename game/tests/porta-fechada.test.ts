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

  it('e não existe mais caminho anônimo nenhum', () => {
    /**
     * A regra ficou MAIS forte em 04/09: a conta virou obrigatória.
     *
     * Antes havia `entrarAnonimo`, e este teste guardava que a falha dele
     * mantinha a tela aberta em vez de deixar passar. Agora a função não
     * existe: o progresso do jogador anônimo ficava amarrado ao
     * `localStorage` daquele navegador, e limpar os dados do site apagava o
     * ACESSO a um save que continuava vivo no servidor.
     *
     * Só coube tornar obrigatório porque ainda não havia ninguém jogando.
     * Depois do primeiro jogador isso seria migração, não escolha.
     */
    // O SÍMBOLO, não a menção: os comentários citam `entrarAnonimo` para
    // explicar por que ele saiu, e proibir a palavra apagaria a história —
    // o mesmo cuidado que o teste do vocabulário onda/setor já exigiu.
    expect(fonte('app/conta.ts')).not.toMatch(/export const entrarAnonimo/);
    expect(fonte('ui/Login.ts')).not.toMatch(/entrarAnonimo\s*\(/);
    expect(fonte('ui/Login.ts')).not.toContain("'Jogar agora'");
  });

  it('e há duas formas de entrar, ambas com dono', () => {
    /**
     * E-mail e Google. As duas produzem conta com id no servidor e caminho de
     * volta — era exatamente o que faltava.
     *
     * O Facebook chegou a existir e saiu em 04/09: para aceitar qualquer
     * pessoa o app precisa estar em modo Ativo, e isso exige URL de política
     * de privacidade, que o jogo não tem. Botão que só funciona para quem está
     * cadastrado como testador é pior que botão nenhum.
     */
    const conta = fonte('app/conta.ts');
    expect(conta).toContain('entrarComProvedor');
    expect(conta).toContain('recolherSessaoDaUrl');
    expect(conta).toContain("google: 'Google'");
    expect(fonte('ui/Login.ts')).toContain('login-provedor');
  });

  it('e o provedor abre em janela própria, sem descarregar o jogo', () => {
    /**
     * `window.open` e não `location.href`: navegar a própria página descarrega
     * o jogo, e quem desiste no meio do Google volta para uma página que não é
     * mais a dele.
     *
     * O recuo para `location.href` FICA, e é o que este teste também guarda:
     * quando o navegador bloqueia a janela, perder o conforto é melhor que
     * perder o login.
     */
    const conta = fonte('app/conta.ts');
    expect(conta).toContain('window.open(');
    expect(conta).toContain('finalizarLoginEmPopup');
    // O recuo, para o caso de bloqueio.
    expect(conta).toContain('location.href = url.toString();');
    // E o boot fecha a janela antes de carregar o jogo dentro dela.
    expect(fonte('main.ts')).toContain('finalizarLoginEmPopup()');
  });

  it('o Game não trata mais "entrou sem conta"', () => {
    // Se voltasse a tratar, seria sinal de que o `null` voltou junto.
    expect(fonte('app/Game.ts')).not.toMatch(/mostrar\([^)]*\)[^;]*\?\?/);
  });
});

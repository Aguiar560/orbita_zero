import { AMBIENTE, API_ORIGEM, API_URL } from '@app/api';

/**
 * A faixa que diz em qual ambiente o jogo está rodando.
 *
 * ## Por que uma faixa na tela, e não só um log
 *
 * O acidente que isto evita não é técnico, é humano: achar que se está testando
 * quando se está em produção, ou o contrário. Os dois custam caro e nenhum dos
 * dois se anuncia — a tela do jogo é idêntica. Um `console.log` não resolve
 * porque ninguém deixa o devtools aberto enquanto joga.
 *
 * Então a regra é: **só a produção não se anuncia.** Qualquer outro ambiente
 * carrega uma faixa permanente, impossível de fechar, com o destino da API
 * escrito nela. Se não há faixa, é produção — e isso passa a ser uma informação
 * confiável em vez de uma suposição.
 *
 * ## A faixa é `position: fixed` e não mexe no layout
 *
 * De propósito. A cena vertical calcula altura útil a partir do elemento raiz
 * (ver `relayout` em `main.ts`), e uma faixa que empurrasse o conteúdo mudaria
 * o enquadramento do jogo entre ambientes — o que faria o teste deixar de
 * valer para a produção.
 */

const CORES: Record<string, { fundo: string; texto: string }> = {
  fechado: { fundo: '#b3261e', texto: '#fff' },
  sandbox: { fundo: '#8a5a00', texto: '#fff' },
  staging: { fundo: '#0b5d8a', texto: '#fff' },
  local: { fundo: '#4a3d8f', texto: '#fff' },
};

function textoDaFaixa(): string {
  if (API_ORIGEM === 'fechado') {
    return 'API NÃO CONFIGURADA — o jogo não vai sincronizar. Defina VITE_API_URL.';
  }
  return `AMBIENTE ${AMBIENTE.toUpperCase()} — DADOS SEPARADOS — A PRODUÇÃO NÃO SERÁ ALTERADA · ${API_URL}`;
}

/**
 * Explica no console o que fazer, com o comando pronto.
 *
 * Quem chega aqui está com o jogo aberto e nada sincronizando. A pergunta que
 * ele tem é "por quê", e a resposta inteira cabe numa mensagem — inclusive o
 * fato de que isto é deliberado, porque senão parece defeito.
 */
function explicarNoConsole(): void {
  if (API_ORIGEM !== 'fechado') {
    console.info(`[ambiente] ${AMBIENTE} · API em ${API_URL} (origem: ${API_ORIGEM})`);
    return;
  }
  console.error(
    '[ambiente] A API está FECHADA de propósito.\n'
    + '\n'
    + 'Rodar em localhost sem declarar VITE_API_URL não cai mais para a produção:\n'
    + 'uma conta autenticada aqui escreveria no banco dos jogadores de verdade.\n'
    + '\n'
    + 'Escolha um destino antes de subir o servidor de dev:\n'
    + '  staging → VITE_API_URL=https://orbita-zero-api-staging.orbitazero.workers.dev\n'
    + '  Worker local → VITE_API_URL=http://127.0.0.1:8787\n'
    + '\n'
    + 'O jeito estável é criar game/.env.local a partir de game/.env.example.',
  );
}

/** Monta a faixa quando o ambiente não é produção. Idempotente. */
export function anunciarAmbiente(): void {
  explicarNoConsole();
  if (AMBIENTE === 'producao' && API_ORIGEM === 'producao') return;
  if (document.getElementById('faixa-de-ambiente')) return;

  const cor = CORES[API_ORIGEM === 'fechado' ? 'fechado' : AMBIENTE] ?? CORES.local!;
  const faixa = document.createElement('div');
  faixa.id = 'faixa-de-ambiente';
  faixa.textContent = textoDaFaixa();
  faixa.style.cssText = [
    'position:fixed', 'inset:auto 0 0 0', 'z-index:2147483647',
    `background:${cor.fundo}`, `color:${cor.texto}`,
    'font:600 11px/1.6 system-ui,sans-serif', 'letter-spacing:.04em',
    'text-align:center', 'padding:3px 8px', 'pointer-events:none',
    'text-transform:uppercase', 'white-space:nowrap',
    'overflow:hidden', 'text-overflow:ellipsis',
  ].join(';');
  document.body.appendChild(faixa);
}

import { API_URL } from '@app/api';

import { tokenValido } from './conta';

/**
 * O erro de JavaScript do navegador — o último buraco da observabilidade.
 *
 * ## O que era invisível
 *
 * Desde 09/09 o servidor conta tudo o que ELE recusa, e avisa a cada cinco
 * minutos. Um `TypeError` num painel, porém, acontece inteiro na máquina do
 * jogador: a tela quebra, ele fecha a aba, e do lado de cá não existe rastro
 * nenhum. É a classe de defeito **mais visível para quem joga e menos visível
 * para quem conserta** — e os defeitos de 08/09 foram todos de interação.
 *
 * ## As três decisões que este arquivo carrega
 *
 * **1. A pilha NUNCA sobe.** Ela pode carregar dado do jogador — o conteúdo de
 * uma variável aparece em mensagem de erro com frequência — e um livro de
 * operação não é lugar para isso. Sobe o nome do erro e a mensagem SANEADA:
 * letras e pontuação, sem dígitos, sem símbolo, sem URL. "Cannot read
 * properties of undefined (reading 'hull')" sobrevive; um token, um e-mail ou
 * um id não.
 *
 * **2. Cada erro distinto sobe UMA vez por sessão.** Um erro dentro do laço de
 * quadros dispara sessenta vezes por segundo. Sem a trava, a primeira tela
 * quebrada gastaria a cota de escrita do dia inteiro — o mesmo raciocínio do
 * livro das recusas, que agrega em vez de gravar ocorrência a ocorrência.
 *
 * **3. O relator nunca pode estourar.** Um erro dentro do tratador de erros
 * vira laço infinito. Tudo aqui é `try`/`catch`, e o `catch` é vazio de
 * propósito — é o único lugar do projeto onde engolir é a resposta certa e
 * final.
 */

/** Erros distintos por sessão. Acima disso, a página já disse o que tinha. */
export const DISTINTOS_MAX = 10;

/** Tamanho do motivo que vai para o livro. A coluna é curta por desenho. */
export const MOTIVO_MAX = 100;

const enviados = new Set<string>();

/**
 * O motivo, pronto para virar chave de agregação.
 *
 * Sanear DEPOIS de juntar nome e mensagem, e não antes, porque o corte de
 * tamanho precisa ver o texto inteiro — um nome longo não pode comer a
 * mensagem toda.
 */
export function motivoDoErro(nome: string, mensagem: string): string {
  // Junta só o que existe. Formatar com `${nome}: ${mensagem}` deixava um `:`
  // solto quando faltava um dos dois, e aparar a pontuação depois comia o `')`
  // do fim de "(reading 'hull')" — que é justamente a parte que localiza.
  const limpo = [nome, mensagem].filter(Boolean).join(': ')
    // Sem dígitos e sem símbolo: é o que tira id, token, e-mail e caminho de
    // arquivo sem precisar adivinhar o formato de cada um.
    .replace(/[^A-Za-z ,.:'()_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Sem NENHUMA letra não é descrição de nada — é o caso do erro de script de
  // outra origem, que chega sem `name` e sem `message`. Contar "aconteceu
  // algo" é melhor que mandar `:` e tomar 400 do servidor.
  if (!/[A-Za-z]/.test(limpo)) return 'erro_sem_nome';

  return limpo.slice(0, MOTIVO_MAX);
}

/** Manda, se ainda não mandou este. Nunca estoura, nunca espera. */
async function relatar(nome: string, mensagem: string): Promise<void> {
  try {
    const motivo = motivoDoErro(nome, mensagem);
    if (enviados.has(motivo) || enviados.size >= DISTINTOS_MAX) return;
    enviados.add(motivo);

    const token = await tokenValido();
    if (!token) return;

    await fetch(`${API_URL}/erro-do-cliente`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ motivo }),
      // A aba pode estar fechando: é justamente o erro que a derrubou que mais
      // interessa, e sem isto ele morreria com ela.
      keepalive: true,
    });
  } catch { /* ver o cabeçalho: aqui engolir é a resposta certa e final */ }
}

/**
 * Liga os dois tratadores globais. Chamado o mais cedo possível.
 *
 * Os dois, e não um: `error` pega a exceção síncrona, `unhandledrejection` pega
 * a promessa que ninguém tratou — e num código cheio de `await` de rede a
 * segunda é a mais comum das duas.
 */
export function vigiarErrosDoCliente(): void {
  window.addEventListener('error', (e) => {
    // `e.error` some em erro de script de outra origem; o `message` fica.
    const erro = e.error as Error | undefined;
    void relatar(erro?.name ?? 'Error', erro?.message ?? e.message ?? '');
  });

  window.addEventListener('unhandledrejection', (e) => {
    const motivo = e.reason as unknown;
    const nome = motivo instanceof Error ? motivo.name : 'UnhandledRejection';
    const msg = motivo instanceof Error ? motivo.message : String(motivo ?? '');
    void relatar(nome, msg);
  });
}

/** Esquece o que já foi relatado. Só para teste. */
export function esquecerErrosRelatados(): void {
  enviados.clear();
}

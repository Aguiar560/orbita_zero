import { ADMINS } from '@data/servidor';
import { sessaoGuardada } from './conta';

/**
 * Quem pode ver as ferramentas administrativas: modo de teste e Laboratório.
 *
 * ## Por que isto passou a existir
 *
 * Enquanto o jogo era de uma pessoa só, "modo de teste" em Configurações era
 * conveniência. Com testers, virou armadilha: a seção fica ao lado de volume e
 * contraste, não avisa que muda o jogo inteiro, e o primeiro relato seria de
 * alguém descrevendo um jogo com recursos infinitos e nave indestrutível sem
 * saber que foi ele quem ligou.
 *
 * ## O que este portão vale, e o que não vale
 *
 * É um portão de INTERFACE. A lista vai no pacote e a checagem roda no
 * navegador do jogador; quem abrir o devtools contorna. Ele tira a ferramenta
 * do caminho de quem não a procura, e é só isso que ele promete.
 *
 * Contra quem QUER trapacear, o que vale é o servidor não confiar no cliente —
 * e a conferência de plausibilidade do save ainda não existe. Ver `ADMINS`.
 *
 * ## Por que não basta esconder o interruptor
 *
 * Porque `settings.testMode` é um campo do SAVE, e há saves por aí com ele
 * ligado — o da Vercel, por exemplo. Esconder o interruptor deixaria o jogador
 * preso no modo, com recursos infinitos e sem a chave para sair. Por isso
 * `desligarModoDeTesteSeNaoForAdmin` existe e roda na entrada e a cada troca de
 * conta.
 */
export function ehAdmin(): boolean {
  const sessao = sessaoGuardada();
  if (!sessao) return false;
  return ADMINS.includes(sessao.usuarioId);
}

/**
 * Devolve o jogo ao normal para quem não é admin.
 *
 * Escreve, e de propósito: é o único caminho de saída para um save que já
 * chegou com o modo ligado. As duas linhas são o que `setTestMode(false)` faz —
 * repetidas aqui em vez de importar `Sim`, que ainda não existe quando isto
 * roda na construção do estado.
 *
 * Devolve `true` quando desligou algo, para quem chamou poder avisar.
 */
export function desligarModoDeTesteSeNaoForAdmin(
  settings: { testMode: boolean; speed: number },
): boolean {
  if (ehAdmin() || !settings.testMode) return false;
  settings.testMode = false;
  settings.speed = 1;
  return true;
}

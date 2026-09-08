import { API_URL } from '@data/servidor';
import type { Sim } from '@sim/index';
import { curvaXpNave, curvaXpPersonagem } from '@data/balance/curvas';
import { nivelPorXpAcumulado, xpAcumuladoDe } from '@sim/nivel';

import { tokenValido } from './conta';

/**
 * A progressão, que mora no servidor.
 *
 * ## O que a Fase 4 fechou
 *
 * Item, casco, moeda e passe já eram do servidor. Faltava o que MULTIPLICA
 * tudo isso: nível de piloto e de nave (atributos-base), os nós da Matriz
 * (modificadores diretos) e o setor alcançado (que libera conteúdo e cascos).
 * Um save com `command.nivel = 300` e a Matriz cheia valia mais que qualquer
 * item Divino injetado.
 *
 * ## Delta para o que acumula, valor inteiro para o que é escolha
 *
 * XP e materiais sobem como DELTA — são somas, e mandar o total faria duas abas
 * abertas sobrescreverem uma à outra com o valor mais velho. A Matriz sobe
 * INTEIRA porque não é acúmulo: é uma escolha que se refaz por completo a cada
 * respec.
 *
 * ## O nível não é calculado aqui
 *
 * Vem pronto do servidor, derivado do XP pela curva. Se o cliente derivasse por
 * conta própria e a curva mudasse numa entrega, os dois discordariam — e o
 * jogador veria um nível que o servidor não reconhece.
 */

interface Remoto {
  xp: number;
  nivel: number;
  melhorSetor: number;
  matriz: string[];
  naves: Record<string, number>;
  materiais: Record<string, number>;
  /** O casco em campo, guardado pelo servidor. Vazio = nunca escolheu. */
  cascoEmCampo?: string;
}

let sincronizado = false;

/**
 * O casco que o jogador ESCOLHEU e o servidor ainda não confirmou.
 *
 * ## Por que não se manda `state.hull` direto
 *
 * Porque `state.hull` também muda por CONSERTO — `casarCascoComAFrota` o
 * demove quando a frota não tem a nave, e a nave também troca sozinha por falta
 * de combustível. Mandar o valor atual a cada drenagem transformava qualquer um
 * desses ajustes locais numa ordem para o servidor.
 *
 * Foi o que aconteceu em 08/09: o Rafael trocou para a Vetor VC-1, o servidor
 * gravou `void_canhao`, e uma aba com o pacote antigo em cache subiu
 * `nucleo_vektor` por cima — apagando a escolha no servidor, que é a única
 * cópia que sobrevive à recarga. Ele mesmo notou: com Ctrl+F5 não acontecia.
 *
 * Com a intenção explícita, o pior que um cliente velho faz é não mandar nada.
 *
 * Fica em memória, e não no save: se a requisição falhar, a próxima drenagem
 * tenta de novo; se a aba fechar antes, o jogador escolhe outra vez. Guardar no
 * save faria uma escolha antiga ressuscitar depois de o jogador mudar de ideia
 * em outro aparelho.
 */
let cascoEscolhido: string | null = null;

/**
 * O último estado que o servidor confirmou, para medir o delta contra ele.
 *
 * Anda SEMPRE junto do espelho, e é por isso que mora ao lado de `adotar`. Na
 * primeira versão ele só era atualizado no dreno — então, depois do boot, o
 * espelho tinha o XP do servidor e o marco tinha zero. O primeiro dreno mandava
 * o total como se fosse ganho e DOBRAVA o XP do jogador, em silêncio.
 */
let marco = { xp: 0, naves: {} as Record<string, number> };

export const progressoPronto = (): boolean => sincronizado;

async function chamar(corpo?: unknown): Promise<Remoto | null> {
  const token = await tokenValido();
  if (!token) return null;
  const body = corpo ? JSON.stringify(corpo) : undefined;
  try {
    const r = await fetch(`${API_URL}/progresso`, {
      method: body ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
    });
    if (!r.ok) return null;
    return (await r.json()) as Remoto;
  } catch {
    return null;
  }
}

/**
 * Adota o progresso do servidor, convertendo o modelo dele para o do cliente.
 *
 * O servidor guarda XP **acumulado** e o cliente guarda **nível + resto**. A
 * conversão mora em `@sim/nivel`, uma implementação só para os dois lados —
 * antes ninguém convertia, e o cliente mandava restos que o servidor somava
 * como acumulado.
 *
 * ## Por que o XP nunca é rebaixado aqui
 *
 * `Math.max` e não atribuição: XP não anda para trás. Sem isso, uma leitura do
 * servidor mais velha que o que o jogador acabou de ganhar apagaria o ganho —
 * e é exatamente o que aconteceria com as linhas gravadas pelo código antigo,
 * que estão SUBESTIMADAS (o crédito de ausência gravava o resto por cima do
 * acumulado). Com o máximo, a próxima drenagem manda a diferença e o servidor
 * se acerta sozinho.
 *
 * Não é fresta nova: o cliente já declara o XP que ganhou, e `conferirDelta`
 * continua limitando cada envio. O que muda é que uma leitura não destrói o
 * que ainda não subiu.
 */
function adotar(sim: Sim, r: Remoto): void {
  const piloto = nivelPorXpAcumulado(
    Math.max(r.xp, xpAcumuladoDe(sim.state.command, curvaXpPersonagem)),
    curvaXpPersonagem,
  );
  sim.state.command.xp = piloto.resto;
  sim.state.command.nivel = piloto.nivel;
  sim.state.command.allocated = [...r.matriz];
  sim.state.universe.bestSectorEver = Math.max(
    sim.state.universe.bestSectorEver,
    r.melhorSetor,
  );

  for (const [casco, xp] of Object.entries(r.naves)) {
    const nave = sim.state.naves[casco];
    if (!nave) continue;
    const v = nivelPorXpAcumulado(
      Math.max(xp, xpAcumuladoDe(nave, curvaXpNave)),
      curvaXpNave,
    );
    nave.nivel = v.nivel;
    nave.xp = v.resto;
  }
  sim.state.armazem = { ...r.materiais };

  /**
   * O casco em campo volta do servidor, que agora é quem o guarda.
   *
   * Só se for da pessoa e só fora do modo de teste — no modo de teste o admin
   * está pilotando algo que não é dele de propósito, e sobrescrever a escolha
   * dele aqui seria repetir o defeito que esta mudança conserta.
   */
  if (r.cascoEmCampo && !sim.state.settings.testMode
    && sim.state.fleet.includes(r.cascoEmCampo)) {
    sim.state.hull = r.cascoEmCampo;
  }

  marco = { xp: r.xp, naves: { ...r.naves } };
  sincronizado = true;
  sim.touch();
}

/** Busca o progresso do servidor. Chamado no boot. */
export async function sincronizarProgresso(sim: Sim): Promise<boolean> {
  const r = await chamar();
  if (!r) return false;
  adotar(sim, r);
  return true;
}

/**
 * Envia o que mudou desde a última vez e adota o que voltar.
 *
 * ## Por que o delta é medido contra um marco, e não acumulado numa fila
 *
 * XP não vem de um evento único que dê para enfileirar: ele sobe a cada abate,
 * dezenas de vezes por segundo. Uma fila teria milhares de entradas por minuto
 * para somar um número só. Guardar o valor do último envio e mandar a diferença
 * dá o mesmo resultado com uma subtração.
 *
 * A Matriz vai inteira, sempre: é pequena e é escolha, não acúmulo.
 */
export async function drenarProgresso(sim: Sim, escolha?: string): Promise<void> {
  // A escolha fica pendente até o servidor confirmar: uma requisição que falha
  // não pode perder a troca de nave em silêncio.
  if (escolha) cascoEscolhido = escolha;
  if (!sincronizado) { await sincronizarProgresso(sim); return; }

  /**
   * A diferença é entre ACUMULADOS, e era aqui que o progresso se perdia.
   *
   * Era `s.command.xp - marco.xp` — diferença de RESTOS. O resto cai toda vez
   * que se sobe de nível, então a diferença ficava negativa exatamente nas
   * drenagens em que o jogador mais progrediu, e o servidor recebia um
   * desconto. O próprio código já sabia disso: o comentário de `MarcoDeSetor`
   * em `sim/index.ts` diz que "diferença de marco daria número negativo
   * justamente na hora mais comemorativa" — e por isso o painel de setor tem
   * acumulador próprio. Este caminho não tinha.
   *
   * Medido em 08/09, simulando cinquenta drenagens: com 5.000.000 de XP ganho
   * o piloto está no nível 39 e o servidor terminava com um valor que derivava
   * 28. A nave, de curva mais curta, ia a 21 contra 50.
   *
   * O marco continua guardando o que o SERVIDOR tem, e não o local: é a
   * diferença entre os dois que precisa subir.
   */
  const s = sim.state;
  const dXp = xpAcumuladoDe(s.command, curvaXpPersonagem) - marco.xp;
  const dNaves: Record<string, number> = {};
  for (const [casco, nave] of Object.entries(s.naves)) {
    const d = xpAcumuladoDe(nave, curvaXpNave) - (marco.naves[casco] ?? 0);
    if (d !== 0) dNaves[casco] = d;
  }

  const corpo = {
    xp: dXp,
    setor: s.universe.bestSectorEver,
    matriz: s.command.allocated,
    naves: dNaves,
    /**
     * Só a ESCOLHA sobe, e só quando é DA PESSOA.
     *
     * `state.fleet` é a frota do servidor, adotada no boot. Mandar um casco de
     * fora dela seria mandar algo que o servidor recusa — e, se ele aceitasse,
     * o modo de teste viraria uma forma de ganhar nave.
     */
    casco: cascoEscolhido && s.fleet.includes(cascoEscolhido) ? cascoEscolhido : undefined,
    // Materiais ainda não têm marco: eles são gravados como ABSOLUTO pelo
    // caminho antigo e a conversão para delta entra junto do Armazém no
    // servidor. Enviar zero é honesto — não muda nada — até lá.
    materiais: {},
  };

  const r = await chamar(corpo);
  if (!r) return;
  // O servidor devolve o progresso já gravado, então o que voltar é a verdade.
  if (corpo.casco && r.cascoEmCampo === corpo.casco) cascoEscolhido = null;

  // `adotar` move o marco junto. O marco só anda quando o servidor confirma:
  // andar antes perderia o ganho da requisição que falhou, em silêncio.
  adotar(sim, r);
}

/** Esquece o espelho ao trocar de conta. */
export function esquecerProgresso(): void {
  sincronizado = false;
  marco = { xp: 0, naves: {} };
}

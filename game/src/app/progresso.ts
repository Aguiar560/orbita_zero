import { API_URL } from '@app/api';
import type { Sim } from '@sim/index';
import { curvaXpNave, curvaXpPersonagem } from '@data/balance/curvas';
import { nivelPorXpAcumulado, xpAcumuladoDe } from '@sim/nivel';

import { tokenValido } from './conta';
import { avisarMarcos, type MarcoCreditado } from './marcos';
import { espelharNoSim, sincronizar as sincronizarCarteira } from './carteira';
import { relatarFalha, relatarSucesso } from './recusa';

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
  /** Marcos de cristal que ESTA chamada creditou. Ver `app/marcos.ts`. */
  marcos?: MarcoCreditado[];
  /** O servidor concedeu agora o passe de agradecimento do teste. */
  vipRecompensa?: boolean;
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
let marco = { xp: 0, naves: {} as Record<string, number>, matriz: [] as string[] };

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
    if (!r.ok) { await relatarFalha('/progresso', 'fundo', r); return null; }
    const dados = (await r.json()) as Remoto;
    relatarSucesso('/progresso', dados);
    return dados;
  } catch {
    await relatarFalha('/progresso', 'fundo', null);
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
/** Duas alocações são a mesma? A ordem importa: ela é o caminho até a raiz. */
const mesmaMatriz = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((no, i) => no === b[i]);

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
  /**
   * O armazém do servidor, com a FILA DAQUI por cima.
   *
   * Escrever `{ ...r.materiais }` puro era o defeito de 12/09/2026: o que o
   * jogador acabou de desmanchar ainda não chegou ao servidor, e a resposta —
   * que descreve um instante ANTERIOR ao desmanche — apagava o ganho.
   *
   * Somar a fila restante é o mesmo raciocínio de `comAsFilasDaqui` no save:
   * o que está na fila, por construção, ainda não foi aplicado em lugar nenhum,
   * então reaplicá-lo sobre o que voltou não conta nada duas vezes.
   */
  const armazem: Record<string, number> = { ...r.materiais };
  for (const [id, d] of Object.entries(sim.state.materiaisPendentes)) {
    const n = (armazem[id] ?? 0) + d;
    if (n > 0) armazem[id] = n;
    else delete armazem[id];
  }
  sim.state.armazem = armazem;

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

  marco = { xp: r.xp, naves: { ...r.naves }, matriz: [...r.matriz] };
  sincronizado = true;
  sim.touch();
}

/** Atualiza imediatamente o espelho do VIP que o servidor acabou de conceder. */
async function adotarRecompensaVip(sim: Sim, r: Remoto): Promise<void> {
  if (!r.vipRecompensa) return;
  if (await sincronizarCarteira()) espelharNoSim(sim);
}

/** Busca o progresso do servidor. Chamado no boot. */
export async function sincronizarProgresso(sim: Sim): Promise<boolean> {
  const r = await chamar();
  if (!r) return false;
  adotar(sim, r);
  await adotarRecompensaVip(sim, r);
  return true;
}

/**
 * Adota o progresso que a AUSÊNCIA acabou de gravar — inclusive para baixo.
 *
 * ## Por que `sincronizarProgresso` não serve aqui
 *
 * `adotar` nunca rebaixa XP, e isso é certo para uma leitura comum: o
 * servidor pode estar atrasado em relação ao que o jogador acabou de ganhar.
 * Depois da ausência é o contrário. O servidor simulou as quedas e gravou o XP
 * MENOR de propósito; com o `Math.max`, o cliente mantinha o valor antigo, e
 * a drenagem seguinte mandava a diferença como ganho — devolvendo, em
 * silêncio, o XP e a patente que as quedas tinham tirado. A sucata perdida
 * ficava perdida (carteira não tem `max`), o XP voltava: metade da punição.
 *
 * ## O que se preserva
 *
 * Só o que o cliente tem e o servidor ainda não recebeu — a diferença entre o
 * local e o marco, que é exatamente o que a próxima drenagem mandaria. A
 * ausência partiu do XP do SERVIDOR, então esse pendente não passou por ela e
 * soma por cima do resultado.
 */
export async function adotarAusencia(sim: Sim): Promise<boolean> {
  const r = await chamar();
  if (!r) return false;

  if (sincronizado) {
    const s = sim.state;
    const pendente = Math.max(0, xpAcumuladoDe(s.command, curvaXpPersonagem) - marco.xp);
    const piloto = nivelPorXpAcumulado(r.xp + pendente, curvaXpPersonagem);
    s.command.nivel = piloto.nivel;
    s.command.xp = piloto.resto;

    for (const [casco, xp] of Object.entries(r.naves)) {
      const nave = s.naves[casco];
      if (!nave) continue;
      const falta = Math.max(0, xpAcumuladoDe(nave, curvaXpNave) - (marco.naves[casco] ?? 0));
      const v = nivelPorXpAcumulado(xp + falta, curvaXpNave);
      nave.nivel = v.nivel;
      nave.xp = v.resto;
    }
  }

  // Com o local já rebaixado, o `Math.max` de `adotar` não tem o que
  // desfazer — ele só move o marco e adota Matriz, setor e armazém.
  adotar(sim, r);
  await adotarRecompensaVip(sim, r);
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
    /**
     * A Matriz sobe INTEIRA, então só sobe quando MUDOU.
     *
     * É escolha, não acúmulo: o servidor grava a lista que chega por cima da
     * que tinha. Mandá-la em toda drenagem fazia de qualquer aba uma ordem — e
     * uma aba com o pacote antigo em cache desfazia a alocação feita na outra.
     * É a mesma classe de defeito do casco em campo, encontrada na auditoria
     * de 08/09 antes de alguém perder uma Matriz por causa dela.
     */
    matriz: mesmaMatriz(s.command.allocated, marco.matriz) ? undefined : s.command.allocated,
    naves: dNaves,
    /**
     * Só a ESCOLHA sobe, e só quando é DA PESSOA.
     *
     * `state.fleet` é a frota do servidor, adotada no boot. Mandar um casco de
     * fora dela seria mandar algo que o servidor recusa — e, se ele aceitasse,
     * o modo de teste viraria uma forma de ganhar nave.
     */
    casco: cascoEscolhido && s.fleet.includes(cascoEscolhido) ? cascoEscolhido : undefined,
    /**
     * A semente do universo, para o servidor montar as MESMAS ondas.
     *
     * Vai em toda drenagem porque o servidor a grava UMA vez e ignora o resto —
     * mandar sempre poupa um campo de estado no cliente para saber se já foi.
     */
    semente: s.universe.seed,
    /**
     * Os encontros enfrentados desde a última confirmação.
     *
     * É o que substitui a declaração de XP de combate: o cliente diz ONDE e
     * QUANTOS, e o servidor calcula quanto vale. Enquanto ele ainda não paga
     * por aqui, os dois sobem juntos e o servidor compara — é assim que se
     * descobre uma divergência antes de ela virar XP perdido de alguém.
     */
    encontros: { ...s.encontros },
    /**
     * O que o Armazém ganhou e gastou desde a última confirmação.
     *
     * Isto era `{}` — e era por isso que material desmanchado sumia. A rota do
     * servidor sempre aplicou `quantia = MAX(0, quantia + d)`; faltava alguém
     * mandar o `d`. Ver `materiaisPendentes` em `sim/types.ts`.
     */
    materiais: { ...s.materiaisPendentes },
  };

  const r = await chamar(corpo);
  if (!r) return;
  // O servidor devolve o progresso já gravado, então o que voltar é a verdade.
  if (corpo.casco && r.cascoEmCampo === corpo.casco) cascoEscolhido = null;

  /**
   * Os encontros declarados saem da fila SÓ depois da confirmação.
   *
   * E saem por CHAVE, não com um `= {}`: entre montar o corpo e receber a
   * resposta o jogador continuou abatendo, e zerar o mapa inteiro apagaria o
   * que entrou nesse meio — que é o XP de combate dele quando o servidor
   * passar a pagar por aqui.
   */
  for (const chave of Object.keys(corpo.encontros)) {
    const enviado = corpo.encontros[chave] ?? 0;
    const atual = s.encontros[chave] ?? 0;
    if (atual > enviado) s.encontros[chave] = atual - enviado;
    else delete s.encontros[chave];
  }

  /**
   * O material declarado sai da fila SÓ depois da confirmação, e por CHAVE.
   *
   * Mesma regra dos encontros acima, e pelo mesmo motivo: entre montar o corpo
   * e receber a resposta o jogador continuou desmanchando, e um `= {}` apagaria
   * o que entrou nesse meio. Subtrair o que foi ENVIADO deixa o resto na fila
   * para a próxima drenagem — e é o que `adotar`, logo abaixo, soma de volta.
   */
  for (const [id, enviado] of Object.entries(corpo.materiais)) {
    const resto = (s.materiaisPendentes[id] ?? 0) - enviado;
    if (resto === 0) delete s.materiaisPendentes[id];
    else s.materiaisPendentes[id] = resto;
  }

  // `adotar` move o marco junto. O marco só anda quando o servidor confirma:
  // andar antes perderia o ganho da requisição que falhou, em silêncio.
  adotar(sim, r);
  await adotarRecompensaVip(sim, r);
  // O setor alcançado pode ter passado de um chefe: a primeira vitória vira
  // cristal no servidor, e é aqui que o jogador fica sabendo.
  await avisarMarcos(sim, r.marcos);
}

/** Esquece o espelho ao trocar de conta. */
export function esquecerProgresso(): void {
  sincronizado = false;
  marco = { xp: 0, naves: {}, matriz: [] };
  // A escolha de nave tambem e por conta: uma pendencia da conta anterior
  // gravaria o casco dela na conta que acabou de entrar.
  cascoEscolhido = null;
}

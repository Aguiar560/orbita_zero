import { API_URL } from '@data/servidor';
import type { Sim } from '@sim/index';

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
}

let sincronizado = false;

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

function adotar(sim: Sim, r: Remoto): void {
  sim.state.command.xp = r.xp;
  sim.state.command.nivel = r.nivel;
  sim.state.command.allocated = [...r.matriz];
  sim.state.universe.bestSectorEver = Math.max(
    sim.state.universe.bestSectorEver,
    r.melhorSetor,
  );

  for (const [casco, xp] of Object.entries(r.naves)) {
    const nave = sim.state.naves[casco];
    if (nave) nave.xp = xp;
  }
  sim.state.armazem = { ...r.materiais };

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
export async function drenarProgresso(sim: Sim): Promise<void> {
  if (!sincronizado) { await sincronizarProgresso(sim); return; }

  const s = sim.state;
  const dXp = s.command.xp - marco.xp;
  const dNaves: Record<string, number> = {};
  for (const [casco, nave] of Object.entries(s.naves)) {
    const d = nave.xp - (marco.naves[casco] ?? 0);
    if (d !== 0) dNaves[casco] = d;
  }

  const corpo = {
    xp: dXp,
    setor: s.universe.bestSectorEver,
    matriz: s.command.allocated,
    naves: dNaves,
    // Materiais ainda não têm marco: eles são gravados como ABSOLUTO pelo
    // caminho antigo e a conversão para delta entra junto do Armazém no
    // servidor. Enviar zero é honesto — não muda nada — até lá.
    materiais: {},
  };

  const r = await chamar(corpo);
  if (!r) return;

  // `adotar` move o marco junto. O marco só anda quando o servidor confirma:
  // andar antes perderia o ganho da requisição que falhou, em silêncio.
  adotar(sim, r);
}

/** Esquece o espelho ao trocar de conta. */
export function esquecerProgresso(): void {
  sincronizado = false;
  marco = { xp: 0, naves: {} };
}

import { Rng } from '@core/math';
import { resolverDrop } from '@data/balance/drops';
import { galaxyOfSector } from '@data/galaxies';
import { rollItem } from '@sim/loot';
import { sectorIlvl } from '@sim/progression';
import type { Item } from '@sim/types';

/**
 * O lote de itens, rolado pelo servidor.
 *
 * ## Por que isto é possível sem reescrever nada
 *
 * `rollItem`, `resolverDrop` e `sectorIlvl` são os MESMOS arquivos que o
 * navegador importa para jogar. É a regra de camada nº 1 do projeto se pagando:
 * `sim/` e `data/` não conhecem DOM nem canvas, então o Worker os importa
 * direto. Medido em 03/09 — o pacote do Worker foi de 25,6 KiB para 104,9 KiB
 * ao incluir o gerador e suas tabelas.
 *
 * Não existe cópia da fórmula. Um item rolado aqui é indistinguível de um
 * rolado no cliente, porque é o mesmo código; o que muda é quem tem a semente.
 *
 * ## As três decisões que fecham o re-rolar
 *
 * O buraco não era o gerador, era o CONTROLE sobre ele. Quem abre o console
 * rola até sair Divino, e o item ruim nunca chega a existir para ser comparado
 * com nada. Fechar isso exigiu tirar do cliente as três alavancas:
 *
 * 1. **A semente é do servidor** e fica guardada. Derivá-la de `(usuario,
 *    setor)` com hash não serviria: o cliente conhece os dois e preveria o lote.
 * 2. **As regras de drop são derivadas AQUI**, de `(setor, kind)`. Aceitá-las
 *    do cliente reabriria tudo — a mesma semente com `pisoDeRaridade` diferente
 *    dá itens diferentes, então bastaria pedir de novo mexendo no piso.
 * 3. **A sorte é travada junto da semente.** Mesmo motivo: sorte alterada muda
 *    o resultado da mesma semente. A primeira chamada de um setor fixa as duas,
 *    e as seguintes usam o que ficou guardado.
 *
 * ## O que muda no jogo, e é a única coisa que muda
 *
 * A afinidade elemental **por inimigo** sai. `afinidadeDoAlvo` enviesava o
 * elemento do item pelo elemento de quem morreu, e isso é a única entrada de
 * `resolverDrop` que não se deriva do setor. Aceitá-la do cliente devolveria a
 * alavanca nº 2 — e é justamente o parâmetro mais fácil de abusar, porque
 * escolher o elemento do drop vale mais que subir a raridade.
 *
 * Piso de raridade, bônus de nível, itens extras e multiplicador de sorte do
 * chefe continuam **idênticos**: são função de `kind` e `galaxia`, e o servidor
 * calcula os dois sozinho.
 *
 * ## O que este módulo ainda NÃO decide
 *
 * `setor` e `sorte` chegam do cliente. Mentir neles melhora o lote — é a mesma
 * classe de problema do teto de valor da carteira, e a Fase 5 a resolve pela
 * raiz: quando o servidor calcular o combate, ele saberá o setor e os atributos
 * sem perguntar.
 */

/**
 * Quantos itens cada pool traz.
 *
 * Medido: 186 itens/hora contra ~20 setores/hora dá cerca de 9 por setor,
 * somando os três tipos. Doze por pool cobre com folga o jogador de sorte e
 * cadência altas sem a resposta virar um pacote grande — são ~6 KB de JSON no
 * total dos três.
 *
 * Sobra não tem consequência: o que não foi consumido some quando o lote é
 * substituído, e nunca vira item no inventário.
 */
export const ITENS_POR_POOL = 12;

export const TIPOS = ['onda', 'elite', 'chefe'] as const;
export type TipoDeDrop = (typeof TIPOS)[number];

export type Lote = Record<TipoDeDrop, Item[]>;

/** Faixas de sanidade para o que o cliente declara. */
const SETOR_MAX = 100_000;
const SORTE_MAX = 5;

export const setorValido = (n: unknown): number | null => {
  const s = Math.floor(Number(n));
  return Number.isFinite(s) && s >= 1 && s <= SETOR_MAX ? s : null;
};

export const sorteValida = (n: unknown): number =>
  Math.min(SORTE_MAX, Math.max(0, Number(n) || 0));

/**
 * Teto de páginas por setor.
 *
 * Paginar não permite re-rolar, mas permite GASTAR: cada página são 36
 * rolagens no Worker. Cinquenta páginas dão 600 itens por tipo no mesmo
 * setor — muito acima de qualquer sessão honesta, e barato o bastante para
 * quem estiver realmente preso num chefe difícil.
 */
const PAGINA_MAX = 50;

export const paginaValida = (n: unknown): number =>
  Math.min(PAGINA_MAX, Math.max(0, Math.floor(Number(n) || 0)));

/**
 * Rola o lote inteiro a partir da semente guardada.
 *
 * Determinístico: a MESMA semente com os mesmos parâmetros produz exatamente os
 * mesmos itens. É o que faz reiniciar o setor não re-rolar — o servidor devolve
 * o lote que já tinha, e não um novo.
 *
 * Os três pools saem de UM rng, em ordem fixa. Um rng por pool exigiria três
 * sementes guardadas para o mesmo ganho.
 */
/**
 * Continuar o lote é PAGINAR a mesma sequência, nunca sortear de novo.
 *
 * ## O caso que obrigou isto, e que só apareceu medindo
 *
 * O lote é por setor CONCLUÍDO, mas o drop é por abate. Um jogador preso num
 * setor difícil continua matando ondas e nunca conclui — então o pote seca e
 * nunca é reposto. Medido: dez minutos morrendo no setor 3 acumularam 39
 * drops devidos contra 12 no pote.
 *
 * A saída óbvia — sortear um lote novo quando esvazia — devolveria o
 * re-rolar: bastaria consumir o pote para ganhar outro. Paginar não devolve:
 * a página 2 é a continuação da MESMA sequência da mesma semente, então pedir
 * de novo dá sempre o mesmo resultado.
 */
export function rolarLote(
  semente: number,
  setor: number,
  sorte: number,
  universo: number,
  pagina = 0,
): Lote {
  const rng = new Rng(semente);
  const galaxia = galaxyOfSector(setor);
  const origem = Math.max(0, Math.floor(Number(universo) || 0));
  const base = sectorIlvl(setor);

  const lote = {} as Lote;
  for (const kind of TIPOS) {
    const regra = resolverDrop({ setor, galaxia, kind });
    const ilvl = base + regra.ilvlBonus;
    const luck = sorte * regra.sorteMult;
    // Rola desde o começo e devolve só a página pedida. Descartar o começo
    // parece desperdício e é o contrário: é o que garante que a página 3 de
    // hoje seja idêntica à página 3 de amanhã, com a mesma semente.
    const ate = (pagina + 1) * ITENS_POR_POOL;
    const itens: Item[] = [];
    for (let i = 0; i < ate; i++) {
      const item = rollItem(rng, ilvl, luck, origem, {
        floor: regra.pisoDeRaridade,
        slotFavorecido: regra.slotFavorecido,
        // `elementoFavorecido` NÃO entra: ver o cabeçalho. É a única entrada de
        // `resolverDrop` que dependia do inimigo, e aceitá-la do cliente
        // devolveria a alavanca de re-rolar.
      });
      if (i >= pagina * ITENS_POR_POOL) itens.push(item);
    }
    lote[kind] = itens;
  }
  return lote;
}

/**
 * O lote precisa ser refeito?
 *
 * ## A primeira versão disto estava errada, e o teste pegou
 *
 * Ela devolvia `true` sempre que o setor mudava, apostando que trocar de setor
 * custa tempo de jogo. Não custa nada: o setor é um número que o cliente
 * declara. Alternar entre 60 e 61 gerava semente nova a cada troca — re-rolagem
 * instantânea, exatamente o que a fase existe para fechar, entrando pela porta
 * que eu tinha acabado de construir.
 *
 * ## O que substitui a aposta
 *
 * Lote novo exige **evidência de progresso**: um lançamento no livro-caixa
 * posterior ao lote atual. É o depósito que acontece quando o setor cai, e o
 * servidor já o tem — não custa estado novo.
 *
 * Um cliente adulterado ainda pode forjar o depósito para destravar o lote.
 * A diferença é que forjar DEIXA RASTRO: vira linha em `transacoes`, com
 * motivo e hora, auditável. Trocar um buraco invisível por um visível é o tipo
 * de troca que esta fase pode fazer; fechar de vez é a Fase 5.
 */
export const precisaDeLoteNovo = (
  guardado: { setor: number; criado_em: number } | null,
  setor: number,
  ultimoLancamentoEm: number,
): boolean => {
  if (!guardado) return true;
  if (guardado.setor === setor) return false;
  return ultimoLancamentoEm > guardado.criado_em;
};
/** Semente imprevisível. `Math.random` não serve: é previsível o bastante. */
export function novaSemente(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! >>> 0;
}

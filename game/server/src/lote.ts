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
 * Teto de páginas por setor. Hoje é sanidade, e não mais orçamento.
 *
 * ## Por que ele era 50, e por que deixou de precisar ser
 *
 * `rolarLote` rolava SEMPRE desde o item zero e descartava o começo, para a
 * página 3 de hoje ser idêntica à de amanhã. O preço era quadrático: medido em
 * 09/09, a página 50 custava **1.836 rolagens e 14,8 ms** para devolver os
 * mesmos 36 itens que a página 0 entrega com 36 rolagens e 0,9 ms.
 *
 * O teto existia para o Worker não se afogar nisso — e tinha um efeito colateral
 * que ninguém tinha notado: **a lista de itens do setor ACABAVA** em 600 por
 * tipo. Depois disso o pote secava para sempre, e o drop daquele tipo parava.
 * Uma conta em produção já estava em 156 de elite.
 *
 * Com semente derivada por página (`sementeDaPagina`), a página 500 custa o
 * mesmo que a página 0. O teto continua aqui só para um número absurdo vindo do
 * cliente não virar uma resposta absurda — 1,2 milhão de itens por tipo por
 * setor é fora de qualquer alcance.
 */
const PAGINA_MAX = 100_000;

/**
 * A semente DAQUELA página DAQUELE tipo.
 *
 * ## O que ela troca
 *
 * Antes, a página N exigia rolar as N anteriores e jogá-las fora — era assim
 * que se garantia que a página 3 de hoje fosse a de amanhã. A mesma garantia
 * sai de derivar a semente: mesma entrada, mesma página, mesmos itens, sem
 * passar por nenhuma anterior.
 *
 * ## Por que o tipo entra na mistura
 *
 * Sem ele, os três potes do mesmo setor sairiam idênticos — a onda comum
 * soltaria exatamente as mesmas peças que o chefe. O índice vem da posição em
 * `TIPOS` e não do nome, para renomear um tipo não reescrever o loot de todo
 * mundo.
 *
 * O embaralhamento é o finalizador do murmur3: sementes vizinhas (página 3 e 4)
 * precisam produzir sequências sem parentesco, e somar um número pequeno a uma
 * semente não faz isso sozinho.
 */
export function sementeDaPagina(semente: number, tipo: TipoDeDrop, pagina: number): number {
  const ordem = TIPOS.indexOf(tipo) + 1;
  let x = (semente ^ Math.imul(ordem, 0x9e3779b1) ^ Math.imul(pagina + 1, 0x85ebca6b)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

export const paginaValida = (n: unknown): number =>
  Math.min(PAGINA_MAX, Math.max(0, Math.floor(Number(n) || 0)));

/**
 * A MESMA página dos três tipos. Continua existindo para a ausência e o teste.
 *
 * ## Continuar o lote é PAGINAR, nunca sortear de novo
 *
 * O lote é por setor CONCLUÍDO, mas o drop é por abate. Um jogador preso num
 * setor difícil continua matando ondas e nunca conclui — então o pote seca e
 * nunca é reposto. Medido: dez minutos morrendo no setor 3 acumularam 39 drops
 * devidos contra 12 no pote.
 *
 * A saída óbvia — sortear um lote novo quando esvazia — devolveria o re-rolar:
 * bastaria consumir o pote para ganhar outro. Paginar não devolve: a página 2 é
 * sempre a mesma página 2.
 *
 * ## Quem serve o jogo é `rolarDoCursor`
 *
 * Esta função dá a MESMA página aos três tipos, e era isso que arrastava a
 * elite atrasada para a página da onda. As rotas usam `rolarDoCursor`, que
 * respeita o passo de cada uma.
 */
export function rolarLote(
  semente: number,
  setor: number,
  sorte: number,
  universo: number,
  pagina = 0,
): Lote {
  const lote = {} as Lote;
  for (const kind of TIPOS) lote[kind] = rolarPagina(semente, setor, sorte, universo, kind, pagina);
  return lote;
}

/**
 * Uma página de UM tipo. É aqui que os itens nascem.
 *
 * ## Cada tipo com a própria página, e por que isso importa
 *
 * Os três potes andam em ritmos muito diferentes — uma elite a cada cinco
 * ondas, um chefe a cada dez setores. A rota escolhia UMA página pelo cursor
 * mais adiantado e aplicava aos três, e o resultado, medido em 09/09, era o
 * cursor da elite pulando de 6 para 27 num único envio: dezessete itens
 * consumidos sem chegarem a ninguém, e o pote queimando quatro vezes mais
 * rápido do que devia.
 *
 * Com a semente derivada por página, rolar cada tipo na página dele custa o
 * mesmo que rolar os três juntos. Não há mais motivo para compartilharem.
 */
/**
 * A identidade reproduzível de um item do pote.
 *
 * ## Por que ela precisa existir
 *
 * O desenho da Fase 3a é "o cliente diz QUANTOS pegou, o servidor deriva
 * QUAIS". Derivar só funciona se o item derivado for o MESMO item — e o `uid`
 * padrão sai do relógio, então a peça entregue e a peça criada na coleta eram
 * objetos distintos com os mesmos atributos.
 *
 * O custo disso era invisível e real: equipar uma peça recém-caída virava
 * `item_nao_e_seu` (dois casos no livro de produção), e a economia de "caiu e
 * foi descartado no mesmo lote, não grava" nunca disparava — cada item era
 * escrito e apagado, que é justamente a metade das escritas de D1 que ela
 * existe para poupar.
 *
 * ## Por que hash, e não `semente-tipo-pagina-indice`
 *
 * Porque o uid viaja para o cliente. Escrever a semente nele entregaria a chave
 * que faz o pote inteiro ser previsível — a Fase 3a inteira depende de o
 * cliente não conhecê-la.
 *
 * Duas passadas de 32 bits dão 64 bits de espaço: com um `uid` sendo chave
 * primária global em `itens`, 32 bits colidiriam entre jogadores muito antes
 * do que se imagina.
 */
export function uidDoPote(semente: number, tipo: TipoDeDrop, pagina: number, indice: number): string {
  const a = sementeDaPagina(semente, tipo, pagina * ITENS_POR_POOL + indice);
  const b = sementeDaPagina(a ^ 0x5bf03635, tipo, indice + 1);
  return `${a.toString(36)}${b.toString(36)}`;
}

export function rolarPagina(
  semente: number,
  setor: number,
  sorte: number,
  universo: number,
  kind: TipoDeDrop,
  pagina: number,
): Item[] {
  const galaxia = galaxyOfSector(setor);
  const origem = Math.max(0, Math.floor(Number(universo) || 0));
  const regra = resolverDrop({ setor, galaxia, kind });
  const ilvl = sectorIlvl(setor) + regra.ilvlBonus;
  const luck = sorte * regra.sorteMult;

  // A semente é DESTA página: não é preciso passar pelas anteriores para
  // chegar nela, e ela continua sendo sempre a mesma. Ver `sementeDaPagina`.
  const rng = new Rng(sementeDaPagina(semente, kind, paginaValida(pagina)));

  const itens: Item[] = [];
  for (let i = 0; i < ITENS_POR_POOL; i++) {
    itens.push(rollItem(rng, ilvl, luck, origem, {
      // A identidade também é derivada: ver `uidDoPote`. Sem ela, o item
      // entregue e o criado na coleta são objetos diferentes.
      uid: uidDoPote(semente, kind, paginaValida(pagina), i),
      floor: regra.pisoDeRaridade,
      slotFavorecido: regra.slotFavorecido,
      // `elementoFavorecido` NÃO entra: ver o cabeçalho. É a única entrada de
      // `resolverDrop` que dependia do inimigo, e aceitá-la do cliente
      // devolveria a alavanca de re-rolar.
    }));
  }
  return itens;
}

/**
 * Os próximos `ITENS_POR_POOL` itens de cada tipo, a partir do cursor dele.
 *
 * ## Por que o CURSOR decide, e não o cliente
 *
 * A entrega e a coleta precisam concordar sobre qual item é qual. Enquanto o
 * cliente pedia a página e a coleta derivava outra do cursor, os dois olhavam
 * para itens diferentes — e o que o jogador via na mochila não era o que o
 * servidor criava. Era o `faltaram_*` do livro, e o item que aparece e some.
 *
 * Derivando dos dois lados do MESMO cursor, a discordância deixa de ser
 * possível. E o cliente perde uma alavanca de escolha que ele nunca deveria
 * ter tido.
 *
 * Duas páginas por tipo no pior caso — quando o cursor cai no meio de uma —,
 * o que a semente por página torna barato.
 */
export function rolarDoCursor(
  semente: number,
  setor: number,
  sorte: number,
  universo: number,
  cursor: Record<TipoDeDrop, number>,
): Lote {
  const lote = {} as Lote;

  for (const kind of TIPOS) {
    const de = Math.max(0, Math.floor(cursor[kind] || 0));
    const pagina = Math.floor(de / ITENS_POR_POOL);
    const dentro = de - pagina * ITENS_POR_POOL;

    const atual = rolarPagina(semente, setor, sorte, universo, kind, pagina);
    lote[kind] = dentro === 0
      ? atual
      : [
        ...atual.slice(dentro),
        ...rolarPagina(semente, setor, sorte, universo, kind, pagina + 1).slice(0, dentro),
      ];
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

import { BOSSES } from '@data/bosses';
import { describeGalaxy } from '@data/galaxies';
import { HULLS } from '@data/hulls';
import { navegadorForaDoPortugues } from './idioma';

/**
 * Nomes próprios que o tradutor do navegador não deve tocar.
 *
 * O jogo ainda não tem versão em inglês, e quem vem de fora joga pelo tradutor
 * do Chrome/Edge. Ele traduz tudo o que é texto — e "Coroa Quebrada" vira
 * "Broken Crown" num painel e continua "Coroa Quebrada" no combate, que é
 * desenhado no canvas e não passa pelo tradutor. O mesmo lugar com dois nomes
 * parece dois lugares. `translate="no"` é o pedido padrão da web para o
 * tradutor deixar um trecho como está, e o Chrome o respeita.
 *
 * ## Quais nomes
 *
 * A marca, as naves do jogador, os chefes e as galáxias. Todos têm duas
 * palavras ou mais, então não colidem com texto comum. Os inimigos ficaram de
 * fora: "Dardo", "Enxame", "Cometa" são palavras de verdade, que aparecem em
 * frases, e traduzidas ajudam quem joga a entender o que está vendo.
 *
 * ## Por que só fora do português
 *
 * Proteger um nome no meio de uma frase exige quebrar o texto em pedaços, e o
 * jogador brasileiro, que é quase todo mundo, não ganha nada com isso. Fora do
 * português o custo se paga; em português ele nem roda.
 */
const MARCA = 'Órbita Zero';

/** Um pedaço de texto: comum, ou nome a proteger. */
export interface Parte { texto: string; nome: boolean }

export function listaDeNomesProprios(): string[] {
  // Uma galáxia por chefe: `bossForSector` põe o chefe no último setor de cada
  // uma, então as duas listas têm o mesmo tamanho por construção.
  const galaxias = BOSSES.map((_, i) => describeGalaxy(i).name);
  return [MARCA, ...HULLS.map((h) => h.name), ...BOSSES.map((b) => b.name), ...galaxias];
}

/**
 * Uma expressão só para todos os nomes, e não um `includes` por nome: o painel
 * se redesenha 5 vezes por segundo, e cada texto dele passaria por ~110 testes.
 * O mais longo vem primeiro para "Aurora Mk II" não ser achado dentro de
 * "Aurora Mk III". As bordas são por letra Unicode porque `\b` do JavaScript
 * não conhece acento, e "Óxido" teria uma borda no meio do "Ó".
 */
export function padraoDosNomes(nomes: readonly string[]): RegExp {
  const unicos = [...new Set(nomes.map((n) => n.trim()).filter((n) => n.length >= 3))]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${unicos.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
}

/** Corta o texto em pedaços comuns e nomes. Sem nome, devolve um pedaço só. */
export function partesDoTexto(texto: string, padrao: RegExp): Parte[] {
  const partes: Parte[] = [];
  let desde = 0;
  padrao.lastIndex = 0;
  for (const achado of texto.matchAll(padrao)) {
    const inicio = achado.index ?? 0;
    if (inicio > desde) partes.push({ texto: texto.slice(desde, inicio), nome: false });
    partes.push({ texto: achado[0], nome: true });
    desde = inicio + achado[0].length;
  }
  if (desde < texto.length || !partes.length) partes.push({ texto: texto.slice(desde), nome: false });
  return partes;
}

// `null` = desligado (navegador em português). Montado na primeira chamada,
// porque `dom.ts` é importado antes de qualquer tela e as tabelas são grandes.
let padrao: RegExp | null | undefined;
function padraoAtivo(): RegExp | null {
  if (padrao === undefined) padrao = navegadorForaDoPortugues() ? padraoDosNomes(listaDeNomesProprios()) : null;
  return padrao;
}

/**
 * Põe `texto` em `el`, protegendo os nomes próprios do tradutor.
 *
 * O texto que É o nome inteiro marca o próprio elemento — o caso comum, um
 * `<strong>` com o nome da nave — sem mudar a árvore. Nome no meio de frase
 * vira um `<span translate="no">` só em volta dele, e o resto da frase continua
 * traduzível.
 */
export function escreverComNomesProtegidos(el: HTMLElement, texto: string): void {
  const re = padraoAtivo();
  const partes = re ? partesDoTexto(texto, re) : null;
  if (!partes || (partes.length === 1 && !partes[0]!.nome)) {
    el.textContent = texto;
    return;
  }
  if (partes.length === 1) {
    el.setAttribute('translate', 'no');
    el.textContent = texto;
    return;
  }
  el.replaceChildren(...nos(partes));
}

/** O mesmo, para um filho de texto solto: aqui não há elemento próprio a marcar. */
export function nosComNomesProtegidos(texto: string): Node[] {
  const re = padraoAtivo();
  const partes = re ? partesDoTexto(texto, re) : null;
  if (!partes || (partes.length === 1 && !partes[0]!.nome)) return [document.createTextNode(texto)];
  return nos(partes);
}

function nos(partes: readonly Parte[]): Node[] {
  return partes.map((p) => {
    if (!p.nome) return document.createTextNode(p.texto);
    const span = document.createElement('span');
    span.setAttribute('translate', 'no');
    span.textContent = p.texto;
    return span;
  });
}

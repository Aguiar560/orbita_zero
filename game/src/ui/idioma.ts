/**
 * O navegador de quem joga NÃO está em português.
 *
 * Vale para qualquer idioma da lista do navegador, e não só o primeiro: um
 * brasileiro com o sistema em inglês costuma ter `pt-BR` mais abaixo, lê o
 * jogo sem esforço e não precisa de aviso nenhum.
 *
 * Sem import de propósito: `main.ts` consulta isto antes de decidir se baixa a
 * wiki ou o jogo, e nenhum dos dois pode vir junto só por causa desta pergunta.
 */
export function navegadorForaDoPortugues(
  idiomas: readonly string[] | undefined = typeof navigator === 'undefined' ? undefined : navigator.languages,
): boolean {
  const lista = idiomas?.length ? idiomas : typeof navigator === 'undefined' ? [] : [navigator.language];
  // Sem idioma declarado não há como saber; o padrão é não incomodar.
  if (!lista.length || lista.every((l) => !l)) return false;
  return !lista.some((l) => l?.toLowerCase().startsWith('pt'));
}

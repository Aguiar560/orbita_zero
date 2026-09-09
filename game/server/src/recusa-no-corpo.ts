/**
 * A recusa que viaja DENTRO de um 200.
 *
 * ## O erro escondido dentro do sucesso
 *
 * Quatro rotas respondem "deu certo" carregando o que NÃO deu:
 *
 * | rota | campo | o que some |
 * |---|---|---|
 * | `/inventario` | `recusados` | equipar recusado (peça não é sua, nave não aceita, slot errado) |
 * | `/inventario` | `faltaram` | o pote deu menos do que o cliente pediu |
 * | `/missoes` | `recusadas` | entrega que não passou na validação B |
 * | `/marcas` | `recusadas` | marca de ranking implausível |
 * | `/progresso` | `recusados` | encontro declarado que não cabe no mundo |
 *
 * Todas de propósito: **um comando ruim não derruba o lote** — foi a lição que
 * custou o dia 08/09. Só que isso as tornava invisíveis duas vezes. O status é
 * 200, então o livro das recusas não olhava; e o cliente ignorava os campos.
 *
 * Erro escondido dentro de sucesso é o pior lugar para um erro estar: ninguém
 * procura ali. Um jogador cuja peça é recusada em todo envio não veria nada, e
 * do lado de cá também não apareceria nada.
 *
 * ## Por que contar aqui, e não reabrir o corpo depois
 *
 * `json()` ainda tem o objeto na mão. Contar custa um `for`; reabrir o corpo no
 * interceptador custaria um `JSON.parse` em TODA resposta — inclusive nos 512 KB
 * do save, que não tem recusa nenhuma para achar.
 */

/**
 * Os campos que carregam recusa, e o que cada um é.
 *
 * `lista` = vetor de objetos com `motivo`. `contagem` = mapa de chave para
 * número. `numero` = um contador só, e aí o motivo é o nome do campo.
 *
 * Uma lista num lugar só é o que impede a próxima rota de esquecer — e
 * `tests/o-erro-escondido-no-sucesso.test.ts` varre o servidor atrás de campo
 * com cara de recusa que não esteja aqui.
 */
export const CAMPOS_DE_RECUSA: readonly string[] = [
  'recusados',
  'recusadas',
  'faltaram',
];

/** O cabeçalho interno que leva a conta até o interceptador. */
export const CABECALHO_DE_RECUSA = 'x-oz-recusas';

/** Um motivo cabe num identificador curto; o resto é lixo ou tentativa. */
const saneado = (s: string): string => s.replace(/[^a-z0-9_]/gi, '').slice(0, 48);

/**
 * `motivo=n,motivo=n` do que a resposta recusou. Vazio quando não recusou nada.
 *
 * Pura: o teste monta cada forma de corpo e confere a contagem sem rede.
 */
export function contarRecusas(dados: unknown): string {
  if (!dados || typeof dados !== 'object') return '';
  const corpo = dados as Record<string, unknown>;
  const por = new Map<string, number>();

  const somar = (motivo: string, n: number): void => {
    const limpo = saneado(motivo);
    if (!limpo || !(n > 0)) return;
    por.set(limpo, (por.get(limpo) ?? 0) + n);
  };

  /**
   * A forma é decidida pelo VALOR, não declarada por campo.
   *
   * `recusados` é vetor em `/inventario` e número em `/progresso`. Fixar a
   * forma na tabela faria uma das duas ser ignorada em silêncio — que é
   * exatamente o defeito que este arquivo existe para acabar.
   */
  for (const campo of CAMPOS_DE_RECUSA) {
    const valor = corpo[campo];
    if (valor === undefined || valor === null) continue;

    if (Array.isArray(valor)) {
      for (const item of valor) {
        // Sem `motivo` legível, o nome do campo já diz o que aconteceu — é
        // melhor contar como anônimo do que perder a ocorrência.
        const m = (item as { motivo?: unknown })?.motivo;
        somar(typeof m === 'string' && m ? m : campo, 1);
      }
      continue;
    }

    if (typeof valor === 'number') { somar(campo, valor); continue; }

    if (typeof valor === 'object') {
      for (const [chave, n] of Object.entries(valor as Record<string, unknown>)) {
        somar(`${campo}_${chave}`, Number(n) || 0);
      }
    }
  }

  return [...por.entries()].map(([m, n]) => `${m}=${n}`).join(',');
}

/** Desfaz o cabeçalho. Ignora em silêncio o que vier deformado. */
export function lerRecusas(cabecalho: string | null): { motivo: string; n: number }[] {
  if (!cabecalho) return [];
  const fora: { motivo: string; n: number }[] = [];

  for (const parte of cabecalho.split(',').slice(0, 40)) {
    const [motivo, bruto] = parte.split('=');
    const n = Number(bruto);
    if (!motivo || !Number.isFinite(n) || n <= 0) continue;
    fora.push({ motivo: saneado(motivo), n: Math.floor(n) });
  }
  return fora;
}

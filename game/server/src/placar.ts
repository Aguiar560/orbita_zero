import type { Env } from './index';

/**
 * O placar mundial: apelido, marcas e a lista.
 *
 * ## A regra que governa este arquivo
 *
 * **A marca chega do cliente, então ela é uma AFIRMAÇÃO, não um fato.** A
 * simulação roda no navegador do jogador; não existe caminho pelo qual este
 * Worker saiba o que aconteceu de verdade. O que dá para fazer é recusar o que
 * é impossível e o que é implausível, e é o que se faz aqui.
 *
 * O que a conferência PEGA:
 *
 * - valor fora de faixa — andar 101, setor 4000, nível negativo;
 * - marca que DIMINUI (o placar guarda o melhor de sempre, então cair é sinal
 *   de save adulterado, não de jogo ruim);
 * - salto rápido demais para o tempo decorrido.
 *
 * O que ela NÃO pega: quem sobe devagar mentindo. Um cliente adulterado que
 * respeite as taxas passa. A defesa contra isso é recalcular o progresso contra
 * as tabelas do jogo, o que faria mudança de balanceamento exigir atualizar o
 * servidor junto — troca que não vale a pena antes de o placar ter aposta.
 */

/** Tetos de SANIDADE, não de balanceamento. */
const TETO: Record<string, number> = {
  // `PROVACAO_PISOS` no jogo. Duplicar aqui é aceitável porque é um teto de
  // sanidade: se o jogo ganhar mais andares, o pior caso é o servidor recusar
  // marca legítima — barulhento e fácil de achar, ao contrário do inverso.
  provacao: 100,
  galaxia: 300,
  personagem: 300,
  naves: 300,
  missoes: 100000,
};

/**
 * Ganho máximo por HORA, por placar.
 *
 * Generoso de propósito: recusar marca legítima é pior que deixar passar uma
 * inflada, porque o jogador legítimo não tem como saber o que aconteceu. Os
 * números vêm do ritmo mais rápido que o jogo permite, com folga larga.
 */
const GANHO_POR_HORA: Record<string, number> = {
  provacao: 12,
  galaxia: 40,
  personagem: 30,
  naves: 30,
  missoes: 60,
};

/** Folga fixa somada ao ganho permitido. Cobre a primeira marca e a sessão curta. */
const FOLGA = 5;

const PLACARES = new Set(Object.keys(TETO));

export interface MarcaRecebida {
  placar: string;
  casco?: string;
  valor: number;
  desempate?: number;
}

// ── apelido ────────────────────────────────────────────────────────────────

/**
 * Regras do apelido, e o motivo de cada uma.
 *
 * - 3 a 16 caracteres: cabe na coluna sem cortar, e um nome de um caractere
 *   torna o placar ilegível.
 * - letras (com acento), dígitos, espaço, `-` e `_`: acento porque o jogo é em
 *   português e "João" não pode ser recusado; o resto é o mínimo para nomes
 *   compostos.
 * - sem espaço nas pontas nem duplo: evita "  a  " e "a    b" ocupando a linha
 *   inteira, e evita dois apelidos que parecem o mesmo.
 *
 * O que NÃO se faz aqui é escapar HTML. O cliente desenha com `textContent`, e
 * escapar no servidor além disso produziria `&amp;` visível no nome de quem
 * usasse `&`. A defesa está em não haver sink de `innerHTML` no cliente.
 */
const APELIDO_OK = /^[\p{L}\p{N}][\p{L}\p{N} _-]{1,14}[\p{L}\p{N}]$/u;

export function apelidoValido(bruto: unknown): string | null {
  if (typeof bruto !== 'string') return null;
  const limpo = bruto.trim().replace(/\s+/g, ' ');
  if (limpo.length < 3 || limpo.length > 16) return null;
  if (!APELIDO_OK.test(limpo)) return null;
  return limpo;
}

/** A forma comparável: a unicidade é sobre ela, não sobre o texto exibido. */
export const normalizar = (apelido: string): string => apelido.toLocaleLowerCase('pt-BR');

// ── conferência das marcas ─────────────────────────────────────────────────

export type Veredito =
  | { ok: true; valor: number; desempate: number }
  | { ok: false; motivo: string };

/**
 * A marca passa?
 *
 * `anterior` é a marca guardada, ou `null` na primeira vez. `agora` e
 * `anteriorEm` são epoch em segundos.
 */
export function conferir(
  m: MarcaRecebida,
  anterior: { valor: number; desempate: number; atualizado_em: number } | null,
  agora: number,
): Veredito {
  if (!PLACARES.has(m.placar)) return { ok: false, motivo: 'placar_desconhecido' };

  const valor = Math.floor(Number(m.valor));
  const desempate = Math.floor(Number(m.desempate ?? 0));
  if (!Number.isFinite(valor) || !Number.isFinite(desempate)) {
    return { ok: false, motivo: 'valor_nao_numerico' };
  }
  if (valor < 0 || desempate < 0) return { ok: false, motivo: 'valor_negativo' };
  if (valor > TETO[m.placar]!) return { ok: false, motivo: 'acima_do_teto' };

  if (!anterior) {
    // Primeira marca. Não há de onde medir ritmo, então só a faixa vale — e é
    // por isso que uma conta nova consegue declarar qualquer coisa dentro do
    // teto. Sem histórico não existe implausibilidade a detectar.
    return { ok: true, valor, desempate };
  }

  if (valor < anterior.valor) {
    // Não é erro do jogador: o placar guarda o melhor de sempre, e a marca
    // menor simplesmente não substitui. Recusar aqui é o que impede um save
    // antigo sincronizado de rebaixar quem já subiu.
    return { ok: false, motivo: 'marca_menor' };
  }
  if (valor === anterior.valor && desempate <= anterior.desempate) {
    return { ok: false, motivo: 'sem_novidade' };
  }

  const horas = Math.max(0, agora - anterior.atualizado_em) / 3600;
  const permitido = GANHO_POR_HORA[m.placar]! * horas + FOLGA;
  if (valor - anterior.valor > permitido) return { ok: false, motivo: 'salto_implausivel' };

  return { ok: true, valor, desempate };
}

// ── consultas ──────────────────────────────────────────────────────────────

export interface LinhaDoPlacar {
  posicao: number;
  apelido: string;
  valor: number;
  casco: string;
  /** `true` na linha do próprio jogador. */
  voce: boolean;
}

/**
 * O topo de um placar, mais a posição de quem perguntou.
 *
 * As duas coisas na mesma consulta porque a tela mostra as duas juntas, e
 * porque a posição só faz sentido contra a mesma lista — perguntar em duas
 * viagens abriria a janela de o jogador ver "12º" ao lado de um topo que já
 * mudou.
 */
export async function lerPlacar(
  env: Env,
  placar: string,
  usuario: string,
  casco = '',
  limite = 50,
): Promise<{ linhas: LinhaDoPlacar[]; minhaPosicao: number | null; total: number; meuApelido: string | null }> {
  // O apelido do proprio jogador vem junto: a tela precisa saber se ele ja
  // escolheu um para decidir entre mostrar a lista e pedir o nome, e uma
  // segunda viagem so para isso dobraria a requisicao de cada abertura.
  const meu = await env.DB.prepare(`SELECT apelido FROM apelidos WHERE usuario = ?`)
    .bind(usuario).first<{ apelido: string }>();
  const meuApelido = meu?.apelido ?? null;

  if (!PLACARES.has(placar)) return { linhas: [], minhaPosicao: null, total: 0, meuApelido };

  // O placar de naves compara CASCO com casco: o nível de um Núcleo Vektor não
  // diz nada contra o de outra nave. Nos demais placares `casco` é vazio e o
  // filtro casa com a coluna vazia, que é o que lá está gravado.
  const topo = await env.DB.prepare(`
    SELECT m.usuario, m.valor, m.casco, a.apelido
    FROM marcas m JOIN apelidos a ON a.usuario = m.usuario
    WHERE m.placar = ? AND m.casco = ?
    ORDER BY m.valor DESC, m.desempate DESC, m.atualizado_em ASC
    LIMIT ?
  `).bind(placar, casco, limite).all<{ usuario: string; valor: number; casco: string; apelido: string }>();

  const linhas: LinhaDoPlacar[] = (topo.results ?? []).map((r, i) => ({
    posicao: i + 1,
    apelido: r.apelido,
    valor: r.valor,
    casco: r.casco,
    voce: r.usuario === usuario,
  }));

  const total = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM marcas m JOIN apelidos a ON a.usuario = m.usuario WHERE m.placar = ? AND m.casco = ?')
    .bind(placar, casco)
    .first<{ n: number }>();

  // A minha marca, uma vez — as subconsultas repetidas de antes liam a mesma
  // linha seis vezes e ignoravam o casco.
  const minhaMarca = await env.DB
    .prepare('SELECT valor, desempate FROM marcas WHERE usuario = ? AND placar = ? AND casco = ?')
    .bind(usuario, placar, casco)
    .first<{ valor: number; desempate: number }>();

  const minha = minhaMarca
    ? await env.DB.prepare(`
        SELECT 1 + COUNT(*) AS pos FROM marcas m
        JOIN apelidos a ON a.usuario = m.usuario
        WHERE m.placar = ? AND m.casco = ?
          AND (m.valor > ? OR (m.valor = ? AND m.desempate > ?))
      `).bind(placar, casco, minhaMarca.valor, minhaMarca.valor, minhaMarca.desempate)
        .first<{ pos: number }>()
    : null;

  const tenhoMarca = !!minhaMarca;

  return {
    linhas,
    minhaPosicao: tenhoMarca ? (minha?.pos ?? null) : null,
    total: total?.n ?? 0,
    meuApelido,
  };
}

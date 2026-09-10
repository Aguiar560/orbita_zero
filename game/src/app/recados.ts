import { API_URL } from '@data/servidor';

import { tokenValido } from './conta';
import { relatarFalha, relatarSucesso } from './recusa';

/**
 * O recado do comando: uma mensagem do operador para este jogador.
 *
 * ## Quando ele chega
 *
 * No boot, e só. Não há relógio próprio nem escuta aberta, e isso é decisão:
 * um recado é raro — compensação, aviso de manutenção, agradecimento a quem
 * testou. Perguntar de dois em dois minutos por uma coisa que acontece uma vez
 * por mês gastaria a cota do D1 para responder "nada" milhares de vezes.
 *
 * Quem já está com a aba aberta recebe na próxima vez que o jogo iniciar — e
 * desde `app/versao.ts` isso deixou de significar "quando ele lembrar de
 * recarregar": um deploy leva a aba dele a reiniciar sozinha.
 *
 * ## Por que a leitura é confirmada de volta
 *
 * Sem a confirmação o servidor não teria como parar de entregar, e o mesmo
 * recado apareceria em todo boot até o jogador desistir do jogo. A marca
 * também é a resposta para a pergunta que o suporte faz depois: *ele viu?*
 */

export interface Recado {
  id: number;
  texto: string;
  criadoEm: number;
}

/**
 * Os recados por entregar. Lista vazia quando não há — e quando deu errado.
 *
 * Os dois casos são o mesmo para quem chama: não mostrar nada. Um aviso de
 * cortesia não pode ser motivo para o boot falhar.
 */
export async function buscarRecados(): Promise<readonly Recado[]> {
  const token = await tokenValido();
  if (!token) return [];

  try {
    const r = await fetch(`${API_URL}/recados`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!r.ok) { await relatarFalha('/recados', 'fundo', r); return []; }

    const dados = (await r.json()) as { recados?: unknown };
    relatarSucesso('/recados', dados);
    if (!Array.isArray(dados.recados)) return [];

    return dados.recados
      .filter((x): x is { id: number; texto: string; criado_em: number } =>
        !!x && typeof x === 'object'
        && typeof (x as { id?: unknown }).id === 'number'
        && typeof (x as { texto?: unknown }).texto === 'string')
      .map((x) => ({ id: x.id, texto: x.texto, criadoEm: x.criado_em }));
  } catch {
    await relatarFalha('/recados', 'fundo', null);
    return [];
  }
}

/**
 * Confirma a leitura.
 *
 * Chamado quando o jogador FECHA o cartão, não quando ele aparece. Um recado
 * que chega junto com a tela de carregamento e some antes de alguém olhar não
 * foi lido — e marcá-lo como lido ali faria ele nunca mais voltar.
 */
export async function marcarRecadosLidos(ids: readonly number[]): Promise<void> {
  if (!ids.length) return;
  const token = await tokenValido();
  if (!token) return;

  try {
    const r = await fetch(`${API_URL}/recados`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ lidos: ids }),
    });
    if (!r.ok) await relatarFalha('/recados', 'fundo', r);
  } catch {
    await relatarFalha('/recados', 'fundo', null);
  }
}

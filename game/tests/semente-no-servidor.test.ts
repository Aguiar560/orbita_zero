import { describe, expect, it } from 'vitest';
import { montarEstado, type DadosDoServidor } from '../server/src/estado';
import { buildEncounter, WAVES_PER_SECTOR } from '@sim/progression';
import { HULLS } from '@data/hulls';

/**
 * A semente do universo tem de ser a DO JOGADOR.
 *
 * ## Os dois defeitos
 *
 * 1. `montarEstado` chamava `createState()` sem argumento, e a semente saía
 *    aleatória a cada requisição. **A ausência era simulada em outro mundo** —
 *    outros inimigos, outra densidade, outra contagem. O ganho saía plausível
 *    e errado.
 *
 * 2. Sem ela o servidor não consegue PRECIFICAR uma onda, que é o próximo passo
 *    da Fase 5. Medido em 09/09, a maior parte do XP não vem de concluir a onda
 *    — vem de cada abate: no setor 1, **99%**. E `abatesDeReferencia` varia
 *    **6×** conforme o perfil que a semente sorteia.
 *
 * A semente não é poder: ela decide o LAYOUT do mundo, não atributo nenhum. É
 * contexto, como `run` e `hull`. Mas é imutável mesmo assim — ver abaixo.
 */

const casco = HULLS[0]!.id;

const base = (extra: Partial<DadosDoServidor> = {}): DadosDoServidor => ({
  saldos: { sucata: 0, nucleo: 0, cristal: 0 },
  xp: 0, nivel: 1, matriz: [], melhorSetor: 300,
  materiais: {}, naves: {}, frota: [casco], itens: [],
  ...extra,
});

/** A cara das ondas de um estado: é isto que a semente decide. */
function assinaturaDoMundo(estado: ReturnType<typeof montarEstado>): string {
  const partes: string[] = [];
  for (const setor of [1, 40, 300]) {
    for (let onda = 1; onda <= WAVES_PER_SECTOR + 1; onda++) {
      const e = buildEncounter(estado, setor, onda);
      partes.push(`${e.unidades}:${e.abatesDeReferencia}:${e.squad.map((g) => g.def.id).join(',')}`);
    }
  }
  return partes.join('|');
}

describe('o mundo que o servidor monta', () => {
  it('é o MESMO do jogador quando a semente vem junto', () => {
    const a = montarEstado(base({ semente: 123456 }), {});
    const b = montarEstado(base({ semente: 123456 }), {});
    expect(a.universe.seed).toBe(123456);
    expect(assinaturaDoMundo(a), 'a mesma semente deu mundos diferentes')
      .toBe(assinaturaDoMundo(b));
  });

  it('e é OUTRO quando a semente é outra — senão o teste acima não prova nada', () => {
    const a = montarEstado(base({ semente: 111 }), {});
    const b = montarEstado(base({ semente: 999 }), {});
    expect(assinaturaDoMundo(a)).not.toBe(assinaturaDoMundo(b));
  });

  it('e sem semente o comportamento antigo vale, sem quebrar', () => {
    /**
     * Zero é "ainda não sei": save de antes da coluna, ou conta que nunca
     * sincronizou. O boot não pode falhar por causa disso — a regra do projeto
     * é que save malformado não trava nada.
     */
    const e = montarEstado(base({ semente: 0 }), {});
    expect(Number.isFinite(e.universe.seed)).toBe(true);
    expect(() => assinaturaDoMundo(e)).not.toThrow();
  });
});

describe('a composição da onda', () => {
  it('muda MUITO com a semente — é por isso que ela precisa ser fixa', () => {
    /**
     * O número que justifica a imutabilidade. `abatesDeReferencia` sai do
     * perfil sorteado, e os perfis vão de densidade 0,45 a 2,4. Quem pudesse
     * re-sortear a semente ficaria repetindo até cair no perfil que paga mais.
     */
    const vistos = new Set<number>();
    for (let semente = 1; semente <= 40; semente++) {
      vistos.add(buildEncounter(montarEstado(base({ semente }), {}), 40, 1).abatesDeReferencia);
    }
    const maior = Math.max(...vistos);
    const menor = Math.min(...vistos);
    expect(maior / menor, 'se isto encolher, a imutabilidade da semente perde o motivo')
      .toBeGreaterThan(2);
  });
});

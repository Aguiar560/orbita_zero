import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, createState, migrate } from '@sim/state';
import { HULL_BY_ID } from '@data/hulls';

/**
 * O casco em campo não pode ser trocado por voltar ao jogo.
 *
 * ## O defeito, relatado pelo Rafael em 08/09
 *
 * "Saio do jogo com a nave Sopro Astral, ao reconectar o jogo entra com Núcleo
 * Vektor." Núcleo Vektor é o casco do piloto Vektor, que é o piloto PADRÃO — o
 * jogo voltava para a nave de partida de quem nem chegou a escolher personagem.
 *
 * ## A cadeia
 *
 * 1. `semODinheiro` sobe `fleet: []` para a nuvem, de propósito: a frota mora
 *    na tabela `frota` desde a Fase 3c, e casco é poder — a lista não pode ser
 *    escrita pelo cliente.
 * 2. `migrate` recebia essa frota vazia, caía no padrão (`fresh.fleet`, que é o
 *    casco do piloto mais a frota inicial) e então demovia o casco ativo por
 *    ele "não estar na frota".
 * 3. `sincronizarFrota` devolvia a frota verdadeira logo depois — mas ninguém
 *    devolvia o casco.
 * 4. `creditarAusencia` mandava esse `hull` ao servidor, que simula a ausência
 *    com o casco que o cliente informa. **A ausência inteira era calculada com
 *    a nave errada**, e o save seguinte gravava a troca.
 *
 * A regra continua valendo: casco em campo tem de estar na frota. O que mudou é
 * QUANDO ela é cobrada — contra a frota do servidor, que é a autoridade, e não
 * contra um espaço reservado que ainda não foi preenchido.
 */

/** Um save como o que volta da nuvem: sem frota, porque ela vem da tabela. */
function saveDaNuvem(hull: string, piloto: string): unknown {
  const estado = createState(1, piloto);
  return {
    ...estado,
    version: SAVE_VERSION,
    hull,
    // É isto que `semODinheiro` faz. Ver `app/nuvem.ts`.
    fleet: [],
  };
}

describe('o casco em campo', () => {
  it('sobrevive a um save da nuvem, que vem SEM frota', () => {
    /**
     * O teste do relato, com os nomes do relato: um save cujo piloto é o padrão
     * (casco de partida Núcleo Vektor) voando no Sopro Astral.
     */
    const migrado = migrate(saveDaNuvem('sopro_astral', 'piloto_vektor'));
    expect(migrado).toBeTruthy();
    expect(migrado!.hull, 'o jogador saiu no Sopro Astral e voltou em outra nave')
      .toBe('sopro_astral');
  });

  it('e continua valendo para qualquer casco do catálogo, não só o do relato', () => {
    // Um caso só passaria por acaso — por exemplo se `fleet[0]` já fosse o
    // casco certo. Percorrer o catálogo é o que garante que a regra mudou.
    for (const id of HULL_BY_ID.keys()) {
      const migrado = migrate(saveDaNuvem(id, 'piloto_vektor'));
      expect(migrado!.hull, `voltou trocado quando o casco era ${id}`).toBe(id);
    }
  });

  it('mas um casco que não existe no catálogo ainda cai para um que existe', () => {
    /**
     * A proteção que a linha original dava e que não pode se perder: save
     * editado à mão, ou casco removido do jogo entre versões. Sem isto,
     * `resolveStats` procuraria um casco inexistente.
     */
    const migrado = migrate(saveDaNuvem('casco_que_nao_existe', 'piloto_vektor'));
    expect(HULL_BY_ID.has(migrado!.hull)).toBe(true);
  });

  it('e uma frota LOCAL que não tem o casco continua demovendo', () => {
    /**
     * O outro lado da moeda. Quando a frota vem preenchida ela é informação de
     * verdade, e a regra vale: não se leva a campo o que não se tem.
     *
     * Sem esta asserção o conserto viraria um buraco — bastaria editar `hull`
     * no save local para voar com qualquer casco do jogo.
     */
    const estado = createState(1, 'piloto_vektor');
    const migrado = migrate({
      ...estado, version: SAVE_VERSION, hull: 'sopro_astral', fleet: ['nucleo_vektor'],
    });
    expect(migrado!.hull).not.toBe('sopro_astral');
    expect(migrado!.fleet).toContain(migrado!.hull);
  });
});

/**
 * A conferência do placar, no servidor.
 *
 * A marca chega do cliente, então ela é uma AFIRMAÇÃO. Este é o único lugar do
 * sistema que decide se ela entra — e errar aqui tem duas faces igualmente
 * ruins: aceitar demais publica um placar de mentira, recusar demais tranca o
 * jogador legítimo fora dele sem ele ter como saber por quê.
 */

import { describe, expect, it } from 'vitest';

import { apelidoValido, conferir, normalizar } from '../server/src/placar';

const HORA = 3600;
const anterior = (valor: number, atrasSegundos = HORA, desempate = 0) =>
  ({ valor, desempate, atualizado_em: Math.floor(Date.now() / 1000) - atrasSegundos });
const agora = () => Math.floor(Date.now() / 1000);

describe('apelido', () => {
  it('aceita nome comum, com acento', () => {
    // O jogo é em português: recusar "João" seria um defeito, não uma defesa.
    for (const bom of ['João', 'Vektor 9', 'ana-maria', 'Piloto_01', 'NHARU']) {
      expect(apelidoValido(bom), bom).toBe(bom);
    }
  });

  it('apara espaço solto em vez de recusar', () => {
    // Espaço colado é erro de digitação, não tentativa de burlar. Recusar por
    // isso faria o jogador tentar de novo sem saber o que estava errado.
    expect(apelidoValido('  Vektor   9  ')).toBe('Vektor 9');
  });

  it('recusa o que quebraria a lista', () => {
    const ruins: [unknown, string][] = [
      ['ab', 'curto demais'],
      ['a'.repeat(17), 'longo demais'],
      ['  a  ', 'só espaço em volta de uma letra'],
      ['-abc', 'começa com símbolo'],
      ['abc-', 'termina com símbolo'],
      ['<script>', 'marcação'],
      ['a\u0000b', 'byte nulo'],
      [42, 'nem é texto'],
      [null, 'nulo'],
    ];
    for (const [ruim, porque] of ruins) {
      expect(apelidoValido(ruim), porque).toBeNull();
    }
  });

  it('a unicidade ignora caixa', () => {
    // Sem isto, "Vektor" e "vektor" coexistiriam e o placar viraria uma lista
    // de quase-homônimos que ninguém distingue.
    expect(normalizar('Vektor')).toBe(normalizar('VEKTOR'));
  });
});

describe('conferência de marca', () => {
  it('primeira marca: só a faixa vale', () => {
    // Sem histórico não existe ritmo a medir. Vale dizer que isto significa que
    // uma conta nova declara o que quiser dentro do teto — é o limite real
    // desta abordagem, e está documentado no módulo.
    expect(conferir({ placar: 'provacao', valor: 40 }, null, agora())).toEqual({ ok: true, valor: 40, desempate: 0 });
  });

  it('recusa o impossível', () => {
    const casos: [string, number, string][] = [
      ['provacao', 101, 'acima_do_teto'],
      ['galaxia', 301, 'acima_do_teto'],
      ['personagem', 301, 'acima_do_teto'],
      ['provacao', -1, 'valor_negativo'],
    ];
    for (const [placar, valor, motivo] of casos) {
      const v = conferir({ placar, valor }, null, agora());
      expect(v.ok, `${placar} ${valor}`).toBe(false);
      if (!v.ok) expect(v.motivo).toBe(motivo);
    }
  });

  it('recusa placar que não existe', () => {
    const v = conferir({ placar: 'inventado', valor: 1 }, null, agora());
    expect(v.ok).toBe(false);
  });

  it('recusa valor não numérico', () => {
    // `NaN` passaria por toda comparação de tamanho sem disparar nenhuma, e
    // entraria no banco como marca. É o caso que só aparece em produção.
    const v = conferir({ placar: 'provacao', valor: Number.NaN }, null, agora());
    expect(v.ok).toBe(false);
  });

  describe('monotonia', () => {
    it('marca menor não rebaixa', () => {
      // O placar guarda o melhor de sempre. Sem isto, sincronizar um save
      // antigo de outro dispositivo derrubaria quem já tinha subido.
      const v = conferir({ placar: 'provacao', valor: 10 }, anterior(40), agora());
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.motivo).toBe('marca_menor');
    });

    it('marca igual sem desempate novo não gasta escrita', () => {
      const v = conferir({ placar: 'personagem', valor: 40, desempate: 100 }, anterior(40, HORA, 100), agora());
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.motivo).toBe('sem_novidade');
    });

    it('mesmo nível com mais XP passa', () => {
      const v = conferir({ placar: 'personagem', valor: 40, desempate: 500 }, anterior(40, HORA, 100), agora());
      expect(v.ok).toBe(true);
    });
  });

  describe('ritmo', () => {
    it('recusa o salto do 1 ao 100', () => {
      // O caso que o placar existe para impedir: devtools, marca no topo.
      const v = conferir({ placar: 'provacao', valor: 100 }, anterior(1, HORA), agora());
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.motivo).toBe('salto_implausivel');
    });

    it('aceita progresso rápido, mas real', () => {
      // 12 andares/hora é o teto; uma sessão de uma hora subindo 10 tem de
      // passar. Recusar jogador legítimo é pior que deixar passar um inflado,
      // porque o legítimo não tem como saber o que houve.
      const v = conferir({ placar: 'provacao', valor: 11 }, anterior(1, HORA), agora());
      expect(v.ok).toBe(true);
    });

    it('quem some por uma semana volta com o progresso todo', () => {
      // A folga é por TEMPO decorrido, então ficar offline não vira suspeita.
      const semana = 7 * 24 * HORA;
      const v = conferir({ placar: 'provacao', valor: 90 }, anterior(1, semana), agora());
      expect(v.ok, 'uma semana comporta 90 andares').toBe(true);
    });

    it('a folga fixa cobre a sessão curta', () => {
      // Duas submissões seguidas em 150s: sem a folga, subir dois andares
      // seguidos seria recusado por "rápido demais".
      const v = conferir({ placar: 'provacao', valor: 4 }, anterior(1, 150), agora());
      expect(v.ok).toBe(true);
    });
  });
});

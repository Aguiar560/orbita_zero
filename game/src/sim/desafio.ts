import { BOSSES, type BossDef } from '@data/bosses';
import { efeitosDoPiso, pisoDaProvacao, type PisoDef } from '@data/provacao';
import { chefeDoPiso, type ChefeDaProvacao } from '@data/provacao-chefes';
import { ESPECIAL_POR_ID, type EspecialDef } from '@data/provacao-especiais';
import { sectorDamage, sectorHp, sectorIlvl, type Encounter } from './progression';
import { activeElement } from './stats';
import type { ElementId, GameState } from './types';

/**
 * A FRONTEIRA entre o Núcleo de Provação e o combate.
 *
 * Este é o único módulo que traduz "piso" para "encontro". `VerticalMode` não
 * aprende o vocabulário da Provação: ele continua lendo `sim.encounter` como
 * sempre leu, e recebe os efeitos já resolvidos num objeto só.
 *
 * A razão é o custo de errar: `VerticalMode` tem 1484 linhas e roda a 60 fps.
 * Espalhar `if (estáNaProvação)` por ele seria pagar esse risco em cada linha
 * tocada — e no dia em que houver um terceiro modo, seria pagar de novo.
 */

/** Efeitos já somados, prontos para o combate ler uma vez por encontro. */
export interface EfeitosDoDesafio {
  vida: number;
  dano: number;
  velocidade: number;
  cadencia: number;
  /** Fração da vida do chefe regenerada por segundo. */
  regen: number;
  /** Fração do dano recebido devolvida ao jogador. */
  reflexo: number;
  /** Resistência plana contra todos os elementos, 0..1. */
  resistencia: number;
  invocaCada: number;
  divideEm: number;
  limiteDeTempo: number;
  /** O escudo do JOGADOR não regenera. */
  travaEscudo: boolean;
  espelhaElemento: boolean;
  invulneravelCada: number;
  invulneravelPor: number;
  zonaCada: number;
  zonaPor: number;
  zonaRaio: number;
  zonaDano: number;
  clones: number;
  barreiraFrontal: number;
  barreiraCada: number;
  barreiraPor: number;
  pontoFraco: number;
  pontoFracoRaio: number;
}

/** Um desafio em andamento. Vive em memória — não é salvo. */
export interface DesafioAtivo {
  piso: number;
  def: PisoDef;
  chefe: ChefeDaProvacao;
  especial: EspecialDef;
  efeitos: EfeitosDoDesafio;
  /** Carga do especial, 0..1. */
  carga: number;
  /** Segundos restantes de telegrafia. Zero = não está avisando. */
  avisando: number;
  /** Quantas vezes o especial já saiu. */
  disparos: number;
  /** Segundos decorridos, para o registro e para o limite de tempo. */
  tempo: number;
  danoCausado: number;
  danoRecebido: number;
  /**
   * Segundos desde o último dano no chefe.
   *
   * A regeneração só volta a contar depois de uma pausa: sem isso o modificador
   * vira um piso de DPS, e um chefe que regenera mais rápido do que você bate é
   * imortal por aritmética, não por dificuldade.
   */
  semDanoHa: number;
  /** O chefe já se partiu? Uma vez por luta. */
  dividiu: boolean;
  /** Evita recriar os mesmos ecos quando a cena é atualizada. */
  clonesGerados: boolean;
  /** Cronômetro independente das zonas, que são telegráficas. */
  proximaZonaEm: number;
}

/**
 * Multiplicador de vida do chefe da Provação.
 *
 * Medido, não escolhido: sem ele as lutas dos primeiros pisos duravam de 10 a
 * 16 segundos, e os especiais — que carregam entre 11 e 20 — simplesmente nunca
 * saíam. Um chefe cujo golpe característico não chega a aparecer é um chefe sem
 * identidade, que é o oposto do que o §33 pede.
 *
 * 1,9 põe o piso 1 em torno de 30 s, que é o bastante para o especial disparar
 * uma vez e o jogador ver o que o modo é.
 */
export const VIDA_DO_CHEFE = 1.9;

/**
 * Nível de setor EQUIVALENTE ao piso.
 *
 * O combate dimensiona tudo por setor — vida, dano, nível de item. Em vez de
 * criar uma segunda curva só para a Provação, o piso é mapeado para o setor de
 * dificuldade comparável e as curvas existentes fazem o resto.
 *
 * Assim uma recalibragem da campanha alcança a Provação sozinha, em vez de as
 * duas divergirem em silêncio — que é o defeito clássico de um modo paralelo.
 */
export function setorEquivalente(piso: number): number {
  // Cem pisos cobrindo até o setor 300: o piso 1 pesa como o setor 12, o piso
  // 100 como o 300. A Provação anda à frente da campanha o tempo todo, que é o
  // que a torna endgame.
  return Math.round(12 + (piso - 1) * 2.9);
}

/**
 * O chefe da Provação como `BossDef` — a forma que o combate já sabe desenhar.
 *
 * Reaproveita as FASES de um chefe de campanha em vez de inventar padrões de
 * tiro novos: `BossPhase` já traz ataque, cadência, estrafe e invocação, e
 * `VerticalMode.updateBoss` já os executa. O que muda entre um piso e outro é o
 * elenco, os números e o especial — não a gramática do combate.
 */
export function bossDoPiso(
  chefe: ChefeDaProvacao,
  efeitos: EfeitosDoDesafio,
  elementoDoJogador?: ElementId,
): BossDef {
  const molde = BOSSES[(chefe.piso - 1) % BOSSES.length]!;
  return {
    ...molde,
    id: chefe.id,
    name: chefe.nome,
    title: chefe.caracteristica,
    sprite: chefe.sprite,
    /**
     * O ESPELHO anula a vantagem elemental assumindo o elemento do jogador.
     *
     * Resolvido na montagem do encontro, não a cada quadro: trocar o elemento no
     * meio da luta faria o jogador ver o tiro mudar de cor sem entender por quê,
     * e obrigaria o combate a reconsultar o equipamento a cada disparo.
     */
    element: efeitos.espelhaElemento && elementoDoJogador ? elementoDoJogador : chefe.elemento,
    hp: molde.hp * chefe.vida * efeitos.vida,
    dano: molde.dano * chefe.dano * efeitos.dano,
    // As fases herdam a cadência e a velocidade do modificador. Multiplicar
    // aqui, e não no laço, mantém `VerticalMode` sem saber que a Provação
    // existe.
    phases: molde.phases.map((f) => ({
      ...f,
      fireRate: f.fireRate * efeitos.cadencia,
      strafe: f.strafe * efeitos.velocidade,
      bulletSpeed: f.bulletSpeed * Math.min(1.6, efeitos.velocidade),
      ...(efeitos.invocaCada > 0
        ? { summon: f.summon ?? { enemy: molde.phases[0]?.summon?.enemy ?? 'drone', every: efeitos.invocaCada, count: 3 } }
        : {}),
    })),
  };
}

/** Monta o encontro do piso, na forma que `VerticalMode` já consome. */
export function encontroDoDesafio(_state: GameState, d: DesafioAtivo): Encounter {
  const setor = setorEquivalente(d.piso);
  const boss = bossDoPiso(d.chefe, d.efeitos, activeElement(_state));

  return {
    sector: setor,
    // Onda além do último: é assim que o resto do código reconhece "encontro
    // final", e o chefe da Provação é sempre um.
    wave: 99,
    kind: 'chefe',
    /**
     * SEM a `escala` do piso aqui.
     *
     * `setorEquivalente` já avança 2,9 setores por piso, e `sectorHp` é
     * exponencial no setor — multiplicar também pela escala do piso contava a
     * progressão DUAS VEZES. Medido antes da correção: a luta ia de 16 s no
     * piso 1 a 244 s no piso 10, quando deveria ficar mais ou menos constante,
     * já que o equipamento do jogador cresce junto.
     *
     * A escala continua existindo para a RECOMPENSA, que é onde ela nunca
     * duplicou nada.
     */
    hpPool: sectorHp(setor) * boss.hp * VIDA_DO_CHEFE,
    unidades: 1,
    squad: [],
    boss,
    damage: sectorDamage(setor) * boss.dano,
    pressao: d.efeitos.cadencia,
    perfil: d.chefe.nome,
    // A recompensa do piso é paga por `concluirPisoDaProvacao`; o `bounty` aqui
    // só alimenta o ganho por abate da cena, que é acessório.
    bounty: sectorHp(setor) * 0.002,
    ilvl: sectorIlvl(setor),
  };
}

/** Começa um desafio. Puro — quem guarda o estado é o `Sim`. */
export function abrirDesafio(piso: number): DesafioAtivo {
  const def = pisoDaProvacao(piso);
  const chefe = chefeDoPiso(piso);
  return {
    piso,
    def,
    chefe,
    especial: ESPECIAL_POR_ID.get(chefe.especial)!,
    efeitos: efeitosDoPiso(def),
    carga: 0,
    avisando: 0,
    disparos: 0,
    tempo: 0,
    danoCausado: 0,
    danoRecebido: 0,
    semDanoHa: 0,
    dividiu: false,
    clonesGerados: false,
    proximaZonaEm: 0,
  };
}

/**
 * Avança o relógio do desafio e diz o que o combate deve fazer.
 *
 * Devolve `'aviso'` quando a barra encheu e a telegrafia começou, `'dispara'`
 * no instante em que o golpe sai, e `'tempo'` quando o limite estourou.
 *
 * A telegrafia é OBRIGATÓRIA e vive aqui, e não na tela: um especial que
 * acertasse sem aviso não seria dificuldade, seria imposto — o jogador perderia
 * sem ter tido o que fazer. Pôr o aviso na camada de dados, e não no desenho,
 * garante que ele exista mesmo que alguém reescreva a interface.
 */
export function tickDoDesafio(d: DesafioAtivo, dt: number): 'nada' | 'aviso' | 'dispara' | 'tempo' {
  d.tempo += dt;

  if (d.efeitos.limiteDeTempo > 0 && d.tempo >= d.efeitos.limiteDeTempo) return 'tempo';

  if (d.avisando > 0) {
    d.avisando -= dt;
    if (d.avisando <= 0) {
      d.avisando = 0;
      d.carga = 0;
      d.disparos++;
      return 'dispara';
    }
    return 'nada';
  }

  const antes = d.carga;
  // `aceleraProximo` encurta a carga a cada disparo — é o que faz um chefe de
  // salto ficar cada vez mais insistente sem precisar de outra mecânica.
  const acelera = Math.pow(d.especial.efeito.aceleraProximo ?? 1, d.disparos);
  d.carga = Math.min(1, d.carga + dt / Math.max(1, d.especial.carga * acelera));

  if (antes < 1 && d.carga >= 1) {
    d.avisando = d.especial.aviso;
    return 'aviso';
  }
  return 'nada';
}

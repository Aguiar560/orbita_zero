import type { ElementId } from '@sim/types';
import { getElement } from './elements';
import type { AttackPattern, EnemyDef, MovePattern } from './enemies';

/**
 * As três frotas do pack Void, geradas a partir de duas tabelas pequenas.
 *
 * São 24 inimigos (3 frotas × 8 classes) e escrevê-los à mão seria repetitivo e
 * fácil de dessincronizar. Aqui a CLASSE define comportamento e forma, a FROTA
 * define tempero e faixa de setor, e o cruzamento produz o bestiário inteiro
 * com nomes, sprites e animações consistentes.
 */

interface ClassSpec {
  slug: string;
  name: string;
  /** Multiplicadores sobre a curva base do setor. */
  hp: number;
  dano: number;
  reward: number;
  speed: number;
  move: MovePattern;
  attack: AttackPattern;
  fireRate: number;
  shots: number;
  radius: number;
  scale: number;
  /** Setor mínimo, somado ao piso da frota. */
  from: number;
  weight: number;
  elite?: boolean;
  /** Índice do projétil da frota que esta classe dispara. */
  ammo: number;
  /**
   * Elemento próprio da classe, à revelia da frota.
   *
   * Sem isto os 24 inimigos de frota herdariam três elementos só (fogo, cósmico,
   * químico) e o bestiário inteiro pendia para lá: resistência a fogo virava
   * obrigatória e resistência a gelo, decoração. Três classes fogem do padrão da
   * frota para os seis elementos circularem — e, quando fogem, o projétil passa
   * a sair da tabela de elementos, senão a cor do tiro mentiria sobre o dano.
   */
  element?: ElementId;
}

/**
 * `scale` compensa o enquadramento do pack: a arte ocupa cerca de metade da
 * célula de 64px, então 1.0 renderizaria naves de ~30px numa tela de 540 de
 * largura — pequenas demais para o jogador distinguir as classes.
 */
const CLASSES: readonly ClassSpec[] = [
  { slug: 'batedor', name: 'Batedor', hp: 0.5, dano: 0.8, reward: 0.7, speed: 178, move: 'senoide', attack: 'direto', fireRate: 0.6, shots: 1, radius: 15, scale: 1.4, from: 0, weight: 110, ammo: 0 },
  { slug: 'caca', name: 'Caça', hp: 0.9, dano: 1.0, reward: 1.0, speed: 132, move: 'mergulho', attack: 'mirado', fireRate: 0.8, shots: 1, radius: 17, scale: 1.4, from: 0, weight: 100, ammo: 0 },
  { slug: 'bombardeiro', name: 'Bombardeiro', hp: 1.7, dano: 1.4, reward: 1.4, speed: 84, move: 'pairar', attack: 'leque', fireRate: 0.45, shots: 3, radius: 20, scale: 1.5, from: 3, weight: 70, ammo: 1 },
  { slug: 'fragata', name: 'Fragata', hp: 2.8, dano: 1.2, reward: 1.9, speed: 74, move: 'pairar', attack: 'direto', fireRate: 0.9, shots: 3, radius: 22, scale: 1.5, from: 6, weight: 60, ammo: 1 },
  { slug: 'torpedeiro', name: 'Torpedeiro', hp: 2.1, dano: 1.9, reward: 2.0, speed: 98, move: 'investida', attack: 'teleguiado', fireRate: 0.5, shots: 2, radius: 24, scale: 1.5, from: 9, weight: 50, ammo: 3, element: 'raio' },
  { slug: 'suporte', name: 'Nave de Suporte', hp: 3.4, dano: 0.9, reward: 2.4, speed: 66, move: 'orbita', attack: 'nenhum', fireRate: 0, shots: 0, radius: 20, scale: 1.5, from: 11, weight: 34, ammo: 0, element: 'gelo' },
  // Cruzador e encouraçado vêm em células de 128px, então escalam menos.
  { slug: 'cruzador', name: 'Cruzador de Batalha', hp: 7.5, dano: 1.6, reward: 5.0, speed: 54, move: 'pairar', attack: 'espiral', fireRate: 1.5, shots: 5, radius: 34, scale: 0.95, from: 16, weight: 20, elite: true, ammo: 2 },
  { slug: 'encouracado', name: 'Encouraçado', hp: 13, dano: 2.1, reward: 8.0, speed: 40, move: 'pairar', attack: 'leque', fireRate: 0.8, shots: 9, radius: 40, scale: 1.05, from: 24, weight: 12, elite: true, ammo: 2, element: 'padrao' },
];

interface FleetSpec {
  id: string;
  name: string;
  /** Setor em que a frota começa a aparecer. */
  floor: number;
  hp: number;
  dano: number;
  speed: number;
  bulletSpeed: number;
  color: string;
  /**
   * Elemento da frota inteira.
   *
   * Vem da paleta que o pack já tinha — Kla'ed é vermelha, Nairan é roxa,
   * Nautolan é verde —, então o tipo de dano bate com o que o jogador já vê há
   * setores. Isso é o que torna a galáxia legível: descobrir a frota dominante
   * é descobrir qual resistência equipar.
   */
  element: ElementId;
  /** Projéteis da frota, na ordem em que `ClassSpec.ammo` os indexa. */
  ammo: readonly string[];
  blast: string;
}

const FLEETS: readonly FleetSpec[] = [
  {
    id: 'klaed', name: "Kla'ed", floor: 1,
    hp: 0.9, dano: 1.15, speed: 1.1, bulletSpeed: 250,
    color: '#ff5a4d', blast: 'arc/boom_fogo', element: 'fogo',
    ammo: ['bala', 'balao', 'raio', 'torpedo'],
  },
  {
    id: 'nairan', name: 'Nairan', floor: 13,
    hp: 1.0, dano: 1.0, speed: 1.0, bulletSpeed: 300,
    color: '#a86bff', blast: 'arc/boom_vazio', element: 'cosmico',
    ammo: ['raio', 'feixe', 'foguete', 'torpedo'],
  },
  {
    id: 'nautolan', name: 'Nautolan', floor: 26,
    hp: 1.3, dano: 0.95, speed: 0.9, bulletSpeed: 235,
    color: '#4ddb9a', blast: 'arc/boom_plasma', element: 'quimico',
    ammo: ['bala', 'giro', 'onda', 'foguete'],
  },
];

/** Ids de atlas das partes de uma nave da frota. */
const partId = (fleet: string, cls: string, part: string): string => `void/${fleet}/${cls}_${part}`;

function build(): EnemyDef[] {
  const out: EnemyDef[] = [];

  for (const fleet of FLEETS) {
    for (const cls of CLASSES) {
      const from = fleet.floor + cls.from;
      const ammo = fleet.ammo[Math.min(cls.ammo, fleet.ammo.length - 1)]!;
      const element = cls.element ?? fleet.element;
      const info = getElement(element);
      const desviado = element !== fleet.element;

      out.push({
        id: `${fleet.id}_${cls.slug}`,
        name: `${cls.name} ${fleet.name}`,
        sprite: partId(fleet.id, cls.slug, 'base'),
        // As animações ficam como prefixo; a cena resolve o quadro pelo tempo.
        engineClip: partId(fleet.id, cls.slug, 'motor'),
        deathClip: partId(fleet.id, cls.slug, 'morte'),
        weaponClip: cls.attack === 'nenhum' ? undefined : partId(fleet.id, cls.slug, 'arma'),
        shieldClip: cls.elite ? partId(fleet.id, cls.slug, 'escudo') : undefined,

        element,
        radius: cls.radius,
        scale: cls.scale,
        hp: cls.hp * fleet.hp,
        dano: cls.dano * fleet.dano,
        reward: cls.reward,
        speed: cls.speed * fleet.speed,
        move: cls.move,
        attack: cls.attack,
        fireRate: cls.fireRate,
        shots: cls.shots,

        bulletSprite: desviado ? info.bullet[cls.elite ? 0 : 1] : `void/tiro/${fleet.id}_${ammo}`,
        bulletSpeed: fleet.bulletSpeed,
        bulletColor: desviado ? info.color : fleet.color,

        // Cada frota some quando a seguinte já dominou o espaço por um tempo,
        // exceto a última — senão os setores altos ficariam sem variedade.
        sectors: [from, fleet.id === 'nautolan' ? 0 : fleet.floor + 34],
        weight: cls.weight,
        blast: desviado ? info.blast : fleet.blast,
        ...(cls.elite ? { elite: true } : {}),
      });
    }
  }
  return out;
}

export const VOID_ENEMIES: readonly EnemyDef[] = build();

export const FLEET_INFO = FLEETS;

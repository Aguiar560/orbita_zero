/**
 * Mapa do pack Foozle "Void" (`new spaceships/`).
 *
 * Convenção do pack: toda animação é uma tira horizontal cuja célula é
 * QUADRADA e do tamanho da altura da imagem — `quadros = largura / altura`.
 * Isso vale para naves, motores, escudos, armas, projéteis e coletáveis, então
 * um único fatiador cobre o pack inteiro.
 */

/** Nunca guardamos mais que isto por animação; tiras longas são subamostradas. */
export const MAX_FRAMES = 12;

export const MAIN_SHIP = 'Foozle_2DS0011_Void_MainShip/Main Ship';
export const MAIN_WEAPONS = 'Foozle_2DS0011_Void_MainShip/Main ship weapons/PNGs';

/** Estados de casco do jogador, do intacto ao destroçado. */
export const HULL_STATES = [
  ['Main Ship - Base - Full health', 'cheio'],
  ['Main Ship - Base - Slight damage', 'leve'],
  ['Main Ship - Base - Damaged', 'medio'],
  ['Main Ship - Base - Very damaged', 'grave'],
];

export const ENGINE_KINDS = [
  ['Base Engine', 'base'],
  ['Big Pulse Engine', 'pulso'],
  ['Burst Engine', 'rajada'],
  ['Supercharged Engine', 'turbo'],
];

export const SHIELD_KINDS = [
  ['Front Shield', 'frontal'],
  ['Front and Side Shield', 'lateral'],
  ['Round Shield', 'redondo'],
  ['Invincibility Shield', 'invulneravel'],
];

export const WEAPON_KINDS = [
  ['Auto Cannon', 'canhao'],
  ['Big Space Gun', 'canhaozao'],
  ['Rockets', 'foguetes'],
  ['Zapper', 'zapper'],
];

export const PLAYER_PROJECTILES = [
  ['Main ship weapon - Projectile - Auto cannon bullet', 'canhao'],
  ['Main ship weapon - Projectile - Big Space Gun', 'canhaozao'],
  ['Main ship weapon - Projectile - Rocket', 'foguetes'],
  ['Main ship weapon - Projectile - Zapper', 'zapper'],
];

/**
 * As três frotas inimigas. Cada uma nomeia seus arquivos de um jeito
 * ligeiramente diferente (espaçamento, sufixos), então guardamos os padrões
 * em vez de tentar adivinhar na hora.
 */
export const FLEETS = [
  {
    id: 'klaed',
    name: "Kla'ed",
    root: "Foozle_2DS0012_Void_EnemyFleet_1/Kla'ed",
    dirs: { base: 'Base', engine: 'Engine', destruction: 'Destruction', shield: 'Shield', weapons: 'Weapons' },
    file: (cls, part) => {
      if (part === 'base') return `Kla'ed - ${cls} - Base`;
      if (part === 'engine') return `Kla'ed - ${cls} - Engine`;
      if (part === 'destruction') return `Kla'ed - ${cls} - Destruction`;
      if (part === 'shield') return `Kla'ed - ${cls} - Shield`;
      return `Kla'ed - ${cls} - Weapons`;
    },
    classes: ['Fighter', 'Scout', 'Bomber', 'Frigate', 'Torpedo Ship', 'Support ship', 'Battlecruiser', 'Dreadnought'],
    projectiles: ["Kla'ed - Bullet", "Kla'ed - Big Bullet", "Kla'ed - Ray", "Kla'ed - Torpedo", "Kla'ed - Wave"],
    projectileNames: ['bala', 'balao', 'raio', 'torpedo', 'onda'],
    projectileDir: 'Projectiles',
  },
  {
    id: 'nairan',
    name: 'Nairan',
    root: 'Foozle_2DS0013_Void_EnemyFleet_2/Nairan',
    dirs: { base: 'Designs - Base', engine: 'Engine Effects', destruction: 'Destruction', shield: 'Shields', weapons: 'Weapons' },
    file: (cls, part) => {
      if (part === 'base') return `Nairan - ${cls} - Base`;
      if (part === 'engine') return `Nairan - ${cls} - Engine`;
      // A frota Nairan tem espaçamento irregular nos arquivos de destruição.
      if (part === 'destruction') return `Nairan - ${cls} -  Destruction`;
      if (part === 'shield') return `Nairan - ${cls} - Shield`;
      return `Nairan - ${cls} - Weapons`;
    },
    classes: ['Fighter', 'Scout', 'Bomber', 'Frigate', 'Torpedo Ship', 'Support Ship', 'Battlecruiser', 'Dreadnought'],
    projectiles: ['Nairan - Bolt', 'Nairan - Ray', 'Nairan - Rocket', 'Nairan - Torpedo'],
    projectileNames: ['raio', 'feixe', 'foguete', 'torpedo'],
    projectileDir: 'Weapon Effects - Projectiles',
  },
  {
    id: 'nautolan',
    name: 'Nautolan',
    root: 'Foozle_2DS0014_Void_EnemyFleet_3/Nautolan',
    dirs: { base: 'Designs - Base', engine: 'Engine Effects', destruction: 'Destruction', shield: 'Shields', weapons: 'Weapons' },
    file: (cls, part) => {
      // O torpedeiro Nautolan é o único sem o sufixo "- Base" no arquivo.
      if (part === 'base') return cls === 'Torpedo Ship' ? 'Nautolan Ship - Torpedo Ship' : `Nautolan Ship - ${cls} - Base`;
      if (part === 'engine') return `Nautolan Ship - ${cls} - Engine Effect`;
      if (part === 'destruction') return `Nautolan Ship - ${cls}`;
      if (part === 'shield') return `Nautolan Ship - ${cls} - Shield`;
      return `Nautolan Ship - ${cls} - Weapons`;
    },
    classes: ['Fighter', 'Scout', 'Bomber', 'Frigate', 'Torpedo Ship', 'Support', 'Battlecruiser', 'Dreadnought'],
    projectiles: ['Nautolan - Bullet', 'Nautolan - Spinning Bullet', 'Nautolan - Ray', 'Nautolan - Rocket', 'Nautolan - Bomb', 'Nautolan - Wave'],
    projectileNames: ['bala', 'giro', 'raio', 'foguete', 'bomba', 'onda'],
    projectileDir: 'Weapon Effects - Projectiles',
  },
];

/** Nome curto e estável de cada classe, usado nos ids do atlas. */
export const CLASS_SLUG = {
  'Fighter': 'caca',
  'Scout': 'batedor',
  'Bomber': 'bombardeiro',
  'Frigate': 'fragata',
  'Torpedo Ship': 'torpedeiro',
  'Support ship': 'suporte',
  'Support Ship': 'suporte',
  'Support': 'suporte',
  'Battlecruiser': 'cruzador',
  'Dreadnought': 'encouracado',
};

export const PICKUPS = [
  ['Foozle_2DS0016_Void_PickupsPack/Engines/PNGs', 'Pickup Icon - Engines - Base Engine', 'motor_base'],
  ['Foozle_2DS0016_Void_PickupsPack/Engines/PNGs', 'Pickup Icon - Engines - Big Pulse Engine', 'motor_pulso'],
  ['Foozle_2DS0016_Void_PickupsPack/Engines/PNGs', 'Pickup Icon - Engines - Burst Engine', 'motor_rajada'],
  ['Foozle_2DS0016_Void_PickupsPack/Engines/PNGs', 'Pickup Icon - Engines - Supercharged Engine', 'motor_turbo'],
  ['Foozle_2DS0016_Void_PickupsPack/Shield Generators/PNGs', 'Pickup Icon - Shield Generator - All around shield', 'escudo_total'],
  ['Foozle_2DS0016_Void_PickupsPack/Shield Generators/PNGs', 'Pickup Icon - Shield Generator - Front and Side Shield', 'escudo_lateral'],
  ['Foozle_2DS0016_Void_PickupsPack/Shield Generators/PNGs', 'Pickup Icon - Shield Generator - Front Shield', 'escudo_frontal'],
  ['Foozle_2DS0016_Void_PickupsPack/Shield Generators/PNGs', 'Pickup Icon - Shield Generator - Invincibility Shield', 'escudo_invuln'],
  ['Foozle_2DS0016_Void_PickupsPack/Weapons/PNGs', 'Pickup Icon - Weapons - Auto Cannons', 'arma_canhao'],
  ['Foozle_2DS0016_Void_PickupsPack/Weapons/PNGs', 'Pickup Icon - Weapons - Big Space Gun 2000', 'arma_canhaozao'],
  ['Foozle_2DS0016_Void_PickupsPack/Weapons/PNGs', 'Pickup Icon - Weapons - Rocket', 'arma_foguete'],
  ['Foozle_2DS0016_Void_PickupsPack/Weapons/PNGs', 'Pickup Icon - Weapons - Zapper', 'arma_zapper'],
];

export const ENVIRONMENT = 'Foozle_2DS0015_Void_EnvironmentPack';

/**
 * Naves grandes soltas na raiz do pack (192px por célula). São detalhadas
 * demais para inimigos comuns — viram cascos jogáveis e chefes.
 */
export const BIG_SHIPS = [
  { dir: 'Fighter', id: 'caca', anims: ['Idle', 'Move', 'Attack_1', 'Damage', 'Destroyed'] },
  { dir: 'Bomber', id: 'bombardeiro', anims: ['Idle', 'Move', 'Attack_1', 'Damage', 'Destroyed'] },
  { dir: 'Corvette', id: 'corveta', anims: ['Idle', 'Move', 'Attack_1', 'Damage', 'Destroyed', 'Turret'] },
];

/** As naves grandes ocupam 192px por célula; poucas amostras já bastam. */
export const BIG_SHIP_FRAMES = 6;

/** Camadas panorâmicas do fundo: giradas 90° viram rolagem vertical. */
export const BACKDROPS = [
  ['Backgrounds/PNGs/Condesed/Starry background  - Layer 01 - Void', 'void'],
  ['Backgrounds/PNGs/Condesed/Starry background  - Layer 02 - Stars', 'stars'],
  ['Backgrounds/PNGs/Condesed/Starry background  - Layer 03 - Stars', 'glow'],
];

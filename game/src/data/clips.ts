import { defineClip, defineClipFrames } from '@render/Anim';
import { FLEET_INFO } from './fleets';
import { HULLS } from './hulls';

/**
 * Registra todos os clipes de animação. Precisa rodar DEPOIS de `assets.boot()`
 * porque os quadros são descobertos varrendo os atlas por prefixo.
 */
export function registerClips(): void {
  // Explosões da folha Espaço — usadas na camada vertical.
  defineClip('blast/fire', 'fx/blast_fire_', 16, false);
  defineClip('blast/void', 'fx/blast_void_', 16, false);

  // Explosões do SpaceRage — variedade para abates comuns.
  defineClip('blast/sr1', 'sr/blast/explosion_1_', 22, false);
  defineClip('blast/sr2', 'sr/blast/explosion_2_', 20, false);
  defineClip('blast/sr3', 'sr/blast/explosion_3_', 20, false);

  // Minas do SpaceRage piscam em loop.
  defineClip('mina/idle', 'sr/enemy/mine_1_', 12, true);
  defineClip('mina/idle2', 'sr/enemy/mine_2_', 10, true);

  // Escape do jogador na vertical.
  defineClip('fx/exhaust', 'sr/fx/exhaust_', 18, true);
  defineClip('fx/plasma', 'sr/fx/plasma_', 14, true);
  defineClip('fx/proton', 'sr/fx/proton_', 16, true);
  defineClip('fx/vulcan', 'sr/fx/vulcan_', 16, true);

  // Drone acompanhante / inimigo da faixa horizontal.
  defineClip('drone/idle', 'drone/idle_', 10, true);
  defineClip('drone/fly', 'drone/fly_', 12, true);
  defineClip('drone/attack', 'drone/attack_', 14, false);
  defineClip('drone/death', 'drone/death_', 16, false);
  defineClip('drone/hurt', 'drone/hurt_', 14, false);
  defineClip('drone/dodge', 'drone/dodge_', 14, false);

  // Por casco: escape, projétil, impacto e explosão da faixa horizontal.
  for (let n = 1; n <= 6; n++) {
    defineClip(`bar/exhaust${n}`, `hull/ship${n}_exhaust_idle_`, 16, true);
    defineClip(`bar/exhaustBoost${n}`, `hull/ship${n}_exhaust_boost_`, 20, true);
    defineClip(`bar/shot${n}`, `hull/shot${n}_fly_`, 18, true);
    defineClip(`bar/hit${n}`, `hull/shot${n}_hit_`, 24, false);
    defineClip(`bar/boom${n}`, `hull/boom${n}_`, 20, false);
  }

  // Cada casco jogável referencia seu clipe de escape pelo prefixo declarado.
  for (const hull of HULLS) defineClip(`hull/${hull.id}/exhaust`, hull.barExhaust, 16, true);

  // Cintilação de power-up: alterna ícone e brilho.
  defineClipFrames('powerup/rapid', ['powerup/drop_rapid'], 1, true);
  defineClipFrames('powerup/shield', ['powerup/drop_shield'], 1, true);
  defineClipFrames('powerup/damage', ['powerup/drop_damage'], 1, true);
  defineClipFrames('powerup/bounty', ['powerup/drop_bounty'], 1, true);

  // ── folhas arcade ────────────────────────────────────────────────────────
  // Coletáveis com giro próprio: cinco quadros cada.
  for (const kind of ['reparo', 'escudo', 'dano', 'cadencia', 'bonus']) {
    defineClip(`pick/${kind}`, `pick/${kind}_`, 10, true);
  }

  // Quatro paletas de explosão em anel, para variar por tipo de alvo.
  for (const tone of ['fogo', 'plasma', 'vazio', 'rubro']) {
    defineClip(`arc/boom_${tone}`, `boom/${tone}_`, 18, false);
  }

  // Minas: ociosa em loop e detonação sem loop. Os quadros são listados à mão
  // porque o prefixo `mina/a_` também casaria com `mina/a_boom_*`.
  for (const v of ['a', 'b', 'c']) {
    defineClipFrames(`arc/mina_${v}`, [0, 1, 2, 3].map((i) => `mina/${v}_${i}`), 8, true);
    defineClip(`arc/mina_${v}_boom`, `mina/${v}_boom_`, 14, false);
  }

  // Barreira do jogador: um quadro por cor, escolhido pela situação.
  defineClipFrames('arc/barreira', ['barrier/1'], 1, true);

  registerVoidClips();
}

/**
 * Registra os clipes do pack Void.
 *
 * Os ids do atlas já seguem o padrão `<prefixo>_<n>`, e `defineClip` descobre
 * os quadros varrendo por prefixo — então basta pedir cada peça pelo mesmo id
 * que os dados usam. Peças ausentes (bombardeiros não têm arma, por exemplo)
 * são ignoradas em silêncio.
 */
function registerVoidClips(): void {
  // Motor e arma do jogador.
  for (const kind of ['base', 'pulso', 'rajada', 'turbo']) {
    defineClip(`void/nave/motorfx_${kind}_idle`, `void/nave/motorfx_${kind}_idle_`, 12, true);
    defineClip(`void/nave/motorfx_${kind}_forca`, `void/nave/motorfx_${kind}_forca_`, 16, true);
  }
  for (const kind of ['canhao', 'canhaozao', 'foguetes', 'zapper']) {
    defineClip(`void/nave/arma_${kind}`, `void/nave/arma_${kind}_`, 18, true);
    defineClip(`void/tiro/${kind}`, `void/tiro/${kind}_`, 16, true);
  }
  for (const kind of ['frontal', 'lateral', 'redondo', 'invulneravel']) {
    defineClip(`void/nave/escudo_${kind}`, `void/nave/escudo_${kind}_`, 14, true);
  }

  // Frotas inimigas: motor e escudo em loop, destruição uma vez.
  for (const fleet of FLEET_INFO) {
    for (const cls of ['batedor', 'caca', 'bombardeiro', 'fragata', 'torpedeiro', 'suporte', 'cruzador', 'encouracado']) {
      const id = `void/${fleet.id}/${cls}`;
      defineClip(`${id}_motor`, `${id}_motor_`, 14, true);
      defineClip(`${id}_arma`, `${id}_arma_`, 16, true);
      defineClip(`${id}_escudo`, `${id}_escudo_`, 12, true);
      defineClip(`${id}_morte`, `${id}_morte_`, 16, false);
    }
    for (const ammo of fleet.ammo) {
      defineClip(`void/tiro/${fleet.id}_${ammo}`, `void/tiro/${fleet.id}_${ammo}_`, 14, true);
    }
  }

  // Ambiente e coletáveis do pack.
  defineClip('void/rocha/explode', 'void/rocha/explode_', 16, false);
  defineClip('void/rocha/chama', 'void/rocha/chama_', 12, true);
  defineClip('void/planeta/terra', 'void/planeta/terra_', 10, true);
  for (const id of [
    'motor_base', 'motor_pulso', 'motor_rajada', 'motor_turbo',
    'escudo_total', 'escudo_lateral', 'escudo_frontal', 'escudo_invuln',
    'arma_canhao', 'arma_canhaozao', 'arma_foguete', 'arma_zapper',
  ]) {
    defineClip(`void/coleta/${id}`, `void/coleta/${id}_`, 12, true);
  }
}

import { bus } from '@app/Bus';
import { LAB_CODE_WRITE_AVAILABLE, writeHitboxCalibration } from '@app/LabCalibrationAdmin';
import { ALL_ENEMIES, type AttackPattern, type MovePattern } from '@data/enemies';
import { ELEMENT_IDS, type ElementId } from '@sim/types';
import { HULLS, type HullHitbox } from '@data/hulls';
import { HULL_ARCHETYPES, SPACESHIPS2_HULL_SPECS } from '@data/hulls-spaceships2';
import { getElement } from '@data/elements';
import { BOSSES } from '@data/bosses';
import { PLAYER_SCALE_CALIBRATIONS, calibratedEnemyScale } from '@data/hitbox-calibrations';
import {
  SPACESHIPS2_BOSS_ART, SPACESHIPS2_ENEMY_ART,
} from '@data/spaceships2';
import type { Sim } from '@sim/index';
import { LAB_SCENARIOS, labScenario, type LaboratorioConfig, type LabControl } from '@sim/laboratorio';
import { h, spriteIcon } from '../dom';
import type { Panel } from './types';

const MOVES: readonly MovePattern[] = ['mergulho', 'senoide', 'pairar', 'deriva', 'investida', 'orbita'];
const ATTACKS: readonly AttackPattern[] = ['nenhum', 'direto', 'mirado', 'leque', 'espiral', 'teleguiado', 'explosivo'];
const CONTROLS: readonly { id: LabControl; label: string }[] = [
  { id: 'manual', label: 'Manual (WASD/setas)' }, { id: 'agressivo', label: 'IA agressiva' },
  { id: 'evasivo', label: 'IA evasiva' },
  { id: 'coletor', label: 'IA coletora' },
];

interface ShipVisualOption {
  id: string;
  label: string;
  sprite: string;
  scale: number;
  hullId?: string;
  enemySourceId?: string;
  enemyHitboxKey?: string;
  defaultHitbox?: HullHitbox;
  calibrated?: boolean;
}

const uniqueSprites = (options: readonly ShipVisualOption[]): ShipVisualOption[] => {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.sprite)) return false;
    seen.add(option.sprite);
    return true;
  });
};

const rawVisual = (art: { id: string; name: string; sprite: string; scale: number }): ShipVisualOption => ({
  id: art.id, label: art.name, sprite: art.sprite, scale: art.scale,
});

// Hitbox é por CASCO, não por sprite. Mesmo cascos que compartilham a mesma
// base visual precisam aparecer separadamente para receber ajuste próprio.
const PLAYER_VISUALS: readonly ShipVisualOption[] = HULLS.map((hull) => ({
    id: `hull_${hull.id}`, label: hull.name, sprite: hull.sprite,
    scale: PLAYER_SCALE_CALIBRATIONS[hull.id] ?? (hull.damageStates ? 1.5 : (hull.scale ?? 0.62)),
    hullId: hull.id,
  }));

// Para editar colisão, cada ficha implementada precisa aparecer, mesmo quando
// duas fichas reutilizam a mesma arte. As artes ainda sem ficha entram ao fim
// apenas como sandbox e não podem ser salvas na campanha.
const IMPLEMENTED_ENEMY_VISUALS: ShipVisualOption[] = [
  ...ALL_ENEMIES.map((enemy) => ({
    id: `enemy_${enemy.id}`, label: enemy.name, sprite: enemy.sprite, scale: calibratedEnemyScale(`enemy:${enemy.id}`) ?? enemy.scale,
    enemySourceId: enemy.id, enemyHitboxKey: `enemy:${enemy.id}`,
    defaultHitbox: { width: enemy.radius * enemy.scale * 2, height: enemy.radius * enemy.scale * 2, offsetX: 0, offsetY: 0 },
  })),
  ...BOSSES.map((boss) => ({
    id: `boss_${boss.id}`, label: `Chefe · ${boss.name}`, sprite: boss.sprite, scale: calibratedEnemyScale(`boss:${boss.id}`) ?? boss.scale,
    enemyHitboxKey: `boss:${boss.id}`,
    defaultHitbox: { width: boss.radius * boss.scale * 2, height: boss.radius * boss.scale * 2, offsetX: 0, offsetY: 0 },
  })),
];
const IMPLEMENTED_ENEMY_SPRITES = new Set(IMPLEMENTED_ENEMY_VISUALS.map((entry) => entry.sprite));
const EXTRA_ENEMY_VISUALS = uniqueSprites([
  ...SPACESHIPS2_ENEMY_ART.map(rawVisual), ...SPACESHIPS2_BOSS_ART.map(rawVisual),
]).filter((entry) => !IMPLEMENTED_ENEMY_SPRITES.has(entry.sprite))
  .map((entry) => ({ ...entry, defaultHitbox: { width: 30, height: 30, offsetX: 0, offsetY: 0 } }));
const ENEMY_VISUALS: readonly ShipVisualOption[] = [...IMPLEMENTED_ENEMY_VISUALS, ...EXTRA_ENEMY_VISUALS];

const CONFRONTOS = HULL_ARCHETYPES.map((archetype) => {
  const spec = SPACESHIPS2_HULL_SPECS.find((entry) => entry.archetype === archetype.id)!;
  const hull = HULLS.find((entry) => entry.id === spec.id)!;
  return { id: hull.id, label: archetype.name, name: hull.name, sprite: hull.sprite };
});

export class LaboratorioPanel implements Panel {
  id = 'laboratorio';
  title = 'Laboratório';
  icon = 'aba/melhorias';
  iconUrl = '/assets/ui/menu/laboratorio.webp';
  overlay = true;
  badge(sim: Sim): number { return sim.laboratorio.active ? 1 : 0; }

  render(sim: Sim): HTMLElement {
    const c = sim.laboratorio.config;
    const patch = <K extends keyof LaboratorioConfig>(key: K, value: LaboratorioConfig[K]) =>
      sim.atualizarLaboratorio({ [key]: value });

    const section = (title: string, desc: string, ...controls: HTMLElement[]) =>
      h('section.lab-card', {}, h('h3', { text: title }), h('p.muted.tiny', { text: desc }), h('.lab-fields', {}, ...controls));

    const playerVisuals = PLAYER_VISUALS.map((option) => ({
      ...option, calibrated: !!option.hullId && sim.cascoTemHitboxCalibrada(option.hullId),
    }));
    const visiblePlayerVisuals = c.playerOnlyUncalibrated
      ? playerVisuals.filter((option) => option.hullId === c.playerHullId || !option.calibrated)
      : playerVisuals;
    const enemyVisuals = ENEMY_VISUALS.map((option) => ({
      ...option, calibrated: !!option.enemyHitboxKey && sim.inimigoTemHitboxCalibrada(option.enemyHitboxKey),
    }));
    const visibleEnemyVisuals = c.enemyOnlyUncalibrated
      ? enemyVisuals.filter((option) => option.enemyHitboxKey === c.enemyHitboxKey
        || (!c.enemyHitboxKey && option.sprite === c.enemySprite)
        || (!!option.enemyHitboxKey && !option.calibrated))
      : enemyVisuals;

    return h('.panel-body.lab', {},
      h('.lab-warning', {},
        h('strong', { text: 'SANDBOX ISOLADO' }),
        h('span', { text: 'Não altera o save, não avança setores e não concede XP, recursos, itens ou missões.' }),
      ),
      h('.lab-grid', {},
        h('section.lab-card.lab-span-full', {},
          h('h3', { text: 'Confrontos padronizados' }),
          h('p.muted.tiny', { text: 'Protocolos reproduzíveis com a ficha real do casco, IA equilibrada, velocidade 8× e três sementes oficiais.' }),
          h('.lab-preset-strip', {}, ...LAB_SCENARIOS.map((scenario) => h(`button.lab-preset${c.scenario === scenario.id ? '.active' : ''}`, {
            type: 'button', title: scenario.description,
            onclick: () => sim.carregarCenarioLaboratorio(scenario.id),
          }, h('span', {}, h('strong', { text: scenario.name }), h('small', { text: `${scenario.duration}s · ${scenario.config.enemyCount} alvo(s)` }))))),
          h('.lab-preset-strip', {}, ...CONFRONTOS.map((preset) => h(`button.lab-preset${c.playerHullId === preset.id ? '.active' : ''}`, {
            type: 'button',
            onclick: () => { sim.carregarCascoNoLaboratorio(preset.id); sim.carregarCenarioLaboratorio(c.scenario); },
            title: `${preset.label} · ${preset.name}`,
          }, spriteIcon(preset.sprite, 48), h('span', {}, h('strong', { text: preset.label }), h('small', { text: preset.name }))))),
          h('.lab-preset-strip', {}, ...labScenario(c.scenario).seeds.map((seed) => h(`button.lab-preset${c.seed === seed ? '.active' : ''}`, {
            type: 'button', onclick: () => patch('seed', seed),
          }, h('span', {}, h('strong', { text: `SEMENTE ${seed}` }), h('small', { text: 'Execução reproduzível' }))))),
          h('.lab-help', { text: labScenario(c.scenario).description }),
        ),
        section('Cenário', 'Escolha livremente os dois lados do confronto.',
          toggleField('Somente cascos não calibrados', c.playerOnlyUncalibrated, (v) => patch('playerOnlyUncalibrated', v)),
          shipPicker('Nave do jogador', c.playerSprite, visiblePlayerVisuals, (option) => {
            const box = option.hullId ? sim.hitboxDoCasco(option.hullId) : sim.hitboxDoCasco(c.playerHullId);
            sim.atualizarLaboratorio({
              playerHullId: option.hullId ?? c.playerHullId,
              playerSprite: option.sprite,
              playerSpriteScale: option.scale,
              playerHitboxWidth: box.width,
              playerHitboxHeight: box.height,
              playerHitboxOffsetX: box.offsetX,
              playerHitboxOffsetY: box.offsetY,
              hitboxTarget: 'player',
              showHitboxes: true,
            });
          }, `hull_${c.playerHullId}`, PLAYER_VISUALS.length),
          numberField('Escala da nave do jogador', c.playerSpriteScale, .05, 4, .05, (v) => patch('playerSpriteScale', v)),
          toggleField('Somente fichas inimigas não calibradas', c.enemyOnlyUncalibrated, (v) => patch('enemyOnlyUncalibrated', v)),
          shipPicker('Nave inimiga', c.enemySprite, visibleEnemyVisuals, (option) => {
            const key = option.enemyHitboxKey ?? '';
            const box = (key ? sim.hitboxSalvaDoInimigo(key) : undefined)
              ?? option.defaultHitbox
              ?? { width: 30, height: 30, offsetX: 0, offsetY: 0 };
            sim.atualizarLaboratorio({
              enemyId: option.enemySourceId ?? c.enemyId,
              enemySprite: option.sprite,
              enemySpriteScale: option.scale,
              enemyHitboxKey: key,
              enemyHitboxWidth: box.width,
              enemyHitboxHeight: box.height,
              enemyHitboxOffsetX: box.offsetX,
              enemyHitboxOffsetY: box.offsetY,
              hitboxTarget: 'enemy',
              showHitboxes: true,
            });
          }, c.enemyHitboxKey ? c.enemyHitboxKey.replace(':', '_') : undefined, ENEMY_VISUALS.length),
          numberField('Escala da nave inimiga', c.enemySpriteScale, .05, 4, .05, (v) => patch('enemySpriteScale', v)),
          numberField('Quantidade inimiga', c.enemyCount, 1, 30, 1, (v) => patch('enemyCount', v)),
          toggleField('Repor inimigos abatidos', c.autoRespawn, (v) => patch('autoRespawn', v)),
        ),
        section('Pilotagem', 'Controle você mesmo ou compare as políticas reais de IA.',
          selectField('Controle', c.control, CONTROLS.map((x) => [x.id, x.label]), (v) => patch('control', v as LabControl)),
          toggleField('Disparo automático', c.autoFire, (v) => patch('autoFire', v)),
          toggleField('Nave indestrutível', c.immortal, (v) => patch('immortal', v)),
          numberField('Velocidade da nave', c.playerSpeed, 40, 1500, 10, (v) => patch('playerSpeed', v)),
          numberField('Habilidade da IA (0–1)', c.playerAiSkill, 0, 1, .05, (v) => patch('playerAiSkill', v)),
        ),
        section('Dano do jogador', 'A fração elemental converte parte do dano base no elemento escolhido.',
          elementField('Elemento do tiro', c.playerElement, (v) => patch('playerElement', v)),
          elementField('Elemento defensivo', c.defenseElement, (v) => patch('defenseElement', v)),
          numberField('Dano por projétil', c.playerDamage, .1, 1e9, 1, (v) => patch('playerDamage', v)),
          numberField('Fração elemental (0–1)', c.elementalFraction, 0, 1, .05, (v) => patch('elementalFraction', v)),
          numberField('Chance crítica (0–1)', c.playerCritChance, 0, 1, .05, (v) => patch('playerCritChance', v)),
          numberField('Bônus crítico', c.playerCritDamage, 0, 20, .1, (v) => patch('playerCritDamage', v)),
          numberField('Penetração (0–1)', c.playerPenetration, 0, 1, .05, (v) => patch('playerPenetration', v)),
        ),
        section('Tiro do jogador', 'Cadência, leque, perfuração, área e velocidade usam o sistema real de projéteis.',
          visualPicker('Visual do tiro', c.playerShotHullId, HULLS.map((x) => ({ id: x.id, label: x.name, sprite: x.shot.sprite })), (v) => patch('playerShotHullId', v)),
          numberField('Disparos por segundo', c.playerFireRate, .1, 60, .1, (v) => patch('playerFireRate', v)),
          numberField('Projéteis por salva', c.playerShots, 1, 24, 1, (v) => patch('playerShots', v)),
          numberField('Velocidade do projétil', c.playerBulletSpeed, 40, 2400, 20, (v) => patch('playerBulletSpeed', v)),
          numberField('Abertura do leque', c.playerSpread, 0, 1.5, .01, (v) => patch('playerSpread', v)),
          numberField('Perfuração', c.playerPierce, 0, 30, 1, (v) => patch('playerPierce', v)),
          numberField('Raio da explosão', c.playerSplash, 0, 600, 10, (v) => patch('playerSplash', v)),
        ),
        section('Sobrevivência', 'Casco, escudo e regeneração independentes do equipamento salvo.',
          numberField('Vida', c.playerHp, 1, 1e9, 10, (v) => patch('playerHp', v)),
          numberField('Escudo', c.playerShield, 0, 1e9, 10, (v) => patch('playerShield', v)),
          numberField('Regeneração/s', c.playerRegen, 0, 1e8, 1, (v) => patch('playerRegen', v)),
        ),
        section('Comportamento inimigo', 'Misture qualquer sprite com qualquer movimento e padrão de ataque.',
          selectField('Movimento', c.enemyMove, MOVES.map((x) => [x, x]), (v) => patch('enemyMove', v as MovePattern)),
          selectField('Ataque', c.enemyAttack, ATTACKS.map((x) => [x, x]), (v) => patch('enemyAttack', v as AttackPattern)),
          elementField('Elemento', c.enemyElement, (v) => patch('enemyElement', v)),
          numberField('Velocidade', c.enemySpeed, 0, 1500, 10, (v) => patch('enemySpeed', v)),
          numberField('Vida por inimigo', c.enemyHp, 1, 1e12, 10, (v) => patch('enemyHp', v)),
        ),
        section('Tiro inimigo', 'Controle a pressão e a composição do dano recebido.',
          visualPicker('Visual do tiro', c.enemyShotEnemyId, ALL_ENEMIES.map((x) => ({ id: x.id, label: x.name, sprite: x.bulletSprite })), (v) => patch('enemyShotEnemyId', v)),
          numberField('Dano por projétil', c.enemyDamage, 0, 1e9, 1, (v) => patch('enemyDamage', v)),
          numberField('Fração elemental (0–1)', c.enemyElementalFraction, 0, 1, .05, (v) => patch('enemyElementalFraction', v)),
          numberField('Salvas por segundo', c.enemyFireRate, 0, 60, .1, (v) => patch('enemyFireRate', v)),
          numberField('Projéteis por salva', c.enemyShots, 0, 48, 1, (v) => patch('enemyShots', v)),
          numberField('Velocidade do projétil', c.enemyBulletSpeed, 20, 2000, 20, (v) => patch('enemyBulletSpeed', v)),
        ),
        section('Simulação e depuração', 'Ferramentas para observar colisões e comportamentos difíceis de reproduzir.',
          selectField('Velocidade', String(c.speed), [1, 2, 4, 8].map((x) => [String(x), `${x}×`]), (v) => patch('speed', Number(v))),
          toggleField('Mostrar escudo da nave', c.showPlayerShieldVisual, (v) => patch('showPlayerShieldVisual', v)),
          toggleField('Mostrar hitboxes', c.showHitboxes, (v) => patch('showHitboxes', v)),
          selectField('Controles rápidos da hitbox', c.hitboxTarget, [['player', 'Nave do jogador'], ['enemy', 'Nave inimiga']], (v) => patch('hitboxTarget', v as 'player' | 'enemy')),
          h('.lab-help', { text: 'Manual: WASD ou setas · Espaço: atirar · Shift: dash' }),
        ),
        section('Hitbox do casco', 'A caixa verde é a colisão real. O ponto verde é o centro da caixa; a cruz branca é o centro da arte.',
          numberField('Largura', c.playerHitboxWidth, 6, 220, 1, (v) => sim.atualizarLaboratorio({ playerHitboxWidth: v, hitboxTarget: 'player', showHitboxes: true })),
          numberField('Altura', c.playerHitboxHeight, 6, 260, 1, (v) => sim.atualizarLaboratorio({ playerHitboxHeight: v, hitboxTarget: 'player', showHitboxes: true })),
          numberField('Deslocamento X', c.playerHitboxOffsetX, -100, 100, 1, (v) => sim.atualizarLaboratorio({ playerHitboxOffsetX: v, hitboxTarget: 'player', showHitboxes: true })),
          numberField('Deslocamento Y', c.playerHitboxOffsetY, -120, 120, 1, (v) => sim.atualizarLaboratorio({ playerHitboxOffsetY: v, hitboxTarget: 'player', showHitboxes: true })),
          h('.lab-hitbox-status', {
            text: sim.cascoTemHitboxCalibrada(c.playerHullId)
              ? 'CALIBRADA NO CÓDIGO — ATIVA PARA TODOS OS SAVES'
              : 'AINDA NÃO CALIBRADA — USANDO O PADRÃO DO CASCO',
          }),
          h('.lab-inline-actions', {},
            h('button.btn', {
              disabled: !LAB_CODE_WRITE_AVAILABLE || !sim.cascoTemHitboxCalibrada(c.playerHullId),
              onclick: () => void writeHitboxCalibration('restore', 'player', c.playerHullId),
            }, h('span', { text: 'REMOVER CALIBRAÇÃO' })),
            h('button.btn.primary', {
              disabled: !LAB_CODE_WRITE_AVAILABLE,
              onclick: () => void writeHitboxCalibration('save', 'player', c.playerHullId, {
                width: c.playerHitboxWidth, height: c.playerHitboxHeight,
                offsetX: c.playerHitboxOffsetX, offsetY: c.playerHitboxOffsetY,
              }, c.playerSpriteScale),
            }, h('span', { text: 'GRAVAR NO CÓDIGO' })),
          ),
        ),
        section('Hitbox do inimigo', 'A caixa vermelha é a colisão real de todos os inimigos selecionados. Salvar aplica a ficha na campanha.',
          numberField('Largura', c.enemyHitboxWidth, 6, 220, 1, (v) => sim.atualizarLaboratorio({ enemyHitboxWidth: v, hitboxTarget: 'enemy', showHitboxes: true })),
          numberField('Altura', c.enemyHitboxHeight, 6, 260, 1, (v) => sim.atualizarLaboratorio({ enemyHitboxHeight: v, hitboxTarget: 'enemy', showHitboxes: true })),
          numberField('Deslocamento X', c.enemyHitboxOffsetX, -100, 100, 1, (v) => sim.atualizarLaboratorio({ enemyHitboxOffsetX: v, hitboxTarget: 'enemy', showHitboxes: true })),
          numberField('Deslocamento Y', c.enemyHitboxOffsetY, -120, 120, 1, (v) => sim.atualizarLaboratorio({ enemyHitboxOffsetY: v, hitboxTarget: 'enemy', showHitboxes: true })),
          h('.lab-hitbox-status', {
            text: !c.enemyHitboxKey
              ? 'ARTE SEM FICHA — AJUSTE DISPONÍVEL SÓ NO SANDBOX'
              : sim.inimigoTemHitboxCalibrada(c.enemyHitboxKey)
                ? 'CALIBRADA NO CÓDIGO — ATIVA PARA TODOS OS SAVES'
                : 'AINDA NÃO CALIBRADA — USANDO O PADRÃO DA FICHA',
          }),
          h('.lab-inline-actions', {},
            h('button.btn', {
              disabled: !LAB_CODE_WRITE_AVAILABLE || !c.enemyHitboxKey || !sim.inimigoTemHitboxCalibrada(c.enemyHitboxKey),
              onclick: () => {
                const [kind, id] = c.enemyHitboxKey.split(':') as ['enemy' | 'boss', string];
                void writeHitboxCalibration('restore', kind, id);
              },
            }, h('span', { text: 'REMOVER CALIBRAÇÃO' })),
            h('button.btn.primary', {
              disabled: !LAB_CODE_WRITE_AVAILABLE || !c.enemyHitboxKey,
              onclick: () => {
                const [kind, id] = c.enemyHitboxKey.split(':') as ['enemy' | 'boss', string];
                void writeHitboxCalibration('save', kind, id, {
                  width: c.enemyHitboxWidth, height: c.enemyHitboxHeight,
                  offsetX: c.enemyHitboxOffsetX, offsetY: c.enemyHitboxOffsetY,
                }, c.enemySpriteScale);
              },
            }, h('span', { text: 'GRAVAR NO CÓDIGO' })),
          ),
        ),
      ),
      h('.lab-actions', {},
        h('button.btn', { onclick: () => sim.atualizarLaboratorio({}) }, h('span', { text: 'VALIDAR VALORES' })),
        h('button.btn.primary.big', {
          onclick: () => { sim.iniciarLaboratorio(); bus.emit('panel:close'); },
        }, h('span', { text: sim.laboratorio.active ? 'APLICAR E REINICIAR TESTE' : 'ENTRAR NO LABORATÓRIO' })),
      ),
    );
  }
}

function selectField(label: string, value: string, options: readonly (readonly [string, string])[], onChange: (v: string) => void): HTMLElement {
  return h('label.lab-field', {}, h('span', { text: label }), h('select.select', {
    onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value),
  }, ...options.map(([id, text]) => h('option', { value: id, text, selected: value === id }))));
}

function numberField(label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, disabled = false): HTMLElement {
  return h('label.lab-field', {}, h('span', { text: label }), h('input.lab-input', {
    type: 'number', value: String(value), min: String(min), max: String(max), step: String(step), disabled,
    onchange: (e: Event) => onChange(Number((e.target as HTMLInputElement).value)),
  }));
}

function toggleField(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
  return h('label.lab-toggle', {}, h('span', { text: label }), h('input', {
    type: 'checkbox', checked: value,
    onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked),
  }));
}

function elementField(label: string, value: ElementId, onChange: (v: ElementId) => void): HTMLElement {
  return selectField(label, value, ELEMENT_IDS.map((id) => [id, getElement(id).name]), (v) => onChange(v as ElementId));
}

function visualPicker(
  label: string,
  value: string,
  options: readonly { id: string; label: string; sprite: string }[],
  onChange: (v: string) => void,
): HTMLElement {
  return h('.lab-visual-field', {},
    h('span', { text: label }),
    h('.lab-visual-strip', {}, ...options.map((option) => h(`button.lab-visual${option.id === value ? '.active' : ''}`, {
      type: 'button', title: option.label, onclick: () => onChange(option.id),
    }, spriteIcon(option.sprite, 44), h('small', { text: option.label })) )),
  );
}

function shipPicker(
  label: string,
  value: string,
  options: readonly ShipVisualOption[],
  onChange: (option: ShipVisualOption) => void,
  selectedId?: string,
  totalCount = options.length,
): HTMLElement {
  const selected = (selectedId ? options.find((option) => option.id === selectedId) : undefined)
    ?? options.find((option) => option.sprite === value)
    ?? options[0];
  const isSelected = (option: ShipVisualOption) => option === selected;
  const cards = options.map((option) => h(`button.lab-visual${isSelected(option) ? '.active' : ''}${option.calibrated ? '.calibrated' : ''}`, {
    type: 'button', title: option.label, onclick: () => onChange(option),
  }, option.calibrated ? h('b.lab-visual-check', { text: '✓', title: 'Calibrada no código' }) : null,
  spriteIcon(option.sprite, 44), h('small', { text: option.label })));
  const activeCard = cards[options.findIndex(isSelected)];
  const strip = h('.lab-visual-strip', {}, ...cards);

  // O carrossel é recriado quando o painel abre ou uma escolha muda. Depois
  // que ele entra no DOM, centraliza o cartão ativo em vez de voltar à origem.
  queueMicrotask(() => {
    if (!strip.isConnected || !activeCard) return;
    const stripRect = strip.getBoundingClientRect();
    const cardRect = activeCard.getBoundingClientRect();
    strip.scrollLeft += cardRect.left - stripRect.left - (stripRect.width - cardRect.width) / 2;
  });

  return h('.lab-visual-field', {},
    h('span', { text: `${label} · ${options.length}${options.length !== totalCount ? ` de ${totalCount}` : ''} opções` }),
    ...(selected ? [h('.lab-visual-selected', { title: selected.label },
      h('.lab-visual-selected-art', {}, spriteIcon(selected.sprite, 62)),
      h('.lab-visual-selected-copy', {},
        h('small', { text: 'SELECIONADA' }),
        h('strong', { text: selected.label }),
        h('span', { text: selected.calibrated
          ? 'CALIBRADA NO CÓDIGO'
          : selected.hullId || selected.enemyHitboxKey ? 'AINDA NÃO CALIBRADA' : 'ARTE SEM FICHA' }),
      ),
    )] : []),
    strip,
  );
}

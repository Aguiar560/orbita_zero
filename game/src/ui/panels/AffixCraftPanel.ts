import { fmt } from '@core/format';
import { tipoDoAfixo, AFFIXES, type TipoDeAfixo } from '@data/items';
import {
  OPERACOES_DE_MODULACAO, type OperacaoDeModulacaoId,
} from '@data/balance/modulacao';
import { RECURSO_POR_ID, iconeDeRecurso } from '@data/recursos';
import { RARITIES, rarityInfo } from '@data/rarity';
import { affixText, itemName, recalibrationCandidates } from '@sim/loot';
import type { Affix, Item, Rarity } from '@sim/types';
import type { Sim } from '@sim/index';
import { h, spriteIcon } from '../dom';
import { RESOURCE_META } from '../recursos';
import type { Panel } from './types';

const WORKBENCH_ART = '/assets/ui/craft/modulacao/craft_bancada_recalibracao.webp';

interface CraftResult {
  uid: string;
  before: Affix[];
  after: Affix[];
  operation: string;
}

/**
 * Bancada de Modulação.
 *
 * O princípio vem do craft por moeda de ARPGs: o item permanece no centro, a
 * operação declara exatamente o que preserva e o resultado continua aleatório.
 * Não imita a interface de outro jogo; traduz a decisão para a gramática visual
 * industrial já usada em Provação, Baús e Loja.
 */
export class AffixCraftPanel implements Panel {
  id = 'afixos';
  title = 'Afixos';
  icon = 'cat/reator';
  iconUrl = '/assets/ui/menu/afixos.webp';
  overlay = true;

  private selectedUid: string | null = null;
  private selectedAffix = 0;
  private selectedOperation: OperacaoDeModulacaoId = 'remoldar';
  private filter: Rarity | -1 = -1;
  private feedback = 'SELECIONE UM ITEM E UMA LINHA';
  private result: CraftResult | null = null;

  render(sim: Sim): HTMLElement {
    const item = this.selectedItem(sim);
    const current = item?.affixes[this.selectedAffix] ?? null;

    return h('.panel-body.afx', {},
      this.header(sim),
      h('.afx-body', {},
        this.inventory(sim),
        this.workbench(sim, item),
        this.operation(sim, item, current),
      ),
      h('.afx-footer', {},
        h('span', { text: 'DEZ ESSÊNCIAS · DEZ OPERAÇÕES · NENHUMA ALTERA A BASE DO ITEM.' }),
        h('strong', { text: this.feedback }),
      ),
    );
  }

  private header(sim: Sim): HTMLElement {
    return h('.afx-header', {},
      h('.afx-title', {},
        h('img.afx-title-art', { src: WORKBENCH_ART, alt: '', 'aria-hidden': true, draggable: false }),
        h('span', {},
          h('h1', { text: 'BANCADA DE MODULAÇÃO' }),
          h('small', { text: 'Engenharia de Prefixos e Sufixos' }),
        ),
      ),
      h('.afx-balance', {},
        spriteIcon(RESOURCE_META.nucleo.icon, 28),
        h('span', {}, h('small', { text: 'NÚCLEOS DISPONÍVEIS' }), h('strong', { text: fmt(sim.state.resources.nucleo) })),
      ),
    );
  }

  private inventory(sim: Sim): HTMLElement {
    const items = [...sim.state.inventory]
      .filter((item) => this.filter < 0 || item.rarity === this.filter)
      .sort((a, b) => b.rarity - a.rarity || b.ilvl - a.ilvl);

    return h('.afx-panel.afx-inventory', {},
      section('INVENTÁRIO ELEGÍVEL'),
      h('.afx-count', {}, h('span', { text: 'CARGA' }), h('strong', { text: `${sim.state.inventory.length} / ${sim.cargoSlots}` })),
      h('.afx-filters', {},
        this.filterButton(sim, -1, 'TODOS', '#8fa7b6'),
        ...RARITIES.map((rarity) => this.filterButton(sim, rarity.id, rarity.name.slice(0, 3).toUpperCase(), rarity.color)),
      ),
      h('.afx-item-list', {},
        ...items.map((item) => this.inventoryItem(sim, item)),
        ...(items.length ? [] : [h('.afx-empty', {}, h('strong', { text: 'SEM ITENS' }), h('span', { text: 'Altere o filtro ou libere espaço no inventário.' }))]),
      ),
    );
  }

  private filterButton(sim: Sim, id: Rarity | -1, label: string, color: string): HTMLElement {
    const active = this.filter === id;
    return h(`button.afx-filter${active ? '.active' : ''}`, {
      text: label,
      title: id < 0 ? 'Todas as raridades' : RARITIES[id]?.name,
      style: { '--afx-rarity': color } as Partial<CSSStyleDeclaration>,
      onclick: () => { this.filter = id; sim.touch(); },
    });
  }

  private inventoryItem(sim: Sim, item: Item): HTMLElement {
    const info = rarityInfo(item.rarity);
    const counts = countTypes(item);
    const active = item.uid === this.selectedUid;
    return h(`button.afx-item${active ? '.active' : ''}`, {
      style: { '--afx-rarity': info.color } as Partial<CSSStyleDeclaration>,
      title: itemName(item),
      onclick: () => {
        this.selectedUid = item.uid;
        this.selectedAffix = 0;
        this.result = null;
        this.feedback = `${itemName(item).toUpperCase()} NA BANCADA`;
        sim.touch();
      },
    },
      h('.afx-item-icon', {}, spriteIcon(item.icon, 42)),
      h('.afx-item-copy', {},
        h('strong', { text: itemName(item) }),
        h('span', { text: `${info.name} · NV ${item.ilvl}` }),
      ),
      h('.afx-item-mods', {},
        h('span.prefix', { text: `P ${counts.prefixo}` }),
        h('span.suffix', { text: `S ${counts.sufixo}` }),
      ),
    );
  }

  private workbench(sim: Sim, item: Item | null): HTMLElement {
    return h('.afx-panel.afx-workbench', {},
      section('ITEM NA BANCADA'),
      item ? this.itemFocus(item) : this.noItem(),
      item ? h('.afx-mod-board', {},
        this.modGroup(sim, item, 'prefixo'),
        this.modGroup(sim, item, 'sufixo'),
      ) : null,
      item && this.result?.uid === item.uid ? this.resultView() : null,
    );
  }

  private itemFocus(item: Item): HTMLElement {
    const info = rarityInfo(item.rarity);
    return h('.afx-item-focus', { style: { '--afx-rarity': info.color } as Partial<CSSStyleDeclaration> },
      h('.afx-focus-icon', {}, spriteIcon(item.icon, 92)),
      h('.afx-focus-copy', {},
        h('span', { text: `${info.name.toUpperCase()} · NÍVEL DO ITEM ${item.ilvl}` }),
        h('h2', { text: itemName(item), style: { color: info.color } }),
        h('p', { text: 'Escolha uma linha. A bancada preserva a estrutura do item e sorteia outra identidade compatível.' }),
      ),
      item.favorite ? h('.afx-favorite', { text: '★ FAVORITO' }) : null,
    );
  }

  private modGroup(sim: Sim, item: Item, tipo: TipoDeAfixo): HTMLElement {
    const lines = item.affixes
      .map((affix, index) => ({ affix, index, def: AFFIXES.find((candidate) => candidate.id === affix.id) }))
      .filter((entry) => entry.def && tipoDoAfixo(entry.def) === tipo);
    const title = tipo === 'prefixo' ? 'PREFIXOS · OFENSIVA' : 'SUFIXOS · DEFESA E UTILIDADE';

    return h(`.afx-mod-group.${tipo}`, {},
      h('.afx-mod-title', {}, h('span', { text: tipo === 'prefixo' ? 'P' : 'S' }), h('strong', { text: title }), h('small', { text: `${lines.length} LINHAS` })),
      h('.afx-mod-lines', {}, ...lines.map(({ affix, index }) => {
        const active = index === this.selectedAffix;
        return h(`button.afx-mod${active ? '.active' : ''}`, {
          onclick: () => {
            this.selectedAffix = index;
            this.result = null;
            this.feedback = `${tipo.toUpperCase()} T${affix.tier ?? 1} SELECIONADO`;
            sim.touch();
          },
        },
          h('b', { text: `T${affix.tier ?? 1}` }),
          h('strong', { text: affixText(affix) }),
          h('small', { text: affix.locked ? '◈ ANCORADO' : active ? 'ALVO DA OPERAÇÃO' : 'SELECIONAR' }),
        );
      })),
    );
  }

  private operation(sim: Sim, item: Item | null, current: Affix | null): HTMLElement {
    const operation = OPERACOES_DE_MODULACAO.find((o) => o.id === this.selectedOperation)!;
    const candidates = item && current ? recalibrationCandidates(item, this.selectedAffix) : [];
    const def = current ? AFFIXES.find((candidate) => candidate.id === current.id) : null;
    const tipo = def ? tipoDoAfixo(def) : null;
    const cost = item ? sim.modulationCost(item.uid, operation.id) : null;
    const essence = RECURSO_POR_ID.get(operation.essencia);
    const can = !!item && !!cost
      && sim.can('nucleo', cost.nucleos)
      && sim.materialDisponivel(cost.essencia) >= cost.quantidade
      && this.operationAllowed(item, current, candidates.length);

    return h('.afx-panel.afx-operation', {},
      section('PROTOCOLO DE CRAFT'),
      h('.afx-operation-scroll', {},
        h('.afx-protocol-grid', {}, ...OPERACOES_DE_MODULACAO.map((entry) => {
          const resource = RECURSO_POR_ID.get(entry.essencia);
          return h(`button.afx-protocol${entry.id === operation.id ? '.active' : ''}`, {
            title: `${entry.nome} · ${resource?.nome ?? entry.essencia}`,
            onclick: () => { this.selectedOperation = entry.id; this.result = null; sim.touch(); },
          },
            resource ? spriteIcon(iconeDeRecurso(resource), 26) : h('span', { text: '◇' }),
            h('span', { text: entry.nome }),
          );
        })),
        h('.afx-operation-art', {},
          h('img', { src: WORKBENCH_ART, alt: '', 'aria-hidden': true, draggable: false }),
          h('span', { text: operation.nome.toUpperCase() }),
        ),
        h('.afx-target', {},
          h('small', { text: 'ALVO ATUAL' }),
          current
            ? h('strong', { text: `${tipo === 'prefixo' ? 'PREFIXO' : 'SUFIXO'} · T${current.tier ?? 1}${current.locked ? ' · ANCORADO' : ''}` })
            : h('strong', { text: operation.exigeLinha ? 'NENHUMA LINHA' : 'ITEM INTEIRO' }),
          h('span', { text: operation.exigeLinha
            ? current ? affixText(current) : 'Selecione um item e uma linha.'
            : operation.descricao }),
        ),
        h('.afx-rules', {},
          rule('ESSÊNCIA', essence?.nome ?? operation.essencia),
          rule('PRESERVA', operation.preserva),
          rule('ALVO', operation.exigeLinha ? 'Linha selecionada' : 'Item inteiro'),
          rule('ESTADO', this.operationAllowed(item, current, candidates.length) ? 'Operação aplicável' : 'Prepare o item'),
        ),
        operation.id === 'remoldar' ? h('.afx-pool', {},
          h('.afx-pool-head', {}, h('span', { text: 'POOL POSSÍVEL' }), h('strong', { text: `${candidates.length}` })),
          h('.afx-pool-list', {}, ...candidates.slice(0, 6).map((candidate) => h('span', {
            text: `${candidate.kind === 'mul' ? '%' : '+'} ${candidate.label}`,
          }))),
          candidates.length > 6 ? h('small', { text: `+ ${candidates.length - 6} outras identidades` }) : null,
        ) : null,
        h('.afx-warning', {},
          h('strong', { text: operation.verbo }),
          h('span', { text: operation.descricao }),
        ),
      ),
      h('.afx-operation-actions', {},
        h('.afx-cost', {},
          h('span', {}, spriteIcon(RESOURCE_META.nucleo.icon, 24), h('small', { text: 'NÚCLEOS' })),
          h('strong', { text: fmt(cost?.nucleos ?? 0), style: { color: cost && sim.can('nucleo', cost.nucleos) ? '#7fd8ed' : '#ff667d' } }),
        ),
        h('.afx-cost', {},
          h('span', {}, essence ? spriteIcon(iconeDeRecurso(essence), 24) : null, h('small', { text: essence?.nome.toUpperCase() ?? 'ESSÊNCIA' })),
          h('strong', {
            text: `${cost?.quantidade ?? 0} / ${cost ? fmt(sim.materialDisponivel(cost.essencia)) : 0}`,
            style: { color: cost && sim.materialDisponivel(cost.essencia) >= cost.quantidade ? '#7fd8ed' : '#ff667d' },
          }),
        ),
        h('button.afx-execute', {
          disabled: !can,
          onclick: () => {
            if (!item || !cost) return;
            if (!confirm(`${operation.nome} por ${fmt(cost.nucleos)} núcleos e ${cost.quantidade}× ${essence?.nome ?? operation.essencia}?`)) return;
            const outcome = sim.modulateItem(item.uid, operation.id, this.selectedAffix);
            if (!outcome) { this.feedback = 'OPERAÇÃO RECUSADA — VERIFIQUE O ITEM'; return; }
            this.result = { uid: item.uid, before: outcome.antes, after: outcome.depois, operation: operation.nome };
            this.feedback = `${operation.nome.toUpperCase()} CONCLUÍDA`;
          },
        }, h('span', { text: can ? operation.verbo : 'REQUISITOS PENDENTES' }), h('b', { text: 'EXECUTAR' })),
      ),
    );
  }

  private operationAllowed(item: Item | null, current: Affix | null, candidates: number): boolean {
    if (!item) return false;
    const op = this.selectedOperation;
    if (op === 'eco_temporal') return !!item.modulationSnapshot?.length;
    if (op === 'imprimir_prefixo' || op === 'imprimir_sufixo') return item.affixes.length < rarityInfo(item.rarity).afixos;
    if (op === 'primordial') return item.affixes.some((a) => !a.locked);
    if (!current) return false;
    if (op === 'ancorar') return true;
    if (current.locked) return false;
    if (op === 'remoldar') return candidates > 0;
    if (op === 'dissolver') return item.affixes.length > 1;
    if (op === 'ascender') return (current.tier ?? 1) < rarityInfo(item.rarity).tierMax;
    return true;
  }

  private resultView(): HTMLElement {
    const result = this.result!;
    const index = result.after.findIndex((after, i) => JSON.stringify(after) !== JSON.stringify(result.before[i]));
    const before = result.before[index] ?? result.before[0];
    const after = result.after[index] ?? result.after[0];
    return h('.afx-result', {},
      h('.afx-result-title', { text: result.operation.toUpperCase() }),
      before ? h('.afx-result-row.before', {}, h('span', { text: 'ANTES' }), h('b', { text: `T${before.tier ?? 1}` }), h('strong', { text: affixText(before) })) : null,
      h('.afx-result-arrow', { text: '↓' }),
      after ? h('.afx-result-row.after', {}, h('span', { text: 'AGORA' }), h('b', { text: `T${after.tier ?? 1}` }), h('strong', { text: affixText(after) })) : h('.afx-result-row.after', {}, h('strong', { text: `${result.after.length} linhas restantes` })),
    );
  }

  private noItem(): HTMLElement {
    return h('.afx-no-item', {},
      h('span', { text: '◇' }),
      h('strong', { text: 'BANCADA VAZIA' }),
      h('p', { text: 'Selecione um equipamento no inventário para inspecionar Prefixos e Sufixos.' }),
    );
  }

  private selectedItem(sim: Sim): Item | null {
    let item = this.selectedUid
      ? sim.state.inventory.find((candidate) => candidate.uid === this.selectedUid) ?? null
      : null;
    if (!item) {
      item = [...sim.state.inventory].sort((a, b) => b.rarity - a.rarity || b.ilvl - a.ilvl)[0] ?? null;
      this.selectedUid = item?.uid ?? null;
      this.selectedAffix = 0;
      this.result = null;
    }
    if (item && this.selectedAffix >= item.affixes.length) this.selectedAffix = 0;
    return item;
  }
}

function section(label: string): HTMLElement {
  return h('.afx-section', { text: label });
}

function rule(label: string, value: string): HTMLElement {
  return h('.afx-rule', {}, h('span', { text: label }), h('strong', { text: value }));
}

function countTypes(item: Item): Record<TipoDeAfixo, number> {
  const count: Record<TipoDeAfixo, number> = { prefixo: 0, sufixo: 0 };
  for (const affix of item.affixes) {
    const def = AFFIXES.find((candidate) => candidate.id === affix.id);
    if (def) count[tipoDoAfixo(def)]++;
  }
  return count;
}

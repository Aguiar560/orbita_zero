import { duration } from '@core/format';
import { RARITIES } from '@data/rarity';
import { allowSaving, clearStorage, exportSave, importSave } from '@sim/state';
import type { Rarity } from '@sim/types';
import type { Sim } from '@sim/index';
import { h } from '../dom';
import type { Panel } from './types';

export class SettingsPanel implements Panel {
  id = 'ajustes';
  title = 'Ajustes';
  icon = 'geral/b_1';

  render(sim: Sim): HTMLElement {
    const s = sim.state.settings;

    return h('.panel-body', {},
      h('h3.section', { text: 'Automação' }),
      toggle('Equipar automaticamente o que for melhor', s.autoEquip, (v) => { s.autoEquip = v; sim.touch(); }),
      toggle('Repetir a fase em vez de avançar', s.repetirSetor, (v) => { s.repetirSetor = v; sim.touch(); }),
      h('.setting', {},
        h('.setting-text', {},
          h('strong', { text: 'Desmanchar automaticamente abaixo de' }),
          h('span.muted.tiny', { text: 'Itens abaixo desta raridade viram núcleos ao cair. Favoritos nunca são desmanchados.' }),
        ),
        h('select.select', {
          onchange: (e: Event) => { s.autoSalvage = Number((e.target as HTMLSelectElement).value) as Rarity; sim.touch(); },
        },
          h('option', { value: '0', text: 'Nada', selected: s.autoSalvage === 0 }),
          ...RARITIES.slice(1).map((r) => h('option', { value: String(r.id), text: r.name, selected: s.autoSalvage === r.id })),
        ),
      ),

      h('h3.section', { text: 'Apresentação' }),
      toggle('Mostrar números de dano', s.showDamageNumbers, (v) => { s.showDamageNumbers = v; sim.touch(); }),
      toggle('Reduzir efeitos (economiza bateria)', s.reduceEffects, (v) => { s.reduceEffects = v; sim.touch(); }),

      h('h3.section', { text: 'Modo de teste' }),
      h('p.muted.hint', { text: 'Recursos e pontos de matriz infinitos, hangar liberado, nave indestrutível e controle de velocidade. Serve para inspecionar conteúdo sem esperar a progressão — o save continua o mesmo.' }),
      toggle('Ativar modo de teste', s.testMode, (v) => { sim.setTestMode(v); }),
      ...(s.testMode
        ? [
            h('.setting', {},
              h('.setting-text', {},
                h('strong', { text: 'Velocidade do jogo' }),
                h('span.muted.tiny', { text: 'Repete o passo fixo N vezes por quadro.' }),
              ),
              h('.speed-picker', {}, ...[1, 2, 4, 8].map((n) =>
                h(`button.chip${s.speed === n ? '.active' : ''}`, {
                  text: `${n}×`,
                  onclick: () => { s.speed = n; sim.touch(); },
                }),
              )),
            ),
            h('.setting-row', {},
              h('button.btn', { onclick: () => { sim.jumpSector(sim.state.run.sector + 5); } }, h('span', { text: 'Setor +5' })),
              h('button.btn', { onclick: () => { sim.jumpSector(sim.state.run.sector + 25); } }, h('span', { text: 'Setor +25' })),
              h('button.btn', { onclick: () => { sim.jumpSector(nextBossSector(sim.state.run.sector)); } }, h('span', { text: 'Próximo chefe' })),
              h('button.btn', { onclick: () => { sim.jumpSector(1); } }, h('span', { text: 'Voltar ao 1' })),
            ),
            h('.setting-row', {},
              h('button.btn', { onclick: () => { sim.dropItem(sim.encounter.ilvl + 10, 10); sim.touch(); } }, h('span', { text: '+10 itens' })),
              h('button.btn', { onclick: () => { for (const t of ['bronze', 'prata', 'ouro', 'singularidade']) sim.grantChest(t, 5, 'teste'); sim.touch(); } }, h('span', { text: '+5 de cada baú' })),
              h('button.btn', { onclick: () => { sim.grantXp(50000); } }, h('span', { text: '+50k XP' })),
            ),
          ]
        : []),

      h('h3.section', { text: 'Progresso offline' }),
      h('p.muted.hint', { text: `Teto atual: ${duration(sim.offlineCap)}. O nó de Legado "Piloto Automático" aumenta esse limite. O rendimento offline é 60% do rendimento ativo.` }),

      h('h3.section', { text: 'Dados' }),
      h('.setting-row', {},
        h('button.btn', {
          onclick: () => {
            sim.save();
            void navigator.clipboard?.writeText(exportSave(sim.state));
            alert('Save copiado para a área de transferência.');
          },
        }, h('span', { text: 'Exportar save' })),
        h('button.btn', {
          onclick: () => {
            const text = prompt('Cole o save exportado:');
            if (!text) return;
            const state = importSave(text);
            if (!state) {
              alert('Save inválido.');
              return;
            }
            // Importar reabilita a gravação: pode vir logo depois de um
            // apagamento na mesma sessão, e aí a trava ainda estaria ativa.
            allowSaving();
            sim.state = state;
            sim.touch();
            sim.save();
            location.reload();
          },
        }, h('span', { text: 'Importar save' })),
        h('button.btn.danger', {
          onclick: () => {
            if (!confirm('Apagar todo o progresso? Isso não tem volta.')) return;
            clearStorage();
            location.reload();
          },
        }, h('span', { text: 'Apagar progresso' })),
      ),
    );
  }
}

/** Próximo múltiplo de 10 — os chefes aparecem a cada dez setores. */
function nextBossSector(current: number): number {
  return (Math.floor(current / 10) + 1) * 10;
}

function toggle(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
  return h('.setting', {},
    h('.setting-text', {}, h('strong', { text: label })),
    h(`button.switch${value ? '.on' : ''}`, {
      onclick: (e: Event) => {
        onChange(!value);
        (e.currentTarget as HTMLElement).classList.toggle('on', !value);
      },
    }, h('span.knob')),
  );
}

import { duration } from '@core/format';
import { RARITIES } from '@data/rarity';
import { allowSaving, clearStorage, exportSave, importSave } from '@sim/state';
import { ehAdmin } from '@app/admin';
import { pilotoDe } from '@data/pilotos';
import { describeGalaxy } from '@data/galaxies';
import type { Rarity } from '@sim/types';
import type { Sim } from '@sim/index';
import { h } from '../dom';
import type { Panel } from './types';

/**
 * Ajustes, em abas.
 *
 * Era uma página só com seis seções empilhadas, e o custo aparecia na hora de
 * PROCURAR: quem queria desligar o tremor de tela passava por automação,
 * descarte e modo de teste no caminho. Aba não é enfeite aqui — é o que faz o
 * jogador achar a coisa sem ler o resto.
 *
 * A ordem é por frequência de uso, não por importância: jogabilidade primeiro
 * porque é onde se mexe toda semana, dados e teste por último porque são visita
 * rara. "Teste" fica em último de propósito também por ser destrutivo de
 * percepção — ele muda o jogo inteiro, e não deve ser a primeira coisa que
 * alguém encontra.
 */

type AbaId = 'jogabilidade' | 'video' | 'audio' | 'dados' | 'teste';

const ABAS: readonly { id: AbaId; nome: string; icone: string }[] = [
  { id: 'jogabilidade', nome: 'Jogabilidade', icone: '🎮' },
  { id: 'video', nome: 'Vídeo', icone: '🖵' },
  { id: 'audio', nome: 'Áudio', icone: '🔊' },
  { id: 'dados', nome: 'Dados', icone: '💾' },
  { id: 'teste', nome: 'Teste', icone: '🧪' },
];

export class SettingsPanel implements Panel {
  id = 'ajustes';
  title = 'Ajustes';
  icon = 'geral/b_1';
  /** Abre em camada: a coluna direita é do inventário. */
  overlay = true;

  /**
   * Aba visível. Mora na instância, e não no save, porque é onde o jogador
   * estava — não uma preferência. Reabrir Ajustes numa aba que ele viu há dois
   * dias seria lembrar da coisa errada.
   */
  private aba: AbaId = 'jogabilidade';

  render(sim: Sim): HTMLElement {
    return h('.panel-body.ajustes', {},
      h('nav.ajustes-abas', { role: 'tablist', 'aria-label': 'Seções dos ajustes' },
        // A aba de Teste some junto com o conteúdo dela. Esconder só o conteúdo
        // deixaria um botão que abre uma página em branco — que é pior que o
        // problema original: em vez de uma ferramenta perigosa aparecendo, um
        // defeito aparente aparecendo, e um relato de bug atrás.
        ...ABAS.filter((a) => a.id !== 'teste' || ehAdmin())
          .map((a) => h(`button.ajustes-aba${a.id === this.aba ? '.ativa' : ''}`, {
          role: 'tab',
          'aria-selected': String(a.id === this.aba),
          onclick: () => { this.aba = a.id; sim.touch(); },
        },
          h('span.ajustes-aba-icone', { text: a.icone, 'aria-hidden': true }),
          h('span', { text: a.nome }),
        )),
      ),
      h('.ajustes-conteudo', { role: 'tabpanel' }, ...this.conteudo(sim)),
    );
  }

  private conteudo(sim: Sim): HTMLElement[] {
    // Sair da conta com a aba de Teste aberta deixaria o painel vazio até o
    // jogador clicar em outra coisa. Cai para a primeira, que sempre existe.
    if (this.aba === 'teste' && !ehAdmin()) this.aba = 'jogabilidade';

    switch (this.aba) {
      case 'video': return this.video(sim);
      case 'audio': return this.audio(sim);
      case 'dados': return this.dados(sim);
      case 'teste': return this.teste(sim);
      default: return this.jogabilidade(sim);
    }
  }

  // ── jogabilidade ──────────────────────────────────────────────────────────

  private jogabilidade(sim: Sim): HTMLElement[] {
    const s = sim.state.settings;
    return [
      h('h3.section', { text: 'Controle de combate' }),
      h('p.muted.hint', { text: 'Vale na campanha e na Provação. O Laboratório mantém seu seletor próprio para comparar IAs. No manual a arma continua automática; use WASD ou as setas para pilotar.' }),
      h('.setting', {},
        h('.setting-text', {},
          h('strong', { text: 'Piloto da nave' }),
          h('span.muted.tiny', { text: s.controlMode === 'manual' ? 'Manual · WASD ou setas' : 'Idle · IA no comando' }),
        ),
        h('.speed-picker', { role: 'group', 'aria-label': 'Modo de controle' },
          h(`button.chip${s.controlMode === 'idle' ? '.active' : ''}`, {
            text: 'Idle', 'aria-pressed': String(s.controlMode === 'idle'),
            onclick: () => { s.controlMode = 'idle'; sim.touch(); },
          }),
          h(`button.chip${s.controlMode === 'manual' ? '.active' : ''}`, {
            text: 'WASD / setas', 'aria-pressed': String(s.controlMode === 'manual'),
            onclick: () => { s.controlMode = 'manual'; sim.touch(); },
          }),
        ),
      ),

      h('h3.section', { text: 'Em campo' }),
      // O escudo é um TOGGLE de jogabilidade e não de vídeo: a bolha cobre o
      // casco, e quem pilota no manual perde a nave de vista exatamente quando
      // o escudo está cheio — que é quando se avança.
      toggle('Mostrar a bolha de escudo', s.mostrarEscudo, (v) => { s.mostrarEscudo = v; sim.touch(); },
        'Ela mostra a carga pela opacidade, mas cobre o casco. Desligue se atrapalhar a leitura da nave.'),
      toggle('Repetir a fase em vez de avançar', s.repetirSetor, (v) => { s.repetirSetor = v; sim.touch(); },
        'Não muda o que a vitória rende: recompensa, XP e drops continuam iguais. Só segura o ponteiro da incursão.'),

      h('h3.section', { text: 'Automação' }),
      toggle('Equipar automaticamente o que for melhor', s.autoEquip, (v) => { s.autoEquip = v; sim.touch(); }),
      h('.setting', {},
        h('.setting-text', {},
          h('strong', { text: 'Descartar automaticamente abaixo de' }),
          h('span.muted.tiny', { text: 'Aplica o destino escolhido ao cair. Se o Armazém lotar, a desmontagem automática vende a peça para não perder valor.' }),
        ),
        h('select.select', {
          onchange: (e: Event) => { s.autoSalvage = Number((e.target as HTMLSelectElement).value) as Rarity; sim.touch(); },
        },
          h('option', { value: '0', text: 'Nada', selected: s.autoSalvage === 0 }),
          ...RARITIES.slice(1).map((r) => h('option', { value: String(r.id), text: r.name, selected: s.autoSalvage === r.id })),
        ),
      ),
      h('.setting', {},
        h('.setting-text', {},
          h('strong', { text: 'Destino do descarte automático' }),
          h('span.muted.tiny', { text: 'Venda gera Sucata. Desmontagem gera materiais de craft. Nunca os dois.' }),
        ),
        h('select.select', {
          onchange: (e: Event) => {
            s.autoDispose = (e.target as HTMLSelectElement).value as typeof s.autoDispose;
            sim.touch();
          },
        },
          h('option', { value: 'desmontar', text: 'Desmontar', selected: s.autoDispose === 'desmontar' }),
          h('option', { value: 'vender', text: 'Vender', selected: s.autoDispose === 'vender' }),
        ),
      ),

      h('h3.section', { text: 'Progresso offline' }),
      h('p.muted.hint', { text: `Teto atual: ${duration(sim.offlineCap)}. O nó de Legado "Piloto Automático" aumenta esse limite. O rendimento offline é 60% do rendimento ativo.` }),
    ];
  }

  // ── vídeo ─────────────────────────────────────────────────────────────────

  private video(sim: Sim): HTMLElement[] {
    const s = sim.state.settings;
    return [
      h('h3.section', { text: 'Efeitos' }),
      toggle('Reduzir efeitos e movimento', s.reduceEffects, (v) => { s.reduceEffects = v; sim.touch(); },
        'Corta brilhos e animações dos painéis. Use se o jogo estiver pesado.'),
      // Separado de "reduzir efeitos" porque atinge gente diferente: efeito pesa
      // na MÁQUINA, tremor pesa em quem sente enjoo de movimento. Junto, alguém
      // teria de desligar partícula para parar de passar mal.
      toggle('Tremor de tela', s.tremorDeTela, (v) => { s.tremorDeTela = v; sim.touch(); },
        'A tela balança em impacto, morte e entrada de chefe. Desligue se causar desconforto.'),
      toggle('Mostrar números de dano', s.showDamageNumbers, (v) => { s.showDamageNumbers = v; sim.touch(); },
        'Cada acerto imprime o valor sobre o alvo. Em ondas cheias vira ruído.'),

      h('h3.section', { text: 'Acessibilidade' }),
      toggle('Alto contraste', s.highContrast, (v) => {
        s.highContrast = v;
        document.documentElement.dataset.contrast = v ? 'high' : '';
        sim.touch();
      }, 'Aumenta a separação entre texto, fundo e estados interativos.'),

      h('h3.section', { text: 'Enquadramento' }),
      h('p.muted.hint', { text: 'O campo de jogo se adapta à janela: a altura é constante (o tempo que um inimigo leva para atravessar não pode variar com o monitor) e a largura acompanha a proporção. Não há o que ajustar aqui — redimensionar a janela é o controle.' }),
    ];
  }

  // ── áudio ─────────────────────────────────────────────────────────────────

  /**
   * A aba diz que não funciona, e isso é deliberado.
   *
   * O jogo não tem som nenhum — nem `Audio`, nem `AudioContext`, nem arquivo.
   * Havia duas saídas ruins: esconder a aba, e o jogador procurar volume onde
   * não há; ou mostrar controles mudos, e ele mexer achando que ajustou. A
   * terceira é dizer. Os valores são guardados no save para o dia em que o som
   * existir — aí a aba perde o aviso e nada mais muda.
   */
  private audio(sim: Sim): HTMLElement[] {
    const s = sim.state.settings;
    const vol = (rotulo: string, valor: number, aplicar: (v: number) => void, dica?: string): HTMLElement =>
      h('.setting', {},
        h('.setting-text', {},
          h('strong', { text: rotulo }),
          h('span.muted.tiny', { text: dica ?? `${Math.round(valor * 100)}%` }),
        ),
        h('.ajustes-volume', {},
          h('input.ajustes-slider', {
            type: 'range', min: '0', max: '100', step: '5',
            value: String(Math.round(valor * 100)),
            disabled: true,
            'aria-label': rotulo,
            oninput: (e: Event) => { aplicar(Number((e.target as HTMLInputElement).value) / 100); sim.touch(); },
          }),
          h('span.ajustes-volume-num.tiny', { text: `${Math.round(valor * 100)}%` }),
        ),
      );

    return [
      h('.ajustes-aviso', {},
        h('strong', { text: 'O jogo ainda não tem som.' }),
        h('span.tiny', { text: 'Não existe trilha nem efeito sonoro no projeto — estes controles estão desligados de propósito, em vez de fingirem que ajustam alguma coisa. O que você escolher aqui fica guardado e passa a valer no dia em que o áudio existir.' }),
      ),
      h('h3.section', { text: 'Volume' }),
      vol('Geral', s.volumeMestre, (v) => { s.volumeMestre = v; }),
      vol('Música', s.volumeMusica, (v) => { s.volumeMusica = v; }),
      vol('Efeitos', s.volumeEfeitos, (v) => { s.volumeEfeitos = v; }),
      toggle('Silenciar tudo', s.muted, (v) => { s.muted = v; sim.touch(); }),
    ];
  }

  // ── dados ─────────────────────────────────────────────────────────────────

  private dados(sim: Sim): HTMLElement[] {
    const st = sim.state;
    const piloto = st.piloto ? pilotoDe(st.piloto) : null;
    return [
      h('h3.section', { text: 'Esta partida' }),
      h('.ajustes-resumo', {},
        linha('Personagem', piloto ? `${piloto.nome} · ${piloto.raca}` : '—'),
        linha('Origem', piloto ? describeGalaxy(piloto.galaxia).name : '—'),
        linha('Nível de comando', String(st.command.nivel)),
        linha('Melhor setor', String(st.universe.bestSectorEver)),
        linha('Tempo de jogo', duration(st.playtime)),
        linha('Versão do save', String(st.version)),
      ),

      h('h3.section', { text: 'Transferir' }),
      h('p.muted.hint', { text: 'O save vive neste navegador. Exportar é a única forma de levá-lo para outra máquina hoje — as contas em nuvem ainda não existem.' }),
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
      ),

      h('h3.section.perigo', { text: 'Zona de perigo' }),
      h('p.muted.hint', { text: 'Apagar remove tudo: progresso, frota, inventário e o personagem escolhido. Não há como desfazer, e não há cópia em outro lugar.' }),
      h('.setting-row', {},
        h('button.btn.danger', {
          onclick: () => {
            if (!confirm('Apagar todo o progresso? Isso não tem volta.')) return;
            clearStorage();
            location.reload();
          },
        }, h('span', { text: 'Apagar progresso' })),
      ),
    ];
  }

  // ── teste ─────────────────────────────────────────────────────────────────

  private teste(sim: Sim): HTMLElement[] {
    const s = sim.state.settings;
    // Some inteira para quem não é admin. Enquanto o jogo era de uma pessoa
    // só, "modo de teste" ao lado de volume e contraste era conveniência; com
    // testers vira armadilha, porque a seção não avisa que muda o jogo inteiro
    // e o primeiro relato seria de alguém descrevendo recursos infinitos e nave
    // indestrutível sem saber que foi ele quem ligou.
    //
    // Esconder não basta, e por isso não é a única medida: `settings.testMode`
    // é campo do SAVE, e há saves com ele ligado. Quem tira do modo quem já
    // entrou é `desligarModoDeTesteSeNaoForAdmin`, na entrada do jogo.
    if (!ehAdmin()) return [];

    return [
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
            h('h3.section', { text: 'Saltar' }),
            h('.setting-row', {},
              h('button.btn', { onclick: () => { sim.jumpSector(sim.state.run.sector + 5); } }, h('span', { text: 'Setor +5' })),
              h('button.btn', { onclick: () => { sim.jumpSector(sim.state.run.sector + 25); } }, h('span', { text: 'Setor +25' })),
              h('button.btn', { onclick: () => { sim.jumpSector(nextBossSector(sim.state.run.sector)); } }, h('span', { text: 'Próximo chefe' })),
              h('button.btn', { onclick: () => { sim.jumpSector(1); } }, h('span', { text: 'Voltar ao 1' })),
            ),
            h('h3.section', { text: 'Conceder' }),
            h('.setting-row', {},
              h('button.btn', { onclick: () => { sim.dropItem(sim.encounter.ilvl + 10, 10); sim.touch(); } }, h('span', { text: '+10 itens' })),
              h('button.btn', { onclick: () => { for (const t of ['bronze', 'prata', 'ouro', 'singularidade']) sim.grantChest(t, 5, 'teste'); sim.touch(); } }, h('span', { text: '+5 de cada baú' })),
              h('button.btn', { onclick: () => { sim.grantXp(50000); } }, h('span', { text: '+50k XP' })),
            ),
          ]
        : []),
      ...(sim.state.piloto
        ? []
        : [h('p.muted.hint', { text: 'Nenhum personagem escolhido nesta partida.' })]),
    ];
  }
}

/** Próximo múltiplo de 10 — os chefes aparecem a cada dez setores. */
function nextBossSector(current: number): number {
  return (Math.floor(current / 10) + 1) * 10;
}

function linha(rotulo: string, valor: string): HTMLElement {
  return h('.ajustes-linha', {},
    h('span.muted.tiny', { text: rotulo }),
    h('strong.tiny', { text: valor }),
  );
}

/**
 * Interruptor com dica opcional.
 *
 * A dica não é enfeite: metade destes controles muda algo que o jogador não vê
 * de imediato — desligar o tremor não tem efeito visível até o próximo chefe.
 * Sem a linha de baixo ele precisaria testar para saber o que ligou.
 */
function toggle(
  label: string,
  value: boolean,
  onChange: (v: boolean) => void,
  dica?: string,
): HTMLElement {
  return h('.setting', {},
    h('.setting-text', {},
      h('strong', { text: label }),
      ...(dica ? [h('span.muted.tiny', { text: dica })] : []),
    ),
    h(`button.switch${value ? '.on' : ''}`, {
      'aria-label': label,
      'aria-pressed': String(value),
      onclick: (e: Event) => {
        onChange(!value);
        const control = e.currentTarget as HTMLElement;
        control.classList.toggle('on', !value);
        control.setAttribute('aria-pressed', String(!value));
      },
    }, h('span.knob')),
  );
}

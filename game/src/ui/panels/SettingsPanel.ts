import { duration } from '@core/format';
import { RARITIES } from '@data/rarity';
import { allowSaving, clearStorage, createState, exportSave, importSave } from '@sim/state';
import { ehAdmin } from '@app/admin';
import { apagarNaNuvem } from '@app/nuvem';
import { sessaoGuardada } from '@app/conta';
import { bus, toast } from '@app/Bus';
import { MUSICAS } from '@data/musicas';
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

type AbaId = 'jogo' | 'video' | 'audio' | 'interface' | 'conta' | 'teste';

/**
 * Seis assuntos, nomes de uma palavra.
 *
 * "Jogabilidade" e "Dados" viraram "Jogo" e "Conta": rótulo de aba é lido de
 * relance, e palavra curta acha mais rápido que palavra certa. A ordem é por
 * frequência de uso — Jogo primeiro porque é onde se mexe toda semana, Teste
 * por último porque muda o jogo inteiro e não deve ser a primeira coisa que
 * alguém encontra.
 */
const ABAS: readonly { id: AbaId; nome: string; icone: string }[] = [
  { id: 'jogo', nome: 'Jogo', icone: '🎮' },
  { id: 'video', nome: 'Vídeo', icone: '🖵' },
  { id: 'audio', nome: 'Áudio', icone: '🔊' },
  { id: 'interface', nome: 'Interface', icone: '🗔' },
  { id: 'conta', nome: 'Conta', icone: '💾' },
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
  private aba: AbaId = 'jogo';

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
    if (this.aba === 'teste' && !ehAdmin()) this.aba = 'jogo';

    switch (this.aba) {
      case 'video': return this.video(sim);
      case 'audio': return this.audio(sim);
      case 'interface': return this.interface(sim);
      case 'conta': return this.dados(sim);
      case 'teste': return this.teste(sim);
      default: return this.jogo(sim);
    }
  }

  // ── jogabilidade ──────────────────────────────────────────────────────────

  private jogo(sim: Sim): HTMLElement[] {
    const s = sim.state.settings;
    const vip = sim.vipAtivo;
    const manualDisponivel = sim.controleManualDisponivel;
    return [
      // O guia abre a PRIMEIRA aba de proposito. Ja esteve em "Dados", ao lado de
      // exportar e apagar save, e a pergunta "como eu vejo o tutorial de novo?"
      // foi a prova de que ninguem procura tutorial na gaveta do backup.
      h('h3.section', { text: 'Guia' }),
      h('.setting', {},
        h('.setting-text', {}, h('strong', { text: 'Rever o guia do jogo' })),
        h('button.btn', {
          onclick: () => {
            // Fecha Ajustes ANTES de abrir o guia: ele aponta para a tela de
            // tras, e com o modal por cima o passeio destacava coisas escondidas.
            //
            // `ajustes:fechar` e nao `panel:close`: Ajustes e MODAL, e aquele
            // evento so fecha CAMADAS. Passava reto, sem erro nenhum.
            bus.emit('ajustes:fechar');
            bus.emit('guia:abrir');
          },
        }, h('span', { text: 'Abrir' })),
      ),

      h('h3.section', { text: 'Pilotagem' }),
      escolha('Quem pilota', [
        ['idle', 'IA'],
        ['manual', 'Você'],
      ], manualDisponivel ? s.controlMode : 'idle', (v) => {
        if (v === 'manual' && !manualDisponivel) return;
        s.controlMode = v as typeof s.controlMode;
        sim.touch();
      }, manualDisponivel
        ? (s.controlMode === 'manual' ? 'WASD ou setas · tiro automático' : '')
        : 'A partir do nível 15, o controle manual requer VIP',
      manualDisponivel ? [] : ['manual']),
      escolha('Postura da IA', [
        ['agressivo', 'Agressiva'],
        ['evasivo', 'Evasiva'],
        ['coletor', 'Coletora'],
      ], s.pilot, (v) => { s.pilot = v as typeof s.pilot; sim.touch(); }),

      h('h3.section', { text: 'Em campo' }),
      toggle('Repetir o setor', s.repetirSetor, (v) => { s.repetirSetor = v; sim.touch(); }),
      toggle('Bolha de escudo', s.mostrarEscudo, (v) => { s.mostrarEscudo = v; sim.touch(); }),
      toggle('Números de dano', s.showDamageNumbers, (v) => { s.showDamageNumbers = v; sim.touch(); }),

      h('h3.section', { text: 'Automação' }),
      toggle('Equipar o melhor', vip && s.autoEquip, (v) => { s.autoEquip = v; sim.touch(); },
        vip ? 'Compara cada novo item com o equipamento atual' : 'Benefício VIP', !vip),
      h('.setting', {},
        h('.setting-text', {}, h('strong', { text: 'Descartar abaixo de' })),
        h('select.select', {
          onchange: (e: Event) => { s.autoSalvage = Number((e.target as HTMLSelectElement).value) as Rarity; sim.touch(); },
        },
          h('option', { value: '0', text: 'Nada', selected: s.autoSalvage === 0 }),
          ...RARITIES.slice(1).map((r) => h('option', { value: String(r.id), text: r.name, selected: s.autoSalvage === r.id })),
        ),
      ),
      escolha('Destino do descarte', [
        ['desmontar', 'Desmontar'],
        ['vender', 'Vender'],
      ], vip ? s.autoDispose : 'desmontar', (v) => {
        if (v === 'vender' && !vip) return;
        s.autoDispose = v as typeof s.autoDispose;
        sim.touch();
      }, vip ? '' : 'Venda automática por raridade é um benefício VIP', vip ? [] : ['vender']),

      h('h3.section', { text: 'Offline' }),
      linha('Teto de progresso', duration(sim.offlineCap)),
      linha('Rendimento', '60% do ativo'),
    ];
  }

  // ── vídeo ─────────────────────────────────────────────────────────────────

  private video(sim: Sim): HTMLElement[] {
    const s = sim.state.settings;
    return [
      h('h3.section', { text: 'Tela' }),
      h('.setting', {},
        h('.setting-text', {}, h('strong', { text: 'Tela cheia' })),
        h('button.btn', {
          onclick: () => {
            // Não é preferência salva: tela cheia é estado do NAVEGADOR, e ele
            // a desfaz sozinho ao trocar de aba ou apertar Esc. Guardar no save
            // faria o jogo prometer algo que não controla.
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen().catch(() => {});
          },
        }, h('span', { text: document.fullscreenElement ? 'Sair' : 'Ativar' })),
      ),
      deslizante('Resolução', s.qualidade, 0.5, 2, 0.25, (v) => {
        s.qualidade = v;
        sim.touch();
        bus.emit('preferencias:visuais');
      }, (v) => `${Math.round(v * 100)}%`),
      toggle('Contador de FPS', s.mostrarFps, (v) => {
        s.mostrarFps = v;
        sim.touch();
        bus.emit('preferencias:visuais');
      }),

      h('h3.section', { text: 'Efeitos' }),
      toggle('Efeitos reduzidos', s.reduceEffects, (v) => { s.reduceEffects = v; sim.touch(); }),
      // Separado de "efeitos reduzidos" porque atinge gente diferente: efeito
      // pesa na MÁQUINA, tremor pesa em quem sente enjoo de movimento. Junto,
      // alguém teria de desligar partícula para parar de passar mal.
      toggle('Tremor de tela', s.tremorDeTela, (v) => { s.tremorDeTela = v; sim.touch(); }),
    ];
  }

  // ── interface ─────────────────────────────────────────────────────────────

  private interface(sim: Sim): HTMLElement[] {
    const s = sim.state.settings;
    return [
      h('h3.section', { text: 'Tamanho' }),
      deslizante('Escala da interface', s.escalaDaInterface, 0.8, 1.25, 0.05, (v) => {
        s.escalaDaInterface = v;
        sim.touch();
        bus.emit('preferencias:visuais');
      }, (v) => `${Math.round(v * 100)}%`),

      h('h3.section', { text: 'Acessibilidade' }),
      toggle('Alto contraste', s.highContrast, (v) => {
        s.highContrast = v;
        document.documentElement.dataset.contrast = v ? 'high' : '';
        sim.touch();
      }),

      h('h3.section', { text: 'Painéis' }),
      toggle('Anatomia aberta', s.anatomiaAberta !== false, (v) => { s.anatomiaAberta = v; sim.touch(); }),

    ];
  }

  // ── áudio ─────────────────────────────────────────────────────────────────

  /** Volumes do mixer de combate; música aguarda trilha própria. */
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
            // O de Música nascia `disabled`, de quando a trilha ainda não
            // existia. Ela existe desde 04/09, e o controle desligado é a
            // pior forma de dizer isso — parece defeito, não ausência.
            'aria-label': rotulo,
            oninput: (e: Event) => {
              aplicar(Number((e.target as HTMLInputElement).value) / 100);
              // Sem isto o número na tela mudava e o som não: `atualizar` só
              // roda quando alguém a chama.
              bus.emit('preferencias:audio');
              sim.touch();
            },
          }),
          h('span.ajustes-volume-num.tiny', { text: `${Math.round(valor * 100)}%` }),
        ),
      );

    return [
      h('.ajustes-aviso', {},
        h('strong', { text: 'Áudio' }),
        h('span.tiny', { text: 'O som começa após um clique ou toque — é exigência do navegador, não do jogo. Os efeitos de combate silenciam ao sair da aba; a trilha continua, porque ela acompanha quem deixou o jogo rodando noutra janela.' }),
      ),

      h('h3.section', { text: 'Trilha' }),
      ...this.trilha(sim),

      h('h3.section', { text: 'Volume' }),
      vol('Geral', s.volumeMestre, (v) => { s.volumeMestre = v; }),
      vol('Música', s.volumeMusica, (v) => { s.volumeMusica = v; }),
      vol('Efeitos', s.volumeEfeitos, (v) => { s.volumeEfeitos = v; }),
      toggle('Silenciar tudo', s.muted, (v) => { s.muted = v; bus.emit('preferencias:audio'); sim.touch(); }),
    ];
  }

  /**
   * A lista de faixas, com a atual marcada.
   *
   * Lista e não `<select>`: são poucas e cada uma tem título E artista, que
   * num seletor virariam uma linha só e truncada. A lista também deixa clicar
   * direto na faixa desejada, em vez de obrigar a passar pelas do meio com
   * "próxima".
   *
   * O botão de pular fica junto porque é o gesto de quem NÃO quer escolher —
   * só quer ouvir outra coisa.
   */
  private trilha(sim: Sim): HTMLElement[] {
    const atual = sim.state.settings.musicaAtual ?? MUSICAS[0]?.id;
    return [
      h('.ajustes-trilha', {}, ...MUSICAS.map((m) => h(
        `button.ajustes-faixa${m.id === atual ? '.ativa' : ''}`,
        {
          onclick: () => { bus.emit('musica:trocar', { id: m.id }); sim.touch(); },
          title: `${m.titulo} — ${m.artista}`,
        },
        h('span.ajustes-faixa-nome', { text: m.titulo }),
        h('span.ajustes-faixa-artista', { text: m.artista }),
      ))),
      h('.ajustes-trilha-acoes', {},
        h('button.mini', {
          text: '‹ Anterior',
          onclick: () => { bus.emit('musica:anterior'); sim.touch(); },
        }),
        h('button.mini', {
          text: 'Próxima ›',
          onclick: () => { bus.emit('musica:proxima'); sim.touch(); },
        }),
      ),
      h('p.muted.hint', { text: 'A faixa escolhida fica salva, e ao terminar o jogo passa para a seguinte.' }),
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

      ...this.zonaDePerigo(),
    ];
  }

  /**
   * Apagar o progresso, dos DOIS lados.
   *
   * Ficou em método próprio porque virou assíncrono, e um `onclick` que espera
   * rede no meio de uma lista de elementos esconde o que mais importa aqui: a
   * ordem. A nuvem é limpa PRIMEIRO. Ao contrário, um erro de rede deixaria o
   * jogador sem o save local e com o antigo intacto no servidor, pronto para
   * descer inteiro no próximo boot — o pior dos dois mundos.
   */
  private zonaDePerigo(): HTMLElement[] {
    const comConta = sessaoGuardada() !== null;

    const aviso = comConta
      ? 'Apagar remove tudo: progresso, frota, inventário e o personagem escolhido. Apaga também a cópia da sua conta na nuvem. Não há como desfazer.'
      : 'Apagar remove tudo: progresso, frota, inventário e o personagem escolhido. Não há como desfazer, e não há cópia em outro lugar.';

    const botao = h('button.btn.danger', {},
      h('span', { text: 'Apagar progresso' })) as HTMLButtonElement;

    botao.onclick = () => {
      if (!confirm('Apagar todo o progresso? Isso não tem volta.')) return;
      botao.disabled = true;
      botao.textContent = 'Apagando…';

      void (async () => {
        // O estado que sobe é um jogador novo de verdade: sem piloto escolhido,
        // que é o que faz a tela de escolha voltar a aparecer no próximo boot.
        const limpou = await apagarNaNuvem(createState());
        if (!limpou) {
          botao.disabled = false;
          botao.textContent = 'Apagar progresso';
          // Contar em vez de apagar assim mesmo: o save local sumiria e o da
          // nuvem desceria de volta no boot seguinte, e o jogador teria feito
          // uma coisa irreversível para ficar exatamente onde estava.
          toast('Não deu para apagar na nuvem. O progresso continua intacto — tente de novo em um minuto.', 'bad');
          return;
        }

        clearStorage();
        location.reload();
      })();
    };

    return [
      h('h3.section.perigo', { text: 'Zona de perigo' }),
      h('p.muted.hint', { text: aviso }),
      h('.setting-row', {}, botao),
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
  disabled = false,
): HTMLElement {
  return h('.setting', {},
    h('.setting-text', {},
      h('strong', { text: label }),
      ...(dica ? [h('span.muted.tiny', { text: dica })] : []),
    ),
    h(`button.switch${value ? '.on' : ''}`, {
      'aria-label': label,
      'aria-pressed': String(value),
      disabled,
      onclick: (e: Event) => {
        onChange(!value);
        const control = e.currentTarget as HTMLElement;
        control.classList.toggle('on', !value);
        control.setAttribute('aria-pressed', String(!value));
      },
    }, h('span.knob')),
  );
}

/**
 * Escolha entre poucas opções, como fichas lado a lado.
 *
 * Fichas e não `<select>` quando são duas ou três: o valor atual fica visível
 * sem abrir nada, e trocar é um clique em vez de dois. Acima de três opções o
 * `<select>` volta a ganhar — cinco fichas não cabem na linha desta tela, que é
 * estreita de propósito.
 */
function escolha<T extends string>(
  rotulo: string,
  opcoes: readonly (readonly [T, string])[],
  atual: T,
  aoTrocar: (v: T) => void,
  nota = '',
  desabilitadas: readonly T[] = [],
): HTMLElement {
  return h('.setting', {},
    h('.setting-text', {},
      h('strong', { text: rotulo }),
      ...(nota ? [h('span.muted.tiny', { text: nota })] : []),
    ),
    h('.speed-picker', { role: 'group', 'aria-label': rotulo },
      ...opcoes.map(([valor, nome]) => h(`button.chip${valor === atual ? '.active' : ''}`, {
        text: nome,
        'aria-pressed': String(valor === atual),
        disabled: desabilitadas.includes(valor),
        onclick: () => aoTrocar(valor),
      })),
    ),
  );
}

/**
 * Valor contínuo, com o número ao lado.
 *
 * O número não é enfeite: um controle deslizante sozinho diz "mais ou menos
 * aqui", e resolução e escala são coisas que a pessoa quer conseguir repetir
 * depois — "estava em 75%" é reproduzível, uma posição de alça não é.
 *
 * `oninput` e não `onchange`: o efeito aparece enquanto se arrasta, que é como
 * se acha o ponto certo de uma escala.
 */
function deslizante(
  rotulo: string,
  valor: number,
  min: number,
  max: number,
  passo: number,
  aoMudar: (v: number) => void,
  formatar: (v: number) => string,
): HTMLElement {
  const num = h('span.ajustes-volume-num.tiny', { text: formatar(valor) });
  return h('.setting', {},
    h('.setting-text', {}, h('strong', { text: rotulo })),
    h('.ajustes-volume', {},
      h('input.ajustes-slider', {
        type: 'range',
        min: String(min), max: String(max), step: String(passo),
        value: String(valor),
        'aria-label': rotulo,
        oninput: (e: Event) => {
          const v = Number((e.target as HTMLInputElement).value);
          num.textContent = formatar(v);
          aoMudar(v);
        },
      }),
      num,
    ),
  );
}

import { Loop } from './Loop';
import { bus } from './Bus';
import { assets } from '@render/Assets';
import { Surface } from '@render/Surface';
import { registerClips } from '@data/clips';
import { ALL_ENEMIES } from '@data/enemies';
import { Sim } from '@sim/index';
import { loadFromStorage } from '@sim/state';
import { VerticalMode, registerMinions } from '@modes/vertical/VerticalMode';
import { VIEW, fitView } from '@modes/vertical/entities';
import { Shell } from '@ui/Shell';
import { EscolhaDePiloto } from '@ui/EscolhaDePiloto';
import { Login } from '@ui/Login';

/**
 * Ausência mínima (segundos) para creditar progresso offline.
 *
 * Ausência aqui significa JANELA FECHADA — o tempo entre o último save e o
 * boot. Trocar de aba não passa por este caminho: a aba oculta continua
 * simulando no relógio de fundo do laço.
 */
const AWAY_THRESHOLD = 3;

/** Ausência mínima para o relatório aparecer. Recarregar a página não conta. */
const REPORT_THRESHOLD = 120;

/**
 * Orquestrador: junta simulação, os dois modos e a interface num só laço.
 *
 * Regra central de tempo: o combate corre SEMPRE. Aba oculta continua simulando
 * ao vivo, num relógio próprio do laço — o que muda é só que não se desenha.
 * `sim.abstractTick()` existe apenas para o tempo de JANELA FECHADA, onde não há
 * cena para rodar.
 *
 * Havia aqui uma segunda fonte, a PATRULHA, rodando em paralelo ao combate e
 * rendendo sem cena própria. Ela era o resto de um modo horizontal que foi
 * removido: os biomas dela — Mar da Tranquilidade, Cinturão de Dunas, Bioma
 * Verdejante, Alta Estratosfera — descreviam uma subida da superfície de um
 * planeta até a órbita, e não tinham lugar num jogo de galáxias e setores.
 *
 * Medida antes de sair, ela era 97 a 99,9% de toda a sucata do jogo. Uma renda
 * invisível, sem decisão do jogador e sem lugar na ficção, maior que o jogo
 * inteiro.
 */
export class Game {
  private readonly sim: Sim;
  private readonly shell: Shell;
  private readonly loop: Loop;

  private stage!: Surface;
  private vertical!: VerticalMode;

  private stageWrap!: HTMLElement;

  /** Onde a tela de escolha de personagem é montada, antes do laço começar. */
  private readonly rootEl: HTMLElement;

  constructor(root: HTMLElement) {
    this.rootEl = root;
    const loaded = loadFromStorage();
    this.sim = new Sim(loaded?.state);
    this.shell = new Shell(root, this.sim);
    this.loop = new Loop(this.tick, this.draw);
    this.offlineSeconds = loaded?.offlineSeconds ?? 0;
  }

  private readonly offlineSeconds: number;

  async start(): Promise<void> {
    try {
      await assets.boot();
    } catch (err) {
      this.shell.showFatal(err instanceof Error ? err.message : String(err));
      throw err;
    }

    registerClips();
    registerMinions(ALL_ENEMIES);

    const { stage, stageWrap } = this.shell.build();
    this.stageWrap = stageWrap;

    this.stage = new Surface(stage);
    this.vertical = new VerticalMode(this.stage, this.sim);
    this.vertical.refreshPlayer(true);

    window.addEventListener('resize', this.layout);
    // O palco pode mudar de tamanho SEM a janela mudar — um trilho que some,
    // uma faixa que aparece — e `fitView` deriva a largura lógica da proporção
    // do elemento, então precisa saber. `resize` da janela não cobre isso.
    //
    // Nasceu de um caso concreto: a anatomia era uma quarta trilha de grid, e
    // abrir e fechar deixava o layout com 1.350px numa janela de 1.280. Hoje
    // ela é sobreposta e não mexe mais no palco, mas o observador fica: é a
    // única defesa contra a próxima trilha que entrar no layout.
    new ResizeObserver(() => this.layout()).observe(stage.parentElement ?? stage);
    document.addEventListener('visibilitychange', this.onVisibility);
    // `pagehide` é o evento que realmente dispara ao fechar em todo navegador;
    // `beforeunload` não é garantido no celular. Salvar nos dois é barato e a
    // gravação é idempotente.
    window.addEventListener('pagehide', () => this.sim.save());
    window.addEventListener('beforeunload', () => this.sim.save());
    bus.on('state:changed', () => this.vertical.refreshPlayer());

    this.layout();

    // A escolha de personagem vem ANTES do laço e antes do relatório de
    // ausência. Antes do laço porque o casco escolhido troca a nave em campo, e
    // um quadro sequer da nave errada já é uma piscada errada na primeira tela
    // que o jogador vê. Antes do relatório porque save sem piloto é save novo,
    // e save novo não tem ausência para relatar.
    // A conta vem ANTES da escolha de piloto: se houver save na nuvem, ele
    // troca o estado inteiro, e escolher piloto para um save que vai ser
    // substituido seria fazer o jogador decidir duas vezes.
    //
    // Dá para pular. O jogo funciona inteiro sem conta — o save mora no
    // navegador desde sempre —, e cobrar um e-mail antes de a pessoa saber se
    // gosta do jogo trocaria jogadores por cadastros.
    await new Login().mostrar(this.rootEl);

    if (!this.sim.state.piloto) {
      await new EscolhaDePiloto(this.sim, this.rootEl).mostrar();
      this.vertical.refreshPlayer(true);
    }

    if (this.offlineSeconds > AWAY_THRESHOLD) {
      const report = this.sim.applyOffline(this.offlineSeconds);
      this.vertical.refreshPlayer(true);
      if (this.offlineSeconds > REPORT_THRESHOLD) this.shell.showOfflineReport(report);
    }

    this.loop.start();
  }

  // ── laço ──────────────────────────────────────────────────────────────────

  private readonly tick = (dt: number): void => {
    const speed = this.sim.timeScale;
    // O modo de teste acelera o jogo repetindo o passo fixo, e não esticando
    // `dt`: a IA e as colisões dependem de um passo constante para não falhar.
    for (let i = 0; i < speed; i++) {
      this.vertical.update(dt);
    }
    if (!this.sim.laboratorio.active) this.sim.tickSave(dt);
  };

  private readonly draw = (_alpha: number, dt: number): void => {
    this.vertical.draw();
    this.shell.update(dt);
  };

  // ── layout ────────────────────────────────────────────────────────────────

  /**
   * A cena preenche a coluna central inteira.
   *
   * Em vez de manter uma proporção fixa e sobrar tarja preta dos lados, o
   * campo de jogo LÓGICO se adapta à proporção do espaço: a altura é constante
   * (o tempo de travessia de um inimigo não pode variar com o monitor) e a
   * largura acompanha. O combate é a tela principal, então ele fica com todo o
   * espaço que a coluna oferece.
   */
  private readonly layout = (): void => {
    const box = this.stageWrap.getBoundingClientRect();
    const availW = Math.max(240, Math.floor(box.width));
    const availH = Math.max(240, Math.floor(box.height));
    fitView(availW, availH);

    // A largura lógica acompanha a área disponível, então esta escala preenche
    // o palco sem distorcer a arte nem deixar faixas laterais.
    const scale = Math.min(availW / VIEW.w, availH / VIEW.h);
    this.vertical.resize(Math.floor(VIEW.w * scale), Math.floor(VIEW.h * scale));
  };

  /**
   * Trocar de aba NÃO é ausência.
   *
   * Antes, `visibilitychange` parava o laço e contabilizava o tempo como
   * progresso offline — o jogador olhava outra aba por um minuto e voltava com
   * um relatório de ausência. Agora a aba oculta continua simulando, num
   * relógio próprio, porque `requestAnimationFrame` congela em segundo plano.
   *
   * Ausência de verdade é a janela fechada, e quem detecta isso é `pagehide`:
   * o tempo entre fechar e reabrir sai do `savedAt` do save, no boot.
   */
  private readonly onVisibility = (): void => {
    this.loop.setBackground(document.hidden);
    if (document.hidden) this.sim.save();
  };

  /** Reaplica o layout — chamado quando a faixa é escondida/mostrada. */
  relayout(): void {
    this.layout();
  }

  /**
   * Avança o jogo manualmente. Existe para testes automatizados e para
   * inspecionar quadros quando o navegador não está compositando (aba oculta,
   * headless), situação em que `requestAnimationFrame` nunca dispara.
   */
  debugStep(frames = 60, dt = 1 / 60): void {
    for (let i = 0; i < frames; i++) this.tick(dt);
    this.draw(0, dt);
  }

  get debugSim(): Sim {
    return this.sim;
  }
}

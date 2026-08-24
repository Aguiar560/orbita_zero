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
 * Regra central de tempo: a patrulha (`sim.patrolTick`) e o combate correm
 * SEMPRE. Aba oculta continua simulando ao vivo, num relógio próprio do laço —
 * o que muda é só que não se desenha. `sim.abstractTick()` existe apenas para o
 * tempo de JANELA FECHADA, onde não há cena para rodar.
 *
 * A patrulha continua rendendo sem cena própria: virou uma renda de fundo lida
 * no painel esquerdo, e a tela inteira ficou para o combate.
 */
export class Game {
  private readonly sim: Sim;
  private readonly shell: Shell;
  private readonly loop: Loop;

  private stage!: Surface;
  private vertical!: VerticalMode;

  private stageWrap!: HTMLElement;

  constructor(root: HTMLElement) {
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
    document.addEventListener('visibilitychange', this.onVisibility);
    // `pagehide` é o evento que realmente dispara ao fechar em todo navegador;
    // `beforeunload` não é garantido no celular. Salvar nos dois é barato e a
    // gravação é idempotente.
    window.addEventListener('pagehide', () => this.sim.save());
    window.addEventListener('beforeunload', () => this.sim.save());
    bus.on('state:changed', () => this.vertical.refreshPlayer());

    this.layout();

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
      if (!this.sim.laboratorio.active) this.sim.patrolTick(dt);
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

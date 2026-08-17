/**
 * Laço principal com passo fixo para a simulação e interpolação livre para o
 * desenho.
 *
 * Passo fixo importa aqui porque a IA piloto e a detecção de colisão precisam
 * ser determinísticas: com `dt` variável, uma queda de FPS faria a nave
 * atravessar projéteis. O acumulador é limitado (`MAX_CATCHUP`) para que uma
 * aba minimizada não gere uma avalanche de ticks ao voltar — esse tempo é
 * tratado pelo caminho de progresso offline, que é muito mais barato.
 */
export type TickFn = (dt: number) => void;
export type DrawFn = (alpha: number, dt: number) => void;

const STEP = 1 / 60;
const MAX_CATCHUP = 5; // ticks por quadro

/**
 * Intervalo do relógio de fundo, em milissegundos.
 *
 * `requestAnimationFrame` congela em aba oculta — é do navegador, não dá para
 * contornar. Como o jogo deve CONTINUAR rodando quando o jogador troca de aba,
 * existe este segundo relógio, que só entra em cena quando a página some.
 *
 * O navegador também estrangula `setInterval` em segundo plano, tipicamente
 * para uma chamada por segundo. Isso não atrasa o jogo porque o avanço é
 * calculado pelo RELÓGIO DE PAREDE decorrido, não pelo número de chamadas: se
 * o navegador pular um segundo, o tick seguinte simplesmente processa um
 * segundo de simulação de uma vez.
 */
const BACKGROUND_MS = 250;

/**
 * Teto de tempo que um tick de fundo processa de uma vez.
 *
 * Sem ele, uma aba estrangulada por dez minutos tentaria simular dez minutos
 * num único quadro e travaria a página ao voltar. Acima deste teto o tempo é
 * descartado aqui e tratado pelo caminho de progresso offline, que é barato.
 */
const BACKGROUND_MAX_CATCHUP = 4;

export class Loop {
  private raf = 0;
  private timer = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  private background = false;

  /** Segundos de tempo real acumulados desde o início desta sessão. */
  elapsed = 0;
  /** FPS suavizado, para o overlay de debug. */
  fps = 60;

  constructor(
    private readonly tick: TickFn,
    private readonly draw: DrawFn,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
    this.timer = 0;
  }

  /**
   * Troca o relógio quando a aba some ou volta.
   *
   * Em segundo plano a simulação continua, mas sem desenhar: o canvas não está
   * visível e compor quadros seria gastar bateria à toa.
   */
  setBackground(background: boolean): void {
    if (this.background === background || !this.running) return;
    this.background = background;

    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
    this.timer = 0;
    this.last = performance.now();
    this.acc = 0;

    if (background) this.timer = setInterval(this.backgroundFrame, BACKGROUND_MS) as unknown as number;
    else this.raf = requestAnimationFrame(this.frame);
  }

  /**
   * Passo de segundo plano: simula, não desenha.
   *
   * Usa o mesmo passo fixo do primeiro plano para o resultado ser o mesmo — a
   * IA piloto e a colisão dependem disso. O que muda é só quantos passos cabem
   * numa chamada.
   */
  private readonly backgroundFrame = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, BACKGROUND_MAX_CATCHUP);
    this.last = now;
    this.elapsed += dt;

    this.acc += dt;
    const maxSteps = Math.ceil(BACKGROUND_MAX_CATCHUP / STEP);
    let steps = 0;
    while (this.acc >= STEP && steps < maxSteps) {
      this.tick(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === maxSteps) this.acc = 0;
  };

  private frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);

    const rawDt = (now - this.last) / 1000;
    this.last = now;
    // Clamp defensivo: alt-tab, breakpoint no devtools, throttling do browser.
    const dt = Math.min(rawDt, 0.25);
    this.elapsed += dt;
    this.fps += (1 / Math.max(1e-4, rawDt) - this.fps) * 0.1;

    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_CATCHUP) {
      this.tick(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_CATCHUP) this.acc = 0; // desiste do resto em vez de espiralar

    this.draw(this.acc / STEP, dt);
  };
}

export const FIXED_STEP = STEP;

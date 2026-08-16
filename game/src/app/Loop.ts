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

export class Loop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;

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
  }

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

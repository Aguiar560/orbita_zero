import { ARTES_ATMOSFERA_OCEANICA, NUVENS_OCEANICAS, passagemAtmosferica } from '@data/atmosfera-oceanica';
import { assets } from './Assets';
import type { Surface } from './Surface';

/** Cenografia decorativa; não cria entidades, hitboxes, dano nem estado salvo. */
export class AtmosferaOceanica {
  private pediuArtes = false;
  private sombraDeNuvem: HTMLCanvasElement | null = null;
  private deslocamentoX = 0;
  private deslocamentoY = 0;

  atualizar(dt: number, x: number, y: number): void {
    const fator = 1 - Math.exp(-Math.min(dt, .1) * 2);
    this.deslocamentoX += (x - this.deslocamentoX) * fator;
    this.deslocamentoY += (y - this.deslocamentoY) * fator;
  }

  private preparar(): void {
    if (!this.pediuArtes) {
      this.pediuArtes = true;
      for (const src of Object.values(ARTES_ATMOSFERA_OCEANICA)) assets.prefetch(src);
    }
    const nuvem = assets.peek(ARTES_ATMOSFERA_OCEANICA.nuvem);
    if (nuvem && !this.sombraDeNuvem) {
      // Uma única textura pequena no cache; nenhum blur/filtro caro por frame.
      const tela = document.createElement('canvas');
      tela.width = 256;
      tela.height = Math.round(256 * nuvem.height / nuvem.width);
      const ctx = tela.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(nuvem, 0, 0, tela.width, tela.height);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#03131e';
      ctx.fillRect(0, 0, tela.width, tela.height);
      this.sombraDeNuvem = tela;
    }
  }

  fundo(s: Surface, tempo: number, reduzido: boolean): void {
    this.preparar();
    const ctx = s.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = true;

    // Cor da coluna de ar: superfície mais profunda e horizonte luminoso difuso.
    const ar = ctx.createLinearGradient(0, 0, 0, s.height);
    ar.addColorStop(0, 'rgba(53,124,139,.13)');
    ar.addColorStop(.5, 'rgba(5,28,44,.06)');
    ar.addColorStop(1, 'rgba(2,15,26,.2)');
    ctx.fillStyle = ar;
    ctx.fillRect(0, 0, s.width, s.height);

    this.nuvens(s, tempo, 'baixo', reduzido, true);
    this.nuvens(s, tempo, 'baixo', reduzido);
    this.nuvens(s, tempo, 'medio', reduzido);
    ctx.restore();
  }

  private nuvens(s: Surface, tempo: number, plano: 'baixo' | 'medio' | 'frente', reduzido: boolean, sombra = false): void {
    const img = sombra ? this.sombraDeNuvem : assets.peek(ARTES_ATMOSFERA_OCEANICA.nuvem);
    if (!img || (reduzido && (plano !== 'baixo' || sombra))) return;
    const ctx = s.ctx;
    const parallax = reduzido ? 0 : plano === 'frente' ? 38 : plano === 'medio' ? 22 : 8;
    for (const nuvem of NUVENS_OCEANICAS) {
      if (nuvem.plano !== plano) continue;
      const largura = Math.min(s.width, 1000) * nuvem.escala;
      const altura = largura * img.height / img.width;
      const x = s.width * nuvem.x - this.deslocamentoX * parallax + (sombra ? 32 : 0);
      const y = passagemAtmosferica(tempo, nuvem.velocidade, nuvem.fase, s.height, largura * .7)
        - (reduzido ? 0 : this.deslocamentoY * parallax * .5) + (sombra ? 52 : 0);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(nuvem.angulo);
      ctx.globalAlpha = sombra ? .32 : nuvem.alfa * (reduzido ? .6 : 1);
      ctx.drawImage(img, -largura / 2, -altura / 2, largura, altura);
      ctx.restore();
    }
  }

  /** Halo e esteira abaixo da nave: ancoram o casco na coluna de ar. */
  esteira(s: Surface, x: number, y: number, tempo: number, cor: string): void {
    const ctx = s.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y + 32);
    ctx.scale(.65, 2.2);
    const luz = ctx.createRadialGradient(0, 0, 1, 0, 0, 36);
    luz.addColorStop(0, cor);
    luz.addColorStop(1, 'rgba(30,160,190,0)');
    ctx.globalAlpha = .1 + Math.sin(tempo * 5) * .012;
    ctx.fillStyle = luz;
    ctx.fillRect(-36, -36, 72, 72);
    ctx.restore();
  }

  frente(s: Surface, tempo: number, reduzido: boolean): void {
    if (reduzido) return;
    const ctx = s.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    // Centros fora da arena: apenas bordas orgânicas entram, sem recorte reto.
    this.nuvens(s, tempo, 'frente', false);
    ctx.restore();

    // Aerossóis rápidos e discretos, sem usar o gerador aleatório da simulação.
    ctx.save();
    ctx.strokeStyle = 'rgba(165,224,237,.18)';
    ctx.lineWidth = .7;
    const quantidade = s.width < 600 ? 12 : 22;
    for (let i = 0; i < quantidade; i++) {
      const faixa = (i * .61803398875) % 1;
      const x = faixa * s.width - this.deslocamentoX * 24;
      const y = passagemAtmosferica(tempo, 130 + i % 4 * 18, (i * .381966) % 1, s.height, 20);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 1, y + 3 + i % 3);
      ctx.stroke();
    }
    ctx.restore();
  }
}

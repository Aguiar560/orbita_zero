import type { ElementId, Settings } from '@sim/types';
import type { Hull } from '@data/hulls';
import type { EnemyDef } from '@data/enemies';
import type { BossDef } from '@data/bosses';
import { perfilDaNave, perfilDoInimigo, perfilDoChefe, sintetizarDisparo, sintetizarExplosao, type PerfilSonoro } from './SinteseSonora';

/** Áudio somente da cena visível; sintetiza uma vez e reutiliza os buffers. */
export class AudioCombate {
  private contexto: AudioContext | null = null;
  private ganho: GainNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly vozes = new Set<AudioBufferSourceNode>();
  private proximoJogador = 0;
  private proximoInimigo = 0;
  private explosaoAte = 0;
  private encerrado = false;

  constructor(private readonly preferencias: () => Pick<Settings, 'muted' | 'volumeMestre' | 'volumeEfeitos'>) {
    window.addEventListener('pointerdown', this.ativar);
    window.addEventListener('keydown', this.ativar);
    document.addEventListener('visibilitychange', this.visibilidade);
  }

  private readonly ativar = (): void => {
    if (this.encerrado || document.hidden || this.preferencias().muted) return;
    try {
      if (!this.contexto) {
        this.contexto = new AudioContext();
        this.ganho = this.contexto.createGain();
        const limitador = this.contexto.createDynamicsCompressor();
        limitador.threshold.value = -12;
        limitador.knee.value = 12;
        limitador.ratio.value = 8;
        limitador.attack.value = .003;
        limitador.release.value = .18;
        this.ganho.connect(limitador).connect(this.contexto.destination);
      }
      if (this.contexto.state === 'suspended') void this.contexto.resume().catch(() => {});
      this.atualizar();
    } catch { /* Navegador sem áudio não impede a partida. */ }
  };

  private readonly visibilidade = (): void => {
    if (document.hidden) {
      this.pararVozes();
      if (this.contexto?.state === 'running') void this.contexto.suspend().catch(() => {});
    } else if (this.contexto) this.ativar();
  };

  atualizar(): void {
    const c = this.contexto;
    if (!c || !this.ganho) return;
    const s = this.preferencias();
    const volume = s.muted || document.hidden ? 0 : Math.max(0, Math.min(1, s.volumeMestre)) * Math.max(0, Math.min(1, s.volumeEfeitos));
    this.ganho.gain.setTargetAtTime(volume * .65, c.currentTime, .02);
    if (volume === 0) this.pararVozes();
  }

  disparoDaNave(nave: Hull, elemento: ElementId, cadencia: number, pan: number): void {
    this.disparar(perfilDaNave(nave), elemento, cadencia, pan, true);
  }

  disparoInimigo(nave: EnemyDef, elemento: ElementId, id: string, pan: number): void {
    this.disparar(perfilDoInimigo(nave, elemento, id), elemento, nave.fireRate, pan, false);
  }

  disparoDeChefe(chefe: BossDef, estagio: number, pan: number): void {
    const perfil = perfilDoChefe(chefe, estagio);
    this.disparar(perfil, chefe.element, perfil.cadencia, pan, false);
  }

  private disparar(perfil: PerfilSonoro, elemento: ElementId, cadencia: number, pan: number, jogador: boolean): void {
    const c = this.pronto();
    if (!c) return;
    const agora = c.currentTime;
    if (agora < (jogador ? this.proximoJogador : this.proximoInimigo)) return;
    // Uma voz por salva; o mix limita enxames sem mudar a cadência simulada.
    if (jogador) this.proximoJogador = agora + .045;
    else this.proximoInimigo = agora + .1;
    const chave = `${perfil.id}:${elemento}`;
    const buffer = this.buffer(chave, () => sintetizarDisparo({ ...perfil, elemento }));
    const rapidez = Math.max(1, Math.min(1.7, cadencia / Math.max(1, perfil.cadencia)));
    const volume = (jogador ? .48 : .13) * (agora < this.explosaoAte ? .3 : 1);
    this.tocar(buffer, volume, pan, rapidez);
  }

  explosaoDeChefe(elemento: ElementId, pan: number): void {
    const c = this.pronto();
    if (!c) return;
    this.explosaoAte = c.currentTime + 1.2;
    this.tocar(this.buffer(`explosao:${elemento}`, () => sintetizarExplosao(elemento)), .9, pan * .35, 1, true);
  }

  private pronto(): AudioContext | null {
    const s = this.preferencias();
    return !this.encerrado && !document.hidden && !s.muted && s.volumeMestre > 0 && s.volumeEfeitos > 0
      && this.contexto?.state === 'running' ? this.contexto : null;
  }

  private buffer(id: string, gerar: () => Float32Array): AudioBuffer {
    const existente = this.buffers.get(id);
    if (existente) return existente;
    const amostras = gerar();
    const buffer = this.contexto!.createBuffer(1, amostras.length, 24000);
    buffer.getChannelData(0).set(amostras);
    if (this.buffers.size >= 160) this.buffers.delete(this.buffers.keys().next().value!);
    this.buffers.set(id, buffer);
    return buffer;
  }

  private tocar(buffer: AudioBuffer, volume: number, pan: number, rapidez: number, prioridade = false): void {
    const c = this.contexto!;
    if (this.vozes.size >= 20) {
      if (!prioridade) return;
      this.vozes.values().next().value?.stop();
    }
    const voz = c.createBufferSource();
    const ganho = c.createGain();
    const stereo = c.createStereoPanner();
    voz.buffer = buffer;
    voz.playbackRate.value = rapidez;
    ganho.gain.value = volume;
    stereo.pan.value = Math.max(-.8, Math.min(.8, pan));
    voz.connect(ganho).connect(stereo).connect(this.ganho!);
    this.vozes.add(voz);
    voz.onended = () => { this.vozes.delete(voz); voz.disconnect(); ganho.disconnect(); stereo.disconnect(); };
    voz.start();
  }

  private pararVozes(): void {
    for (const voz of this.vozes) { try { voz.stop(); } catch { /* Já terminou. */ } }
    this.vozes.clear();
  }

  dispose(): void {
    this.encerrado = true;
    window.removeEventListener('pointerdown', this.ativar);
    window.removeEventListener('keydown', this.ativar);
    document.removeEventListener('visibilitychange', this.visibilidade);
    this.pararVozes();
    this.buffers.clear();
    void this.contexto?.close().catch(() => {});
  }
}

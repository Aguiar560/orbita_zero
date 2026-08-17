import type { Item, Resources } from '@sim/types';

/** Todos os eventos entre simulação, modos e UI. Um lugar só, tipado. */
export interface GameEvents {
  'save:written': { at: number };
  'save:loaded': { offlineSeconds: number };

  'state:changed': void;
  'resources:changed': void;

  'sector:advanced': { universe: number; sector: number };
  'sector:failed': { sector: number; perdido: Resources };
  'wave:cleared': { wave: number; ofWaves: number };
  'boss:spawned': { id: string; name: string };
  'boss:defeated': { id: string; name: string; sector: number };

  'loot:dropped': { item: Item };
  'chest:granted': { tier: string; source: string };
  'chest:opened': { tier: string; items: Item[] };

  'universe:ascended': { from: number; to: number; aether: number };

  'toast': { text: string; kind?: 'info' | 'good' | 'bad' | 'epic'; icon?: string };
  'panel:open': { id: string };
  'panel:close': void;
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

/**
 * Barramento de eventos síncrono. Handlers adicionados durante um `emit` só
 * recebem o evento seguinte (iteramos sobre uma cópia), o que evita laços
 * infinitos quando um painel reage abrindo outro.
 */
export class Bus {
  private readonly map = new Map<string, Set<(p: unknown) => void>>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<K>): () => void {
    let set = this.map.get(event as string);
    if (!set) this.map.set(event as string, (set = new Set()));
    set.add(handler as (p: unknown) => void);
    return () => set!.delete(handler as (p: unknown) => void);
  }

  once<K extends keyof GameEvents>(event: K, handler: Handler<K>): () => void {
    const off = this.on(event, (p) => {
      off();
      handler(p);
    });
    return off;
  }

  emit<K extends keyof GameEvents>(
    event: K,
    ...args: GameEvents[K] extends void ? [] : [GameEvents[K]]
  ): void {
    const set = this.map.get(event as string);
    if (!set || set.size === 0) return;
    const payload = args[0] as unknown;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[bus] handler de "${String(event)}" falhou:`, err);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}

export const bus = new Bus();

/** Atalho para o evento mais usado da UI. */
export const toast = (text: string, kind: GameEvents['toast']['kind'] = 'info', icon?: string): void =>
  bus.emit('toast', { text, kind, icon });

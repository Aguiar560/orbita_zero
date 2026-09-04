import type { Item, Resources } from '@sim/types';
import type { ResumoDaMorte } from '@sim/morte';

/** Todos os eventos entre simulação, modos e UI. Um lugar só, tipado. */
export interface GameEvents {
  'save:written': { at: number };
  'save:loaded': { offlineSeconds: number };

  'state:changed': void;
  'resources:changed': void;

  'sector:advanced': { universe: number; sector: number };
  'sector:failed': { sector: number; perdido: Resources; resumo: ResumoDaMorte };
  /**
   * A nave bateu na parede: três quedas seguidas no mesmo setor.
   *
   * O jogo NÃO recua sozinho — mover o setor por conta própria tira do jogador
   * a decisão que a trava de setor existe para dar. Este evento só avisa; quem
   * escuta oferece a escolha, e o estado só muda se ele aceitar.
   */
  'sector:parede': { setor: number; quedas: number };
  'wave:cleared': { wave: number; ofWaves: number };
  'boss:spawned': { id: string; name: string };
  'boss:defeated': { id: string; name: string; sector: number };

  // Núcleo de Provação (§61). Existem para as missões e a telemetria futura
  // ouvirem o modo sem que ele precise conhecê-las.
  'provacao:iniciado': { piso: number };
  'provacao:vencido': { piso: number; chefeId: string; camadas: string[] };
  'provacao:falhou': { piso: number };
  'provacao:marco': { piso: number };

  /**
   * A nave em campo secou e o comando passou para outra.
   *
   * Evento e não FATO: fato alimenta missão, e ficar sem combustível não é
   * conquista de ninguém. A tela usa para avisar; se ninguém ouvir, o jogo
   * continua igual.
   */
  'combustivel:seco': { trocouPara: string };

  'loot:dropped': { item: Item };
  'chest:granted': { tier: string; source: string };
  'chest:opened': { tier: string; items: Item[] };

  'universe:ascended': { from: number; to: number; aether: number };

  'toast': { text: string; kind?: 'info' | 'good' | 'bad' | 'epic'; icon?: string };
  /** `galaxy` leva o contexto do mapa para o placar sem persistir uma escolha de UI. */
  'panel:open': { id: string; galaxy?: number };
  'panel:close': void;
  /** Pedido de reabrir o passeio guiado, vindo de Ajustes. */
  'guia:abrir': void;

  /**
   * Abre o tutorial de UMA tela.
   *
   * Evento e nao chamada direta porque quem sabe que a tela abriu e o `Shell`,
   * e quem sabe montar um `Tour` e o `Game` — que tambem e quem devolve o
   * estado da interface no fim. Ligar os dois pelo barramento evita o `Shell`
   * passar a conhecer o passeio.
   */
  'guia:painel': { id: string };
  /**
   * Fecha o modal de Configurações de fora dele.
   *
   * Existe porque Ajustes é MODAL e não camada: `panel:close` fecha camadas e
   * passava reto por ele. O conteúdo do painel não tem como alcançar o
   * `close()` local do modal que o hospeda, e não deveria ter — ele não sabe
   * quem o abriu.
   */
  'ajustes:fechar': void;
  /**
   * Escala, resolucao ou contador de FPS mudaram.
   *
   * Elas vivem FORA do estado da simulacao — mexem no documento e no canvas —,
   * entao ninguem as le durante o quadro: precisam ser empurradas quando mudam.
   */
  'preferencias:visuais': void;
  /**
   * Caiu item e o Inventário está cheio — ele NÃO foi coletado.
   *
   * Evento e não fato: a tela avisa, e se ninguém ouvir o jogo segue igual.
   * O item continua no lote, para ser coletado quando houver espaço.
   */
  /**
   * O Armazém do jogador está cheio e uma peça chegou. `motivo` diz o destino:
   *
   * - `nao-coletado`: ela ficou no lote e volta a cair quando houver espaço.
   * - `descartada`: ela FOI coletada e desmontada/vendida na hora, porque a
   *   automação que o jogador ligou manda fazer isso.
   * - `trocada`: ela era melhor, entrou, e a pior guardada saiu no lugar.
   *
   * Os três precisam de textos diferentes porque só o primeiro é uma perda. O
   * silêncio anterior tratava os três como o mesmo nada.
   */
  'inventario:cheio': { motivo: 'nao-coletado' | 'descartada' | 'trocada' };

  /** Caiu a primeira peça de escudo: oferece desligar a bolha. */
  'dica:escudo': void;
  'laboratorio:changed': void;
  /**
   * Uma peça começou ou terminou de ser arrastada.
   *
   * Existe separado de `state:changed` porque este é AMOSTRADO: a Anatomia
   * repinta no máximo a cada 0,2s, e um realce de soquete que aparece até
   * duzentos milissegundos depois de o arraste começar chega tarde demais —
   * o jogador já moveu o cursor. Arraste é entrada direta, como o clique da
   * alça, e entrada direta não espera o relógio.
   */
  'arraste:mudou': void;
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

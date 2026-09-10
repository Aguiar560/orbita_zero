import { fmt } from '@core/format';
import {
  SHOP, shopCost, shopLimit,
  type ShopCategory, type ShopItem,
} from '@data/shop';
import { nivelExigido } from '@data/balance/curvas';
import { CHESTS, type ChestDef } from '@data/chests';
import { comprarVip, espelharNoSim } from '@app/carteira';
import { abrirCobranca, conferirCompra, type Cobranca } from '@app/compras';
import {
  CRYSTAL_PACKAGES, VIP_COST_CRYSTALS, VIP_DURATION_DAYS, cristaisDoPacote,
} from '@sim/vip';
import type { ResourceId } from '@sim/types';
import type { Sim } from '@sim/index';
import { h, progressBar, spriteIcon } from '../dom';
import { RESOURCE_META } from '../recursos';
import type { Panel } from './types';

const CATEGORY: Record<ShopCategory, { label: string; cor: string }> = {
  logistica: { label: 'LOGÍSTICA', cor: '#55bddc' },
  sistemas: { label: 'SISTEMAS', cor: '#a978ff' },
  cambio: { label: 'CÂMBIO CONTROLADO', cor: '#f0b45a' },
};

const CATEGORIES: readonly ShopCategory[] = ['logistica', 'sistemas', 'cambio'];
/**
 * De quanto em quanto tempo a tela do Pix pergunta se o dinheiro caiu.
 *
 * Cinco segundos é o que qualquer app de pagamento faz, e é o ritmo para o qual
 * o balde `cobranca` do servidor foi dimensionado. Mais devagar parece travado
 * — o Pix cai em segundos, e a tela precisa acompanhar isso.
 */
const INTERVALO_DA_ESPERA = 5000;
const SERVICE_ART_ROOT = '/assets/ui/loja/services';
const CHEST_ART_ROOT = '/assets/ui/baus/chests';
type ShopSection = 'servicos' | 'baus' | 'cristais' | 'vip';

function serviceArt(file: string, className: string): HTMLElement {
  return h(`img.${className}`, {
    src: `${SERVICE_ART_ROOT}/${file}`,
    alt: '',
    'aria-hidden': true,
    decoding: 'async',
    draggable: false,
  });
}

/**
 * Central de Serviços.
 *
 * A gramática é a mesma da Provação e dos Baús: catálogo à esquerda, operação
 * em foco no centro e contexto decisivo à direita. Cor identifica moeda ou
 * serviço; a estrutura continua escura para a hierarquia não virar neon.
 */
export class ShopPanel implements Panel {
  id = 'loja';
  title = 'Loja';
  icon = 'aba/loja';
  iconUrl = '/assets/ui/menu/loja.webp';
  overlay = true;

  private selected = 'carga';
  private section: ShopSection = 'servicos';
  private feedback = 'SELECIONE UM SERVIÇO';
  /** Trava do botão do passe enquanto o servidor responde. */
  private comprando = false;
  /** A cobrança Pix aberta. Enquanto existe, ela ocupa o lugar da vitrine. */
  private cobranca: Cobranca | null = null;
  private compraEstado: 'pendente' | 'paga' | 'expirada' | 'cancelada' = 'pendente';
  /** Qual pacote está esperando resposta do `/checkout`. */
  private abrindo: string | null = null;
  /** Já existe um laço perguntando pelo pagamento? Ver `esperarOPix`. */
  private esperando = false;
  private copiado = false;
  /** A recusa da última tentativa de abrir cobrança, em português. */
  private avisoDaLoja = '';

  badge(sim: Sim): number {
    return SHOP.filter((item) => this.visible(sim, item) && sim.canBuyShopItem(item.id)).length;
  }

  /**
   * Reabrir a Loja volta à vitrine — a menos que haja um Pix esperando.
   *
   * A cobrança morava num campo do painel, que sobrevive a fechar e abrir.
   * Depois de uma compra PAGA, toda reabertura mostrava de novo o QR e o
   * "RECEBIDO" (relato de 10/09/2026); a única saída era o botão de voltar.
   *
   * A cobrança PENDENTE fica: quem fechou a Loja no meio do pagamento precisa
   * reencontrar o QR, e abrir outra cobrança para o mesmo Pix seria pior. Paga,
   * vencida e cancelada já disseram o que tinham a dizer.
   */
  aoAbrir(): void {
    if (!this.cobranca || this.compraEstado === 'pendente') return;
    this.cobranca = null;
    this.compraEstado = 'pendente';
    this.copiado = false;
    this.avisoDaLoja = '';
    this.feedback = 'SELECIONE UM PACOTE';
  }

  render(sim: Sim): HTMLElement {
    const visible = SHOP.filter((item) => this.visible(sim, item));
    if (!visible.some((i) => i.id === this.selected)) this.selected = visible[0]?.id ?? 'carga';
    const selected = visible.find((i) => i.id === this.selected) ?? visible[0] ?? SHOP[0]!;

    return h(`.panel-body.loj${sim.state.settings.reduceEffects ? '.efeitos-reduzidos' : ''}`, {},
      this.header(sim),
      this.tabs(sim),
      this.section === 'servicos'
        ? h('.loj-corpo', {},
            this.catalog(sim, visible),
            this.serviceTerminal(sim, selected),
            this.serviceContext(sim, selected),
          )
        : this.section === 'baus' ? this.chestStore(sim)
          : this.section === 'cristais' ? this.crystalStore(sim)
            : this.vipArea(sim),
      h('.loj-rodape', {},
        h('span', { text: 'CONVENIÊNCIA, ESCOLHA E TRANSAÇÕES TRANSPARENTES.' }),
        h('span', { text: this.feedback }),
      ),
    );
  }

  private header(sim: Sim): HTMLElement {
    return h('.loj-topo', {},
      h('.loj-titulo', {},
        spriteIcon('aba/loja', 42),
        h('.loj-titulo-copy', {},
          h('h1', { text: 'ÓRBITA MARKET' }),
          h('span', { text: 'Serviços, cápsulas, cristais e acesso VIP' }),
        ),
      ),
      h('.loj-saldos', {}, ...(['sucata', 'nucleo', 'cristal'] as ResourceId[]).map((id) => {
        const meta = RESOURCE_META[id];
        return h('.loj-saldo', { style: { '--loj-cor': meta.color } as Partial<CSSStyleDeclaration> },
          spriteIcon(meta.icon, 25),
          h('span', {}, h('small', { text: meta.label.toUpperCase() }), h('strong', { text: fmt(sim.state.resources[id]) })),
        );
      })),
    );
  }

  private tabs(sim: Sim): HTMLElement {
    const tabs: readonly [ShopSection, string, string][] = [
      ['servicos', 'SERVIÇOS', 'Logística e sistemas'],
      ['baus', 'BAÚS', 'Escolha sua cápsula'],
      ['cristais', 'CRISTAIS', 'Pacotes de crédito'],
      ['vip', 'VIP', sim.vipAtivo ? `${sim.vipDiasRestantes} dias restantes` : 'Passe de 30 dias'],
    ];
    return h('nav.loj-abas', { role: 'tablist', 'aria-label': 'Áreas da loja' },
      ...tabs.map(([id, label, hint]) => h(`button.loj-aba${this.section === id ? '.ativa' : ''}${id === 'vip' ? '.vip' : ''}`, {
        role: 'tab',
        'aria-selected': String(this.section === id),
        onclick: () => { this.section = id; this.feedback = `${label} EM FOCO`; sim.touch(); },
      }, h('strong', { text: label }), h('span', { text: hint }))),
    );
  }

  private chestStore(sim: Sim): HTMLElement {
    const vendaveis = CHESTS.filter((chest) => chest.buy > 0);
    return h('.loj-vitrine.loj-vitrine-baus', {},
      h('.loj-vitrine-topo', {},
        h('span', { text: 'CÂMARA DE AQUISIÇÃO' }),
        h('h2', { text: 'ESCOLHA O BAÚ QUE DESEJA COMPRAR' }),
        h('p', { text: 'A cápsula entra no estoque de Baús. Abra quando quiser e consulte ali as probabilidades completas.' }),
      ),
      h('.loj-cards.loj-bau-cards', {}, ...vendaveis.map((chest) => this.chestCard(sim, chest))),
    );
  }

  private chestCard(sim: Sim, chest: ChestDef): HTMLElement {
    const stock = sim.state.chests[chest.id] ?? 0;
    return h('.loj-card.loj-bau-card', { style: { '--loj-cor': chest.color } as Partial<CSSStyleDeclaration> },
      h('.loj-card-selo', { text: `${chest.items[0]}–${chest.items[1]} ITENS` }),
      h('img.loj-bau-art', { src: `${CHEST_ART_ROOT}/${chest.art}`, alt: chest.name, decoding: 'async', draggable: false }),
      h('h3', { text: chest.name.toUpperCase() }),
      h('p', { text: `Bônus de nível +${chest.ilvlBonus} · ${stock} no estoque` }),
      h('button.btn.loj-card-acao', {
        disabled: !sim.can('cristal', chest.buy),
        onclick: () => {
          if (!sim.buyChest(chest.id)) return;
          this.feedback = `${chest.name.toUpperCase()} ADICIONADA AO ESTOQUE`;
          sim.touch();
        },
      }, h('span', { text: 'COMPRAR' }), h('.loj-preco', {}, spriteIcon('moeda_2', 20), h('strong', { text: fmt(chest.buy) }))),
    );
  }

  /**
   * A vitrine dos pacotes — ou a tela do Pix, quando há cobrança aberta.
   *
   * ## Por que a cobrança ocupa a MESMA área
   *
   * A Loja já é uma camada por cima do jogo. Uma janela para o QR seria uma
   * segunda camada sobre a primeira, e é a decisão que os Baús já tinham
   * recusado ao confirmar a abertura dentro do próprio botão. A vitrine sai, a
   * cobrança entra, e o botão VOLTAR desfaz — sem nada empilhado.
   */
  private crystalStore(sim: Sim): HTMLElement {
    if (this.cobranca) return this.pixScreen(sim, this.cobranca);

    const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    return h('.loj-vitrine.loj-vitrine-cristais', {},
      h('.loj-vitrine-topo', {},
        h('span', { text: 'RESERVA DE CRISTAIS' }),
        h('h2', { text: 'PACOTES PARA PAGAMENTO EM DINHEIRO REAL' }),
        h('p', { text: 'Pagamento por Pix, dentro do jogo. O crédito entra quando o banco confirma — não quando esta tela diz que sim.' }),
        this.avisoDaLoja ? h('.loj-aviso', { role: 'alert', text: this.avisoDaLoja }) : null,
      ),
      h('.loj-cards.loj-cristal-cards', {}, ...CRYSTAL_PACKAGES.map((pack) => h('.loj-card.loj-cristal-card', {},
        pack.badge ? h('.loj-card-selo', { text: pack.badge }) : null,
        h('.loj-cristal-gema', {}, spriteIcon('moeda_2', 52)),
        h('h3', { text: pack.name.toUpperCase() }),
        h('strong.loj-cristal-total', { text: `${fmt(cristaisDoPacote(pack))} CRISTAIS` }),
        h('p', { text: pack.bonus > 0 ? `${fmt(pack.base)} + ${fmt(pack.bonus)} de bônus` : 'Pacote direto, sem bônus' }),
        h('button.btn.loj-card-acao', {
          // Trava enquanto o servidor responde: dois cliques são duas cobranças
          // abertas, e a segunda só apareceria como um Pix órfão no painel.
          disabled: this.abrindo !== null,
          onclick: () => this.pedirCobranca(sim, pack.id),
        },
          h('span', { text: this.abrindo === pack.id ? 'ABRINDO…' : 'COMPRAR' }),
          h('strong', { text: brl.format(pack.priceCents / 100) }),
        ),
      ))),
    );
  }

  /**
   * Pede a cobrança ao servidor.
   *
   * Manda só o ID do pacote. Preço e quantidade são decididos lá, no mesmo
   * catálogo que esta tela desenha — mandá-los daqui seria deixar o jogador
   * dizer quanto vai pagar por 2.400 cristais.
   */
  private pedirCobranca(sim: Sim, pacote: string): void {
    if (this.abrindo) return;
    this.abrindo = pacote;
    this.avisoDaLoja = '';
    this.feedback = 'ABRINDO A COBRANÇA…';
    sim.touch();

    void abrirCobranca(pacote).then((r) => {
      this.abrindo = null;
      if (!r.ok) {
        // A recusa é AUDÍVEL, e no lugar em que o jogador está olhando: um
        // botão que não faz nada é o defeito que este projeto já pagou caro.
        this.avisoDaLoja = r.motivo;
        this.feedback = r.motivo;
        sim.touch();
        return;
      }
      this.cobranca = r.cobranca;
      this.compraEstado = 'pendente';
      this.copiado = false;
      this.feedback = 'PIX ABERTO · AGUARDANDO PAGAMENTO';
      sim.touch();
    });
  }

  /**
   * A cobrança aberta: QR, copia-e-cola e o estado do pagamento.
   *
   * ## Por que o copia-e-cola tem o mesmo peso do QR
   *
   * Porque o jogo roda no navegador, e quem está no celular não tem uma segunda
   * câmera para ler a própria tela. O QR serve a quem joga no computador; o
   * código serve a todo mundo.
   */
  private pixScreen(sim: Sim, cobranca: Cobranca): HTMLElement {
    const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const pago = this.compraEstado === 'paga';
    const vencida = this.compraEstado === 'expirada' || this.compraEstado === 'cancelada';

    // O laço vive aqui, e não no clique: assim ele volta sozinho quando o
    // jogador sai para a aba do VIP e retorna. Ver `esperarOPix`.
    if (!pago && !vencida) this.esperarOPix(sim, cobranca.compra);

    return h('.loj-vitrine.loj-vitrine-cristais.loj-pix', {},
      h('.loj-vitrine-topo', {},
        h('span', { text: pago ? 'PAGAMENTO CONFIRMADO' : 'PAGAMENTO PIX' }),
        h('h2', { text: `${fmt(cobranca.cristais)} CRISTAIS · ${brl.format(cobranca.centavos / 100)}` }),
        h('p', { text: pago
          ? 'Os cristais já estão na sua conta. Eles moram no servidor, então aparecem em qualquer aparelho onde você entrar.'
          : vencida
            ? 'Esta cobrança venceu. Se você pagou mesmo assim, o crédito ainda entra — o pagamento é honrado.'
            : 'Leia o QR no app do seu banco ou use o código abaixo. A confirmação chega sozinha nesta tela.' }),
      ),
      h('.loj-pix-corpo', {},
        h('.loj-pix-qr', {},
          cobranca.qr
            ? h('img', { src: `data:image/png;base64,${cobranca.qr}`, alt: 'QR do Pix', decoding: 'async', draggable: false })
            : h('span', { text: 'USE O CÓDIGO AO LADO' }),
        ),
        h('.loj-pix-lado', {},
          h(`.loj-pix-estado${pago ? '.paga' : vencida ? '.vencida' : '.esperando'}`, { role: 'status' },
            h('strong', { text: pago ? 'RECEBIDO' : vencida ? 'VENCIDA' : 'AGUARDANDO O PAGAMENTO' }),
            h('span', { text: pago
              ? `+${fmt(cobranca.cristais)} cristais creditados`
              : vencida ? 'Abra uma nova cobrança' : 'Esta tela confirma sozinha' }),
          ),
          h('label.loj-pix-codigo', {},
            h('small', { text: 'CÓDIGO COPIA E COLA' }),
            h('textarea', {
              readonly: true,
              rows: 3,
              // Selecionar tudo ao tocar é o caminho de quem não pode usar a
              // área de transferência — navegador antigo, permissão negada.
              onclick: (e: Event) => (e.currentTarget as HTMLTextAreaElement).select(),
            }, cobranca.copiaECola),
          ),
          h('.loj-pix-acoes', {},
            h('button.btn', {
              onclick: () => {
                void navigator.clipboard?.writeText(cobranca.copiaECola)
                  .then(() => { this.copiado = true; this.feedback = 'CÓDIGO COPIADO'; sim.touch(); })
                  // Área de transferência bloqueada não é falha silenciosa: o
                  // texto continua selecionável, e a tela precisa dizer isso.
                  .catch(() => { this.feedback = 'COPIE O CÓDIGO MANUALMENTE'; sim.touch(); });
              },
            }, h('span', { text: this.copiado ? 'COPIADO' : 'COPIAR CÓDIGO' })),
            h('button.btn.loj-pix-voltar', {
              onclick: () => {
                this.cobranca = null;
                this.avisoDaLoja = '';
                this.feedback = pago ? 'CRISTAIS CREDITADOS' : 'COBRANÇA DEIXADA ABERTA';
                sim.touch();
              },
            }, h('span', { text: pago ? 'VOLTAR À VITRINE' : 'VOLTAR' })),
          ),
          h('.loj-pix-nota', {},
            h('strong', { text: 'O CRÉDITO É DO SERVIDOR' }),
            h('span', { text: 'Fechar esta tela não cancela nada. O pagamento é reconhecido mesmo com o jogo fechado.' }),
          ),
        ),
      ),
    );
  }

  /**
   * Pergunta ao servidor, de cinco em cinco segundos, se o Pix caiu.
   *
   * ## Por que a TELA pergunta, se existe webhook
   *
   * Porque o webhook é uma conversa entre o provedor e o servidor, e esta tela
   * não está nela. Ela precisa saber que o dinheiro entrou para dizer
   * "recebido" — e, de quebra, é ela que faz o servidor consultar o provedor,
   * o que fecha a compra mesmo quando o webhook não chega.
   *
   * ## As três formas de parar
   *
   * Trocar de cobrança, o pagamento sair do pendente, e a tela desaparecer.
   * A última é a que importa: sem ela, fechar o painel deixaria um laço
   * perguntando para ninguém até a cobrança vencer. E como o laço nasce no
   * `pixScreen`, voltar para a tela o traz de volta.
   */
  private esperarOPix(sim: Sim, id: string): void {
    if (this.esperando) return;
    this.esperando = true;

    const passo = async (): Promise<void> => {
      if (this.cobranca?.compra !== id
        || this.compraEstado !== 'pendente'
        || !document.querySelector('.loj-pix')) {
        this.esperando = false;
        return;
      }

      const r = await conferirCompra(id);
      // A cobrança pode ter mudado enquanto a resposta viajava.
      if (this.cobranca?.compra !== id) { this.esperando = false; return; }

      if (r) {
        // Vencida só muda o rótulo: um Pix pago depois disso continua sendo
        // creditado, e é por isso que o servidor separa `estado` de `expirada`.
        this.compraEstado = r.estado === 'pendente' && r.expirada ? 'expirada' : r.estado;
        if (this.compraEstado === 'paga') {
          // O saldo novo veio na mesma resposta. Sem esta linha o topo da tela
          // só o mostraria no fim do setor seguinte — ver `espelharNoSim`.
          espelharNoSim(sim);
          this.feedback = `RECEBIDO · +${fmt(r.cristais)} CRISTAIS`;
        }
      }

      sim.touch();
      if (this.compraEstado === 'pendente') {
        window.setTimeout(() => void passo(), INTERVALO_DA_ESPERA);
      } else {
        this.esperando = false;
      }
    };

    window.setTimeout(() => void passo(), INTERVALO_DA_ESPERA);
  }

  private vipArea(sim: Sim): HTMLElement {
    const benefits = [
      ['6', 'tentativas na Provação'],
      ['AUTO', 'venda por raridade'],
      ['AUTO', 'equipar o melhor item'],
      ['5', 'missões rastreadas'],
      ['DUAL', 'Idle e pilotagem manual'],
    ] as const;
    return h('.loj-vitrine.loj-vitrine-vip', {},
      h('.loj-vip-hero', {},
        h('.loj-vip-emblema', { text: 'VIP' }),
        h('.loj-vip-copy', {},
          h('span', { text: sim.vipAtivo ? 'PROTOCOLO VIP ATIVO' : 'PROTOCOLO DE COMANDO' }),
          h('h2', { text: `PASSE VIP · ${VIP_DURATION_DAYS} DIAS` }),
          h('p', { text: sim.vipAtivo
            ? `Acesso ativo por mais ${sim.vipDiasRestantes} dias. Renovar agora acumula mais 30 dias.`
            : 'Mais automação e liberdade de pilotagem, sem adicionar dano, defesa ou atributos exclusivos.' }),
        ),
        // A compra é do SERVIDOR, e por isso é assíncrona.
        //
        // Era o último lugar em que escrever `vip.expiresAt` no console dava um
        // passe de graça: o cliente debitava, carimbava a validade, e o save
        // subia isso como blob que o servidor gravava sem olhar dentro.
        //
        // O botão trava enquanto espera. Sem a trava, dois cliques viram duas
        // cobranças de 500 cristais — e a segunda só seria descoberta quando o
        // saldo voltasse menor do que deveria.
        h('button.btn.loj-vip-comprar', {
          disabled: this.comprando || !sim.can('cristal', VIP_COST_CRYSTALS),
          onclick: () => {
            if (this.comprando) return;
            this.comprando = true;
            // `sim.touch()`, e não `this.render(sim)`: quem redesenha é o laço
            // do jogo, quando o estado muda. Chamar `render` aqui montava uma
            // árvore de nós e a jogava fora — a trava do botão e o texto do
            // rodapé só apareciam no próximo quadro em que outra coisa mudasse.
            sim.touch();
            void comprarVip().then((ok) => {
              this.comprando = false;
              // O passe e o saldo acabaram de mudar NO SERVIDOR. Espelhar aqui
              // é o que faz o botão virar RENOVAR e o topo perder os 500
              // cristais na hora, em vez de no fim do setor seguinte.
              if (ok) espelharNoSim(sim);
              this.feedback = ok
                ? `PASSE VIP ATIVO · ${sim.vipDiasRestantes} DIAS`
                : 'NÃO FOI POSSÍVEL ATIVAR. TENTE DE NOVO.';
              sim.touch();
            });
          },
        },
          h('span', { text: sim.vipAtivo ? 'RENOVAR PASSE' : 'ATIVAR PASSE' }),
          h('.loj-preco', {}, spriteIcon('moeda_2', 22), h('strong', { text: fmt(VIP_COST_CRYSTALS) })),
        ),
      ),
      h('.loj-vip-beneficios', {}, ...benefits.map(([signal, label]) => h('.loj-vip-beneficio', {},
        h('strong', { text: signal }), h('span', { text: label }),
      ))),
      h('.loj-vip-nota', {},
        h('strong', { text: 'CONVERSÃO TRANSPARENTE' }),
        h('span', { text: '500 cristais correspondem ao pacote Comando de R$ 24,90. O passe não concede poder de combate exclusivo.' }),
      ),
    );
  }

  private catalog(sim: Sim, items: readonly ShopItem[]): HTMLElement {
    return h('.loj-col.loj-catalogo', {},
      h('.loj-secao', { text: 'CATÁLOGO' }),
      ...CATEGORIES.flatMap((category) => {
        const meta = CATEGORY[category];
        const categoryItems = items.filter((i) => i.category === category);
        if (!categoryItems.length) return [];
        const rows: HTMLElement[] = [h('.loj-grupo', { text: meta.label, style: { '--loj-cor': meta.cor } as Partial<CSSStyleDeclaration> })];
        for (const item of categoryItems) rows.push(this.catalogItem(sim, item));
        return rows;
      }),
    );
  }

  private catalogItem(sim: Sim, item: ShopItem): HTMLElement {
    const active = this.selected === item.id;
    const ready = sim.canBuyShopItem(item.id);
    const owned = sim.shopOwned(item.id);
    const limit = shopLimit(item, sim.state.command.nivel);
    const color = RESOURCE_META[item.currency].color;
    return h(`button.loj-servico${active ? '.ativo' : ''}${ready ? '.pronto' : ''}`, {
      style: { '--loj-cor': color } as Partial<CSSStyleDeclaration>,
      onclick: () => { this.selected = item.id; this.feedback = `${item.name.toUpperCase()} EM FOCO`; sim.touch(); },
    },
      serviceArt(item.art, 'loj-servico-img'),
      h('.loj-servico-copy', {},
        h('strong', { text: item.name }),
        h('span', { text: item.desc }),
      ),
      h('.loj-servico-sinal', { text: limit > 0 ? `${owned}/${limit}` : '●' }),
    );
  }

  private serviceTerminal(sim: Sim, item: ShopItem): HTMLElement {
    const owned = sim.shopOwned(item.id);
    const limit = shopLimit(item, sim.state.command.nivel);
    const cost = shopCost(item, owned);
    const meta = RESOURCE_META[item.currency];
    const ready = sim.canBuyShopItem(item.id);
    const fullAttempt = item.effect === 'tentativa_provacao'
      && sim.provacaoTentativas.tem >= sim.provacaoTentativas.max;
    const emptyMatrix = item.effect === 'refaz_matriz' && sim.matrixSpent === 0;
    const exhausted = limit > 0 && owned >= limit;
    const buttonText = exhausted ? 'ESTOQUE ESGOTADO'
      : fullAttempt ? 'TENTATIVAS CHEIAS'
        : emptyMatrix ? 'MATRIZ SEM PONTOS'
          : item.kind === 'cambio' ? 'AUTORIZAR CONVERSÃO'
            : item.kind === 'permanente' ? 'INSTALAR MÓDULO' : 'EXECUTAR SERVIÇO';

    return h('.loj-col.loj-terminal', { style: { '--loj-cor': meta.color } as Partial<CSSStyleDeclaration> },
      h('.loj-secao', { text: 'TERMINAL DE OPERAÇÃO' }),
      h('.loj-hero', {},
        h('.loj-orbita', {}),
        h('.loj-hero-icon', {}, serviceArt(item.art, 'loj-hero-art')),
        h('.loj-classificacao', { text: CATEGORY[item.category].label }),
      ),
      h('.loj-operacao', {},
        h('span', { text: 'SERVIÇO SELECIONADO' }),
        h('h2', { text: item.name.toUpperCase() }),
        h('p', { text: item.detail }),
      ),
      limit > 0
        ? h('.loj-limite', {},
            h('span', { text: item.kind === 'permanente' ? 'INSTALAÇÕES' : 'COTA LIBERADA' }),
            progressBar(limit > 0 ? owned / limit : 0, meta.color, 5),
            h('strong', { text: `${owned} / ${limit}` }),
          )
        : h('.loj-limite.sem-limite', {}, h('span', { text: 'OPERAÇÃO AVULSA' }), h('strong', { text: 'SEM COTA' })),
      h('button.btn.loj-executar', {
        disabled: !ready,
        onclick: () => {
          if (!sim.buyShopItem(item.id)) return;
          // Serviço com alvo não acontece aqui: a compra guarda uma CARGA no
          // Armazém, e o alvo se escolhe lá, com a peça à vista. A loja tentou
          // resolver isso num modal com a lista de todas as peças, e obrigava
          // o jogador a decorar "Reator nv 30 · Raro · Fogo" para achar o
          // ícone certo depois — traduzir do texto para a grade.
          if (item.alvo) {
            this.feedback = `${item.name.toUpperCase()} · CARGA NO ARMAZÉM`;
            return;
          }
          this.feedback = `${item.name.toUpperCase()} · OPERAÇÃO CONCLUÍDA`;
        },
      },
        h('span', { text: buttonText }),
        h('.loj-preco', {}, spriteIcon(meta.icon, 20), h('strong', { text: fmt(cost) })),
      ),
    );
  }

  private serviceContext(sim: Sim, item: ShopItem): HTMLElement {
    const owned = sim.shopOwned(item.id);
    const limit = shopLimit(item, sim.state.command.nivel);
    const output = Object.entries(item.output ?? {});
    return h('.loj-col.loj-contexto', {},
      h('.loj-secao', { text: 'LEITURA DA TRANSAÇÃO' }),
      h('.loj-diagnostico', {},
        h('span', { text: 'ENTRADA' }),
        this.resourceLine(item.currency, shopCost(item, owned), 'débito'),
        ...(output.length
          ? [h('.loj-fluxo', { text: '↓ CONVERSÃO COM PERDA ↓' }), ...output.map(([id, amount]) => this.resourceLine(id as ResourceId, amount ?? 0, 'crédito'))]
          : [h('.loj-fluxo', { text: '↓ SERVIÇO IMEDIATO ↓' })]),
      ),
      h('.loj-secao', { text: 'ESTADO' }),
      this.stateRows(sim, item, owned, limit),
      h('.loj-secao', { text: 'PROTOCOLO' }),
      h('.loj-protocolo', {},
        h('strong', { text: 'SEM PODER EXCLUSIVO' }),
        h('p', { text: item.kind === 'cambio'
          ? 'A cota cresce com o nível de comando. Recursos passivos não podem ser refinados infinitamente em cristais.'
          : 'O serviço altera organização ou tempo. Dano, defesa e atributos continuam vindo apenas de item, craft e Matriz.' }),
      ),
    );
  }

  private stateRows(sim: Sim, item: ShopItem, owned: number, limit: number): HTMLElement {
    const rows: Array<[string, string]> = [
      ['Nível de comando', String(sim.state.command.nivel)],
      ['Operações realizadas', String(owned)],
    ];
    if (limit > 0) rows.push(['Disponíveis agora', String(Math.max(0, limit - owned))]);
    if (item.effect === 'carga') rows.push(['Capacidade atual', `${sim.cargoSlots} itens`]);
    if (item.effect === 'tentativa_provacao') rows.push(['Tentativas', `${sim.provacaoTentativas.tem} / ${sim.provacaoTentativas.max}`]);
    if (item.effect === 'refaz_matriz') rows.push(['Pontos alocados', String(sim.matrixSpent)]);
    return h('.loj-estado', {}, ...rows.map(([label, value]) => h('.loj-estado-row', {}, h('span', { text: label }), h('strong', { text: value }))));
  }

  private resourceLine(id: ResourceId, amount: number, label: string): HTMLElement {
    const meta = RESOURCE_META[id];
    return h('.loj-recurso-linha', { style: { '--loj-cor': meta.color } as Partial<CSSStyleDeclaration> },
      spriteIcon(meta.icon, 27),
      h('span', {}, h('small', { text: label.toUpperCase() }), h('strong', { text: `${fmt(amount)} ${meta.label}` })),
    );
  }

  private visible(sim: Sim, item: ShopItem): boolean {
    return sim.alcanceLiberado >= (item.requiresSector ?? 0)
      && sim.nivelLiberado >= nivelExigido(item.requiresSector ?? 0);
  }
}

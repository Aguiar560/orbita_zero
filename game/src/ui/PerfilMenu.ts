import { sair, sessaoGuardada } from '@app/conta';
import { ehAdmin } from '@app/admin';
import {
  buscarResumoDeIndicacao, salvarChavePix, solicitarSaque, type ResumoDeIndicacao,
} from '@app/indicacoes';
import { apelidoAtual, buscarMeuApelido, buscarOnline, onlineAtual } from '@app/placar';
import { duration, fmt } from '@core/format';
import { HULL_BY_ID } from '@data/hulls';
import { SAQUE_MINIMO_INDICACAO_CENTAVOS } from '@data/balance/indicacoes';
import type { Sim } from '@sim/index';
import { clear, h } from './dom';

/**
 * O menu de perfil, no canto superior esquerdo.
 *
 * ## O que ele mostra, e por que essas coisas
 *
 * Um menu de conta que só oferece "sair" não vale o clique. O que o jogador
 * precisa saber olhando aqui é: **quem eu sou no jogo, onde estou na campanha
 * e se meu progresso está sincronizado.** Dados da conta não pertencem a uma
 * superfície que pode aparecer em uma transmissão ou captura de tela.
 */
export class PerfilMenu {
  readonly root = h('.perfil');
  private aberto = false;
  private carregandoApelido = false;
  private carregandoIndicacao = false;
  private indicacao: ResumoDeIndicacao | null = null;
  private indicacaoCarregada = false;
  private recadoIndicacao = '';
  private centralIndicacao: HTMLElement | null = null;
  private fecharCentralIndicacao: (() => void) | null = null;
  private operandoIndicacao = false;
  private tipoPix = 'cpf';
  private chavePix = '';
  private valorSaque = '';

  constructor(private readonly sim: Sim) {
    // Clicar fora fecha. Sem isto o menu fica aberto atrás dos painéis, e o
    // jogador descobre que ele existe ao esbarrar nele mais tarde.
    document.addEventListener('pointerdown', (e) => {
      if (this.aberto && !this.root.contains(e.target as Node)) this.fechar();
    });

    /**
     * A conta muda DEPOIS que esta barra já existe, sempre.
     *
     * A ordem do boot não deixa alternativa: a barra é montada, e só então a
     * tela de login aparece por cima dela. Quando o jogador entra, este menu já
     * leu `sessaoGuardada()` uma vez — e leu `null`.
     *
     * Sem escutar o aviso, entrar pelo Google guardava a sessão, abria o jogo e
     * deixava "Sem conta" escrito no topo até a próxima recarga. O jogador que
     * acabou de fazer login lendo "Sem conta" tem todo o direito de achar que
     * não funcionou.
     *
     * `guardar` e `sair` disparam o aviso; o listener não é removido porque
     * este menu vive enquanto a página viver.
     */

    /**
     * O selo de quem está online, só para quem administra.
     *
     * Um relógio próprio, e não um pedido a cada `render`: a barra é
     * redesenhada a cada abertura do menu e a cada troca de conta, e amarrar a
     * requisição ao desenho faria o número virar tráfego. O `buscarOnline`
     * ainda tem a própria trava de um minuto — este intervalo é o do relógio,
     * aquele é a garantia.
     *
     * Roda para todo mundo? Não: `ehAdmin` é conferido antes de perguntar.
     * Jogador comum não gasta requisição com um número que não vai ver.
     */
    const olharOnline = (): void => {
      if (!ehAdmin()) return;
      void buscarOnline().then((n) => { if (n !== null) this.render(); });
    };
    olharOnline();
    setInterval(olharOnline, 60_000);

    // O `olharOnline` entra aqui tambem, e nao so no relogio: entrar numa
    // conta de admin com a barra ja montada esperaria o minuto inteiro para o
    // selo aparecer, e um minuto olhando para uma barra sem numero e
    // indistinguivel de um numero que nao funciona.
    window.addEventListener('oz:conta', () => {
      this.fecharCentralIndicacao?.();
      this.indicacao = null;
      this.indicacaoCarregada = false;
      this.recadoIndicacao = '';
    });
    window.addEventListener('oz:conta', () => { this.render(); this.carregarApelido(); olharOnline(); });
    window.addEventListener('oz:apelido', () => this.render());

    this.render();
    this.carregarApelido();
  }

  private reais(centavos: number): string {
    return (Math.max(0, centavos) / 100).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
    });
  }

  private abrirCentralDeIndicacoes(): void {
    if (this.centralIndicacao || !this.indicacao?.ativo) return;
    this.fechar();
    const modal = h('.modal-backdrop.indicacoes-backdrop');
    this.centralIndicacao = modal;
    const fechar = (): void => {
      modal.remove();
      this.centralIndicacao = null;
      this.fecharCentralIndicacao = null;
      document.removeEventListener('keydown', tecla);
    };
    this.fecharCentralIndicacao = fechar;
    const tecla = (evento: KeyboardEvent): void => { if (evento.key === 'Escape') fechar(); };
    modal.addEventListener('click', (evento) => { if (evento.target === modal) fechar(); });
    document.addEventListener('keydown', tecla);
    document.body.append(modal);
    this.desenharCentralDeIndicacoes(fechar);
  }

  private desenharCentralDeIndicacoes(fechar: () => void): void {
    const modal = this.centralIndicacao;
    const resumo = this.indicacao;
    if (!modal || !resumo?.ativo || !resumo.codigo) return;
    const link = `${location.origin}${location.pathname}?ref=${encodeURIComponent(resumo.codigo)}`;
    const faltaParaSaque = Math.max(0, SAQUE_MINIMO_INDICACAO_CENTAVOS - resumo.disponivelCentavos);
    if (!this.valorSaque && resumo.disponivelCentavos > 0) {
      this.valorSaque = (resumo.disponivelCentavos / 100).toFixed(2).replace('.', ',');
    }
    const data = (epoch: number | null): string => epoch
      ? new Date(epoch * 1000).toLocaleDateString('pt-BR') : '—';
    const situacaoSaque: Record<string, string> = {
      solicitado: 'Em análise', analise: 'Revisão necessária', pago: 'Pago',
      recusado: 'Não concluído', cancelado: 'Cancelado',
    };
    const seletorPix = h('select.indicacoes-campo', {
      'aria-label': 'Tipo de chave Pix',
      onchange: (evento: Event) => { this.tipoPix = (evento.target as HTMLSelectElement).value; },
    },
      h('option', { value: 'cpf', text: 'CPF' }),
      h('option', { value: 'cnpj', text: 'CNPJ' }),
      h('option', { value: 'email', text: 'E-mail' }),
      h('option', { value: 'telefone', text: 'Telefone' }),
      h('option', { value: 'aleatoria', text: 'Chave aleatória' }),
    ) as HTMLSelectElement;
    seletorPix.value = this.tipoPix;

    clear(modal).append(h('.indicacoes-central', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Central de indicações' },
      h('.indicacoes-topo', {},
        h('div', {}, h('span.indicacoes-kicker', { text: 'PROGRAMA DE INDICAÇÕES' }), h('h1', { text: 'Sua rede de pilotos' })),
        h('button.camada-x', { text: '✕', 'aria-label': 'Fechar', onclick: fechar }),
      ),
      h('p.indicacoes-intro', {
        text: 'Ganhe 10% do valor real efetivamente pago por cada piloto indicado. A comissão fica 7 dias em retenção antes de entrar no saldo disponível.',
      }),
      h('.indicacoes-resumo', {},
        this.cartaoDeIndicacao('A RECEBER', this.reais(resumo.disponivelCentavos),
          faltaParaSaque > 0 ? `Faltam ${this.reais(faltaParaSaque)} para o saque mínimo` : 'Disponível para solicitar via Pix', 'disponivel'),
        this.cartaoDeIndicacao('EM RETENÇÃO', this.reais(resumo.pendenteCentavos), resumo.proximaLiberacao ? `Próxima liberação em ${data(resumo.proximaLiberacao)}` : 'Nenhuma comissão pendente', 'retencao'),
        this.cartaoDeIndicacao('PIX EM ANÁLISE', this.reais(resumo.reservadoCentavos), 'Valor já reservado para pagamento', 'reservado'),
        this.cartaoDeIndicacao('TOTAL PAGO', this.reais(resumo.recebidoCentavos), 'Histórico de saques concluídos', 'pago'),
      ),
      resumo.dividaCentavos > 0 ? h('.indicacoes-alerta', {
        text: `Há ${this.reais(resumo.dividaCentavos)} em compensação por estorno. Novas comissões cobrem esse valor antes de ficarem disponíveis.`,
      }) : null,
      h('.indicacoes-grade', {},
        h('section.indicacoes-bloco.indicacoes-convite', {},
          h('span.indicacoes-kicker', { text: 'SEU CONVITE' }),
          h('div.indicacoes-codigo', {}, h('strong', { text: resumo.codigo }), h('span', { text: resumo.codigoAtivo ? 'ATIVO' : 'BLOQUEADO' })),
          h('p', { text: `${fmt(resumo.vinculados)} contas vinculadas · ${fmt(resumo.compradores)} já compraram` }),
          h('button.btn.primary', { text: 'Copiar link de convite', disabled: !resumo.codigoAtivo, onclick: () => this.copiarLinkDeIndicacao(link) }),
        ),
        h('section.indicacoes-bloco', {},
          h('span.indicacoes-kicker', { text: 'RETIRADA SEMANAL' }),
          h('h2', { text: 'Receber por Pix' }),
          h('p', { text: resumo.pix ? `Chave cadastrada: ${resumo.pix.chaveMascarada}` : 'Cadastre uma chave Pix para solicitar o seu saldo.' }),
          h('.indicacoes-form-linha', {}, seletorPix, h('input.indicacoes-campo', {
            value: this.chavePix, placeholder: resumo.pix ? 'Digite apenas para trocar a chave' : 'Sua chave Pix',
            autocomplete: 'off', spellcheck: 'false',
            oninput: (evento: Event) => { this.chavePix = (evento.target as HTMLInputElement).value; },
          })),
          h('button.btn', {
            text: this.operandoIndicacao ? 'Salvando…' : 'Salvar chave Pix',
            disabled: this.operandoIndicacao || !this.chavePix.trim(),
            onclick: () => { void this.salvarPix(); },
          }),
          h('.indicacoes-saque', {},
            h('label', { text: 'Valor do saque' }),
            h('div.indicacoes-valor', {}, h('span', { text: 'R$' }), h('input.indicacoes-campo', {
              value: this.valorSaque, inputmode: 'decimal', placeholder: '0,00',
              oninput: (evento: Event) => { this.valorSaque = (evento.target as HTMLInputElement).value; },
            })),
            h('button.btn.primary', {
              text: this.operandoIndicacao ? 'Solicitando…' : 'Solicitar Pix',
              disabled: this.operandoIndicacao || !resumo.pix
                || resumo.disponivelCentavos < SAQUE_MINIMO_INDICACAO_CENTAVOS || Boolean(resumo.proximoSaque),
              onclick: () => { void this.sacar(); },
            }),
          ),
          h('small', {
            text: faltaParaSaque > 0
              ? `O saque mínimo é ${this.reais(SAQUE_MINIMO_INDICACAO_CENTAVOS)}. Faltam ${this.reais(faltaParaSaque)} no saldo liberado.`
              : resumo.proximoSaque
              ? `Próxima solicitação disponível em ${data(resumo.proximoSaque)}.`
              : `Saque mínimo de ${this.reais(SAQUE_MINIMO_INDICACAO_CENTAVOS)} e uma solicitação a cada 7 dias. O valor entra em análise.`,
          }),
        ),
      ),
      h('section.indicacoes-bloco.indicacoes-progressao', {},
        h('.indicacoes-progressao-topo', {},
          h('div', {}, h('span.indicacoes-kicker', { text: 'PROGRESSO DA REDE' }), h('h2', { text: 'Pilotos no nível 25' })),
          h('strong', { text: `${fmt(resumo.qualificadosNivel25)} / 100` }),
        ),
        h('.indicacoes-barra', {}, h('span', { style: { width: `${Math.min(100, resumo.qualificadosNivel25)}%` } })),
        h('.indicacoes-marcos', {}, ...resumo.marcos.map((marco) => h(`.indicacoes-marco${marco.atingido ? '.atingido' : ''}`, {},
          h('span', { text: `${marco.jogadores} PILOTOS` }),
          h('strong', { text: `${fmt(marco.cristais)} cristais` }),
          h('small', { text: marco.atingido ? 'RECOMPENSA RECEBIDA' : `${Math.max(0, marco.jogadores - resumo.qualificadosNivel25)} para chegar` }),
        ))),
      ),
      h('section.indicacoes-bloco.indicacoes-historico', {},
        h('span.indicacoes-kicker', { text: 'HISTÓRICO DE PIX' }),
        resumo.saques.length
          ? h('.indicacoes-historico-lista', {}, ...resumo.saques.map((saque) => h('.indicacoes-historico-linha', {},
            h('span', { text: data(saque.solicitadoEm) }),
            h('strong', { text: this.reais(saque.centavos) }),
            h('em', { text: situacaoSaque[saque.estado] ?? saque.estado }),
          )))
          : h('p', { text: 'Você ainda não solicitou nenhum saque.' }),
      ),
      this.recadoIndicacao ? h('p.indicacoes-feedback', { text: this.recadoIndicacao }) : null,
    ));
  }

  private cartaoDeIndicacao(rotulo: string, valor: string, apoio: string, classe: string): HTMLElement {
    return h(`.indicacoes-card.${classe}`, {}, h('span', { text: rotulo }), h('strong', { text: valor }), h('small', { text: apoio }));
  }

  private async recarregarCentral(): Promise<void> {
    this.indicacao = await buscarResumoDeIndicacao();
    this.indicacaoCarregada = true;
    if (this.centralIndicacao && this.fecharCentralIndicacao) {
      this.desenharCentralDeIndicacoes(this.fecharCentralIndicacao);
    }
  }

  private async salvarPix(): Promise<void> {
    if (this.operandoIndicacao) return;
    this.operandoIndicacao = true;
    const resultado = await salvarChavePix(this.tipoPix, this.chavePix);
    this.operandoIndicacao = false;
    this.recadoIndicacao = resultado.ok ? 'Chave Pix salva com segurança.' : resultado.erro;
    if (resultado.ok) this.chavePix = '';
    await this.recarregarCentral();
  }

  private async sacar(): Promise<void> {
    if (this.operandoIndicacao) return;
    const centavos = Math.round(Number(this.valorSaque.replace(/\./g, '').replace(',', '.')) * 100);
    if (!Number.isSafeInteger(centavos) || centavos < SAQUE_MINIMO_INDICACAO_CENTAVOS) {
      this.recadoIndicacao = `O saque mínimo é ${this.reais(SAQUE_MINIMO_INDICACAO_CENTAVOS)}.`;
      if (this.fecharCentralIndicacao) this.desenharCentralDeIndicacoes(this.fecharCentralIndicacao);
      return;
    }
    this.operandoIndicacao = true;
    const resultado = await solicitarSaque(centavos);
    this.operandoIndicacao = false;
    this.recadoIndicacao = resultado.ok ? 'Solicitação enviada para análise.' : resultado.erro;
    if (resultado.ok) this.valorSaque = '';
    await this.recarregarCentral();
  }

  private carregarApelido(): void {
    if (!sessaoGuardada() || this.carregandoApelido) return;
    this.carregandoApelido = true;
    void buscarMeuApelido().finally(() => {
      this.carregandoApelido = false;
      this.render();
    });
  }

  private fechar(): void {
    this.aberto = false;
    this.render();
  }

  private carregarIndicacao(): void {
    if (!sessaoGuardada() || this.carregandoIndicacao || this.indicacaoCarregada) return;
    this.carregandoIndicacao = true;
    void buscarResumoDeIndicacao().then((resumo) => {
      this.indicacao = resumo;
      this.indicacaoCarregada = true;
    }).finally(() => {
      this.carregandoIndicacao = false;
      this.render();
    });
  }

  private render(): void {
    const sessao = sessaoGuardada();
    const nome = sessao ? apelidoAtual() ?? 'Piloto' : 'Sem conta';

    clear(this.root).append(
      h('button.perfil-botao', {
        'aria-label': sessao ? `Abrir perfil de ${nome}` : 'Abrir opções da conta',
        'aria-expanded': String(this.aberto),
        onclick: () => {
          this.aberto = !this.aberto;
          this.render();
          if (this.aberto) this.carregarIndicacao();
        },
      },
        // Só o nome, sem moldura e sem avatar.
        //
        // A primeira versão era uma pílula com inicial num círculo, e ela pesava
        // como um botão de ação — na barra de cima, peso é o que separa o que se
        // usa o tempo todo do que se abre de vez em quando. Conta é a segunda
        // coisa.
        h(`span.perfil-nome${sessao ? '' : '.sem-conta'}`, { text: nome }),
        /**
         * Quantos estão online. Só admin vê, por enquanto.
         *
         * É um portão de INTERFACE, como o do modo de teste: a lista de admins
         * vai no pacote e a conferência roda no navegador. O que ele promete é
         * tirar do caminho do jogador comum um número que é de operação, não
         * de jogo — e não esconder um segredo, porque não há segredo num
         * agregado sem identidade nenhuma.
         *
         * Sai da tela enquanto a resposta não chega: mostrar zero seria dizer
         * "não tem ninguém", que é diferente de "ainda não sei".
         */
        ...(ehAdmin() && onlineAtual() !== null
          ? [h('span.perfil-online', {
              text: `${onlineAtual()} on`,
            })]
          : []),
        h('span.perfil-seta', { text: this.aberto ? '▴' : '▾' }),
      ),
      ...(this.aberto ? [this.gaveta(sessao)] : []),
    );
  }

  private gaveta(sessao: ReturnType<typeof sessaoGuardada>): HTMLElement {
    const st = this.sim.state;
    const nave = HULL_BY_ID.get(st.hull);

    const linha = (rotulo: string, valor: string, classe = ''): HTMLElement =>
      h(`.perfil-linha${classe}`, {},
        h('span.perfil-rot', { text: rotulo }),
        h('span.perfil-val', { text: valor }),
      );

    if (!sessao) {
      return h('.perfil-gaveta', {},
        h('.perfil-secao', { text: 'CONTA' }),
        h('p.perfil-aviso', {
          text: 'Seu progresso está só neste navegador. Limpar os dados do site apaga tudo.',
        }),
        h('button.perfil-acao.destaque', {
          text: 'Entrar ou criar conta',
          // Recarregar é o caminho honesto: a tela de login roda ANTES do laço,
          // porque um save da nuvem troca o estado inteiro. Abri-la por cima de
          // um jogo em andamento exigiria desmontar e remontar tudo — muito
          // risco para poupar dois segundos de recarga.
          onclick: () => location.reload(),
        }),
        ...this.progresso(st),
      );
    }

    return h('.perfil-gaveta', {},
      h('.perfil-identidade', {},
        h('span.perfil-identidade-rot', { text: 'PILOTO' }),
        h('strong', { text: apelidoAtual() ?? 'Piloto' }),
        h('span.perfil-privacidade', { text: 'DADOS PRIVADOS OCULTOS' }),
      ),
      linha('Nave ativa', nave?.name ?? '—'),

      ...this.progresso(st),

      ...this.blocoDeIndicacao(),

      h('button.perfil-acao', {
        text: 'Sair',
        onclick: () => { sair(); location.reload(); },
      }),
    );
  }

  private blocoDeIndicacao(): HTMLElement[] {
    if (this.carregandoIndicacao) {
      return [
        h('.perfil-secao', { text: 'INDICAÇÕES' }),
        h('p.perfil-aviso', { text: 'Carregando seu convite…' }),
      ];
    }
    const resumo = this.indicacao;
    if (resumo && !resumo.ativo) return [];
    if (!resumo?.codigo) {
      return [
        h('.perfil-secao', { text: 'INDICAÇÕES' }),
        h('p.perfil-aviso', { text: 'Não foi possível carregar seu código agora.' }),
      ];
    }

    const link = `${location.origin}${location.pathname}?ref=${encodeURIComponent(resumo.codigo)}`;
    return [
      h('.perfil-secao', { text: 'INDICAÇÕES' }),
      h('.perfil-indicacao-codigo', {},
        h('span', { text: 'SEU CÓDIGO' }),
        h('strong', { text: resumo.codigo }),
      ),
      h('p.perfil-indicacao-regra', {
        text: resumo.codigoAtivo
          ? 'Receba 10% do valor real pago por novos pilotos e bônus por quem chegar ao nível 25.'
          : 'Este código está bloqueado. Novas contas e compras não geram recompensa enquanto ele estiver inativo.',
      }),
      h('.perfil-linha', {}, h('span.perfil-rot', { text: 'Contas vinculadas' }), h('span.perfil-val', { text: fmt(resumo.vinculados) })),
      h('.perfil-linha', {}, h('span.perfil-rot', { text: 'Disponível para Pix' }), h('span.perfil-val', { text: this.reais(resumo.disponivelCentavos) })),
      h('button.perfil-acao.destaque', {
        text: 'Abrir central de indicações', onclick: () => this.abrirCentralDeIndicacoes(),
      }),
      ...(resumo.codigoAtivo ? [h('button.perfil-acao.destaque', {
        text: 'Copiar link de convite', onclick: () => this.copiarLinkDeIndicacao(link),
      })] : []),
      ...(this.recadoIndicacao
        ? [h('p.perfil-indicacao-feedback', { text: this.recadoIndicacao })]
        : []),
    ];
  }

  private copiarLinkDeIndicacao(link: string): void {
    if (!navigator.clipboard?.writeText) {
      this.recadoIndicacao = link;
      this.render();
      return;
    }
    void navigator.clipboard.writeText(link).then(() => {
      this.recadoIndicacao = 'Link copiado.';
      this.render();
    }).catch(() => {
      // A URL continua visível e selecionável mesmo em HTTP ou quando o
      // navegador nega a permissão da área de transferência.
      this.recadoIndicacao = link;
      this.render();
    });
  }

  /** O que o jogador reconhece como "meu progresso". */
  private progresso(st: Sim['state']): HTMLElement[] {
    return [
      h('.perfil-secao', { text: 'PROGRESSO' }),
      h('.perfil-linha', {},
        h('span.perfil-rot', { text: 'Setor atual' }),
        h('span.perfil-val', { text: fmt(st.run.sector) }),
      ),
      h('.perfil-linha', {},
        h('span.perfil-rot', { text: 'Melhor setor' }),
        h('span.perfil-val', { text: fmt(st.universe.bestSectorEver) }),
      ),
      h('.perfil-linha', {},
        h('span.perfil-rot', { text: 'Patente' }),
        h('span.perfil-val', { text: fmt(st.command.nivel) }),
      ),
      h('.perfil-linha', {},
        h('span.perfil-rot', { text: 'Frota' }),
        h('span.perfil-val', { text: `${st.fleet.length} naves` }),
      ),
      h('.perfil-linha', {},
        h('span.perfil-rot', { text: 'Carga' }),
        h('span.perfil-val', { text: `${st.inventory.length} itens` }),
      ),
      h('.perfil-linha', {},
        h('span.perfil-rot', { text: 'Tempo de jogo' }),
        h('span.perfil-val', { text: duration(st.playtime) }),
      ),
    ];
  }

  /** Repinta quando o estado muda, para os números não envelhecerem abertos. */
  atualizar(): void {
    if (this.aberto) this.render();
  }
}

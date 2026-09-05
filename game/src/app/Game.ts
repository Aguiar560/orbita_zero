import { Loop } from './Loop';
import { assets } from '@render/Assets';
import { Surface } from '@render/Surface';
import { h } from '@ui/dom';
import { registerClips } from '@data/clips';
import { ALL_ENEMIES } from '@data/enemies';
import { Sim } from '@sim/index';
import { allowSaving, loadFromStorage } from '@sim/state';
import { bus, toast } from './Bus';
import { galaxyOfSector } from '@data/galaxies';
import { musicaDaGalaxia } from '@data/musicas';
import { MusicaDeFundo } from '@render/MusicaDeFundo';
import { Tour } from '@ui/Tour';
import { passosDoOnboarding } from '@data/onboarding';
import { TUTORIAIS } from '@data/tutoriais';
import { VerticalMode, registerMinions } from '@modes/vertical/VerticalMode';
import { VIEW, fitView } from '@modes/vertical/entities';
import { Shell } from '@ui/Shell';
import { EscolhaDePiloto } from '@ui/EscolhaDePiloto';
import { Login } from '@ui/Login';
import { desligarModoDeTesteSeNaoForAdmin } from './admin';
import { progressoDe, reconciliar, subirSave } from './nuvem';
import { enviarMarcas } from './placar';
import { drenarCarteira, sincronizar as sincronizarCarteira } from './carteira';
import { garantirLote } from './lote';
import { drenarInventario, sincronizarFrota, sincronizarInventario } from './inventario';
import { drenarProgresso, sincronizarProgresso } from './progresso';
import { creditarAusencia } from './ausencia';

/**
 * Segundos entre tentativas de subir o save.
 *
 * Acima do mínimo do servidor (120s) com folga. Num idle o custo de perder o
 * intervalo é quase nada: o progresso é função do TEMPO, e o cliente recalcula
 * o que passou desde o último save ao voltar.
 */
const INTERVALO_DE_SUBIDA = 150;

/**
 * A ausência mínima saiu daqui na Fase 5 do Passo 9.
 *
 * Quem decide se houve ausência é o SERVIDOR, pela diferença entre agora e o
 * carimbo que ele mesmo gravou. O cliente não tem mais como opinar — e é essa
 * ausência de opinião que fecha o buraco: não existe campo onde mentir sobre
 * quanto tempo se passou.
 */

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
  }


  /** Segundos desde a última tentativa de subir o save. */
  private relogioDaNuvem = 0;

  /**
   * A trilha de fundo.
   *
   * Mora no `Game` e não no `Shell` porque ela não pertence a nenhuma tela: o
   * jogador abre a Galáxia, o Hangar, os Ajustes, e a música não pode parar a
   * cada troca de painel. O `Shell` é remontado; o `Game` não.
   */
  /**
   * Galáxia cuja trilha já está tocando.
   *
   * Existe para a troca acontecer uma vez por galáxia e não a cada setor. É
   * inicializada no boot com a galáxia atual, senão o primeiro `sector:advanced`
   * dentro da MESMA galáxia trocaria a música sem motivo.
   */
  private galaxiaDaTrilha = -1;

  private readonly musica = new MusicaDeFundo(
    () => this.sim.state.settings,
    (id) => {
      // A faixa em cena é a que o save guarda. Sem isto, "próxima" ao fim de
      // uma música seria esquecida no próximo boot.
      if (this.sim.state.settings.musicaAtual === id) return;
      this.sim.state.settings.musicaAtual = id;
      this.sim.touch();
    },
  );

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

    // Ao esconder a aba, tenta subir na hora. É o momento em que o jogador
    // some de verdade, e esperar o intervalo perderia a sessão toda dele.
    // `visibilitychange` e não `beforeunload`: este último não roda no celular,
    // que é onde fechar a aba sem avisar é a regra e não a exceção.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.subirTratandoConflito(true);
    });

    this.rootEl.append(this.fpsNode);
    this.aplicarPreferenciasVisuais();

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
    // O lote é do SETOR, então o pedido acompanha o evento do setor, e não só
    // o relógio de 150 s da nuvem: o setor cai a cada ~3 min, e quem avança
    // rápido secaria o pote antes do próximo ciclo. Pedir duas vezes o mesmo
    // setor é barato — o servidor devolve o mesmo lote.
    bus.on('sector:advanced', ({ sector }) => { void garantirLote(this.sim, sector); });

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
    // NÃO dá para pular, e não é rigor: sem token, `garantirLote` desiste antes
    // da rede e nenhum item cai — nunca. Ver o comentário de classe do `Login`.
    //
    // Ninguém precisa dar e-mail, porém: a conta anônima entra com um clique e
    // não pede nada. O que a tela cobra é uma SESSÃO, não um cadastro.
    //
    // A promessa fica pendente enquanto não houver uma, então este `await`
    // segura o boot de propósito.
    await new Login().mostrar(this.rootEl);

    // Com a conta resolvida dá para juntar o save local ao da nuvem. Antes da
    // escolha de piloto porque um save que desce troca o estado inteiro, e
    // escolher piloto para um save que vai ser substituído é decidir duas vezes.
    await this.juntarComANuvem();

    // A carteira vem DEPOIS do save e antes de tudo que lê saldo.
    //
    // Depois porque juntar com a nuvem pode trocar o estado inteiro, e um
    // saldo buscado antes disso pertenceria ao save que acabou de ser
    // descartado. Antes do resto porque a escolha de piloto, a loja e o HUD
    // desenham número de recurso — e mostrar o valor local por um instante,
    // para ele mudar sozinho logo em seguida, parece defeito.
    await sincronizarCarteira();
    await drenarCarteira(this.sim);
    await garantirLote(this.sim, this.sim.state.run.sector);
    // O inventário vem antes do primeiro quadro: os atributos da nave saem do
    // que está equipado, e desenhar com o equipamento local para trocá-lo um
    // segundo depois é uma piscada de números errados na primeira tela.
    await sincronizarInventario(this.sim);
    // A frota vem junto: quais cascos existem decide o que o Hangar mostra e o
    // que o jogador pode levar a campo.
    await sincronizarFrota(this.sim);
    // A progressão vem por último e antes do laço: nível e Matriz decidem os
    // atributos, e um quadro com o nível errado é uma piscada de números
    // errados na primeira tela que o jogador vê.
    await sincronizarProgresso(this.sim);

    // O modo de teste é ferramenta de admin, e o interruptor some para quem não
    // é. Desligar aqui, e não só esconder, é o que tira do modo quem já entrou
    // nele — há saves por aí com `testMode: true` e, sem o interruptor, não
    // haveria saída.
    if (desligarModoDeTesteSeNaoForAdmin(this.sim.state.settings)) {
      this.sim.touch();
      this.sim.save();
    }

    if (!this.sim.state.piloto) {
      await new EscolhaDePiloto(this.sim, this.rootEl).mostrar();
      this.vertical.refreshPlayer(true);
    }

    // O guia vem DEPOIS da escolha de piloto e ANTES do relatório de ausência:
    // depois porque ele aponta para a nave que o jogador acabou de escolher, e
    // antes porque um relatório sobre um jogo que ele ainda não entende não diz
    // nada. Quem já viu não vê de novo.
    bus.on('guia:abrir', () => this.abrirGuia());
    bus.on('guia:painel', ({ id }) => this.abrirTutorialDeTela(id));
    bus.on('preferencias:visuais', () => this.aplicarPreferenciasVisuais());
    bus.on('musica:trocar', ({ id }) => this.musica.tocar(id));

    /**
     * Cada galáxia começa com a sua faixa.
     *
     * Na MUDANÇA de galáxia, e não a cada setor: dentro da mesma galáxia a
     * trilha não pode reiniciar a cada dez setores, e trocar de faixa por cima
     * de uma escolha que o jogador acabou de fazer é pior que não deixá-lo
     * escolher. Aqui a regra é clara — a galáxia define o INÍCIO, e a escolha
     * manual vale até a próxima galáxia.
     */
    bus.on('sector:advanced', ({ sector }) => {
      const galaxia = galaxyOfSector(sector);
      if (galaxia === this.galaxiaDaTrilha) return;
      this.galaxiaDaTrilha = galaxia;
      this.musica.tocar(musicaDaGalaxia(galaxia).id);
    });
    bus.on('musica:proxima', () => this.musica.proxima());
    bus.on('musica:anterior', () => this.musica.anterior());
    bus.on('preferencias:audio', () => this.musica.atualizar());

    /**
     * No boot vale a faixa SALVA, não a da galáxia.
     *
     * Quem fechou o jogo ouvindo uma faixa espera reencontrá-la — a galáxia
     * define o começo de cada galáxia, e voltar ao jogo não é começar uma.
     * A galáxia atual fica marcada aqui mesmo para que o primeiro
     * `sector:advanced` dentro dela não dispare uma troca.
     *
     * O navegador só solta o som depois de um gesto, e `MusicaDeFundo` se
     * rearma sozinha no primeiro clique.
     */
    this.galaxiaDaTrilha = galaxyOfSector(this.sim.state.run.sector);
    this.musica.tocar(
      this.sim.state.settings.musicaAtual ?? musicaDaGalaxia(this.galaxiaDaTrilha).id,
    );
    if (!this.sim.state.settings.guiaVisto) this.abrirGuia();

    await this.creditarAusencia();

    this.loop.start();
  }

  /**
   * Credita a ausência — no SERVIDOR, desde a Fase 5 do Passo 9.
   *
   * ## O que saiu daqui
   *
   * `sim.applyOffline(this.offlineSeconds)`. O cliente simulava a própria
   * ausência e o resultado subia como ganho declarado — o maior buraco que
   * sobrava depois da Fase 4. Medido e registrado no PLANO: offline rendia
   * **368 itens contra 44** do jogo ao vivo no mesmo trecho.
   *
   * ## Não existe recuo local, e é deliberado
   *
   * Calcular aqui quando o servidor não responde devolveria o buraco inteiro:
   * bastaria bloquear a requisição. E não é preciso — o carimbo do servidor
   * só anda quando ele CREDITA, então a tentativa que falha não perde nada. A
   * ausência continua contando e o crédito vem na próxima conexão que der
   * certo. Quem ficou sem rede recebe atrasado, não recebe a menos.
   *
   * ## Por que o estado é resincronizado depois
   *
   * O servidor mexeu em saldo, XP e inventário ao simular. Sem buscar de
   * volta, a tela continuaria mostrando o que havia antes da ausência — e o
   * jogador veria o relatório dizer "+900 sucata" com o contador parado.
   */
  private async creditarAusencia(): Promise<void> {
    const r = await creditarAusencia(this.sim);
    if (!r || r.segundos <= 0) return;

    // A patente ANTES de resincronizar: é a sincronização que traz o nível
    // novo do servidor, então medir depois dela não teria com o que comparar.
    const nivelAntes = this.sim.state.command.nivel;

    await Promise.all([
      sincronizarCarteira(),
      sincronizarInventario(this.sim),
      sincronizarProgresso(this.sim),
    ]);

    // A incursão volta como o servidor a deixou: a carga que sobreviveu à
    // ausência, e a onda em que a nave parou. Ver `adotarIncursao`.
    if (r.incursao) this.sim.adotarIncursao(r.incursao.onda, r.incursao.carga);
    this.vertical.refreshPlayer(true);

    if (r.segundos > REPORT_THRESHOLD) {
      this.shell.showOfflineReport({
        seconds: r.segundos,
        capped: r.limitado ?? false,
        gained: r.ganhou ?? { sucata: 0, nucleo: 0, cristal: 0 },
        sectorsCleared: r.setores ?? 0,
        kills: r.abates ?? 0,
        chests: r.baus ?? 0,
        // Os três que o servidor já mandava e ninguém lia.
        xp: r.xp ?? 0,
        itens: r.itensNovos ?? 0,
        niveis: Math.max(0, this.sim.state.command.nivel - nivelAntes),
      });
    }
  }

  /**
   * Junta o save local ao da nuvem e aplica a decisão.
   *
   * Falhar aqui não pode impedir o jogo de abrir: sem rede, sem conta ou com o
   * servidor fora, o save local vale e a partida começa igual. É a razão de
   * tudo estar dentro de um `try` que engole — a nuvem é cópia, não requisito.
   */
  private async juntarComANuvem(): Promise<void> {
    try {
      const r = await reconciliar(this.sim.state);
      if (r.acao === 'desceu') {
        // `allowSaving` porque o jogador pode ter apagado o save nesta mesma
        // sessão: a trava de gravação ainda estaria de pé, e o save que acabou
        // de descer nunca chegaria ao disco.
        allowSaving();
        this.sim.state = r.estado;
        this.sim.touch();
        this.sim.save();
      }
    } catch {
      // Ver acima: a nuvem é cópia.
    }
  }

  /**
   * Sobe o save e resolve o conflito, se houver.
   *
   * Conflito quer dizer que OUTRO dispositivo gravou desde a última vez que
   * este falou com o servidor. Gravar por cima apagaria aquele progresso sem
   * ninguém notar, então o servidor recusa e devolve o que está guardado.
   *
   * A decisão é por TEMPO JOGADO. Se o de lá está mais adiantado, este cliente
   * ADOTA: quem estava jogando aqui provavelmente acabou de abrir e ainda não
   * fez nada, e é melhor perder um minuto do que uma sessão inteira do outro
   * dispositivo. Se o daqui está mais adiantado, sobe de novo — agora com a
   * versão certa, então passa.
   */
  private async subirTratandoConflito(saindo = false): Promise<void> {
    const r = await subirSave(this.sim.state, saindo);
    if (r.fase !== 'conflito') return;

    const deLa = r.doServidor;
    if (deLa && progressoDe(deLa) > progressoDe(this.sim.state)) {
      allowSaving();
      this.sim.state = deLa;
      this.sim.touch();
      this.sim.save();
      this.vertical.refreshPlayer(true);
      toast('Progresso mais recente encontrado em outro dispositivo.', 'info');
      return;
    }

    // O daqui é o mais adiantado. A versão já foi atualizada pela resposta do
    // conflito, então esta subida encontra a base certa.
    await subirSave(this.sim.state);
  }

  /**
   * Abre o passeio guiado.
   *
   * Marca como visto ao FECHAR, completo ou pulado. Marcar ao abrir perderia o
   * guia de quem recarregou a página no meio; marcar só ao completar faria o
   * guia voltar toda vez para quem escolheu pular — que é justamente quem já
   * disse que não quer.
   */
  /**
   * O passeio em cena, se houver.
   *
   * Dois passeios ao mesmo tempo não é um estado que alguém queira: são duas
   * camadas escuras somadas e dois balões disputando a tela, e fechar um deixa
   * o outro. Um guardião só, aqui, cobre os três caminhos que abrem passeio —
   * o de entrada, o de tela e o botão "?".
   */
  private passeioEmCena: Tour | null = null;

  abrirGuia(): void {
    if (this.passeioEmCena) return;
    // O que o jogador tinha aberto antes do guia. O passeio pode precisar abrir
    // a Anatomia para explica-la, e mexer numa preferencia salva sem devolver e
    // a mesma cicatriz do modo de teste: o jogador so queria uma explicacao e
    // ficou com a tela reconfigurada.
    const anatomiaAntes = this.sim.state.settings.anatomiaAberta;

    const tour = new Tour({
      passos: passosDoOnboarding(this.sim.controleManualDisponivel),
      // Este passeio roda ANTES da primeira partida, entao a frase e literal.
      rotuloFinal: 'Começar a jogar',
      aoAbrirPainel: (id) => bus.emit('panel:open', { id }),
      aoExigir: (oQue) => {
        if (oQue === 'anatomia') {
          this.sim.state.settings.anatomiaAberta = true;
          this.sim.touch();
        }
      },
      aoFechar: () => {
        this.passeioEmCena = null;
        this.sim.state.settings.anatomiaAberta = anatomiaAntes;
        this.sim.state.settings.guiaVisto = true;
        this.sim.touch();
        this.sim.save();
      },
    });
    this.passeioEmCena = tour;
    tour.comecar(this.rootEl);
  }

  /**
   * O tutorial de uma tela.
   *
   * Separado de `abrirGuia` porque as duas coisas fecham diferente: o passeio
   * de entrada devolve a Anatomia ao estado anterior e marca `guiaVisto`; este
   * não mexe em interface nenhuma — a tela já está aberta, foi abri-la que o
   * chamou — e marca só o id desta tela.
   *
   * Marca ao FECHAR, completo ou pulado, pelo mesmo motivo do outro: marcar ao
   * abrir perderia o tutorial de quem recarregou no meio, e marcar só ao
   * completar traria o guia de volta toda vez para quem escolheu pular.
   */
  abrirTutorialDeTela(id: string): void {
    if (this.passeioEmCena) return;
    const passos = TUTORIAIS[id];
    if (!passos?.length) return;

    const tour = new Tour({
      passos,
      aoAbrirPainel: (alvo) => bus.emit('panel:open', { id: alvo }),
      aoFechar: () => {
        this.passeioEmCena = null;
        const vistos = this.sim.state.settings.guiasVistos;
        if (!vistos.includes(id)) vistos.push(id);
        this.sim.touch();
        this.sim.save();
      },
    });
    this.passeioEmCena = tour;
    tour.comecar(this.rootEl);
  }

  /**
   * Aplica as preferências que vivem FORA do estado do jogo.
   *
   * Escala e qualidade mudam o documento e o canvas, não a simulação, então
   * ninguém as lê durante o quadro — elas precisam ser empurradas quando mudam.
   */
  aplicarPreferenciasVisuais(): void {
    const s = this.sim.state.settings;

    // `zoom` na raiz e não `transform`: transform escala os pixels já
    // desenhados e borra o texto; `zoom` muda o tamanho do PIXEL do CSS, então
    // a interface se remonta nítida e cabe mais coisa quando se reduz.
    this.rootEl.style.zoom = s.escalaDaInterface === 1 ? '' : String(s.escalaDaInterface);

    if (Surface.qualidade !== s.qualidade) {
      Surface.qualidade = s.qualidade;
      // O canvas só relê o dpr no `resize`, então força um.
      this.layout();
    }

    this.fpsNode.classList.toggle('visible', s.mostrarFps);
  }

  // ── laço ──────────────────────────────────────────────────────────────────

  private readonly tick = (dt: number): void => {
    const speed = this.sim.timeScale;

    /**
     * O combustível gasta AQUI, no tempo ao vivo.
     *
     * Ele não gastava. `gastarCombustivel` só era chamado de `abstractTick`, e
     * `abstractTick` só roda em `applyOffline` — ou seja, o tanque descia
     * apenas com a aba FECHADA. Com o jogo aberto ficava eternamente cheio, e
     * o trilho mostrava sempre a mesma autonomia.
     *
     * O comentário dentro de `abstractTick` já dizia a intenção certa:
     * "combustível corre no MESMO ponto do tempo ao vivo e do offline. Se
     * fossem dois caminhos, aba aberta e fechada renderiam tanques
     * diferentes". São dois caminhos mesmo — o que faltava era o segundo
     * chamar. Continua sendo uma linha por caminho, e não uma terceira
     * contabilidade.
     *
     * Fora do laboratório: ali o jogo roda para medir, e secar o tanque no
     * meio de uma bateria de confrontos falsearia a medição.
     */
    if (!this.sim.laboratorio.active) this.sim.gastarCombustivel(dt * speed);

    // O modo de teste acelera o jogo repetindo o passo fixo, e não esticando
    // `dt`: a IA e as colisões dependem de um passo constante para não falhar.
    for (let i = 0; i < speed; i++) {
      this.vertical.update(dt);
    }
    if (!this.sim.laboratorio.active) this.sim.tickSave(dt);
    this.tickNuvem(dt);
  };

  /**
   * Sobe o save de tempos em tempos.
   *
   * `INTERVALO_DE_SUBIDA` é maior que o mínimo que o servidor aceita (120s) de
   * propósito: bater na porta no segundo exato só produz 429 e gasta requisição
   * da cota à toa. A folga faz a tentativa cair sempre do lado que passa.
   *
   * O relógio não conta durante o Laboratório: aquilo é bancada de medição, e o
   * estado que ele produz não é progresso de jogador.
   */
  private tickNuvem(dt: number): void {
    if (this.sim.laboratorio.active) return;
    this.relogioDaNuvem += dt;
    if (this.relogioDaNuvem < INTERVALO_DE_SUBIDA) return;
    this.relogioDaNuvem = 0;
    // Sem `await`: a subida é de fundo e não pode segurar um quadro. Falha fica
    // registrada em `nuvem.ultimoErro` e a próxima tentativa vem sozinha.
    void this.subirTratandoConflito();
    // As marcas do placar sobem no mesmo ritmo, e so as que MUDARAM: reenviar
    // quarenta marcas iguais a cada ciclo gastaria a cota de escrita do D1
    // para nao mudar nada.
    void enviarMarcas(this.sim.state);
    // A carteira anda no MESMO relógio, e não num próprio.
    //
    // Dois relógios independentes dobrariam as requisições sem dobrar a
    // informação: o que o jogador ganhou desde a última subida é justamente o
    // que a fila acumulou desde a última drenagem. Um ciclo só mantém as duas
    // coisas coerentes e cabe na cota de escrita do D1.
    void drenarCarteira(this.sim);
    // O lote acompanha o setor, e o setor muda no mesmo evento que enche a
    // carteira. Pedir aqui cobre o caso comum sem um relógio próprio.
    void garantirLote(this.sim, this.sim.state.run.sector);
    // O inventário anda no mesmo relógio: coletar, descartar e equipar
    // acontecem no mesmo evento que enche a carteira — o setor caiu.
    void drenarInventario(this.sim);
    // XP, Matriz e setor no mesmo relógio: o ganho é contínuo, mas mandá-lo
    // no ritmo do setor basta — o delta acumula sozinho até o próximo ciclo.
    void drenarProgresso(this.sim);
  }

  private readonly draw = (_alpha: number, dt: number): void => {
    this.vertical.draw();
    this.shell.update(dt);

    // O contador lê o FPS que o `Loop` já suaviza — medir de novo aqui daria um
    // número diferente do que o resto do jogo usa.
    if (this.sim.state.settings.mostrarFps) {
      this.fpsAcumulado += dt;
      if (this.fpsAcumulado >= 0.25) {
        this.fpsAcumulado = 0;
        this.fpsNode.textContent = `${Math.round(this.loop.fps)} FPS`;
      }
    }
  };

  /** Segundos desde a última atualização do contador de FPS. */
  private fpsAcumulado = 0;
  /** O contador de FPS, sempre no DOM e escondido por classe. */
  private readonly fpsNode = h('.fps-contador');

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

import { describeGalaxy, galaxyPhases } from '@data/galaxies';
import { getElement } from '@data/elements';
import { HULLS, type Hull } from '@data/hulls';
import { AXES, especialidadeLabel, shipProfile } from '@sim/ships';
import { h, spriteIcon } from './dom';

export type PaginaLanding = 'jogo' | 'naves' | 'galaxias' | 'comunidade';

export interface AcoesLanding {
  navegar: (pagina: PaginaLanding) => void;
  entrar: () => void;
  criarConta: () => void;
  jogar: () => void;
}

const PAGINAS: readonly [PaginaLanding, string][] = [
  ['jogo', 'O JOGO'],
  ['naves', 'NAVES'],
  ['galaxias', 'GALÁXIAS'],
  ['comunidade', 'COMUNIDADE'],
];

const ARTE_POR_PAGINA: Record<PaginaLanding, string> = {
  jogo: '/assets/landing/o-jogo.png',
  naves: '/assets/landing/naves.png',
  galaxias: '/assets/landing/galaxias.png',
  comunidade: '/assets/landing/comunidade.png',
};
let preCargaDasArtesIniciada = false;

function preCarregarDemaisArtes(atual: string): void {
  if (preCargaDasArtesIniciada) return;
  preCargaDasArtesIniciada = true;
  for (const src of Object.values(ARTE_POR_PAGINA)) {
    if (src === atual) continue;
    const imagem = new Image();
    imagem.decoding = 'async';
    imagem.src = src;
  }
}

function pontoClicavel(classe: string, rotulo: string, aoClicar: () => void): HTMLElement {
  return h(`button.landing-art-hotspot.${classe}`, {
    type: 'button', 'aria-label': rotulo, onclick: aoClicar,
  });
}

/**
 * As artes aprovadas são a própria direção visual no desktop. Os controles
 * transparentes preservam os cliques reais sem redesenhar ou reinterpretar a
 * composição. A versão DOM continua logo abaixo como alternativa responsiva.
 */
function arteAprovada(pagina: PaginaLanding, acoes: AcoesLanding): HTMLElement {
  const src = ARTE_POR_PAGINA[pagina];
  const imagem = h('img.landing-art-image', {
    src,
    alt: `Apresentação de ${PAGINAS.find(([id]) => id === pagina)?.[1] ?? 'Órbita Zero'}`,
    draggable: 'false',
  }) as HTMLImageElement;
  imagem.addEventListener('load', () => preCarregarDemaisArtes(src), { once: true });
  const acoesDaPagina: HTMLElement[] = pagina === 'jogo'
    ? [
        pontoClicavel('acao-principal', 'Jogar agora', acoes.jogar),
        pontoClicavel('card-naves', 'Conhecer as naves', () => acoes.navegar('naves')),
        pontoClicavel('card-galaxias', 'Explorar galáxias', () => acoes.navegar('galaxias')),
        pontoClicavel('card-comunidade', 'Conhecer a comunidade', () => acoes.navegar('comunidade')),
      ]
    : pagina === 'naves'
      ? [pontoClicavel('acao-naves', 'Jogar com esta nave', acoes.jogar)]
      : pagina === 'galaxias'
        ? [pontoClicavel('acao-galaxias', 'Explorar esta galáxia', acoes.jogar)]
        : [pontoClicavel('acao-comunidade', 'Entrar na comunidade', acoes.criarConta)];

  return h('.landing-art-shell', {},
    imagem,
    pontoClicavel('marca', 'Ir para O Jogo', () => acoes.navegar('jogo')),
    ...PAGINAS.map(([id, rotulo]) => {
      const botao = pontoClicavel(`nav-${id}`, rotulo, () => acoes.navegar(id));
      if (pagina === id) botao.setAttribute('aria-current', 'page');
      return botao;
    }),
    pontoClicavel('conta-entrar', 'Entrar', acoes.entrar),
    pontoClicavel('conta-criar', 'Criar conta', acoes.criarConta),
    ...acoesDaPagina,
  );
}

const navesDeVitrine = (): Hull[] => {
  const nomes = ['Prisma Arco', 'Ignis Mk I', 'Prisma Aegis', 'Falcão Azul', 'Prisma Vazio'];
  return nomes.map((nome) => HULLS.find((nave) => nave.name === nome)).filter((nave): nave is Hull => !!nave);
};

function marca(acoes: AcoesLanding): HTMLElement {
  return h('button.landing-marca', {
    type: 'button', 'aria-label': 'Órbita Zero — página inicial', onclick: () => acoes.navegar('jogo'),
  },
    h('span.landing-marca-orbita', { text: 'ÓRBITA' }),
    h('span.landing-marca-zero', { text: 'ZERO' }),
  );
}

function cabecalho(pagina: PaginaLanding, acoes: AcoesLanding): HTMLElement {
  return h('header.landing-header', {},
    marca(acoes),
    h('nav.landing-nav', { 'aria-label': 'Apresentação do jogo' },
      ...PAGINAS.map(([id, rotulo]) => h(`button.landing-nav-item${pagina === id ? '.ativo' : ''}`, {
        type: 'button', text: rotulo,
        'aria-current': pagina === id ? 'page' : undefined,
        onclick: () => acoes.navegar(id),
      })),
    ),
    h('.landing-conta', {},
      h('button.landing-entrar', { type: 'button', text: 'ENTRAR', onclick: acoes.entrar }),
      h('button.landing-criar', { type: 'button', text: 'CRIAR CONTA', onclick: acoes.criarConta }),
    ),
  );
}

function menuDoJogo(): HTMLElement {
  const abas = [
    ['/assets/ui/menu/galaxia.webp', 'Galáxia'],
    ['/assets/ui/menu/armazem.webp', 'Armazém'],
    ['/assets/ui/menu/fabricacao.webp', 'Fabricação'],
    ['/assets/ui/menu/missoes.webp', 'Missões'],
    ['/assets/ui/menu/eventos.webp', 'Eventos'],
    ['/assets/ui/menu/matriz.webp', 'Matriz'],
    ['/assets/ui/menu/hangar.webp', 'Hangar'],
    ['/assets/ui/menu/bau.webp', 'Baús'],
  ] as const;
  return h('.landing-game-tabs', {}, ...abas.map(([src, nome], index) => h(`span${index === 0 ? '.ativo' : ''}`, {},
    h('img', { src, alt: '' }), h('small', { text: nome }),
  )));
}

function previaCombate(): HTMLElement {
  const player = HULLS.find((nave) => nave.name === 'Prisma Arco') ?? HULLS[0]!;
  const inimigos = navesDeVitrine().slice(1, 4);
  return h('.landing-game-window', {},
    h('.landing-game-top', {},
      h('strong', { text: 'ØZ' }), h('span', { text: 'Sem conta' }),
      h('.landing-game-res', {}, h('b', { text: '◈ 0' }), h('b', { text: '◆ 0' }), h('b', { text: '✦ 0' })),
    ),
    menuDoJogo(),
    h('.landing-combat-stage', {},
      h('.landing-combat-missoes', {},
        h('strong', { text: 'O Outro Lado I — Assinatura' }),
        h('span', { text: 'Abater 180 inimigos cósmicos' }),
        h('b', { text: '22/180' }),
        h('strong', { text: 'Mão de Artífice' }),
        h('span', { text: 'Concluir 5 fusões raras' }),
        h('b', { text: '3/5' }),
      ),
      ...inimigos.map((nave, index) => {
        const icone = spriteIcon(nave.sprite, 42);
        icone.classList.add('landing-enemy', `e${index + 1}`);
        return icone;
      }),
      (() => {
        const icone = spriteIcon(player.sprite, 72);
        icone.classList.add('landing-player');
        return icone;
      })(),
      h('.landing-shot.s1'), h('.landing-shot.s2'), h('.landing-shot.s3'),
      h('span.landing-sector', { text: 'SETOR 1 · ONDA 2/5' }),
    ),
    h('.landing-game-dock', {},
      h('span', { text: 'NAVE' }), h('span', { text: 'ANATOMIA' }),
      h('span.ativo', { text: 'COMBATE' }), h('span', { text: 'CARGA' }),
    ),
  );
}

function cardRecurso(
  numero: string,
  titulo: string,
  texto: string,
  icone: string,
  pagina: PaginaLanding,
  acoes: AcoesLanding,
): HTMLElement {
  return h('button.landing-recurso-card', { type: 'button', onclick: () => acoes.navegar(pagina) },
    h('.landing-recurso-head', {}, h('b', { text: numero }), h('strong', { text: titulo }), h('span', { text: '›' })),
    h('img', { src: icone, alt: '' }),
    h('p', { text: texto }),
  );
}

function paginaJogo(acoes: AcoesLanding): HTMLElement {
  return h('.landing-page.landing-home', {},
    h('section.landing-hero', {},
      h('.landing-hero-copy', {},
        h('span.landing-kicker', { text: 'ESTRATÉGIA · PROGRESSÃO · CONQUISTA' }),
        h('h1', {}, 'PILOTE O ', h('em', { text: 'FUTURO.' })),
        h('p', { text: 'Construa sua nave, enfrente frotas e conquiste um universo em expansão.' }),
        h('.landing-hero-actions', {},
          h('button.landing-cta', { type: 'button', text: 'JOGAR AGORA  ›', onclick: acoes.jogar }),
          h('button.landing-secondary', { type: 'button', text: 'CONHECER AS NAVES', onclick: () => acoes.navegar('naves') }),
        ),
      ),
      h('.landing-hero-product', {}, previaCombate()),
    ),
    h('section.landing-universo', {},
      h('h2', { text: 'UM UNIVERSO PARA EVOLUIR' }),
      h('.landing-recursos', {},
        cardRecurso('01', 'MONTE SUA NAVE', 'Combine cascos e equipamentos para criar sua própria estratégia.', '/assets/ui/menu/hangar.webp', 'naves', acoes),
        cardRecurso('02', 'EXPLORE GALÁXIAS', 'Atravesse setores, descubra ameaças e desbloqueie novos caminhos.', '/assets/ui/menu/galaxia.webp', 'galaxias', acoes),
        cardRecurso('03', 'ENCONTRE PILOTOS', 'Dispute rankings sazonais e converse com outros comandantes.', '/assets/ui/menu/ranking-trofeu.webp', 'comunidade', acoes),
      ),
    ),
  );
}

function barraDeAtributo(nome: string, valor: number, cor: string): HTMLElement {
  return h('.landing-atributo', {},
    h('span', { text: nome }),
    h('.landing-atributo-trilho', {}, h('i', { style: { width: `${valor}%`, background: cor } })),
    h('b', { text: String(valor) }),
  );
}

function paginaNaves(acoes: AcoesLanding): HTMLElement {
  const catalogo = navesDeVitrine();
  const nave = HULLS.find((item) => item.name === 'Prisma Arco') ?? catalogo[0] ?? HULLS[0]!;
  const elemento = getElement(nave.element);
  const perfil = shipProfile(nave);
  return h('.landing-page.landing-naves', {},
    h('.landing-page-title', {},
      h('span.landing-kicker', { text: 'FROTA · ANATOMIA · EQUIPAMENTOS' }),
      h('h1', {}, 'ESCOLHA. MONTE. ', h('em', { text: 'EVOLUA.' })),
      h('p', { text: 'Cada casco muda sua estratégia. Cada peça define seu poder.' }),
    ),
    h('.landing-naves-grid', {},
      h('section.landing-panel.landing-catalogo', {},
        h('.landing-panel-title', {}, h('strong', { text: 'NOSSAS NAVES' }), h('span', { text: `${catalogo.length} DESTAQUES` })),
        ...catalogo.map((item, index) => {
          const el = getElement(item.element);
          return h(`article.landing-nave-card${index === 0 ? '.ativo' : ''}`, {},
            spriteIcon(item.sprite, 56),
            h('div', {}, h('strong', { text: item.name }), h('span', { text: `TIER ${item.tier}` }), h('small', { text: especialidadeLabel(shipProfile(item)) })),
            h('b', { text: el.name, style: { color: el.color } }),
          );
        }),
      ),
      h('section.landing-panel.landing-nave-hero', {},
        h('.landing-nave-identidade', {},
          h('div', {}, h('h2', { text: nave.name }), h('span', { text: `${especialidadeLabel(perfil)} · ${elemento.name}` })),
          h('b', { text: `PATENTE ${perfil.patente}` }),
        ),
        h('.landing-nave-palco', {}, spriteIcon(nave.sprite, 230), h('i.landing-nave-anel')),
        h('.landing-xp', {}, h('span', { text: 'EXPERIÊNCIA DO CASCO' }), h('i', {}, h('b')), h('strong', { text: 'NÍVEL 3' })),
      ),
      h('section.landing-panel.landing-nave-stats', {},
        h('.landing-panel-title', {}, h('strong', { text: 'ATRIBUTOS' }), h('span', { text: `NOTA ${perfil.nota}` })),
        ...AXES.map((eixo) => barraDeAtributo(eixo.name.toUpperCase(), perfil.axes[eixo.id], eixo.color)),
        h('.landing-elemento', {}, h('span', { text: 'ELEMENTO' }), h('strong', { text: elemento.name, style: { color: elemento.color } })),
        h('button.landing-cta', { type: 'button', text: 'JOGAR COM ESTA NAVE  ›', onclick: acoes.jogar }),
      ),
      h('section.landing-panel.landing-anatomia-preview', {},
        h('.landing-panel-title', {}, h('strong', { text: 'ANATOMIA DA NAVE' }), h('span', { text: '6 ENCAIXES' })),
        h('.landing-anatomia-corpo', {},
          h('.landing-slots.esquerda', {},
            ...['cat/asas', 'cat/controle', 'cat/reator'].map((id) => h('span', {}, spriteIcon(id, 38))),
          ),
          spriteIcon(nave.sprite, 116, 'landing-anatomia-nave'),
          h('.landing-slots.direita', {},
            ...['cat/blindagem', 'cat/reator', 'cat/controle'].map((id) => h('span', {}, spriteIcon(id, 38))),
          ),
        ),
      ),
      h('section.landing-panel.landing-item-preview', {},
        h('.landing-panel-title', {}, h('strong', { text: 'ITEM SELECIONADO' }), h('span', { text: 'INCOMUM · NV 3' })),
        h('.landing-item-top', {}, spriteIcon('cat/asas', 54), h('div', {}, h('strong', { text: 'Empenagem Bruta' }), h('span', { text: 'Asas / Estrutura' }))),
        h('small', { text: 'PREFIXOS' }), h('p', {}, h('b', { text: 'T1' }), ' +20,1% Dano'),
        h('small', { text: 'SUFIXOS' }), h('p', {}, h('b', { text: 'T1' }), ' +12 Casco'),
        h('.landing-comparacao', {},
          h('span', {}, 'Dano ', h('b.bad', { text: '-1,0' })),
          h('span', {}, 'Manobra ', h('b.good', { text: '+6,8' })),
          h('span', {}, 'Casco ', h('b.good', { text: '+11' })),
          h('span', {}, 'Sucata ', h('b.bad', { text: '-44,4%' })),
        ),
      ),
    ),
    h('h2.landing-next-title', { text: 'UMA FROTA PARA CADA DESAFIO' }),
  );
}

function paginaGalaxias(acoes: AcoesLanding): HTMLElement {
  const galaxia = describeGalaxy(0);
  const fases = galaxyPhases(0);
  return h('.landing-page.landing-galaxias', {},
    h('.landing-page-title', {},
      h('span.landing-kicker', { text: '30 GALÁXIAS · 300 SETORES' }),
      h('h1', {}, 'UM CAMINHO ', h('em', { text: 'SEM FIM.' })),
      h('p', { text: 'Explore setores, enfrente ameaças e avance rumo ao desconhecido.' }),
    ),
    h('section.landing-rota', { 'aria-label': 'Prévia da progressão da galáxia' },
      h('button.landing-rota-seta', { type: 'button', text: '‹', 'aria-label': 'Galáxia anterior' }),
      h('.landing-planetas', {}, ...fases.map((fase, index) => h(`article.landing-planeta${index === 0 ? '.atual' : ''}${index < 4 ? '.concluido' : ''}`, {},
        spriteIcon(fase.icon, 68), h('strong', { text: String(fase.phase) }), index < 4 ? h('i', { text: '✓' }) : null,
      ))),
      h('button.landing-rota-seta', { type: 'button', text: '›', 'aria-label': 'Próxima galáxia' }),
    ),
    h('.landing-galaxy-grid', {},
      h('section.landing-panel.landing-sector-card', {},
        h('.landing-panel-title', {}, h('strong', { text: galaxia.name.toUpperCase() }), h('span', { text: 'GALÁXIA 1' })),
        h('h3', { text: 'SETOR 1 · FASE 1: INCURSÃO' }),
        h('small', { text: 'INIMIGOS PRINCIPAIS' }),
        h('.landing-inimigos', {}, ...navesDeVitrine().slice(0, 3).map((nave) => h('article', {}, spriteIcon(nave.sprite, 54), h('span', { text: nave.name })))),
        h('small', { text: 'TIPOS DE AMEAÇA' }),
        h('.landing-ameacas', {}, ...['AÉREA', 'PELOTÃO', 'FOGO', 'PATRULHA'].map((nome) => h('span', { text: nome }))),
      ),
      h('section.landing-panel.landing-sector-detail', {},
        h('.landing-panel-title', {}, h('strong', { text: 'DETALHES DO SETOR' }), h('span', { text: 'FASE ATUAL' })),
        ...[
          ['Nível recomendado', '1 – 3'], ['Onda máxima', '5'], ['Objetivo', 'Sobreviva às ondas'],
          ['Poder inimigo', '2,2'], ['Recompensa base', '0,1'],
        ].map(([nome, valor]) => h('.landing-detail-row', {}, h('span', { text: nome }), h('b', { text: valor }))),
        h('p', { text: galaxia.identity }),
      ),
      h('section.landing-panel.landing-boss-card', {},
        h('.landing-boss-head', {},
          spriteIcon(fases.at(-1)!.icon, 86),
          h('div', {}, h('small', { text: 'CHEFE NO SETOR 10' }), h('h2', { text: fases.at(-1)!.bossName ?? 'Núcleo Ferrugem' }), h('p', { text: 'A ameaça final guarda o caminho para a próxima fronteira.' })),
        ),
        h('.landing-recompensas', {},
          h('span', {}, spriteIcon('recurso/ferrita', 28), h('b', { text: '201 FERRITA' })),
          h('span', {}, spriteIcon('recurso/gas_exotico', 28), h('b', { text: '8 NÚCLEOS' })),
          h('span', {}, spriteIcon((HULLS.find((n) => n.name === 'Prisma Arco') ?? HULLS[0]!).sprite, 30), h('b', { text: 'NOVA NAVE' })),
        ),
        h('button.landing-cta', { type: 'button', text: 'EXPLORAR ESTA GALÁXIA  ›', onclick: acoes.jogar }),
      ),
    ),
    h('h2.landing-next-title', { text: 'DESBLOQUEIE NOVAS NAVES E RECURSOS' }),
  );
}

const PILOTOS = [
  ['NovaPrime', '12.480'], ['Kryon', '11.920'], ['Eclipse', '11.035'], ['Stellaris', '10.894'],
  ['Você', '10.421'], ['Zarah', '10.312'], ['Draken', '9.880'], ['Lunaris', '9.402'],
] as const;

function paginaComunidade(acoes: AcoesLanding): HTMLElement {
  const naves = navesDeVitrine();
  const categorias = [
    ['/assets/ui/menu/provacao.webp', 'PROVAÇÃO'], ['/assets/ui/menu/galaxia.webp', 'GALÁXIA'],
    ['/assets/ui/menu/codex.webp', 'PERSONAGEM'], ['/assets/ui/menu/hangar.webp', 'NAVES'],
    ['/assets/ui/menu/missoes.webp', 'MISSÕES'],
  ] as const;
  const mensagens = [
    ['NovaPrime', 'Alguém para a Provação do setor 3?', '16:02'],
    ['Eclipse', 'Setor 5 livre! Boa caçada, pilotos.', '16:05'],
    ['Zarah', 'Qual a melhor nave para o setor 80+?', '16:11'],
    ['Draken', 'Vektor-9 ainda é imbatível.', '16:14'],
    ['Lunaris', 'Missão concluída. Vamos para o 3?', '16:18'],
  ] as const;
  return h('.landing-page.landing-comunidade', {},
    h('.landing-page-title', {},
      h('span.landing-kicker', { text: 'TEMPORADAS · RANKINGS · COMUNICAÇÕES' }),
      h('h1', {}, 'O UNIVERSO NÃO ', h('em', { text: 'DORME.' })),
      h('p', { text: 'Compare suas conquistas, encontre pilotos e dispute o topo a cada temporada.' }),
    ),
    h('.landing-community-grid', {},
      h('section.landing-panel.landing-ranking', {},
        h('.landing-panel-title', {}, h('strong', { text: 'RANKING MUNDIAL' }), h('span', { text: 'AO VIVO' })),
        h('.landing-season', {}, h('div', {}, h('strong', { text: 'TEMPORADA 1' }), h('small', { text: '01/09/2026 → 28/09/2026' })), h('div', {}, h('span', { text: 'VIRA EM' }), h('b', { text: '21D 7H' }))),
        h('.landing-ranking-tabs', {}, ...['PROVAÇÃO', 'GALÁXIA', 'PERSONAGEM', 'NAVES', 'MISSÕES'].map((nome, i) => h(`span${i === 0 ? '.ativo' : ''}`, { text: nome }))),
        h('.landing-ranking-head', {}, h('span', { text: '#' }), h('span', { text: 'PILOTO' }), h('span', { text: 'MARCA' })),
        ...PILOTOS.map(([nome, marca], index) => h(`.landing-ranking-row${nome === 'Você' ? '.eu' : ''}`, {},
          h('b', { text: String(index + 1) }),
          spriteIcon((naves[index % Math.max(1, naves.length)] ?? HULLS[0]!).sprite, 27),
          h('span', { text: nome }), h('strong', { text: marca }),
        )),
        h('.landing-sua-marca', {}, h('span', {}, 'SUA MARCA', h('b', { text: '5º' })), h('strong', { text: 'VEKTOR-9 · 10.421' })),
      ),
      h('.landing-community-center', {},
        h('section.landing-panel.landing-destaques', {},
          h('.landing-panel-title', {}, h('strong', { text: 'PILOTOS EM DESTAQUE' }), h('span', { text: 'TOP 3' })),
          h('.landing-podio', {}, ...PILOTOS.slice(0, 3).map(([nome, marca], index) => h(`article.p${index + 1}`, {},
            h('b', { text: String(index + 1) }), spriteIcon((naves[index] ?? HULLS[0]!).sprite, index === 0 ? 84 : 66),
            h('strong', { text: nome }), h('span', { text: marca }),
          ))),
        ),
        h('section.landing-panel.landing-categorias', {},
          h('.landing-panel-title', {}, h('strong', { text: 'CINCO FORMAS DE CHEGAR AO TOPO' })),
          h('.landing-categoria-grid', {}, ...categorias.map(([src, nome]) => h('article', {}, h('img', { src, alt: '' }), h('b', { text: nome })))),
        ),
      ),
      h('section.landing-panel.landing-chat-preview', {},
        h('.landing-panel-title', {}, h('strong', { text: 'COMUNICAÇÕES' }), h('span', { text: 'REDE SOCIAL' })),
        h('.landing-chat-tabs', {}, h('span.ativo', { text: 'GLOBAL' }), h('span', { text: 'PRIVADAS' })),
        h('.landing-chat-log', {}, ...mensagens.map(([nome, texto, hora]) => h('article', {},
          h('header', {}, h('strong', { text: nome }), h('time', { text: hora })), h('p', { text: texto }),
        ))),
        h('.landing-chat-form', {}, h('span', { text: 'Escreva sua mensagem…' }), h('button', { type: 'button', text: 'ENVIAR', onclick: acoes.entrar })),
      ),
    ),
    h('button.landing-cta.landing-community-cta', { type: 'button', text: 'ENTRAR NA COMUNIDADE  ›', onclick: acoes.criarConta }),
  );
}

export function montarLanding(pagina: PaginaLanding, acoes: AcoesLanding): HTMLElement {
  const conteudo = pagina === 'naves'
    ? paginaNaves(acoes)
    : pagina === 'galaxias'
      ? paginaGalaxias(acoes)
      : pagina === 'comunidade'
        ? paginaComunidade(acoes)
        : paginaJogo(acoes);
  return h('.landing-shell', { dataset: { pagina } },
    arteAprovada(pagina, acoes),
    h('.landing-code-shell', {},
      cabecalho(pagina, acoes),
      h('main.landing-main', {}, conteudo),
      h('footer.landing-footer', {}, h('span', { text: 'ÓRBITA ZERO' }), h('span', { text: 'PILOTE · CONSTRUA · COMBATA · EXPLORE' })),
    ),
  );
}

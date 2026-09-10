import { BOSSES, BOSS_INTERVAL } from '@data/bosses';
import { ALL_ENEMIES } from '@data/enemies';
import { ELEMENTS } from '@data/elements';
import { HULLS } from '@data/hulls';
import { RECEITAS } from '@data/balance/fusao';
import { RARITIES } from '@data/balance/raridades';
import { VIP_COST_CRYSTALS, VIP_MANUAL_LEVEL } from '@sim/vip';
import { h } from './dom';

/**
 * A capa — uma página só, com a promessa, a prova e o preço.
 *
 * ## O que ela substituiu, e por quê
 *
 * A versão anterior tinha quatro páginas (O JOGO · NAVES · GALÁXIAS ·
 * COMUNIDADE) e **inventava dados**: um ranking mundial com selo AO VIVO e
 * pilotos que não existem, um chat com conversas e horários fabricados, e uma
 * linha "Você — 5º · 10.421". Quem entrasse no jogo descobriria a encenação em
 * dez segundos, e a primeira impressão viraria desconfiança — num jogo que
 * pede conta e vende cristal, isso é caro demais.
 *
 * As outras duas eram de forma: quatro telas de painéis do jogo mostradas a
 * quem ainda não sabe o que é `T1 +20,1% Dano` (manual, não convite), e uma
 * promessa genérica que servia para qualquer jogo espacial — sem dizer a única
 * coisa que separa este dos outros: **a nave luta sozinha**.
 *
 * ## As duas regras desta tela
 *
 * 1. **Nenhum número é digitado.** Todos saem de `@data`, contados aqui na
 *    hora — ver `NUMEROS`. Cadastrar um casco muda a página sozinho, e nenhum
 *    número pode ficar velho porque nenhum foi escrito à mão.
 * 2. **Nada é afirmado sem fonte no jogo.** Não temos contagem de jogadores
 *    para mostrar; a página diz isso em vez de encher o espaço.
 */

export interface AcoesLanding {
  entrar: () => void;
  criarConta: () => void;
  jogar: () => void;
}

/** As seções que o menu do topo alcança. */
const SECOES = [
  ['landing-jogo', 'O JOGO'],
  ['landing-como', 'COMO FUNCIONA'],
  ['landing-limpo', 'JOGO LIMPO'],
] as const;

/**
 * O censo, contado de `@data` — nunca digitado.
 *
 * Os setores e as galáxias são DERIVADOS: cada galáxia termina num chefe, a
 * cada `BOSS_INTERVAL` setores. Escrever "300" seria criar uma segunda verdade
 * que envelhece calada no dia em que um chefe entrar no catálogo.
 *
 * Os elementos descontam o `padrao`, que é o dano sem aposta e não participa
 * do anel de vantagem — contá-lo aqui seria vender seis onde há cinco.
 */
const NUMEROS: readonly [string, string][] = [
  [String(HULLS.length), 'CASCOS'],
  [String(ALL_ENEMIES.length), 'INIMIGOS'],
  [String(BOSSES.length), 'CHEFES'],
  [String(BOSSES.length * BOSS_INTERVAL), 'SETORES'],
  [String(RARITIES.length), 'RARIDADES'],
  [String(ELEMENTS.length - 1), 'ELEMENTOS + NEUTRO'],
];

const SETORES = BOSSES.length * BOSS_INTERVAL;
/**
 * Quantas peças a fusão consome.
 *
 * Vale dez, igual ao `BOSS_INTERVAL` — e por motivo NENHUM em comum. Uma é o
 * tamanho da galáxia, a outra é o tamanho da receita; usar a mesma constante
 * nas duas frases faria a da fusão mentir no dia em que a galáxia encolhesse.
 */
const PECAS_DA_FUSAO = RECEITAS[0]?.quantidade ?? 10;
const GALAXIAS = BOSSES.length;
const PRIMEIRA_RARIDADE = RARITIES[0]?.name ?? 'Comum';
const ULTIMA_RARIDADE = RARITIES.at(-1)?.name ?? 'Divino';

/**
 * Rola até a seção, sem trocar o endereço.
 *
 * ## Por que botão, e não `<a href="#secao">`
 *
 * Porque a volta do Google chega como FRAGMENTO na URL, e `recolherSessaoDaUrl`
 * a lê de lá. Um `href` de âncora reescreve esse fragmento — e o jogador que
 * acabou de autorizar cairia de volta na tela de login sem entender por quê.
 *
 * `scroll-margin-top` no CSS compensa o cabeçalho grudado; sem ele o título da
 * seção para exatamente debaixo da barra.
 */
function irPara(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function botao(
  rotulo: string,
  aoClicar: () => void,
  classe = '',
): HTMLElement {
  return h(`button.landing-btn${classe}`, { type: 'button', text: rotulo, onclick: aoClicar });
}

function cabecalho(acoes: AcoesLanding): HTMLElement {
  return h('header.landing-barra', {},
    h('button.landing-marca', {
      type: 'button', 'aria-label': 'Órbita Zero — topo da página',
      onclick: () => irPara('landing-topo'),
    },
      h('span', { text: 'ÓRBITA ' }), h('b', { text: 'ZERO' }),
    ),
    h('nav.landing-menu', { 'aria-label': 'Seções desta página' },
      ...SECOES.map(([id, rotulo]) => h('button.landing-menu-item', {
        type: 'button', text: rotulo, onclick: () => irPara(id),
      })),
    ),
    h('.landing-conta', {},
      botao('ENTRAR', acoes.entrar, '.mini'),
      botao('JOGAR', acoes.jogar, '.cheio.mini'),
    ),
  );
}

function kicker(texto: string): HTMLElement {
  return h('span.landing-kicker', { text: texto });
}

/**
 * A dobra: a promessa à esquerda, a tela do jogo à direita — INTEIRA.
 *
 * Ela já sangrou pela borda para caber maior, e o corte comia justamente a
 * ficha do item: a tela parecia quebrada em vez de ampliada.
 *
 * Depois disso teve uma ficha recortada pendurada por cima, como detalhe
 * legível. Saiu também, e por um motivo simples: a ficha JÁ ESTÁ na captura,
 * aberta sobre o inventário. Repeti-la ampliada era dizer a mesma coisa duas
 * vezes na mesma imagem.
 */
function dobra(acoes: AcoesLanding): HTMLElement {
  return h('.landing-dobra', { id: 'landing-topo' },
    h('.landing-dobra-grade', {},
      h('.landing-dobra-copy', {},
        kicker('IDLE · LOOT · ESTRATÉGIA'),
        h('h1', {}, 'Sua nave luta sozinha.', h('em', { text: 'As decisões são suas.' })),
        h('p.landing-sub', {
          text: 'Um shooter espacial idle que roda no navegador. A IA pilota e limpa os '
            + 'setores; você monta o build, escolhe o elemento e decide até onde avançar.',
        }),
        h('.landing-acoes', {},
          botao('JOGAR AGORA  ›', acoes.jogar, '.cheio'),
          botao('VER COMO FUNCIONA', () => irPara('landing-como')),
        ),
        h('.landing-confianca', {},
          ...['Sem instalar nada', 'Grátis para começar', 'Progresso salvo na conta']
            .map((texto) => h('span', {}, h('i'), h('small', { text: texto }))),
        ),
      ),
      h('.landing-quadro', {},
        h('img.landing-tela-do-jogo', {
          src: '/assets/landing/tela.webp',
          alt: 'Tela do Órbita Zero: painel de comando à esquerda, combate contra um chefe '
            + 'no centro e inventário com a ficha do item à direita',
          decoding: 'async', draggable: 'false',
        }),
        // O selo é uma promessa que a página precisa poder cumprir: a imagem é
        // captura do jogo rodando, sem montagem.
        h('span.landing-selo', { text: 'CAPTURA DO JOGO · SEM EDIÇÃO' }),
      ),
    ),
  );
}

function pilar(numero: string, titulo: string, texto: string, dado: string): HTMLElement {
  return h('article.landing-pilar', {},
    h('b', { text: numero }),
    h('h3', { text: titulo }),
    h('p', { text: texto }),
    h('span.landing-pilar-dado', { text: dado }),
  );
}

function oQueVoceFaz(): HTMLElement {
  return h('section.landing-secao', { id: 'landing-jogo' },
    h('.landing-titulo', {},
      kicker('O QUE VOCÊ FAZ AQUI'),
      h('h2', { text: 'Três coisas, e só três.' }),
      h('p', {
        text: 'Não existe menu de melhoria, energia para esperar nem botão de bater mais '
          + 'rápido. O poder vem de onde dá para ver.',
      }),
    ),
    h('.landing-pilares', {},
      pilar('01', 'A IA pilota. Você comanda.',
        'Escolha o perfil — agressivo, evasivo ou coletor — e deixe rodar. A nave '
        + 'enfrenta as ondas enquanto você faz outra coisa.',
        '3 PERFIS DE PILOTO'),
      pilar('02', 'O que cai muda o build.',
        'Prefixos e sufixos com tier, afinidade elemental e ganho de poder calculado na '
        + 'hora. Equipar, desmontar ou fundir: três respostas para a mesma peça.',
        `${RARITIES.length} RARIDADES · ${PRIMEIRA_RARIDADE.toUpperCase()} → ${ULTIMA_RARIDADE.toUpperCase()}`),
      pilar('03', 'O caminho é longo de propósito.',
        `Cada galáxia tem ${BOSS_INTERVAL} setores e um chefe no fim. O inimigo muda de `
        + 'elemento, e o que servia antes para de servir.',
        `${SETORES} SETORES · ${BOSSES.length} CHEFES`),
    ),
  );
}

function passo(numero: string, titulo: string, texto: string): HTMLElement {
  return h('.landing-passo', {},
    h('b', { text: numero }), h('h3', { text: titulo }), h('p', { text: texto }),
  );
}

function figura(src: string, alt: string, etiqueta: string, legenda: string): HTMLElement {
  return h('figure.landing-figura', {},
    h('img', { src, alt, decoding: 'async', draggable: 'false' }),
    h('figcaption', {}, h('b', { text: etiqueta }), h('span', { text: legenda })),
  );
}

function comoFunciona(): HTMLElement {
  return h('section.landing-secao.landing-como', { id: 'landing-como' },
    h('.landing-titulo', {},
      kicker('EM TRÊS MINUTOS'),
      h('h2', { text: 'Como uma sessão acontece.' }),
    ),
    h('.landing-passos', {},
      passo('01', 'Entre e escolha um casco.',
        'Cada um tem um perfil próprio de dano, casco e manobra — e um elemento.'),
      passo('02', 'A nave começa a limpar.',
        'Ondas, setores, chefe. Você pode assistir, ou fechar a aba e voltar depois.'),
      passo('03', 'Volte e decida.',
        `Equipe o que subiu seu poder, funda ${PECAS_DA_FUSAO} peças ruins em uma boa, avance o setor.`),
    ),
    h('.landing-figuras', {},
      figura('/assets/landing/fabricacao.webp',
        'Tela de Fabricação: dez componentes num anel e a chance de obter a raridade acima',
        'FABRICAÇÃO',
        'Dez itens da mesma raridade, e a chance de subir uma raridade escrita antes de você apertar.'),
      figura('/assets/landing/elementos.webp',
        'Códex do jogo mostrando o ciclo de vantagem entre os cinco elementos',
        'CÓDEX',
        'Fogo vence Gelo, que vence Cósmico, que vence Raio. Acertar o elemento vale ×1,5 de dano.'),
    ),
  );
}

/**
 * O censo, e a frase que costuma faltar.
 *
 * A linha final não é modéstia: é o que separa esta página da anterior, que
 * mostrava um ranking mundial inventado. Espaço vazio custa menos que um
 * número falso.
 */
function numeros(): HTMLElement {
  return h('.landing-numeros', {},
    h('.landing-numeros-grade', {},
      ...NUMEROS.map(([valor, rotulo]) => h('.landing-numero', {},
        h('b', { text: valor }), h('span', { text: rotulo }),
      )),
    ),
    h('p.landing-numeros-nota', {
      text: 'Números contados no próprio jogo, na tela do Códex. Não temos contagem de '
        + 'jogadores para mostrar — então não mostramos.',
    }),
  );
}

function regra(titulo: string, texto: string, classe = ''): HTMLElement {
  return h(`.landing-regra${classe}`, {},
    h('strong', { text: titulo }), h('p', { text: texto }),
  );
}

/**
 * O bloco que costuma estar escondido no rodapé.
 *
 * Está aqui em cima de propósito. Num gênero em que todo mundo desconfia de
 * pay-to-win, dizer na capa que o passe não dá poder de combate é argumento de
 * conversão — e é verdade verificável: `comprarVip` no servidor debita
 * cristais e estende validade, e nada mais.
 */
function jogoLimpo(): HTMLElement {
  return h('section.landing-secao.landing-limpo', { id: 'landing-limpo' },
    h('.landing-titulo', {},
      kicker('JOGO LIMPO'),
      h('h2', { text: 'O que não dá para comprar.' }),
      h('p', {
        text: 'Vale a pena ler antes de criar a conta. É a parte que costuma estar '
          + 'escondida no rodapé.',
      }),
    ),
    h('.landing-regras', {},
      regra('O PASSE VIP NÃO DÁ PODER DE COMBATE',
        'Ele libera automações, uma tentativa a mais na Provação e a pilotagem manual a '
        + `partir do nível ${VIP_MANUAL_LEVEL}. Dano, defesa e atributo continuam vindo de `
        + 'item, craft e Matriz — para quem paga e para quem não paga.',
        '.destaque'),
      regra('CRISTAIS SE COMPRAM COM DINHEIRO; O PASSE, COM CRISTAIS',
        `O passe custa ${VIP_COST_CRYSTALS} cristais. Sem caixa surpresa paga: os baús são `
        + 'comprados com moeda do jogo, e as probabilidades ficam à vista na própria tela.'),
      regra('SEU PROGRESSO É DA CONTA, NÃO DO NAVEGADOR',
        'Item, casco, moeda, nível e setor ficam no servidor. Trocar de computador não '
        + 'recomeça nada.'),
      regra('EM DESENVOLVIMENTO ATIVO',
        'O jogo está no ar e jogável agora, e continua crescendo. Quando algo estiver '
        + 'incompleto, vai estar escrito — não pintado de pronto.'),
    ),
  );
}

function fechamento(acoes: AcoesLanding): HTMLElement {
  return h('section.landing-fechamento', {},
    h('h2', { text: 'O setor 1 está esperando.' }),
    h('p', { text: 'Sem download, sem chave de acesso, sem cartão. Abre e joga.' }),
    botao('JOGAR AGORA  ›', acoes.jogar, '.cheio'),
  );
}

export function montarLanding(acoes: AcoesLanding): HTMLElement {
  return h('.landing-shell', {},
    cabecalho(acoes),
    dobra(acoes),
    oQueVoceFaz(),
    comoFunciona(),
    numeros(),
    jogoLimpo(),
    fechamento(acoes),
    h('footer.landing-rodape', {},
      h('span', { text: 'ÓRBITA ZERO' }),
      h('span', { text: `PILOTE · CONSTRUA · COMBATA · EXPLORE · ${GALAXIAS} GALÁXIAS` }),
    ),
  );
}

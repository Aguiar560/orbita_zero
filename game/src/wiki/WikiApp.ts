import './wiki.css';
import { BOSSES } from '@data/bosses';
import { getElement } from '@data/elements';
import { describeGalaxy } from '@data/galaxies';
import { HULLS } from '@data/hulls';
import { ITEM_BASES, ITEM_SETS, AFFIXES } from '@data/items';
import { MISSOES, CATEGORIA_LABEL } from '@data/missoes';
import { PILOTOS } from '@data/pilotos';
import { MODIFICADORES, PROVACAO_PISOS } from '@data/provacao';
import { RARITIES, rarityInfo } from '@data/rarity';
import { FAMILIA_LABEL, RECURSOS } from '@data/recursos';
import { SCREEN_UNLOCKS } from '@data/screen-unlocks';

type Artigo = {
  titulo: string;
  resumo: string;
  imagem: string;
  imagemAlt: string;
  leitura: string;
  sistema?: boolean;
  icone?: string;
  secoes: readonly { titulo: string; corpo: string; dica?: string }[];
};

const BASE = '/wiki';
const GALAXIAS = Array.from({ length: 30 }, (_, indice) => describeGalaxy(indice));
const ALIASES: Readonly<Record<string, string>> = {
  '/guia/equipamentos': '/sistemas/equipamentos',
  '/guia/economia': '/sistemas/fabricacao',
  '/guia/missoes': '/sistemas/missoes',
  '/guia/provacao': '/sistemas/provacao',
};

const ARTIGOS: Readonly<Record<string, Artigo>> = {
  '/guia/inicio': {
    titulo: 'Primeiros passos',
    resumo: 'Da criação do piloto ao primeiro chefe, sem desperdiçar recursos importantes.',
    imagem: '/assets/landing/tela.webp',
    imagemAlt: 'Visão geral do Órbita Zero com nave, combate e interface',
    leitura: '6 min',
    secoes: [
      {
        titulo: '1. Crie sua conta e escolha um piloto',
        corpo: `O apelido identifica você no jogo e é obrigatório. Em seguida, escolha um dos ${PILOTOS.length} pilotos. A escolha define apenas o casco inicial e o estilo dos primeiros combates: todas as naves compráveis continuam disponíveis mais adiante.`,
        dica: 'Leia “forte” e “fraco” na seleção. Não existe piloto errado; existe um começo mais próximo do seu jeito de jogar.',
      },
      {
        titulo: '2. Complete o tutorial',
        corpo: 'O tutorial apresenta movimento, combate, coleta e equipamento. Concluir essa sequência garante que a conta seja inicializada corretamente e explica o ciclo central: lutar, coletar, melhorar a nave e avançar.',
      },
      {
        titulo: '3. Avance pelos setores',
        corpo: 'Cada galáxia possui 10 setores. Sobreviva às ondas, observe o elemento predominante e prepare a resistência correta. O décimo setor é sempre um confronto de chefe e abre a próxima fronteira.',
      },
      {
        titulo: '4. Organize o inventário',
        corpo: 'Compare ganho de poder, raridade, afixos e elemento. Um clique seleciona para venda ou desmontagem; duplo clique equipa. Use os filtros antes de “Selecionar todos” para agir apenas sobre o conjunto visível.',
        dica: 'Itens desmontados alimentam fabricação e fusão. Evite desmontar automaticamente raridades altas antes de conferir afixos e conjuntos.',
      },
    ],
  },
  '/guia/combate': {
    titulo: 'Combate e elementos',
    resumo: 'Como ler DPS, sobrevivência, padrões inimigos e o anel elemental.',
    imagem: '/assets/landing/elementos.webp',
    imagemAlt: 'Interface de combate mostrando elementos e resistências',
    leitura: '8 min',
    secoes: [
      {
        titulo: 'O ciclo de combate',
        corpo: 'A incursão combina patrulha contínua, ondas de inimigos e um chefe. Sua nave ataca conforme a cadência das armas; casco, escudo e regeneração determinam quanto tempo ela permanece em campo. Sobreviver não basta: ondas longas também indicam dano insuficiente.',
      },
      {
        titulo: 'O anel elemental',
        corpo: 'Fogo vence Gelo; Gelo vence Cósmico; Cósmico vence Raio; Raio vence Químico; Químico vence Fogo. Padrão é neutro. A arma equipada define o elemento do tiro, enquanto resistências reduzem o dano recebido.',
        dica: 'Antes de trocar uma peça apenas pelo número verde, confira se você está perdendo a resistência necessária para a região.',
      },
      {
        titulo: 'Automação e postura',
        corpo: 'A IA pode priorizar agressividade, evasão ou coleta. A postura não substitui equipamento: ela muda como a nave usa o poder que já possui. Observe mortes, tempo por onda e itens perdidos para escolher a postura.',
      },
      {
        titulo: 'Como diagnosticar uma derrota',
        corpo: 'Casco esvazia rápido: falta vida ou resistência. Escudo não retorna: falta regeneração ou a luta está intensa demais. Inimigos acumulam: falta dano, cadência ou crítico. Projéteis cercam a nave: experimente postura evasiva e mais manobra.',
      },
    ],
  },
  '/guia/progressao': {
    titulo: 'Progressão e desbloqueios',
    resumo: 'O que abre em cada nível e como os sistemas se conectam.',
    imagem: '/assets/landing/galaxias.png',
    imagemAlt: 'Mapa de galáxias e progressão do Órbita Zero',
    leitura: '7 min',
    secoes: [
      {
        titulo: 'Três linhas de avanço',
        corpo: 'Setor mede a campanha, nível de comando representa experiência geral e poder da nave resume o conjunto equipado. Eles caminham juntos, mas não são equivalentes: um nível alto não corrige uma configuração elemental ruim.',
      },
      {
        titulo: 'Desbloqueios de tela',
        corpo: Object.entries(SCREEN_UNLOCKS).sort(([, a], [, b]) => a.level - b.level).map(([id, item]) => `Nível ${item.level}: ${id === 'afixos' ? 'Engenharia de afixos' : id.charAt(0).toUpperCase() + id.slice(1)}`).join(' · ') + '. Ao alcançar um requisito, o jogo mostra um card informando a nova funcionalidade.',
      },
      {
        titulo: 'Galáxias e chefes',
        corpo: `A campanha possui ${GALAXIAS.length} galáxias e ${GALAXIAS.length * 10} setores. Cada bloco de dez apresenta identidade, frota, elemento e recurso próprios. O chefe final concentra a leitura tática aprendida naquela região.`,
      },
      {
        titulo: 'Depois da campanha inicial',
        corpo: `Missões, eventos, ranking e o Núcleo de Provação ampliam o objetivo além de avançar setores. A Provação possui ${PROVACAO_PISOS} pisos com modificadores que mudam as regras do confronto.`,
      },
    ],
  },
  '/sistemas/equipamentos': {
    titulo: 'Equipamentos',
    resumo: 'Tudo o que aparece no Inventário: filtros, grade, ficha do item, seleção e ações em lote.',
    imagem: '/assets/landing/tela.webp', imagemAlt: 'Inventário aberto ao lado do combate', leitura: '8 min', sistema: true,
    icone: '/assets/ui/menu/armazem.webp',
    secoes: [
      { titulo: 'O que esta tela faz', corpo: `O Inventário reúne todas as peças coletadas e mostra a ocupação atual. Cada item combina uma das ${ITEM_BASES.length} bases com nível, raridade e afixos. É aqui que você compara, equipa, favorita, vende ou desmonta.` },
      { titulo: 'Filtros da parte superior', corpo: 'As abas de raridade e os filtros de ganho de poder, tipo de peça, elemento e favoritos controlam o que aparece na grade. “Selecionar todos” usa exatamente o filtro ativo: itens escondidos pelo filtro não entram na seleção.' },
      { titulo: 'Grade e seleção', corpo: 'Um clique deixa a peça amarela e a inclui na seleção. Não existe caixa de tique. Duplo clique equipa, evitando que selecionar e equipar sejam a mesma ação. O botão direito alterna Favorito e protege a peça das ações em lote.' },
      { titulo: 'Ficha ao passar o mouse', corpo: `A ficha fica dentro do jogo, acima da barra de ações. Ela mostra nome, base, slot, raridade, nível, prefixos, sufixos e comparação com o equipado. A escala possui ${RARITIES.length} raridades, de ${RARITIES[0]?.name} a ${RARITIES.at(-1)?.name}.`, dica: 'Verde e vermelho comparam números; elemento, conjunto e função da configuração ainda precisam ser avaliados.' },
      { titulo: 'Vender e desmontar', corpo: 'Os botões aparecem abaixo da grade somente quando existe seleção. Vender converte as peças em sucata; Desmontar devolve materiais. As duas ações abrem uma confirmação dentro da interface antes de alterar o inventário.' },
    ],
  },
  '/sistemas/fabricacao': {
    titulo: 'Fabricação',
    resumo: 'Como usar a síntese de itens, ler probabilidades e confirmar uma fabricação.',
    imagem: '/assets/landing/fabricacao.webp', imagemAlt: 'Tela de Fabricação do Órbita Zero', leitura: '7 min', sistema: true,
    icone: '/assets/ui/menu/fabricacao.webp',
    secoes: [
      { titulo: 'O que esta tela faz', corpo: `A Fabricação transforma dez equipamentos da mesma raridade em uma tentativa de obter uma peça de raridade superior. Ela é liberada no nível ${SCREEN_UNLOCKS.fabricacao?.level ?? 10}.` },
      { titulo: 'Inventário à esquerda', corpo: 'A coluna esquerda mostra apenas peças elegíveis. Use os filtros de raridade e selecione os componentes manualmente, ou use o preenchimento automático para escolher as piores peças disponíveis dentro da regra atual.' },
      { titulo: 'Anel de síntese no centro', corpo: 'Os dez espaços exibem exatamente o que será consumido. O centro informa a raridade-alvo e a chance atual. Se faltar peça ou material, o botão Fabricar permanece desabilitado e a própria tela informa o requisito pendente.' },
      { titulo: 'Probabilidades à direita', corpo: 'A lista de raridades mostra quantos componentes válidos existem e a chance de cada síntese. A porcentagem exibida é a que será usada; não há garantia escondida fora do que a interface informa.' },
      { titulo: 'Confirmação e resultado', corpo: 'Antes de fabricar, confira todos os dez componentes. A operação consome as peças selecionadas. O resultado entra no inventário imediatamente e deve respeitar a capacidade disponível.', dica: 'Favorite qualquer peça que nunca deve entrar numa seleção automática.' },
    ],
  },
  '/sistemas/missoes': {
    titulo: 'Missões',
    resumo: 'Como navegar por contatos, aceitar contratos, acompanhar objetivos e receber recompensas.',
    imagem: '/assets/landing/comunidade.png', imagemAlt: 'Contatos e comunidade de Órbita Zero', leitura: '7 min', sistema: true,
    icone: '/assets/ui/menu/missoes.webp',
    secoes: [
      { titulo: 'Contato e confiança', corpo: 'A parte superior identifica quem oferece os contratos, a galáxia, a afinidade e o nível de confiança. Concluir missões desse contato desenvolve a relação e pode abrir etapas seguintes da cadeia.' },
      { titulo: 'Missões disponíveis', corpo: 'A lista central separa contratos acessíveis e bloqueados. Cards bloqueados mostram o requisito: setor, nível, confiança ou uma missão anterior. Contratos especiais são maiores porque exibem a recompensa exclusiva inteira.' },
      { titulo: 'Aceitar é obrigatório', corpo: 'Uma missão disponível não acumula progresso. Clique em Aceitar para torná-la ativa; somente fatos ocorridos depois da aceitação contam para o objetivo. O limite de missões ativas aparece junto ao botão.' },
      { titulo: 'Objetivos e progresso', corpo: 'A ficha descreve cada objetivo e sua contagem atual. Eliminação, coleta, entrega e progressão são categorias diferentes. Entrega pode consumir o material no resgate; coleta apenas registra o que foi obtido.' },
      { titulo: 'Reclamar recompensa', corpo: 'Quando todos os objetivos forem concluídos, o botão de resgate fica disponível. Recompensas comuns e exclusivas são apresentadas antes da confirmação; espaço de inventário e requisitos continuam valendo.' },
    ],
  },
  '/sistemas/provacao': {
    titulo: 'Provação',
    resumo: 'Leitura completa do Núcleo: câmaras, tentativas, chefe, modificadores e recompensas.',
    imagem: '/assets/landing/o-jogo.png', imagemAlt: 'Combate espacial de Órbita Zero', leitura: '8 min', sistema: true,
    icone: '/assets/ui/menu/provacao.webp',
    secoes: [
      { titulo: 'Acesso e objetivo', corpo: `O Núcleo de Provação abre no nível ${SCREEN_UNLOCKS.provacao?.level ?? 30}. Ele possui ${PROVACAO_PISOS} câmaras; vencer uma libera a seguinte e registra o maior piso alcançado.` },
      { titulo: 'Coluna esquerda: progresso', corpo: 'Mostra a camada atual, maior piso, marcos vencidos e a linha de marcos. Use esse painel para entender em qual trecho do Núcleo você está e quais conclusões de camada ainda faltam.' },
      { titulo: 'Centro: lista de câmaras', corpo: 'Cada card indica estado — vencido, atual ou bloqueado — e o chefe da câmara quando já conhecido. Selecione um piso acessível para carregar seus dados no painel da direita.' },
      { titulo: 'Direita: preparação da luta', corpo: `Mostra chefe, arquétipo, confronto elemental, poder recomendado, especial, ${MODIFICADORES.length} modificadores possíveis e recompensa. Compare seu elemento e poder antes de iniciar.` },
      { titulo: 'Tentativas e recompensas', corpo: 'O topo mostra tentativas disponíveis e o tempo para recuperar a próxima. Primeira vitória, repetição e conclusão de camada podem ter recompensas diferentes; a ficha informa qual delas está ativa.' },
    ],
  },
  '/sistemas/engenharia': {
    titulo: 'Engenharia',
    resumo: 'Como recalibrar prefixos e sufixos na Bancada de Modulação.',
    imagem: '/assets/landing/naves.png', imagemAlt: 'Nave e equipamentos do Órbita Zero', leitura: '9 min', sistema: true,
    icone: '/assets/ui/menu/afixos.webp',
    secoes: [
      { titulo: 'Acesso e propósito', corpo: `A Engenharia abre no nível ${SCREEN_UNLOCKS.afixos?.level ?? 21}. A Bancada de Modulação altera prefixos e sufixos sem trocar a base do item. Existem ${AFFIXES.length} afixos catalogados e ${ITEM_SETS.length} conjuntos.` },
      { titulo: 'Carga à esquerda', corpo: 'Escolha o equipamento que será trabalhado. Os filtros por raridade reduzem a lista; a ficha mostra nome, nível e quantidade de prefixos e sufixos antes de qualquer operação.' },
      { titulo: 'Item e linhas no centro', corpo: 'O painel central separa Prefixos e Sufixos. Clique na linha que será o alvo. Linhas ancoradas aparecem identificadas e não podem ser alteradas por uma operação incompatível.' },
      { titulo: 'Protocolos à direita', corpo: 'Escolha a operação de modulação. A área Alvo atual informa se ela atua numa linha ou no item inteiro; Regras e Pool possível explicam o que pode sair antes de executar.' },
      { titulo: 'Custos e resultado', corpo: 'A barra inferior apresenta Núcleos, Essência e, quando necessário, minério. O botão só libera quando alvo e materiais são válidos. Depois da execução, a tela compara Antes e Agora.', dica: 'Engenharia trabalha identidade e tier dos afixos; ela não transforma a base, o slot ou o nível do item.' },
    ],
  },
  '/guia/conta': {
    titulo: 'Conta, privacidade e suporte',
    resumo: 'Login, apelido, recuperação, dados visíveis e como pedir ajuda.',
    imagem: '/assets/landing/comunidade.png',
    imagemAlt: 'Comunidade e comunicação entre pilotos',
    leitura: '5 min',
    secoes: [
      {
        titulo: 'Entrar não cria conta',
        corpo: 'Use Entrar quando a conta já existe. Use Criar conta para começar um cadastro. Contas sociais devem entrar novamente com o mesmo provedor; elas não recebem uma senha local automaticamente.',
      },
      {
        titulo: 'Apelido obrigatório',
        corpo: 'Todo novo piloto escolhe um apelido antes de entrar no jogo. Ele aparece no perfil, ranking e recursos sociais; e-mail, identificadores técnicos e detalhes de sessão permanecem ocultos para proteger jogadores e streamers.',
      },
      {
        titulo: 'Apagar progresso',
        corpo: 'Apagar o progresso é uma ação destrutiva. Depois da confirmação, a sessão é encerrada para impedir que o cliente continue usando dados que já não existem.',
      },
      {
        titulo: 'Ao pedir suporte',
        corpo: 'Informe apelido, horário aproximado, tela, ação realizada e uma captura. Nunca envie senha, token, código de sessão ou acesso ao provedor social.',
        dica: 'Para bugs de item, inclua o nome da peça, raridade, setor e o que aconteceu antes de ela sumir ou deixar de atualizar.',
      },
    ],
  },
};

const NAV = [
  ['COMECE AQUI', [['/guia/inicio', 'Primeiros passos'], ['/guia/combate', 'Combate e elementos'], ['/guia/progressao', 'Progressão']]],
  ['SISTEMAS', [['/sistemas/fabricacao', 'Fabricação'], ['/sistemas/missoes', 'Missões'], ['/sistemas/equipamentos', 'Equipamentos'], ['/sistemas/provacao', 'Provação'], ['/sistemas/engenharia', 'Engenharia']]],
  ['SUPORTE', [['/guia/conta', 'Conta e privacidade']]],
  ['CATÁLOGOS', [['/catalogo/naves', 'Naves'], ['/catalogo/galaxias', 'Galáxias'], ['/catalogo/recursos', 'Recursos'], ['/catalogo/missoes', 'Missões'], ['/catalogo/chefes', 'Chefes']]],
] as const;

const escapeHtml = (valor: unknown): string => String(valor)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const rotaAtual = (): string => {
  const caminho = location.pathname.replace(/\/+$/, '');
  return caminho.startsWith(BASE) ? caminho.slice(BASE.length) || '/' : '/';
};

const urlWiki = (rota: string): string => `${BASE}${rota === '/' ? '/' : rota}`;

const sprite = (id: string, tamanho = 86): string =>
  `<span class="wiki-sprite" data-wiki-sprite="${escapeHtml(id)}" style="--sprite-size:${tamanho}px" aria-hidden="true"></span>`;

function metadados(titulo: string, descricao: string, rota: string): void {
  document.title = `${titulo} — Wiki Órbita Zero`;
  const canonical = `https://www.orbitazero.com.br${urlWiki(rota)}`;
  const definir = (seletor: string, atributo: string, valor: string): void => {
    document.querySelector<HTMLMetaElement>(seletor)?.setAttribute(atributo, valor);
  };
  definir('meta[name="description"]', 'content', descricao);
  definir('meta[property="og:title"]', 'content', `${titulo} — Wiki Órbita Zero`);
  definir('meta[property="og:description"]', 'content', descricao);
  definir('meta[property="og:url"]', 'content', canonical);
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', canonical);
}

function cabecalhoPagina(kicker: string, titulo: string, resumo: string): string {
  return `<header class="wiki-page-head">
    <span>${escapeHtml(kicker)}</span>
    <h1>${escapeHtml(titulo)}</h1>
    <p>${escapeHtml(resumo)}</p>
  </header>`;
}

function paginaInicial(): string {
  const cards = [
    ['/guia/inicio', 'ORIENTAÇÃO', 'Comece sua jornada', 'Conta, piloto, tutorial e primeiros setores.', '/assets/landing/o-jogo.png'],
    ['/guia/combate', 'TÁTICA', 'Domine os elementos', 'Leia ameaças, resistências e postura da IA.', '/assets/landing/o-jogo.png'],
    ['/sistemas/equipamentos', 'ARSENAL', 'Use o inventário', 'Entenda filtros, seleção, ficha e ações em lote.', '/assets/landing/naves.png'],
    ['/sistemas/fabricacao', 'SÍNTESE', 'Use a Fabricação', 'Selecione componentes, leia chances e fabrique.', '/assets/landing/fabricacao.webp'],
  ] as const;
  return `<section class="wiki-home-hero">
      <div class="wiki-hero-copy">
        <span class="wiki-eyebrow">ARQUIVO DE NAVEGAÇÃO · VERSÃO VIVA</span>
        <h1>Todo o universo.<br><em>Uma rota clara.</em></h1>
        <p>Guias cuidadosos, catálogos ligados aos dados reais do jogo e respostas rápidas para cada sistema de Órbita Zero.</p>
        <div class="wiki-hero-actions">
          <a data-wiki-link href="${urlWiki('/guia/inicio')}" class="wiki-button primary">COMEÇAR PELO BÁSICO <b>›</b></a>
          <a data-wiki-link href="${urlWiki('/catalogo/naves')}" class="wiki-button">EXPLORAR CATÁLOGOS</a>
        </div>
      </div>
      <figure><img src="/assets/landing/tela.webp" alt="Combate, inventário e interface real de Órbita Zero"><figcaption>CAPTURA REAL DO JOGO</figcaption></figure>
    </section>
    <section class="wiki-census" aria-label="Conteúdo atual do jogo">
      ${[[GALAXIAS.length, 'galáxias'], [HULLS.length, 'cascos'], [RECURSOS.length, 'recursos'], [MISSOES.length, 'missões'], [BOSSES.length, 'chefes']].map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('')}
    </section>
    <section class="wiki-section">
      <div class="wiki-section-title"><span>ROTAS RECOMENDADAS</span><h2>Encontre o que precisa sem sair da missão.</h2></div>
      <div class="wiki-feature-grid">${cards.map(([rota, kicker, titulo, texto, imagem]) => `
        <a data-wiki-link href="${urlWiki(rota)}" class="wiki-feature-card">
          <img src="${imagem}" alt="" loading="lazy"><div><span>${kicker}</span><h3>${titulo}</h3><p>${texto}</p><b>ABRIR GUIA ›</b></div>
        </a>`).join('')}</div>
    </section>
    <section class="wiki-section wiki-principles">
      <div class="wiki-section-title"><span>COMO ESTA WIKI FUNCIONA</span><h2>Informação confiável, spoiler sob controle.</h2></div>
      <div class="wiki-three"><article><b>01</b><h3>Dados vivos</h3><p>Contagens e catálogos são lidos das mesmas tabelas usadas pelo jogo.</p></article><article><b>02</b><h3>Explicação prática</h3><p>Cada guia mostra o que fazer, por que funciona e quais erros evitar.</p></article><article><b>03</b><h3>Descoberta preservada</h3><p>Chefes e surpresas ficam escondidos até você decidir revelá-los.</p></article></div>
    </section>`;
}

function paginaArtigo(artigo: Artigo): string {
  if (artigo.sistema) {
    const captura = artigo.imagem.endsWith('.webp')
      ? `<figure class="wiki-system-screen"><img src="${artigo.imagem}" alt="${escapeHtml(artigo.imagemAlt)}"><figcaption>CAPTURA DA TELA NO JOGO</figcaption></figure>`
      : '';
    return `<header class="wiki-system-head">${artigo.icone ? `<img src="${artigo.icone}" alt="">` : ''}<div><span>SISTEMA · ${artigo.leitura} DE LEITURA</span><h1>${escapeHtml(artigo.titulo)}</h1><p>${escapeHtml(artigo.resumo)}</p></div></header>
      ${captura}<article class="wiki-prose wiki-system-prose">${artigo.secoes.map((secao, i) => `<section id="secao-${i + 1}"><small>${String(i + 1).padStart(2, '0')}</small><h2>${escapeHtml(secao.titulo)}</h2><p>${escapeHtml(secao.corpo)}</p>${secao.dica ? `<aside><b>ATENÇÃO</b>${escapeHtml(secao.dica)}</aside>` : ''}</section>`).join('')}</article>`;
  }
  return `${cabecalhoPagina(`GUIA · ${artigo.leitura} DE LEITURA`, artigo.titulo, artigo.resumo)}
    <figure class="wiki-article-hero"><img src="${artigo.imagem}" alt="${escapeHtml(artigo.imagemAlt)}"><figcaption>IMAGEM REAL DO UNIVERSO ÓRBITA ZERO</figcaption></figure>
    <div class="wiki-article-layout"><article class="wiki-prose">
      ${artigo.secoes.map((secao, i) => `<section id="secao-${i + 1}"><h2>${escapeHtml(secao.titulo)}</h2><p>${escapeHtml(secao.corpo)}</p>${secao.dica ? `<aside><b>NOTA DE BORDO</b>${escapeHtml(secao.dica)}</aside>` : ''}</section>`).join('')}
    </article><aside class="wiki-on-this-page"><b>NESTE GUIA</b>${artigo.secoes.map((s, i) => `<a href="#secao-${i + 1}">${escapeHtml(s.titulo)}</a>`).join('')}</aside></div>`;
}

function paginaNaves(): string {
  const tipos = new Map<string, number>();
  HULLS.forEach((nave) => tipos.set(getElement(nave.element).name, (tipos.get(getElement(nave.element).name) ?? 0) + 1));
  return `${cabecalhoPagina('CATÁLOGO DE FROTA', `${HULLS.length} naves documentadas`, 'Compare identidade, elemento, acesso e papel de cada casco disponível no universo conhecido.')}
    <div class="wiki-summary-row">${[...tipos].map(([nome, total]) => `<span><b>${total}</b> ${escapeHtml(nome)}</span>`).join('')}</div>
    <div class="wiki-catalog-tools"><label>FILTRAR FROTA<input data-catalog-filter placeholder="Nome, elemento ou descrição…"></label><span data-catalog-count>${HULLS.length} resultados</span></div>
    <div class="wiki-card-grid" data-catalog-grid>${HULLS.map((nave) => {
      const elemento = getElement(nave.element);
      return `<article class="wiki-data-card" data-search="${escapeHtml(`${nave.name} ${elemento.name} ${nave.blurb}`.toLowerCase())}">
        <div class="wiki-data-art" style="--accent:${elemento.color}">${sprite(nave.sprite)}<span>T${nave.tier}</span></div>
        <div class="wiki-data-copy"><span style="color:${elemento.color}">${escapeHtml(elemento.name)}</span><h2>${escapeHtml(nave.name)}</h2><p>${escapeHtml(nave.blurb)}</p>
        <dl><div><dt>ACESSO</dt><dd>${nave.piloto ? 'Piloto inicial' : nave.prototype ? 'Protótipo' : nave.cost > 0 ? `${nave.cost} cristais` : `Setor ${nave.requiresSector}`}</dd></div><div><dt>PAPEL</dt><dd>${(nave.stats.dano ?? 0) >= (nave.stats.vida ?? 0) ? 'Ofensivo' : 'Resistente'}</dd></div></dl></div>
      </article>`;
    }).join('')}</div>`;
}

function paginaGalaxias(): string {
  return `${cabecalhoPagina('ATLAS ESTELAR', 'Trinta galáxias, trezentos setores', 'Cada região tem identidade, elemento predominante, frota e material-assinatura próprios.')}
    <div class="wiki-catalog-tools"><label>LOCALIZAR GALÁXIA<input data-catalog-filter placeholder="Nome, frota, elemento ou perigo…"></label><span data-catalog-count>${GALAXIAS.length} resultados</span></div>
    <div class="wiki-galaxy-grid" data-catalog-grid>${GALAXIAS.map((g) => {
      const elemento = getElement(g.element);
      return `<article class="wiki-galaxy-card" data-search="${escapeHtml(`${g.name} ${g.fleet} ${elemento.name} ${g.identity} ${g.hazard}`.toLowerCase())}" style="--accent:${g.color}">
        <div class="wiki-galaxy-number"><small>GALÁXIA</small><b>${String(g.index + 1).padStart(2, '0')}</b>${sprite(g.sprite, 64)}</div>
        <div><span>${escapeHtml(elemento.name)} · SETORES ${g.firstSector}–${g.lastSector}</span><h2>${escapeHtml(g.name)}</h2><p>${escapeHtml(g.identity)}</p><dl><div><dt>FROTA</dt><dd>${escapeHtml(g.fleet)}</dd></div><div><dt>AMEAÇA</dt><dd>${escapeHtml(g.hazard)}</dd></div></dl></div>
      </article>`;
    }).join('')}</div>`;
}

function paginaRecursos(): string {
  return `${cabecalhoPagina('BANCO DE MATERIAIS', `${RECURSOS.length} recursos catalogados`, 'Origem, função, família e estágio de cada material da economia do jogo.')}
    <div class="wiki-catalog-tools"><label>BUSCAR MATERIAL<input data-catalog-filter placeholder="Nome, família, origem ou uso…"></label><span data-catalog-count>${RECURSOS.length} resultados</span></div>
    <div class="wiki-resource-table" data-catalog-grid>${RECURSOS.map((recurso) => {
      const raridade = rarityInfo(recurso.raridade);
      return `<article data-search="${escapeHtml(`${recurso.nome} ${FAMILIA_LABEL[recurso.familia]} ${recurso.drop} ${recurso.funcao}`.toLowerCase())}">
        ${sprite(`recurso/${recurso.id}`, 58)}<div><span style="color:${raridade.color}">${escapeHtml(raridade.name)} · ${escapeHtml(FAMILIA_LABEL[recurso.familia])}</span><h2>${escapeHtml(recurso.nome)}</h2><p>${escapeHtml(recurso.funcao)}</p></div>
        <dl><div><dt>OBTENÇÃO</dt><dd>${escapeHtml(recurso.drop)}</dd></div><div><dt>ESTADO</dt><dd>${recurso.dropEstado === 'ativo' && recurso.usoEstado === 'ativo' ? 'Ativo' : 'Em expansão'}</dd></div></dl>
      </article>`;
    }).join('')}</div>`;
}

function paginaMissoes(): string {
  return `${cabecalhoPagina('ARQUIVO DE CONTRATOS', `${MISSOES.length} missões registradas`, 'Consulte objetivo, categoria, ritmo e recompensa. O progresso só começa depois de aceitar a missão.')}
    <aside class="wiki-callout"><b>REGRA IMPORTANTE</b> Missões disponíveis não acumulam progresso. Aceite o contrato antes de realizar o objetivo.</aside>
    <div class="wiki-catalog-tools"><label>BUSCAR MISSÃO<input data-catalog-filter placeholder="Nome, descrição, categoria ou ritmo…"></label><span data-catalog-count>${MISSOES.length} resultados</span></div>
    <div class="wiki-mission-list" data-catalog-grid>${MISSOES.map((missao) => `<article data-search="${escapeHtml(`${missao.nome} ${missao.descricao} ${CATEGORIA_LABEL[missao.categoria]} ${missao.ritmo}`.toLowerCase())}">
      <div><span>${escapeHtml(CATEGORIA_LABEL[missao.categoria])} · ${escapeHtml(missao.ritmo)}</span><h2>${escapeHtml(missao.nome)}</h2><p>${escapeHtml(missao.descricao)}</p></div>
      <ul>${missao.objetivos.map((o) => `<li>${escapeHtml(o.texto ?? `${o.fato}: ${o.alvo}`)}</li>`).join('')}</ul>
    </article>`).join('')}</div>`;
}

function paginaChefes(revelado: boolean): string {
  if (!revelado) return `${cabecalhoPagina('ARQUIVO RESTRITO', 'Chefes da campanha', 'Esta seção contém nomes, títulos, elementos e imagens de confrontos importantes.')}
    <section class="wiki-spoiler"><span>⚠</span><h2>Você está entrando em uma zona de spoilers.</h2><p>A descoberta de cada comandante faz parte da campanha. Revele o arquivo apenas se quiser consultar todos os encontros.</p><button data-reveal-bosses class="wiki-button primary">REVELAR CATÁLOGO</button><a data-wiki-link href="${urlWiki('/')}" class="wiki-button">VOLTAR À WIKI</a></section>`;
  return `${cabecalhoPagina('ARQUIVO RESTRITO · SPOILERS VISÍVEIS', `${BOSSES.length} chefes catalogados`, 'Elementos, títulos e recompensas de primeira vitória dos comandantes da campanha.')}
    <div class="wiki-catalog-tools"><label>BUSCAR CHEFE<input data-catalog-filter placeholder="Nome, título ou elemento…"></label><span data-catalog-count>${BOSSES.length} resultados</span></div>
    <div class="wiki-boss-grid" data-catalog-grid>${BOSSES.map((boss, i) => {
      const elemento = getElement(boss.element);
      return `<article data-search="${escapeHtml(`${boss.name} ${boss.title} ${elemento.name}`.toLowerCase())}" style="--accent:${elemento.color}">${sprite(boss.sprite, 112)}<span>SETOR ${(i + 1) * 10} · ${escapeHtml(elemento.name)}</span><h2>${escapeHtml(boss.name)}</h2><p>${escapeHtml(boss.title)}</p><small>${boss.phases.length} fases de combate</small></article>`;
    }).join('')}</div>`;
}

type AtlasJson = { w: number; h: number; frames: Record<string, [number, number, number, number, number, number, number, number]> };
const atlasCache = new Map<string, Promise<AtlasJson>>();
const ATLAS_CANDIDATOS = ['spaceships2', 'void', 'galaxia', 'espaco', 'elemental', 'recursos', 'characters', 'itens-novos', 'itens', 'icones'];

async function carregarAtlas(nome: string): Promise<AtlasJson> {
  const existente = atlasCache.get(nome);
  if (existente) return existente;
  const pedido = fetch(`/assets/atlas/${nome}.json`).then(async (r) => {
    if (!r.ok) throw new Error(`atlas ${nome}`);
    return r.json() as Promise<AtlasJson>;
  });
  atlasCache.set(nome, pedido);
  return pedido;
}

async function hidratarSprites(raiz: HTMLElement): Promise<void> {
  const elementos = [...raiz.querySelectorAll<HTMLElement>('[data-wiki-sprite]')];
  if (!elementos.length) return;
  const atlas = await Promise.all(ATLAS_CANDIDATOS.map(async (nome) => [nome, await carregarAtlas(nome)] as const));
  for (const el of elementos) {
    const id = el.dataset.wikiSprite ?? '';
    const achado = atlas.find(([, dados]) => id in dados.frames);
    if (!achado) continue;
    const [nome, dados] = achado;
    const [x, y, w, h, ox, oy, sw, sh] = dados.frames[id]!;
    const tamanho = Number.parseFloat(getComputedStyle(el).getPropertyValue('--sprite-size')) || 86;
    const escala = Math.min((tamanho - 10) / sw, (tamanho - 10) / sh);
    const recorte = document.createElement('i');
    recorte.style.width = `${w * escala}px`;
    recorte.style.height = `${h * escala}px`;
    recorte.style.left = `${(tamanho - sw * escala) / 2 + ox * escala}px`;
    recorte.style.top = `${(tamanho - sh * escala) / 2 + oy * escala}px`;
    recorte.style.backgroundImage = `url(/assets/atlas/${nome}.webp)`;
    recorte.style.backgroundSize = `${dados.w * escala}px ${dados.h * escala}px`;
    recorte.style.backgroundPosition = `${-x * escala}px ${-y * escala}px`;
    el.append(recorte);
  }
}

function aplicarFiltro(raiz: HTMLElement): void {
  const campo = raiz.querySelector<HTMLInputElement>('[data-catalog-filter]');
  const grade = raiz.querySelector<HTMLElement>('[data-catalog-grid]');
  const contador = raiz.querySelector<HTMLElement>('[data-catalog-count]');
  if (!campo || !grade || !contador) return;
  const itens = [...grade.querySelectorAll<HTMLElement>('[data-search]')];
  campo.addEventListener('input', () => {
    const termos = campo.value.toLocaleLowerCase('pt-BR').trim().split(/\s+/).filter(Boolean);
    let visiveis = 0;
    for (const item of itens) {
      const texto = item.dataset.search ?? '';
      const mostrar = termos.every((termo) => texto.includes(termo));
      item.hidden = !mostrar;
      if (mostrar) visiveis += 1;
    }
    contador.textContent = `${visiveis} ${visiveis === 1 ? 'resultado' : 'resultados'}`;
  });
}

function resultadoBusca(): { rota: string; titulo: string; resumo: string; grupo: string }[] {
  const artigos = Object.entries(ARTIGOS).map(([rota, artigo]) => ({ rota, titulo: artigo.titulo, resumo: artigo.resumo, grupo: 'Guia' }));
  return [
    ...artigos,
    ...HULLS.map((h) => ({ rota: '/catalogo/naves', titulo: h.name, resumo: h.blurb, grupo: 'Nave' })),
    ...GALAXIAS.map((g) => ({ rota: '/catalogo/galaxias', titulo: g.name, resumo: g.identity, grupo: 'Galáxia' })),
    ...RECURSOS.map((r) => ({ rota: '/catalogo/recursos', titulo: r.nome, resumo: r.funcao, grupo: 'Recurso' })),
    ...MISSOES.map((m) => ({ rota: '/catalogo/missoes', titulo: m.nome, resumo: m.descricao, grupo: 'Missão' })),
  ];
}

export function montarWiki(root: HTMLElement): void {
  let spoilers = sessionStorage.getItem('oz-wiki-spoilers') === 'sim';
  const busca = resultadoBusca();

  const navegar = (rota: string, empurrar = true): void => {
    if (empurrar) history.pushState({}, '', urlWiki(rota));
    renderizar();
    scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderizar = (): void => {
    const solicitada = rotaAtual();
    const rota = ALIASES[solicitada] ?? solicitada;
    const artigo = ARTIGOS[rota];
    let conteudo: string;
    let titulo = 'Wiki oficial';
    let descricao = 'Guias e catálogos oficiais de Órbita Zero.';
    if (rota === '/') conteudo = paginaInicial();
    else if (artigo) { conteudo = paginaArtigo(artigo); titulo = artigo.titulo; descricao = artigo.resumo; }
    else if (rota === '/catalogo/naves') { conteudo = paginaNaves(); titulo = 'Naves'; descricao = `Catálogo das ${HULLS.length} naves de Órbita Zero.`; }
    else if (rota === '/catalogo/galaxias') { conteudo = paginaGalaxias(); titulo = 'Galáxias'; descricao = 'Atlas das 30 galáxias de Órbita Zero.'; }
    else if (rota === '/catalogo/recursos') { conteudo = paginaRecursos(); titulo = 'Recursos'; descricao = `Catálogo dos ${RECURSOS.length} recursos de Órbita Zero.`; }
    else if (rota === '/catalogo/missoes') { conteudo = paginaMissoes(); titulo = 'Missões'; descricao = `Arquivo com ${MISSOES.length} missões de Órbita Zero.`; }
    else if (rota === '/catalogo/chefes') { conteudo = paginaChefes(spoilers); titulo = 'Chefes'; descricao = 'Arquivo de chefes da campanha de Órbita Zero.'; }
    else { conteudo = `${cabecalhoPagina('ERRO DE NAVEGAÇÃO', 'Coordenada não encontrada', 'A rota informada não existe ou foi movida.')}<a data-wiki-link class="wiki-button primary" href="${urlWiki('/')}">VOLTAR AO INÍCIO</a>`; titulo = 'Página não encontrada'; descricao = 'A rota da wiki não foi encontrada.'; }

    root.innerHTML = `<div class="wiki-shell">
      <header class="wiki-topbar"><a data-wiki-link class="wiki-brand" href="${urlWiki('/')}"><span>ØZ</span><b>ÓRBITA ZERO</b><small>WIKI</small></a>
        <button class="wiki-search-open" data-search-open aria-label="Buscar na wiki"><span>⌕</span> BUSCAR NA WIKI <kbd>Ctrl K</kbd></button>
        <nav><a href="/">VOLTAR AO JOGO</a></nav><button class="wiki-menu-button" data-menu-toggle aria-label="Abrir menu">☰</button>
      </header>
      <div class="wiki-body"><aside class="wiki-sidebar"><nav>${NAV.map(([grupo, links]) => `<section><b>${grupo}</b>${links.map(([href, label]) => `<a data-wiki-link class="${rota === href ? 'active' : ''}" href="${urlWiki(href)}">${label}</a>`).join('')}</section>`).join('')}</nav><footer><span>CONTEÚDO DO JOGO</span><b>ATUALIZAÇÃO AUTOMÁTICA</b></footer></aside>
      <main class="wiki-main">${conteudo}<footer class="wiki-footer"><div><b>ÓRBITA ZERO</b><span>Wiki oficial em construção contínua.</span></div><a href="/">JOGAR AGORA ›</a></footer></main></div>
      <dialog class="wiki-search"><form method="dialog"><div><span>⌕</span><input data-global-search autofocus placeholder="Busque por sistema, nave, galáxia, recurso…"><button aria-label="Fechar busca">ESC</button></div><section data-search-results><p>Digite pelo menos dois caracteres para navegar pelo arquivo.</p></section></form></dialog>
    </div>`;
    metadados(titulo, descricao, rota);

    root.querySelectorAll<HTMLAnchorElement>('[data-wiki-link]').forEach((link) => link.addEventListener('click', (evento) => {
      evento.preventDefault();
      navegar(new URL(link.href).pathname.slice(BASE.length) || '/');
    }));
    root.querySelector('[data-menu-toggle]')?.addEventListener('click', () => root.querySelector('.wiki-sidebar')?.classList.toggle('open'));
    root.querySelector('[data-reveal-bosses]')?.addEventListener('click', () => { spoilers = true; sessionStorage.setItem('oz-wiki-spoilers', 'sim'); renderizar(); });
    aplicarFiltro(root);
    void hidratarSprites(root).catch(() => undefined);

    const modal = root.querySelector<HTMLDialogElement>('.wiki-search');
    const campo = root.querySelector<HTMLInputElement>('[data-global-search]');
    const saida = root.querySelector<HTMLElement>('[data-search-results]');
    const abrir = (): void => { modal?.showModal(); requestAnimationFrame(() => campo?.focus()); };
    root.querySelector('[data-search-open]')?.addEventListener('click', abrir);
    campo?.addEventListener('input', () => {
      if (!saida) return;
      const termos = campo.value.toLocaleLowerCase('pt-BR').trim().split(/\s+/).filter(Boolean);
      if (campo.value.trim().length < 2) { saida.innerHTML = '<p>Digite pelo menos dois caracteres para navegar pelo arquivo.</p>'; return; }
      const encontrados = busca.filter((item) => termos.every((t) => `${item.titulo} ${item.resumo}`.toLocaleLowerCase('pt-BR').includes(t))).slice(0, 12);
      saida.innerHTML = encontrados.length ? encontrados.map((item) => `<a href="${urlWiki(item.rota)}" data-search-route="${item.rota}"><span>${item.grupo}</span><b>${escapeHtml(item.titulo)}</b><small>${escapeHtml(item.resumo)}</small></a>`).join('') : '<p>Nenhum registro encontrado. Tente uma palavra mais geral.</p>';
      saida.querySelectorAll<HTMLAnchorElement>('[data-search-route]').forEach((link) => link.addEventListener('click', (e) => { e.preventDefault(); modal?.close(); navegar(link.dataset.searchRoute ?? '/'); }));
    });
  };

  addEventListener('popstate', () => renderizar());
  addEventListener('keydown', (evento) => { if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') { evento.preventDefault(); root.querySelector<HTMLDialogElement>('.wiki-search')?.showModal(); root.querySelector<HTMLInputElement>('[data-global-search]')?.focus(); } });
  renderizar();
}

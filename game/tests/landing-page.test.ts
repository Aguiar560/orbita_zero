import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BOSSES, BOSS_INTERVAL } from '@data/bosses';
import { ALL_ENEMIES } from '@data/enemies';
import { ELEMENTS } from '@data/elements';
import { HULLS } from '@data/hulls';
import { RARITIES } from '@data/balance/raridades';

/**
 * A capa, e o que ela não tem mais o direito de fazer.
 *
 * ## O defeito que estes testes guardam
 *
 * A versão anterior **inventava dados**: um ranking mundial com selo AO VIVO e
 * oito pilotos que não existem, um chat com conversas e horários fabricados, e
 * uma linha "Você — 5º · 10.421" para o visitante se ver no pódio.
 *
 * Isso não é exagero de marketing, é uma promessa que o próprio jogo desmente
 * dez segundos depois — e a página que pede conta e vende cristal é o pior
 * lugar possível para queimar confiança. O teste existe porque números falsos
 * voltam por conveniência: é sempre mais fácil escrever "12.480" do que contar.
 *
 * A regra que ficou: **todo número da capa é contado de `@data`, na hora.**
 * Estes testes conferem os valores de verdade — se alguém digitar "300 setores"
 * à mão e um chefe entrar no catálogo, a asserção cai.
 */

const fonte = (...partes: string[]): string =>
  readFileSync(join(process.cwd(), 'src', ...partes), 'utf8');

/**
 * O fonte sem comentários.
 *
 * Sem isto, a proibição de "RANKING MUNDIAL" cai por causa do cabeçalho deste
 * próprio arquivo, que EXPLICA o ranking removido. O que se proíbe é o que a
 * página desenha — a prosa que conta por quê é justamente o que precisa
 * continuar podendo citar os nomes.
 */
const semComentarios = (fonte: string): string =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const landing = fonte('ui', 'Landing.ts');
const landingDesenhado = semComentarios(landing);
const login = fonte('ui', 'Login.ts');
const css = fonte('styles', 'landing.css');

describe('a capa não inventa dados', () => {
  it('não tem ranking, pódio nem chat simulados', () => {
    /**
     * Os quatro nomes vinham de uma constante `PILOTOS` com marcas inventadas,
     * e as mensagens de uma constante `mensagens` com horários. Nenhum dos dois
     * pode voltar sem que alguém veja este teste cair.
     */
    for (const proibido of ['RANKING MUNDIAL', 'COMUNICAÇÕES', 'PILOTOS EM DESTAQUE',
      'NovaPrime', 'Eclipse', 'TEMPORADA 1', 'AO VIVO']) {
      expect(landingDesenhado, proibido).not.toContain(proibido);
    }
  });

  it('e diz, em vez disso, que não tem número de jogadores', () => {
    // O espaço vazio custa menos que o número falso, e dizer isso é o que
    // separa esta capa da anterior.
    expect(landing).toContain('Não temos contagem de ');
    expect(landing).toContain('jogadores para mostrar');
  });

  it('nenhum número do censo é digitado', () => {
    /**
     * O bloco `NUMEROS` inteiro sai de `@data`. Escrever o valor à mão criaria
     * uma segunda verdade que envelhece calada — que é como um "53 cascos"
     * continua na página depois do 54º entrar.
     */
    const bloco = landingDesenhado.slice(
      landingDesenhado.indexOf('const NUMEROS'), landingDesenhado.indexOf('const SETORES'),
    );
    expect(bloco).toContain('HULLS.length');
    expect(bloco).toContain('ALL_ENEMIES.length');
    expect(bloco).toContain('BOSSES.length');
    expect(bloco).toContain('RARITIES.length');
    expect(bloco).toContain('ELEMENTS.length - 1');
    // Nenhum literal numérico de dois dígitos ou mais dentro do censo.
    expect(bloco).not.toMatch(/\b\d{2,}\b/);
  });

  it('e os setores são derivados dos chefes, não escritos', () => {
    // Cada galáxia termina num chefe, a cada `BOSS_INTERVAL` setores. É a
    // mesma conta que `bossForSector` faz no jogo.
    expect(landing).toContain('BOSSES.length * BOSS_INTERVAL');
    expect(BOSSES.length * BOSS_INTERVAL).toBe(300);
  });

  it('e o censo bate com o que o Códex conta', () => {
    // O Códex mostra a mesma linha dentro do jogo. Se as duas contagens
    // divergirem, uma das telas está mentindo — e o teste não sabe qual.
    const codex = fonte('ui', 'panels', 'CodexPanel.ts');
    expect(codex).toContain('${BOSSES.length} chefes · ${ALL_ENEMIES.length} inimigos · ${HULLS.length} cascos');
    expect(HULLS.length).toBeGreaterThan(0);
    expect(ALL_ENEMIES.length).toBeGreaterThan(0);
    expect(RARITIES.length).toBe(7);
    // Menos o `padrao`, que não entra no anel de vantagem.
    expect(ELEMENTS.length - 1).toBe(5);
  });
});

describe('a capa é uma página só', () => {
  it('as quatro páginas viraram três seções na mesma tela', () => {
    expect(landing).toContain("['landing-jogo', 'O JOGO']");
    expect(landing).toContain("['landing-como', 'COMO FUNCIONA']");
    expect(landing).toContain("['landing-limpo', 'JOGO LIMPO']");
    expect(landingDesenhado).not.toContain('function paginaNaves');
    expect(landingDesenhado).not.toContain('function paginaGalaxias');
    expect(landingDesenhado).not.toContain('function paginaComunidade');
  });

  it('e o Login não guarda mais página nenhuma', () => {
    expect(semComentarios(login)).not.toContain('PaginaLanding');
    expect(login).toContain('montarLanding({');
    expect(semComentarios(login)).not.toMatch(/navegar\s*[:,]/);
  });

  it('e o menu rola sem tocar no endereço', () => {
    /**
     * Uma âncora `href="#secao"` reescreve o FRAGMENTO da URL — que é onde a
     * volta do Google chega e de onde `recolherSessaoDaUrl` a lê. O jogador
     * que acabasse de autorizar cairia de volta na tela de login.
     */
    expect(landing).toContain('scrollIntoView');
    expect(landingDesenhado).not.toMatch(/href:\s*['"`]#/);
    // O cabeçalho é grudado: sem a margem, a seção para debaixo dele.
    expect(css).toContain('scroll-margin-top');
  });

  it('e os hotspots posicionados por porcentagem sumiram', () => {
    // Cada botão era uma coordenada mantida à mão sobre um PNG. Trocar a arte
    // desalinhava a interface inteira, e nada disso aparecia num teste.
    expect(landingDesenhado).not.toContain('landing-art-hotspot');
    expect(landingDesenhado).not.toContain('pontoClicavel');
    expect(semComentarios(css)).not.toContain('landing-art-hotspot');
  });
});

describe('o que a capa promete, ela pode cumprir', () => {
  it('a captura é do jogo, e o arquivo existe', () => {
    expect(landing).toContain('CAPTURA DO JOGO · SEM EDIÇÃO');
    for (const arte of ['tela', 'fabricacao', 'elementos', 'ficha-do-item']) {
      expect(landing).toContain(`/assets/landing/${arte}.webp`);
      expect(existsSync(join(process.cwd(), 'public', 'assets', 'landing', `${arte}.webp`)), arte)
        .toBe(true);
    }
  });

  it('e a captura da dobra não é cortada pela borda', () => {
    /**
     * Ela sangrava pela direita, e o corte comia a ficha do item — o argumento
     * de loot inteiro. Cabe toda na coluna agora, e o detalhe legível vem da
     * MESMA captura, recortado.
     */
    expect(css).not.toContain('margin-right: -60px');
    expect(css).toContain('.landing-detalhe');
    expect(landing).toContain('/assets/landing/ficha-do-item.webp');
  });

  it('e o bloco do passe conta a regra que o servidor aplica', () => {
    /**
     * "O passe não dá poder de combate" é verificável: `comprarVip` no Worker
     * debita cristais e estende a validade, e nada mais. O dia em que isso
     * mudar, a capa vira propaganda enganosa — e este teste é o lembrete.
     */
    expect(landing).toContain('O PASSE VIP NÃO DÁ PODER DE COMBATE');
    expect(landing).toContain('VIP_MANUAL_LEVEL');
    expect(landing).toContain('VIP_COST_CRYSTALS');

    const worker = readFileSync(join(process.cwd(), 'server', 'src', 'index.ts'), 'utf8');
    const t = worker.slice(worker.indexOf('async function comprarVip'));
    const corpo = t.slice(0, t.indexOf('\n}\n'));
    expect(corpo).toContain("moeda: 'cristal'");
    expect(corpo).toContain('INSERT INTO assinaturas');
    // Nenhum atributo de combate é tocado ali.
    for (const atributo of ['dano', 'escudo', 'casco', 'critico']) {
      expect(corpo.toLowerCase(), atributo).not.toContain(atributo);
    }
  });
});

describe('a capa cabe num celular', () => {
  it('empilha e não some com as ações de conta', () => {
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('.landing-menu { display: none; }');
    // O que NÃO pode sumir: entrar e jogar são o motivo da tela.
    expect(css).not.toMatch(/\.landing-conta\s*\{[^}]*display:\s*none/);
  });

  it('e a tela rola', () => {
    expect(css).toContain('overflow-y: auto');
  });
});

import { HULL_BY_ID } from '@data/hulls';
import { describeGalaxy } from '@data/galaxies';
import { getElement } from '@data/elements';
import { PILOTOS, type PilotoDef } from '@data/pilotos';
import { HISTORIA_POR_PILOTO, type HistoriaPiloto } from '@data/lore';
import { registrarPiloto } from '@app/inventario';
import type { Sim } from '@sim/index';
import { createState } from '@sim/state';
import { dps, effectiveHp, powerScore, resolveStats } from '@sim/stats';
import { assets } from '@render/Assets';
import { clear, h, portraitIcon, spriteIcon } from './dom';

/**
 * A primeira tela do jogo: quem você é.
 *
 * ## Por que ela mostra números
 *
 * A tentação é vender os quatro só com adjetivos — "agressivo", "resistente".
 * Mas o jogador está tomando a única decisão irreversível do save sem ter
 * jogado um segundo, e adjetivo não deixa comparar. As barras mostram dano e
 * resistência LADO A LADO, normalizadas entre os quatro, para a escolha ser
 * informada em vez de adivinhada.
 *
 * ## Por que ela diz que a escolha converge
 *
 * Porque é verdade e porque é o que tira o medo. Sem essa linha, um jogador
 * cauteloso escolhe o equilibrado "para não errar" — e a tela teria produzido
 * exatamente a decisão sem graça que ela existe para evitar.
 *
 * ## De onde vêm as barras
 *
 * De `powerScore` / `dps` / `effectiveHp` sobre um estado real, não de números
 * escritos à mão nesta tela. Se alguém mexer num casco, as barras acompanham
 * sozinhas — uma tabela aqui viraria mentira no primeiro ajuste de
 * balanceamento, e ninguém repara numa tela que só aparece uma vez.
 */
export class EscolhaDePiloto {
  private readonly root = h('.escolha-piloto');
  private selecionado = PILOTOS[0]!.id;
  private etapa: 'selecao' | 'dossie' = 'selecao';
  private readonly perfis = new Map<string, { dps: number; ehp: number; vel: number; nota: number }>();

  constructor(private readonly sim: Sim, private readonly host: HTMLElement) {
    for (const p of PILOTOS) {
      const st = createState(11, p.id);
      const s = resolveStats(st);
      this.perfis.set(p.id, { dps: dps(s), ehp: effectiveHp(s), vel: s.velocidade, nota: powerScore(s) });
    }
  }

  /**
   * Mostra a tela. Resolve quando o jogador confirmar.
   *
   * Espera o atlas `characters` ANTES de montar. Ele é `lazy` no manifesto —
   * fica fora do boot porque só a Central de Missões costumava precisar dele —
   * e esta tela roda antes de qualquer painel abrir. Sem a espera os quatro
   * retratos saíam como molduras vazias, que é o pior resultado possível numa
   * tela em que o retrato É o conteúdo: o jogador escolhe entre quatro
   * retângulos.
   *
   * Esperar em vez de re-renderizar ao carregar (como o painel de missões faz)
   * porque aqui não há nada útil para mostrar enquanto isso, e a piscada de
   * caixa vazia para retrato seria mais feia que o meio segundo de espera.
   */
  async mostrar(): Promise<void> {
    // Falhar o carregamento não pode travar o boot: sem retrato a tela ainda
    // diz nome, raça, nave e barras, que é o suficiente para escolher.
    await assets.loadAtlas('characters').catch(() => {});
    return new Promise((resolve) => {
      this.render(() => {
        this.root.remove();
        resolve();
      });
      this.host.append(this.root);
    });
  }

  private render(aoConfirmar: () => void): void {
    const escolhido = PILOTOS.find((p) => p.id === this.selecionado)!;
    if (this.etapa === 'dossie') {
      this.renderDossie(escolhido, HISTORIA_POR_PILOTO.get(escolhido.id)!, aoConfirmar);
      return;
    }

    clear(this.root).append(
      h('.escolha-fundo'),
      h('.escolha-corpo', {},
        h('header.escolha-topo', {},
          h('h1', { text: 'ÓRBITA ZERO' }),
          h('p.escolha-chamada', { text: 'Escolha quem vai comandar a frota.' }),
        ),

        h('.escolha-grade', {}, ...PILOTOS.map((p) => this.cartao(p, aoConfirmar))),

        h('.escolha-rodape', {},
          h('p.escolha-nota', {
            text: 'A escolha define a sua nave de partida — nada além dela. '
              + 'Os quatro cascos têm o mesmo poder em formas diferentes, e todo '
              + 'casco comprável fica aberto a todos. Não existe escolha errada aqui.',
          }),
          h('button.btn.primary.big.escolha-confirmar', {
            onclick: () => {
              this.etapa = 'dossie';
              this.render(aoConfirmar);
            },
          }, h('span', {
            text: `Conhecer a história de ${escolhido.nome}`,
          })),
        ),
      ),
    );
  }

  private async confirmar(aoConfirmar: () => void): Promise<void> {
    // O casco inicial é concedido pelo SERVIDOR, uma vez só. O `escolherPiloto`
    // local continua gravando a escolha; o que saiu dele é a autoridade sobre a
    // frota.
    if (this.sim.escolherPiloto(this.selecionado)) {
      void registrarPiloto(this.sim, this.selecionado).then(aoConfirmar);
    }
  }

  private cartao(p: PilotoDef, aoConfirmar: () => void): HTMLElement {
    const casco = HULL_BY_ID.get(p.casco)!;
    const perfil = this.perfis.get(p.id)!;
    const el = getElement(casco.element);
    const ativo = p.id === this.selecionado;

    // Normalizado entre os quatro, e não contra um máximo absoluto: o que
    // importa é a diferença ENTRE eles. Contra uma escala absoluta as quatro
    // barras ficariam quase iguais e a tela não diria nada.
    const todos = [...this.perfis.values()];
    const faixa = (v: number, campo: 'dps' | 'ehp' | 'vel'): number => {
      const min = Math.min(...todos.map((t) => t[campo]));
      const max = Math.max(...todos.map((t) => t[campo]));
      return max === min ? 0.5 : 0.18 + 0.82 * ((v - min) / (max - min));
    };

    const cartao = h(`.escolha-cartao${ativo ? '.ativo' : ''}`, {
      style: { '--piloto': p.cor } as Partial<CSSStyleDeclaration>,
      onclick: () => {
        // O segundo clique abre o DOSSIÊ, nunca registra o piloto. A história é
        // uma etapa real da escolha: só o botão ao fim dela inicia a partida.
        if (ativo) {
          this.etapa = 'dossie';
          this.render(aoConfirmar);
          return;
        }
        this.selecionado = p.id;
        this.render(aoConfirmar);
      },
    },
      h('.escolha-retrato', {}, portraitIcon(p.retrato, 104, 110)),
      h('.escolha-nome', {}, h('strong', { text: p.nome })),
      h('span.escolha-raca.tiny', { text: `${p.raca} · ${describeGalaxy(p.galaxia).name}` }),
      h('p.escolha-desc.tiny', { text: p.descricao }),

      h('.escolha-nave', {},
        spriteIcon(casco.sprite, 46, 'escolha-nave-art'),
        h('.escolha-nave-txt', {},
          h('strong', { text: casco.name }),
          h('span.tiny', {
            text: `${p.arquetipo} · ${el.name}`,
            style: { color: el.color } as Partial<CSSStyleDeclaration>,
          }),
        ),
      ),

      // Três barras, e a terceira não é enfeite: com só dano e resistência o
      // Sopro Astral aparecia DOMINADO — mesma vida efetiva da Lança Rubra e
      // menos dano —, porque a vantagem dele é velocidade, que `powerScore`
      // conta como esquiva e `effectiveHp` não mostra. A tela dizia que uma
      // das quatro escolhas era pior, e não era. Com o eixo à vista cada um é o
      // melhor em alguma coisa, que é a leitura verdadeira.
      h('.escolha-barras', {},
        this.barra('DANO', faixa(perfil.dps, 'dps'), '#ff8a5c'),
        this.barra('RESISTÊNCIA', faixa(perfil.ehp, 'ehp'), '#5cc8ff'),
        this.barra('VELOCIDADE', faixa(perfil.vel, 'vel'), '#b98cff'),
      ),

      h('.escolha-tracos', {},
        h('.escolha-traco.bom', {}, h('span.tiny', { text: p.forte })),
        h('.escolha-traco.ruim', {}, h('span.tiny', { text: p.fraco })),
      ),
    );
    return cartao;
  }

  private renderDossie(p: PilotoDef, historia: HistoriaPiloto, aoConfirmar: () => void): void {
    const casco = HULL_BY_ID.get(p.casco)!;
    const el = getElement(casco.element);
    clear(this.root).append(
      h('.escolha-fundo'),
      h('.escolha-corpo.escolha-dossie', { style: { '--piloto': p.cor } as Partial<CSSStyleDeclaration> },
        h('header.escolha-dossie-topo', {},
          h('button.btn.escolha-voltar', {
            onclick: () => { this.etapa = 'selecao'; this.render(aoConfirmar); },
          }, h('span', { text: '‹ ESCOLHER OUTRO' })),
          h('div', {}, h('span.tiny', { text: 'ARQUIVO DE RECRUTAMENTO · ACESSO INICIAL' }), h('h1', { text: historia.epiteto })),
        ),
        h('.escolha-dossie-grid', {},
          h('aside.escolha-dossie-identidade', {},
            h('.escolha-dossie-retrato', {}, portraitIcon(p.retrato, 194, 206)),
            h('span.tiny', { text: `${p.raca.toUpperCase()} · ${describeGalaxy(p.galaxia).name.toUpperCase()}` }),
            h('h2', { text: p.nome }),
            h('p', { text: historia.juramento }),
            h('.escolha-nave', {},
              spriteIcon(casco.sprite, 58, 'escolha-nave-art'),
              h('.escolha-nave-txt', {}, h('strong', { text: casco.name }), h('span.tiny', { text: `${p.arquetipo} · ${el.name}`, style: { color: el.color } as Partial<CSSStyleDeclaration> })),
            ),
          ),
          h('main.escolha-dossie-historia', {},
            h('section.escolha-dossie-prologo', {}, h('span.tiny', { text: 'PRÓLOGO' }), h('p', { text: historia.prologo })),
            h('.escolha-dossie-segredos', {},
              h('section', {}, h('span.tiny', { text: 'A FERIDA' }), h('p', { text: historia.ferida })),
              h('section', {}, h('span.tiny', { text: 'ARQUIVO LACRADO' }), h('p', { text: 'O segredo deste piloto será revelado durante a campanha. A wiki permite consultá-lo com spoilers.' })),
            ),
            h('section.escolha-dossie-conexoes', {}, h('span.tiny', { text: 'CONEXÕES COM O UNIVERSO' }),
              h('ul', {}, ...historia.conexoes.map((texto) => h('li', { text: texto }))),
            ),
          ),
          h('aside.escolha-dossie-rota', {},
            h('span.tiny', { text: 'SEUS PRÓXIMOS PASSOS' }),
            h('ol', {}, ...historia.proximosPassos.map((texto, indice) => h('li', {}, h('b', { text: String(indice + 1).padStart(2, '0') }), h('span', { text: texto })))),
            h('.escolha-dossie-arco', {}, h('span.tiny', { text: 'ARCO PESSOAL' }), ...historia.capitulos.map((capitulo) => h('div', {}, h('b', { text: capitulo.titulo }), h('p', { text: capitulo.texto })))),
          ),
        ),
        h('footer.escolha-dossie-acoes', {},
          h('p', { text: 'Ao partir, você entra no prólogo e inicia o tutorial com esta identidade e nave.' }),
          h('button.btn.primary.big.escolha-confirmar', { onclick: () => { void this.confirmar(aoConfirmar); } }, h('span', { text: `ASSUMIR O COMANDO COMO ${p.nome}` })),
        ),
      ),
    );
  }

  private barra(rotulo: string, fracao: number, cor: string): HTMLElement {
    return h('.escolha-barra', {},
      h('span.escolha-barra-rot.tiny', { text: rotulo }),
      h('.escolha-barra-trilho', {},
        h('.escolha-barra-preenche', {
          style: { width: `${(fracao * 100).toFixed(0)}%`, background: cor } as Partial<CSSStyleDeclaration>,
        }),
      ),
    );
  }
}

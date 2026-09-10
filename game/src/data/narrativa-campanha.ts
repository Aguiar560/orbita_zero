import { BOSSES } from './bosses';
import { describeGalaxy } from './galaxies';
import { LORE_DAS_GALAXIAS, nomeDaFaccao } from './lore';
import { PILOTO_POR_ID, PILOTOS } from './pilotos';
import { retratoInimigoDaGalaxia } from './personagens';

export interface FalaDaCampanha {
  autor: string;
  cargo: string;
  texto: string;
  arte: string;
  tipoDeArte: 'retrato' | 'sprite';
  tom: 'hostil' | 'piloto' | 'aliado' | 'comando';
}

export interface TransmissaoDaCampanha {
  id: string;
  titulo: string;
  subtitulo: string;
  objetivo: string;
  falas: readonly FalaDaCampanha[];
}

type VozDoPiloto = {
  aoDesafio: (guardiao: string, dominio: string) => string;
  aoPacto: (guardiao: string) => string;
};

const VOZES: Readonly<Record<string, VozDoPiloto>> = {
  piloto_vektor: {
    aoDesafio: (guardiao, dominio) => `Ameaça de ${guardiao} registrada. ${dominio} contém dados que preciso recuperar. Continuaremos.`,
    aoPacto: (guardiao) => `${guardiao}, sua ordem terminou. Sua memória não precisa terminar com ela. Junte-se a nós por escolha própria.`,
  },
  piloto_darin: {
    aoDesafio: (guardiao, dominio) => `${guardiao} fala como toda torre que já tentou fechar uma rota. ${dominio} está à frente — e eu não aprendi a dar meia-volta.`,
    aoPacto: (guardiao) => `Você tentou me parar. Eu sobrevivi. Agora venha mostrar o atalho que estava protegendo, ${guardiao}.`,
  },
  piloto_sora: {
    aoDesafio: (guardiao, dominio) => `Toda fortaleza tem uma junta, ${guardiao}. Vou encontrar a sua, preservar o que ainda vive e libertar ${dominio}.`,
    aoPacto: (guardiao) => `Eu destruí o protocolo, não a pessoa. Se quer reparar o que protegeu à força, ${guardiao}, comece agora.`,
  },
  piloto_nharu: {
    aoDesafio: (guardiao, dominio) => `Eu ouço medo por trás da sua ameaça, ${guardiao}. ${dominio} também ouve. Chegaremos até você e separaremos medo de vontade.`,
    aoPacto: (guardiao) => `Sua voz finalmente é sua, ${guardiao}. Traga-a para o coro — sem correntes e sem silêncio.`,
  },
};

const vozDe = (pilotoId: string): VozDoPiloto => VOZES[pilotoId] ?? VOZES.piloto_vektor!;

/**
 * Interceptação no começo do setor 6 de cada galáxia.
 *
 * O evento acontece ao CONCLUIR o setor 5: `sector:advanced` já aponta para o
 * seguinte. Fora desse marco não há retorno, para a narrativa não virar ruído.
 */
export function transmissaoAoEntrarNoSetor(setor: number, pilotoId: string): TransmissaoDaCampanha | null {
  const fase = ((setor - 1) % 10) + 1;
  if (setor < 1 || fase !== 6) return null;
  const galaxia = Math.floor((setor - 1) / 10);
  const guardiao = BOSSES[galaxia];
  const regiao = LORE_DAS_GALAXIAS[galaxia];
  const piloto = PILOTO_POR_ID.get(pilotoId) ?? PILOTOS[0]!;
  if (!guardiao || !regiao) return null;

  return {
    id: `g${galaxia + 1}:interceptacao`,
    titulo: 'TRANSMISSÃO HOSTIL INTERCEPTADA',
    subtitulo: `${describeGalaxy(galaxia).name.toUpperCase()} · SETOR ${setor}`,
    objetivo: `Atravesse os setores ${setor}–${(galaxia + 1) * 10} e neutralize ${guardiao.name}.`,
    falas: [
      {
        autor: guardiao.name.toUpperCase(), cargo: `GUARDIÃO DE ${describeGalaxy(galaxia).name.toUpperCase()}`,
        texto: `Piloto de Órbita Zero: você atravessou metade do meu domínio. ${regiao.conflito} Não avance. A próxima advertência será disparada, não transmitida.`,
        arte: retratoInimigoDaGalaxia(galaxia), tipoDeArte: 'retrato', tom: 'hostil',
      },
      {
        autor: piloto.nome, cargo: `${piloto.arquetipo} · ÓRBITA ZERO`,
        texto: vozDe(piloto.id).aoDesafio(guardiao.name, regiao.dominio),
        arte: piloto.retrato, tipoDeArte: 'retrato', tom: 'piloto',
      },
    ],
  };
}

/** A primeira derrota do chefe: verdade, resposta do piloto e novo objetivo. */
export function transmissaoAposVitoria(bossId: string, setor: number, pilotoId: string): TransmissaoDaCampanha | null {
  const galaxia = BOSSES.findIndex((boss) => boss.id === bossId);
  const guardiao = BOSSES[galaxia];
  const regiao = LORE_DAS_GALAXIAS[galaxia];
  const piloto = PILOTO_POR_ID.get(pilotoId) ?? PILOTOS[0]!;
  if (galaxia < 0 || !guardiao || !regiao) return null;
  const proxima = galaxia + 1 < BOSSES.length ? describeGalaxy(galaxia + 1) : null;

  return {
    id: `g${galaxia + 1}:alianca`,
    titulo: 'DOMÍNIO CONQUISTADO · NOVO PACTO',
    subtitulo: `${describeGalaxy(galaxia).name.toUpperCase()} · GUARDIÃO LIBERTADO`,
    objetivo: proxima
      ? `Abra a rota para ${proxima.name} e alcance o setor ${setor + 1}.`
      : 'Retorne ao comando e decida o destino da Rota Zero.',
    falas: [
      {
        autor: guardiao.name.toUpperCase(), cargo: 'SINAL LIVRE · ANTIGO GUARDIÃO',
        texto: `${regiao.verdade} A coroa de comando caiu. ${regiao.depoisDaVitoria}`,
        arte: retratoInimigoDaGalaxia(galaxia), tipoDeArte: 'retrato', tom: 'aliado',
      },
      {
        autor: piloto.nome, cargo: 'COMANDANTE DA INCURSÃO',
        texto: vozDe(piloto.id).aoPacto(guardiao.name),
        arte: piloto.retrato, tipoDeArte: 'retrato', tom: 'piloto',
      },
      {
        autor: 'KAEL VOSS', cargo: 'COORDENADOR · ÓRBITA ZERO',
        texto: proxima
          ? `${guardiao.name} foi reconhecido como aliado de ${nomeDaFaccao(regiao.faccaoId)}. A rota para ${proxima.name} está aberta. Reorganize a carga, leia os contratos do novo contato e avance quando estiver pronto.`
          : 'Os Trinta Domínios responderam. Todos os antigos guardiões estão livres — e a Rota Zero sabe quem você é. Volte ao comando; a escolha final começou.',
        arte: 'character/player/man', tipoDeArte: 'retrato', tom: 'comando',
      },
    ],
  };
}

import type { Objetivo } from './missoes';

export interface EventoDef {
  id: string;
  nome: string;
  subtitulo: string;
  descricao: string;
  cor: string;
  gas: string;
  quantidade: number;
  setorMinimo: number;
  objetivo: Objetivo;
  modificador: string;
}

/**
 * Dez eventos, dez gases, nenhuma tabela genérica.
 *
 * Cada evento dura três dias; uma volta completa leva trinta. A janela é longa
 * o bastante para um idle e curta o bastante para o jogador não esperar meses
 * pelo gás da receita que quer fabricar.
 */
export const DURACAO_EVENTO_MS = 72 * 60 * 60 * 1_000;
export const MARCO_DOS_EVENTOS = Date.UTC(2026, 0, 5);

export const EVENTOS: readonly EventoDef[] = [
  { id: 'corrida_propulsores', nome: 'Corrida de Propulsores', subtitulo: 'ÓRBITA RÁPIDA', cor: '#57d9ff', gas: 'gas_helio_3', quantidade: 45, setorMinimo: 10, modificador: '+12% velocidade inimiga · +18% núcleos', objetivo: { fato: 'abate', alvo: 140, texto: 'Abater 140 inimigos' }, descricao: 'Coletores de Hélio-3 abrem somente enquanto as pistas orbitais estão energizadas.' },
  { id: 'colapso_fusao', nome: 'Colapso de Fusão', subtitulo: 'CONTENÇÃO', cor: '#8ac7ff', gas: 'deuterio', quantidade: 40, setorMinimo: 20, modificador: 'Chefes +15% vida · caixas com carga térmica', objetivo: { fato: 'setor', alvo: 8, filtro: { setorMin: 20 }, texto: 'Concluir 8 setores 20+' }, descricao: 'Reatores instáveis liberam deutério antes que a contenção seja restaurada.' },
  { id: 'tempestade_ionica', nome: 'Tempestade Iônica', subtitulo: 'SINAL FRAGMENTADO', cor: '#b58cff', gas: 'xenonio', quantidade: 36, setorMinimo: 30, modificador: 'Sensores -20% · dano de raio +15%', objetivo: { fato: 'chefe', alvo: 4, filtro: { setorMin: 30 }, texto: 'Derrotar 4 chefes no setor 30+' }, descricao: 'A ionização concentra Xenônio nos poços gravitacionais dos comandantes.' },
  { id: 'cerco_inerte', nome: 'Cerco Inerte', subtitulo: 'LINHA DE BLOQUEIO', cor: '#a8c2d4', gas: 'argonio', quantidade: 42, setorMinimo: 40, modificador: 'Blindagem inimiga +18% · perfuração +1', objetivo: { fato: 'item', alvo: 18, filtro: { raridadeMin: 2 }, texto: 'Obter 18 itens Raros ou melhores' }, descricao: 'A frota de bloqueio usa Argônio puro para selar compartimentos de combate.' },
  { id: 'festival_sinal', nome: 'Festival do Sinal', subtitulo: 'FREQUÊNCIA ABERTA', cor: '#ff65d8', gas: 'neonio', quantidade: 38, setorMinimo: 50, modificador: '+25% cápsulas de baú', objetivo: { fato: 'bau', alvo: 10, texto: 'Abrir 10 baús' }, descricao: 'Balizas de néon marcam rotas temporárias entre mercadores e caçadores.' },
  { id: 'quarentena_vermelha', nome: 'Quarentena Vermelha', subtitulo: 'RISCO RADIOLÓGICO', cor: '#ff5570', gas: 'radonio', quantidade: 34, setorMinimo: 60, modificador: 'Dano químico +20% · cura -15%', objetivo: { fato: 'abate', alvo: 120, filtro: { elemento: 'quimico', setorMin: 60 }, texto: 'Abater 120 inimigos químicos no setor 60+' }, descricao: 'A quarentena é a única janela segura para encapsular Radônio.' },
  { id: 'nascimento_estrela', nome: 'Nascimento de Estrela', subtitulo: 'IGNIÇÃO', cor: '#ffd06a', gas: 'plasma_estelar', quantidade: 30, setorMinimo: 75, modificador: 'Dano de fogo +18% · escudos -10%', objetivo: { fato: 'abate', alvo: 150, filtro: { elemento: 'fogo', setorMin: 75 }, texto: 'Abater 150 inimigos de fogo no setor 75+' }, descricao: 'Uma protoestrela expulsa plasma utilizável por apenas três dias.' },
  { id: 'inverno_vazio', nome: 'Inverno do Vazio', subtitulo: 'ZERO PROFUNDO', cor: '#78efff', gas: 'criogas', quantidade: 30, setorMinimo: 90, modificador: 'Cadência -12% · resistência ao gelo +20%', objetivo: { fato: 'abate', alvo: 150, filtro: { elemento: 'gelo', setorMin: 90 }, texto: 'Abater 150 inimigos de gelo no setor 90+' }, descricao: 'Frentes criogênicas condensam um combustível que evapora fora do ciclo.' },
  { id: 'erupcao_orbital', nome: 'Erupção Orbital', subtitulo: 'CALDEIRA ABERTA', cor: '#ff7d43', gas: 'gas_vulcanico', quantidade: 26, setorMinimo: 120, modificador: 'Explosões +22% área · casco inimigo +12%', objetivo: { fato: 'chefe', alvo: 5, filtro: { setorMin: 120 }, texto: 'Derrotar 5 chefes no setor 120+' }, descricao: 'Gigantes vulcânicos ventilam gases de forja durante o alinhamento orbital.' },
  { id: 'anomalia_exotica', nome: 'Anomalia Exótica', subtitulo: 'LEIS INSTÁVEIS', cor: '#d68cff', gas: 'gas_exotico', quantidade: 18, setorMinimo: 160, modificador: 'Afixos +1 tier efetivo · inimigos aleatórios', objetivo: { fato: 'fusao', alvo: 3, filtro: { subiu: true }, texto: 'Concluir 3 fusões que subam de raridade' }, descricao: 'Matéria gasosa impossível emerge quando uma síntese força as leis locais.' },
];

export interface JanelaDeEvento {
  def: EventoDef;
  ciclo: number;
  chave: string;
  inicio: number;
  fim: number;
}

export function eventoNoInstante(agora = Date.now()): JanelaDeEvento {
  const ciclo = Math.floor((agora - MARCO_DOS_EVENTOS) / DURACAO_EVENTO_MS);
  const indice = ((ciclo % EVENTOS.length) + EVENTOS.length) % EVENTOS.length;
  const inicio = MARCO_DOS_EVENTOS + ciclo * DURACAO_EVENTO_MS;
  const def = EVENTOS[indice]!;
  return { def, ciclo, chave: `${def.id}:${ciclo}`, inicio, fim: inicio + DURACAO_EVENTO_MS };
}

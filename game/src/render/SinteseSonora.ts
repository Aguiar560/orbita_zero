import { hashString, Rng, clamp } from '@core/math';
import type { ElementId } from '@sim/types';
import type { Hull } from '@data/hulls';
import type { EnemyDef } from '@data/enemies';
import type { BossDef } from '@data/bosses';
import { SPACESHIPS2_HULL_SPEC_BY_ID } from '@data/hulls-spaceships2';

export interface PerfilSonoro {
  id: string;
  elemento: ElementId;
  familia: string;
  frequencia: number;
  duracao: number;
  peso: number;
  cadencia: number;
}

const TIMBRES: Record<ElementId, { hz: number; ruido: number; modulacao: number }> = {
  padrao: { hz: 290, ruido: .5, modulacao: .35 },
  fogo: { hz: 210, ruido: .65, modulacao: .7 },
  gelo: { hz: 1060, ruido: .14, modulacao: 1.2 },
  raio: { hz: 740, ruido: .2, modulacao: 2.1 },
  cosmico: { hz: 330, ruido: .12, modulacao: 3.4 },
  quimico: { hz: 430, ruido: .48, modulacao: 1.7 },
};

/** A arma cadastrada manda; os cascos antigos usam seu projétil e cadência. */
export function perfilDaNave(nave: Hull): PerfilSonoro {
  const cadastro = SPACESHIPS2_HULL_SPEC_BY_ID.get(nave.id);
  const cadencia = Number(nave.stats.cadencia ?? 3);
  const familia = cadastro?.weapon ?? (
    /foguet/.test(nave.shot.sprite) ? 'bombarda'
      : /beam|lance|tesla/.test(nave.shot.sprite) ? 'lanca'
        : cadencia >= 4 ? 'rajada' : 'canhao');
  return perfilSonoro(`nave:${nave.id}`, nave.element, familia, cadencia);
}

export function perfilDoInimigo(nave: EnemyDef, elemento = nave.element, id = nave.id): PerfilSonoro {
  return perfilSonoro(`inimigo:${id}`, elemento,
    nave.attack === 'teleguiado' ? 'bombarda' : nave.shots >= 4 ? 'saturador' : 'rajada', nave.fireRate);
}

export function perfilDoChefe(chefe: BossDef, estagio = 0): PerfilSonoro {
  const fase = chefe.phases[estagio] ?? chefe.phases[0]!;
  return perfilSonoro(`chefe:${chefe.id}:${estagio}`, chefe.element,
    fase.attack === 'teleguiado' ? 'bombarda' : fase.shots >= 5 ? 'saturador' : 'canhao', fase.fireRate);
}

function perfilSonoro(id: string, elemento: ElementId, familia: string, cadencia: number): PerfilSonoro {
  const variante = (hashString(id) % 1000) / 1000;
  const peso = familia === 'bombarda' ? 1 : familia === 'canhao' ? .75 : familia === 'lanca' ? .48 : .22;
  return {
    id, elemento, familia, peso, cadencia,
    frequencia: TIMBRES[elemento].hz * (.88 + variante * .26) * (1.12 - peso * .48),
    duracao: clamp(.105 + peso * .19, .045, Math.max(.045, .78 / Math.max(1, cadencia))),
  };
}

/** PCM original: transiente, corpo FM e cauda filtrada; sem arquivos externos. */
export function sintetizarDisparo(p: PerfilSonoro, taxa = 24000): Float32Array {
  const dados = new Float32Array(Math.ceil(taxa * p.duracao));
  const rng = new Rng(hashString(p.id));
  const timbre = TIMBRES[p.elemento];
  let fase = 0, grave = 0, anterior = 0;
  for (let i = 0; i < dados.length; i++) {
    const t = i / taxa, u = t / p.duracao;
    const hz = p.frequencia * (.36 + 1.85 * Math.exp(-t * 32));
    fase += 2 * Math.PI * hz / taxa;
    const ruido = rng.next() * 2 - 1;
    grave += .12 * (ruido - grave);
    const envoltoria = Math.min(1, t / .003) * Math.exp(-u * 5) * Math.min(1, (1 - u) * 24);
    const fm = Math.sin(fase + Math.sin(fase * 1.97) * timbre.modulacao * Math.exp(-u * 4));
    const corpo = fm * .5 + Math.sin(fase * .5) * p.peso * .28;
    const ar = (p.elemento === 'fogo' ? grave * 2.5 : ruido - grave) * timbre.ruido * Math.exp(-u * 9);
    // Suaviza o transiente para não virar estalo digital em disparos repetidos.
    anterior += .65 * (Math.tanh((corpo + ar) * 1.3) * envoltoria - anterior);
    dados[i] = anterior * .72;
  }
  dados[dados.length - 1] = 0;
  return dados;
}

/** Explosão em três estágios: ruptura, subgrave e destroços reverberantes. */
export function sintetizarExplosao(elemento: ElementId, taxa = 24000): Float32Array {
  const duracao = 2.4;
  const dados = new Float32Array(Math.ceil(taxa * duracao));
  const rng = new Rng(hashString(`chefe:${elemento}`));
  let grave = 0, medio = 0, fase = 0;
  for (let i = 0; i < dados.length; i++) {
    const t = i / taxa;
    const ruido = rng.next() * 2 - 1;
    grave += .027 * (ruido - grave);
    medio += .2 * (ruido - medio);
    fase += 2 * Math.PI * (38 + 95 * Math.exp(-t * 12)) / taxa;
    const ataque = Math.min(1, t / .006);
    const fim = Math.min(1, (duracao - t) / .22);
    const impacto = Math.sin(fase) * Math.exp(-t * 4.8) * .58;
    const ruptura = medio * Math.exp(-t * 7) * 1.7;
    const cauda = grave * Math.exp(-t * 1.9) * 2.2;
    const assinatura = Math.sin(2 * Math.PI * TIMBRES[elemento].hz * .4 * t + medio * 4) * Math.exp(-t * 3.5) * .08;
    const eco = i > taxa * .19 ? dados[i - Math.floor(taxa * .19)]! * .23 : 0;
    dados[i] = Math.tanh((impacto + ruptura + cauda + assinatura) * ataque + eco) * fim * .84;
  }
  dados[dados.length - 1] = 0;
  return dados;
}

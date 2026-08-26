import fs from 'node:fs';
import { HULLS } from '@data/hulls';
import { ALL_ENEMIES } from '@data/enemies';

/**
 * Remapeia a escala visual das entidades para faixas coerentes entre si.
 *
 * ## O problema
 *
 * Medido, o tamanho renderizado das entidades não formava uma hierarquia: o
 * jogador tinha mediana 74px e chegava a 88, enquanto um inimigo comum chegava a
 * 87 e um elite começava em 50. Um comum grande era MAIOR que um elite pequeno,
 * e a nave do jogador competia em massa com um elite — a tela não dizia mais
 * quem era quem pelo tamanho, que é a leitura mais barata que um jogo tem.
 *
 * ## Por que remapear e não limitar
 *
 * Cortar tudo que passa do teto comprime a categoria inteira num valor só: dez
 * inimigos de tamanhos diferentes virariam dez inimigos do mesmo tamanho, e a
 * variedade que a arte tem se perderia. O remapeamento linear leva a faixa atual
 * para a faixa alvo preservando a ORDEM e o espalhamento — quem era o maior
 * continua o maior, só que dentro do lugar certo.
 *
 * ## Por que a hitbox anda junto
 *
 * `PLAYER_SCALE_CALIBRATIONS` e `PLAYER_HITBOX_CALIBRATIONS` são independentes,
 * mas foram calibradas OLHANDO uma para a outra: a caixa foi desenhada em cima
 * do sprite no tamanho em que ele aparecia. Mexer só na escala descolaria a
 * colisão da arte — a nave pareceria menor do que acerta, que é a pior espécie
 * de injustiça num jogo de desvio.
 *
 * Então o mesmo fator vai nos dois. A relação entre o que se vê e o que colide
 * fica exatamente como a calibração à mão a deixou.
 */

const ARQUIVO = 'src/data/hitbox-calibrations.json';
const MANIFESTO = 'public/assets/manifest.json';

/** Faixa alvo de cada categoria, em pixels de jogo (lado maior). */
const FAIXAS: Record<string, [number, number]> = {
  jogador: [48, 64],
  comum: [40, 70],
  elite: [70, 100],
  // Chefe fica como está: já passa de 120 em todos, e o teto é aberto de
  // propósito — um chefe pode e deve ocupar a tela.
};

function ladoDoSprite(frames: Map<string, number[]>, sprite: string): number {
  const f = frames.get(sprite);
  return f ? Math.max(f[2]!, f[3]!) : 0;
}

/** Remapeia linearmente [deMin, deMax] em [paraMin, paraMax]. */
const remapear = (v: number, deMin: number, deMax: number, paraMin: number, paraMax: number): number =>
  deMax <= deMin ? (paraMin + paraMax) / 2
    : paraMin + ((v - deMin) / (deMax - deMin)) * (paraMax - paraMin);

function main() {
  const manifesto = JSON.parse(fs.readFileSync(MANIFESTO, 'utf8'));
  const frames = new Map<string, number[]>();
  for (const a of Object.values<any>(manifesto.atlases)) {
    const d = JSON.parse(fs.readFileSync('public/assets/' + a.data, 'utf8'));
    for (const [k, v] of Object.entries<any>(d.frames ?? d)) frames.set(k, v as number[]);
  }

  const calib = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));

  const grupos = {
    jogador: {
      escalas: calib.players,
      hitboxes: calib.players,
      itens: HULLS.filter((h) => !h.prototype).map((h) => ({ id: h.id, sprite: h.sprite })),
    },
    comum: {
      escalas: calib.enemies,
      hitboxes: calib.enemies,
      itens: ALL_ENEMIES.filter((e) => !e.elite).map((e) => ({ id: e.id, sprite: e.sprite })),
    },
    elite: {
      escalas: calib.enemies,
      hitboxes: calib.enemies,
      itens: ALL_ENEMIES.filter((e) => e.elite).map((e) => ({ id: e.id, sprite: e.sprite })),
    },
  };

  console.log('categoria        antes (min/med/max)      depois');
  for (const [nome, g] of Object.entries(grupos)) {
    const [alvoMin, alvoMax] = FAIXAS[nome]!;

    const medidos = g.itens
      .map((i) => ({ ...i, lado: ladoDoSprite(frames, i.sprite), calib: g.escalas[i.id] }))
      .filter((i) => i.lado > 0 && i.calib && typeof i.calib.scale === 'number')
      .map((i) => ({ ...i, px: i.lado * i.calib.scale }));

    if (!medidos.length) { console.log(`${nome}: sem dados`); continue; }

    const px: number[] = medidos.map((i) => i.px).sort((a, b) => a - b);
    const deMin = px[0]!;
    const deMax = px[px.length - 1]!;
    const antes = `${deMin.toFixed(0)}/${px[Math.floor(px.length / 2)]!.toFixed(0)}/${deMax.toFixed(0)}`;

    const novos: number[] = [];
    for (const i of medidos) {
      const alvoPx = remapear(i.px, deMin, deMax, alvoMin, alvoMax);
      const fator = alvoPx / i.px;
      const c = g.escalas[i.id];
      c.scale = Number((c.scale * fator).toFixed(4));
      // A caixa acompanha o mesmo fator: ela foi desenhada sobre o sprite no
      // tamanho antigo, e é essa relação que precisa sobreviver.
      c.width = Number((c.width * fator).toFixed(2));
      c.height = Number((c.height * fator).toFixed(2));
      c.offsetX = Number((c.offsetX * fator).toFixed(2));
      c.offsetY = Number((c.offsetY * fator).toFixed(2));
      novos.push(alvoPx);
    }
    novos.sort((a, b) => a - b);
    const depois = `${novos[0]!.toFixed(0)}/${novos[Math.floor(novos.length / 2)]!.toFixed(0)}/${novos[novos.length - 1]!.toFixed(0)}`;
    console.log(`${nome.padEnd(16)} ${antes.padEnd(24)} ${depois}  (alvo ${alvoMin}–${alvoMax})`);
  }

  fs.writeFileSync(ARQUIVO, JSON.stringify(calib, null, 2) + '\n');
  console.log(`\nescrito em ${ARQUIVO}`);
}

main();

/**
 * Extração da folha `tiros e explosoes.png` (§21).
 *
 * Ganhou módulo próprio porque as duas suposições de `imaging.mjs` falham aqui,
 * e as duas falharam de formas que só apareceram na folha de contato:
 *
 * 1. **`alphaOverDark` pressupõe fundo NEUTRO.** O fundo de cada célula desta
 *    folha é escuro mas TINGIDO na cor do elemento, e o un-premultiply divide a
 *    cor por um alfa baixo — o fundo inteiro virava um bloco opaco colorido.
 *    Arte de brilho aditivo sobre escuro não precisa de un-premultiply nenhum.
 * 2. **`rowComponents` separa por limiar ABSOLUTO.** O halo de brilho faz ponte
 *    entre sprites vizinhos e o vale entre eles nunca chega a zero, então a
 *    célula inteira saía como um componente só.
 *
 * E não existe constante global que sirva: medido, o fundo vai de p10 = 12 no
 * cósmico a p10 = 86 no gelo. Tudo aqui é relativo à própria célula.
 */

/**
 * Recorta uma célula e deriva o alfa do quanto cada pixel SOBE acima do fundo
 * local.
 *
 * O fundo é o percentil 20 da própria célula — não a mediana: em células cheias
 * (as explosões grandes ocupam quase tudo) a mediana já é sprite, e o recorte
 * comeria o miolo. O percentil 20 ainda cai no fundo mesmo nessas.
 */
export function extrairCelula(data, info, x0, y0, w, h, { margem = 46, piso = 0.20 } = {}) {
  const { width: W, channels: C } = info;
  const lums = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * W + (x0 + x)) * C;
      lums[y * w + x] = data[i] * 0.3 + data[i + 1] * 0.6 + data[i + 2] * 0.1;
    }
  }

  const ord = Float32Array.from(lums).sort();
  const base = ord[Math.floor(ord.length * piso)];

  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * W + (x0 + x)) * C;
      const o = (y * w + x) * 4;
      const t = Math.min(1, Math.max(0, (lums[y * w + x] - base) / margem));
      out[o] = data[i];
      out[o + 1] = data[i + 1];
      out[o + 2] = data[i + 2];
      // Suavização cúbica: um corte duro deixa serrilha visível no halo.
      out[o + 3] = Math.round(t * t * (3 - 2 * t) * 255);
    }
  }
  return { data: out, width: w, height: h };
}

/** Perfil de alfa máximo por coluna. */
function perfilDeAlfa(cel) {
  const p = new Array(cel.width).fill(0);
  for (let x = 0; x < cel.width; x++) {
    for (let y = 0; y < cel.height; y++) {
      const a = cel.data[(y * cel.width + x) * 4 + 3];
      if (a > p[x]) p[x] = a;
    }
  }
  return p;
}

/**
 * Separa os corpos de uma célula por VALES RELATIVOS.
 *
 * Um vale só conta como fronteira se for fundo o bastante *em relação aos picos
 * que o cercam*. É o que torna a regra invariante ao brilho da célula — e o
 * brilho varia demais entre elementos para qualquer limiar fixo funcionar.
 *
 * Os padrões saíram de varredura: 0,45/9 partia a explosão de raio em quatro,
 * 0,30/20 dá de 1 a 6 corpos por célula — a faixa que a folha realmente tem.
 *
 * Devolve faixas `[x0, x1)`.
 */
export function separarPorVales(cel, { fracao = 0.30, minLargura = 20, borda = 20 } = {}) {
  const perfil = perfilDeAlfa(cel);
  const n = perfil.length;

  let ini = 0;
  while (ini < n && perfil[ini] < borda) ini++;
  let fim = n - 1;
  while (fim > ini && perfil[fim] < borda) fim--;
  if (fim - ini < minLargura) return [];

  // Máximos acumulados dos dois lados, para não varrer o perfil inteiro a cada
  // candidato — a versão ingênua era O(n²) por célula.
  const picoEsq = new Array(n).fill(0);
  const picoDir = new Array(n).fill(0);
  for (let i = ini; i <= fim; i++) picoEsq[i] = Math.max(i > ini ? picoEsq[i - 1] : 0, perfil[i]);
  for (let i = fim; i >= ini; i--) picoDir[i] = Math.max(i < fim ? picoDir[i + 1] : 0, perfil[i]);

  const cortes = [];
  for (let i = ini + minLargura; i <= fim - minLargura; i++) {
    const v = perfil[i];
    if (v > perfil[i - 1] || v > perfil[i + 1]) continue;
    if (v < fracao * Math.min(picoEsq[i - 1], picoDir[i + 1])) cortes.push(i);
  }

  // Vales adjacentes descrevem a mesma fronteira: fica o mais fundo do grupo.
  const limpos = [];
  for (const c of cortes) {
    const ult = limpos[limpos.length - 1];
    if (ult !== undefined && c - ult < minLargura) {
      if (perfil[c] < perfil[ult]) limpos[limpos.length - 1] = c;
    } else {
      limpos.push(c);
    }
  }

  const faixas = [];
  let a = ini;
  for (const c of limpos) { faixas.push([a, c]); a = c; }
  faixas.push([a, fim + 1]);

  // Segunda passada contra a SUB-divisão, que é o que sobrou depois de calibrar
  // a fração. Quando dois sprites da mesma célula têm os halos encavalados, o
  // vale entre eles nunca fica fundo o bastante e os dois saem como um corpo só
  // — foi o que aconteceu com os dois redemoinhos cósmicos.
  //
  // O sinal de que isso ocorreu é a PROPORÇÃO: estes sprites são desenhados
  // aproximadamente quadrados, então um corpo bem mais largo que alto é quase
  // certamente mais de um. Nesse caso corta-se no vale mais fundo do interior,
  // mesmo que ele não passe no teste relativo — a proporção já é a evidência.
  // RECURSIVA, não de passada única: a fileira de glifos é recortada na largura
  // inteira e contém doze ícones, então um corte só a deixaria em dois. Com uma
  // passada só, o comando devolvia 2 sprites onde havia 12.
  const largo = (x, z) => z - x > cel.height * 1.55;
  const partir = ([x, z], profundidade = 0) => {
    if (!largo(x, z) || profundidade > 5) return [[x, z]];
    let melhor = -1;
    for (let i = x + minLargura; i <= z - minLargura; i++) {
      if (melhor < 0 || perfil[i] < perfil[melhor]) melhor = i;
    }
    if (melhor < 0) return [[x, z]];
    return [
      ...partir([x, melhor], profundidade + 1),
      ...partir([melhor, z], profundidade + 1),
    ];
  };

  return faixas.flatMap((f) => partir(f)).filter(([x, z]) => z - x >= minLargura);
}

/**
 * ► ESTADO: a extração de ALFA está resolvida; a SEGMENTAÇÃO não, e por isso
 *   `buildTiros` está escrito mas DESLIGADO em `build-assets.mjs`.
 *
 * O que funciona, verificado em folha de contato: o alfa sai correto em todas
 * as 48 células, sem bloco opaco e sem comer o miolo dos sprites escuros. Esse
 * era o problema difícil — o fundo tingido — e ele está resolvido.
 *
 * O que não funciona: a separação é boa para corpos ARREDONDADOS e bem
 * espaçados (`estouro` sai 2 de 2 em todos os seis elementos, conferido) e ruim
 * para corpos ALTOS E FINOS. Em `tiro` vários sprites saem em blocos de dois ou
 * três, e outros saem como lascas vazias: os tiros são verticais, então a regra
 * de proporção (`largura > altura × 1,55`) quase nunca dispara e o halo faz
 * ponte entre eles.
 *
 * Publicar assim daria ids confiantes — `tiro/fogo_2` — sobre recortes errados,
 * que é pior que id ausente: some em silêncio dentro do jogo.
 *
 * Caminho para fechar, em ordem de promessa:
 * 1. Segmentar por COMPONENTES 2-D em alfa alto, como a folha de planetas, em
 *    vez de por perfil 1-D. Dois tiros lado a lado que se tocam pelo halo são
 *    componentes distintos em 2-D e indistinguíveis em projeção.
 * 2. Se ainda faltar, parâmetros POR CATEGORIA: `estouro` e `tiro` têm formas
 *    opostas e não há razão para partilharem uma constante.
 * 3. A fileira `glifo` precisa de tratamento próprio de qualquer jeito — ver a
 *    nota em `tiros.slices.mjs`.
 */

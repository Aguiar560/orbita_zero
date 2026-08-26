import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Normaliza os ícones de elemento para um conjunto coerente.
 *
 * ## Por que não basta redimensionar
 *
 * Os seis chegaram em tamanhos e proporções diferentes — de 312x460 (raio, em
 * pé) a 443x398 (cósmico, deitado). Encaixar cada um num quadrado com
 * `fit: contain` faria o raio virar uma tira estreita e alta e o cósmico uma
 * faixa larga e baixa: no mesmo espaço de 11px, um pesaria muito mais que o
 * outro, e o conjunto pareceria mal feito sem que se soubesse dizer por quê.
 *
 * ## Por que a normalização é por ÁREA OPACA
 *
 * O que o olho lê como "tamanho" de um ícone não é a caixa que o contém, é
 * quanta tinta ele põe na tela. Duas formas com a mesma altura mas uma cheia e
 * outra vazada não pesam igual.
 *
 * Então: recorta cada um até o conteúdo, mede quantos pixels opacos tem, e
 * escala todos para a MESMA área. O resultado é um conjunto em que nenhum ícone
 * chama mais atenção que os outros por acidente de enquadramento.
 *
 * ## Por que WebP sem perda
 *
 * Arte de contorno nítido. WebP com perda mistura cor entre pixels vizinhos e
 * borra justamente a aresta que faz a silhueta ser reconhecível a 11px — que é
 * o tamanho crítico deste conjunto.
 */

const ORIGEM = process.argv[2] ?? 'C:/Users/aguia/Downloads';
const DESTINO = 'public/assets/ui/elementos';
const ESTATICOS = 'assets-static/ui/elementos';

/** Lado do quadro final. Reduzir é limpo; ampliar não é. */
const LADO = 256;

/**
 * Quanto do quadro a arte ocupa, em área.
 *
 * 0,42 e não 0,80: `0,8` seria a fração do LADO, e aqui a conta é de ÁREA — a
 * mesma forma ocupando 80% da largura cobre bem menos que 80% do quadrado.
 * Medido, 0,42 de área deixa a margem visual em torno de 10%, que é o que o
 * conjunto pede para não encostar na borda quando ganhar fundo.
 */
const OCUPACAO = 0.42;

const ELEMENTOS = ['fogo', 'gelo', 'raio', 'quimico', 'cosmico', 'padrao'];

/** Recorta até o conteúdo e devolve o buffer mais a área opaca. */
async function recortar(arquivo) {
  const bruto = sharp(arquivo).ensureAlpha();
  const { data, info } = await bruto.raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  let minX = W, maxX = -1, minY = H, maxY = -1, opacos = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // 24 e não 0: PNG de IA costuma trazer uma orla de alfa quase-zero que
      // não se vê mas conta como conteúdo, e ela inflaria o recorte.
      if (data[(y * W + x) * C + 3] < 24) continue;
      opacos++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error(`${arquivo}: imagem vazia`);

  const largura = maxX - minX + 1;
  const altura = maxY - minY + 1;
  const buffer = await sharp(arquivo)
    .extract({ left: minX, top: minY, width: largura, height: altura })
    .png()
    .toBuffer();

  return { buffer, largura, altura, opacos };
}

async function main() {
  await mkdir(DESTINO, { recursive: true });
  await mkdir(ESTATICOS, { recursive: true });

  const arquivos = new Set(await readdir(ORIGEM));
  const recortes = [];
  for (const nome of ELEMENTOS) {
    const arquivo = `${nome}.png`;
    if (!arquivos.has(arquivo)) {
      console.error(`  faltando: ${arquivo}`);
      process.exitCode = 1;
      continue;
    }
    recortes.push({ nome, ...(await recortar(path.join(ORIGEM, arquivo))) });
  }
  if (recortes.length !== ELEMENTOS.length) return;

  // A área ALVO sai da média geométrica das áreas recortadas, e não da maior nem
  // da menor: com a maior, os pequenos seriam ampliados e perderiam nitidez; com
  // a menor, todos encolheriam à toa. A média geométrica é a que menos distorce
  // um conjunto de escalas.
  const log = recortes.map((r) => Math.log(r.opacos / (r.largura * r.altura)));
  const densidadeMedia = Math.exp(log.reduce((s, v) => s + v, 0) / log.length);
  const areaAlvo = LADO * LADO * OCUPACAO;

  console.log(`normalizando ${recortes.length} ícones para ${LADO}x${LADO}`);
  console.log(`densidade média das formas: ${(densidadeMedia * 100).toFixed(0)}% da própria caixa\n`);

  for (const r of recortes) {
    // Escala tal que a ÁREA OPACA fique igual para todos. Como a densidade da
    // forma (opacos / caixa) varia, a caixa final varia junto — e é justamente
    // isso que faz o conjunto pesar igual no olho.
    const escala = Math.sqrt(areaAlvo / r.opacos);
    let largura = Math.round(r.largura * escala);
    let altura = Math.round(r.altura * escala);

    // Teto de segurança: nenhuma dimensão pode passar do quadro. Uma forma muito
    // vazada pediria uma caixa maior que o canvas para atingir a área alvo.
    const excesso = Math.max(largura / LADO, altura / LADO, 1);
    largura = Math.round(largura / excesso);
    altura = Math.round(altura / excesso);

    const png = await sharp(r.buffer)
      .resize(largura, altura, { fit: 'fill', kernel: 'lanczos3' })
      .extend({
        left: Math.floor((LADO - largura) / 2),
        right: Math.ceil((LADO - largura) / 2),
        top: Math.floor((LADO - altura) / 2),
        bottom: Math.ceil((LADO - altura) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const webp = await sharp(png).webp({ lossless: true, effort: 6 }).toBuffer();
    await sharp(webp).toFile(path.join(DESTINO, `${r.nome}.webp`));
    await sharp(webp).toFile(path.join(ESTATICOS, `${r.nome}.webp`));

    const ocupa = ((r.opacos * escala * escala) / (LADO * LADO) * 100).toFixed(0);
    console.log(
      `  ${r.nome.padEnd(8)} ${String(r.largura).padStart(3)}x${String(r.altura).padEnd(3)}` +
      ` → ${String(largura).padStart(3)}x${String(altura).padEnd(3)} em ${LADO}` +
      `  área ${ocupa}%  ${(webp.length / 1024).toFixed(1)} KB`,
    );
  }
  console.log(`\nescritos em ${DESTINO} e ${ESTATICOS}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

/**
 * Recorte de `Recursos.png` — 70 recursos numa grade 10 × 7 (§29, §10).
 *
 * A grade é EXATA: 1536 / 10 = 153,6 e 1024 / 7 ≈ 146,3. Não foi detectada por
 * perfil de luminância como as outras folhas porque aqui não dá — o fundo das
 * células é claro e os ícones brilham, então o perfil não tem vale nenhum e
 * devolve a imagem inteira como um bloco só. Numa grade perfeitamente regular a
 * divisão é mais confiável que a detecção.
 *
 * Cada célula tem o ícone em cima e um RÓTULO embaixo. O rótulo fica de fora do
 * recorte: o nome do recurso é dado, mora em `data/recursos.ts` e precisa poder
 * ser traduzido; queimá-lo no sprite o congelaria em português para sempre.
 */

export const RECURSOS_SHEET = 'spaceships new/Recursos.png';

export const COLUNAS = 10;
export const LINHAS = 7;

export const CELULA_W = 1536 / COLUNAS;
export const CELULA_H = 1024 / LINHAS;

/**
 * Fração da altura da célula ocupada pelo ÍCONE, antes do rótulo.
 *
 * 0,66 e não 0,72: com 0,72 o rótulo vazava em cerca de quinze das setenta
 * células — conferido em folha de contato, não no número, porque a contagem
 * saía 70 certinha nos dois casos. As pílulas de rótulo têm alturas diferentes
 * conforme o nome ocupe uma ou duas linhas, então a fração precisa caber na
 * PIOR delas.
 */
export const FRACAO_DO_ICONE = 0.66;

/** Recuo lateral, para a moldura da célula vizinha não entrar. */
export const RECUO = 6;

/** As 70 células, na ordem de leitura: da esquerda para a direita, linha a linha. */
export function celulas() {
  const out = [];
  for (let linha = 0; linha < LINHAS; linha++) {
    for (let coluna = 0; coluna < COLUNAS; coluna++) {
      out.push({
        indice: linha * COLUNAS + coluna,
        linha,
        coluna,
        x: Math.round(coluna * CELULA_W) + RECUO,
        y: Math.round(linha * CELULA_H) + RECUO,
        w: Math.round(CELULA_W) - RECUO * 2,
        h: Math.round(CELULA_H * FRACAO_DO_ICONE) - RECUO,
      });
    }
  }
  return out;
}

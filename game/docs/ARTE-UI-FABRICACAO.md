# Peças de interface — Fabricação

Especificação para gerar os sprites da tela de Fabricação. As medidas saíram do
CSS que já roda (`src/styles/main.css`), então as peças encaixam sem retrabalho.

**A regra que decide tudo:** nenhuma peça pode conter texto, número ou contagem
fixa de encaixes. As receitas têm 3, 4, 5, 6, 8 e 10 encaixes, e o texto muda por
receita e por idioma. Arte com isso gravado serve a uma tela e quebra nas outras.

---

## Paleta

Use exatamente estas cores — são as do jogo.

| uso | cor |
|---|---|
| neon principal (bordas, brilho) | `#4FC3FF` |
| neon secundário / destaque | `#FFB638` |
| fundo do painel | `#0A1020` |
| fundo mais escuro | `#060B18` |
| linha fraca | `rgba(120, 160, 220, 0.14)` |
| linha forte | `rgba(120, 190, 255, 0.34)` |
| texto | `#DFE8F6` |
| texto apagado | `#7F93B3` |

Estilo: sci-fi limpo, linha fina, brilho de neon **na borda** e não no
preenchimento. Sem gradiente forte no miolo — o texto do jogo é desenhado por
cima e precisa de contraste.

---

## As peças

Todas em **PNG com canal alfa**, fundo totalmente transparente.

### 1. `moldura_modal.png` — 9-slice

- **512 × 512 px**
- Margens de 9-slice: **48 px** em cada lado
- Os 48 px de cada canto são desenho fixo; as faixas do meio serão ESTICADAS
- O miolo (416 × 416 central) precisa ser **transparente ou quase**, com no
  máximo uma leve varredura — o conteúdo é desenhado por cima
- Cantos com colchetes/chanfro; a borda é a estrela da peça

Uso real: caixa de até **1180 × 900 px**, então as faixas esticam bastante — não
ponha detalhe que não sobreviva a estiramento linear.

### 2. `placa_titulo.png` — 3-slice horizontal

- **256 × 32 px**
- Margens de 3-slice: **40 px** à esquerda e à direita
- Ponta esquerda e direita são desenho fixo; os 176 px do meio esticam
- **Sem texto** — o rótulo é desenhado por cima, centralizado
- Usada em larguras de 240 a 560 px

### 3. `anel_fundo.png` — disco

- **512 × 512 px**, círculo centrado
- Anéis concêntricos, marcas de escala, textura de radar
- **Sem encaixes, sem números, sem hexágono central**
- O centro (círculo de raio 112 px, ou 44% do total) fica **transparente**: o
  núcleo é outra peça
- Precisa ficar bom em qualquer rotação — é simétrico e serve a 3 ou 10 encaixes

### 4. `encaixe_vazio.png` e `encaixe_cheio.png`

- **128 × 128 px** cada (desenhados em 2× para 62 px na tela)
- Soquete octogonal ou hexagonal, borda de neon
- `encaixe_vazio`: borda apagada, miolo escuro, **sem o "+"** (é texto)
- `encaixe_cheio`: mesma silhueta, borda acesa e brilho — o ícone do item é
  desenhado por cima, centralizado, ocupando ~55% da caixa
- As duas com a **mesma silhueta e o mesmo centro**, para não "pular" ao trocar

### 5. `nucleo_hex.png`

- **256 × 256 px**
- Hexágono apontando para cima, borda de neon, miolo escuro translúcido
- **Sem texto dentro** — "CHANCE DE OBTER / RARIDADE / 85%" é desenhado por cima
- Deixe ~70% da altura interna livre para três linhas de texto

### 6. `painel_secao.png` — 9-slice

- **256 × 256 px**, margens de 9-slice **24 px**
- Moldura das colunas laterais (inventário, tipos de fabricação)
- Mais discreta que a do modal: linha fina, canto chanfrado, sem colchete grande
- Miolo transparente

### 7. `botao.png` e `botao_ativo.png` — 3-slice horizontal

- **192 × 48 px** cada, margens de 3-slice **28 px**
- `botao`: estado normal, borda apagada
- `botao_ativo`: borda de neon acesa e brilho
- **Sem texto**
- Usado em larguras de 120 a 460 px

### 8. `celula_item.png`

- **128 × 128 px**
- Célula do inventário: quadrado de canto chanfrado, borda fina
- A cor da raridade é aplicada por código — desenhe a borda em **branco puro**
  para poder ser tingida, ou deixe neutra
- Miolo transparente; o ícone do item vai por cima a ~70% da caixa

---

## Como entregar

Uma pasta `Interface` dentro de `spaceships new`, com os arquivos nos nomes
acima. Sem subpastas.

Se puder, mande também **uma variação de cor** de `encaixe_cheio` e `botao_ativo`
em âmbar (`#FFB638`), para os estados de aviso.

---

## Prompt pronto para a IA de imagem

> Sci-fi game UI kit, dark holographic HUD, thin cyan neon line art on near-black
> panels. Palette: cyan `#4FC3FF` glow lines, amber `#FFB638` accents, panel fill
> `#0A1020`, deep background `#060B18`. Clean vector-like edges, subtle scanline
> texture, chamfered corners with bracket details. Glow lives on the BORDERS, not
> in the fill — interiors stay dark and low-contrast so white text drawn on top
> stays readable.
>
> Produce these as **separate PNG files with fully transparent backgrounds**,
> centered, no drop shadow outside the artwork, and **absolutely no text, no
> numbers, no letters** anywhere:
>
> 1. `moldura_modal.png` — 512×512 nine-slice panel frame, 48px corner margins,
>    hollow transparent center, ornate bracketed corners.
> 2. `placa_titulo.png` — 256×32 horizontal title bar, decorative left and right
>    end caps within 40px, plain stretchable middle, empty center.
> 3. `anel_fundo.png` — 512×512 circular radar/reactor backdrop, concentric rings
>    and tick marks, transparent hole in the middle of radius 112px, radially
>    symmetric, no sockets and no numbers.
> 4. `encaixe_vazio.png` — 128×128 empty octagonal socket, dim border, dark
>    interior, nothing inside.
> 5. `encaixe_cheio.png` — 128×128 same octagonal socket, bright glowing cyan
>    border, identical silhouette and center to the empty one.
> 6. `nucleo_hex.png` — 256×256 upward-pointing hexagon, glowing cyan outline,
>    dark translucent interior, completely empty inside.
> 7. `painel_secao.png` — 256×256 nine-slice subtle panel frame, 24px corner
>    margins, thin lines, hollow center.
> 8. `botao.png` and `botao_ativo.png` — 192×48 horizontal button frames,
>    28px end caps, one dim and one glowing, empty middle.
> 9. `celula_item.png` — 128×128 inventory slot, chamfered square, thin white
>    border so it can be tinted, transparent interior.
>
> Consistent line weight and glow intensity across all pieces — they appear on
> the same screen together.

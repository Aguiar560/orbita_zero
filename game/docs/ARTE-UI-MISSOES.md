# Peças de interface — Missões

> **Estado de implementação — 24/08/2026.** Este documento continua útil como
> especificação de arte, mas a interface em produção não depende de uma nova
> moldura brilhante para funcionar. A Central de Contratos foi simplificada na
> gramática Provação/Afixos: painéis escuros, linha cyan discreta e cor reservada
> para o tipo/estado. Os nove retratos são servidos pelo atlas lazy `characters`
> gerado da pasta `Characters`; o enquadramento é 3×4, ancorado no rodapé e
> isolado por frame para impedir que pixels de outro retrato entrem no card. A
> escada de confiança usa hexágonos preenchidos pelo CSS na cor de cada contato,
> de modo que borda, interior e conectores sejam coerentes. Veja o registro em
> [`ATUALIZACAO-2026-08-24.md`](ATUALIZACAO-2026-08-24.md).

Especificação para gerar os sprites da Central de Contratos. **As medidas saíram
do CSS que já roda**, medidas no navegador com o modal aberto em 1280 × 800 — não
são estimativa. Por isso as peças encaixam sem retrabalho.

> Mesmo processo de `ARTE-UI-FABRICACAO.md`, que funcionou. O que deu errado lá e
> não pode repetir: a IA não respeitou a grade pedida (tivemos de detectar as
> posições por componentes conexos) e algumas peças vieram com resíduo de fundo
> que virou caixa brilhante na tela.

---

## As três regras que decidem tudo

**1. Nenhuma peça pode conter texto, número ou contagem fixa.** Os nomes de
missão, os valores de progresso, os algarismos I–V e os rótulos mudam por missão,
por personagem e por idioma. Arte com isso gravado serve a uma tela e quebra nas
outras.

**2. Alfa de verdade, fundo 100% transparente.** Sem xadrez cinza, sem retângulo
preto por trás, sem sombra externa ao desenho. Resíduo de fundo vira caixa
luminosa quando o sprite é recortado.

**3. Glow só na BORDA.** O interior de todo painel fica escuro e de baixo
contraste — o texto branco é desenhado por cima e precisa de contraste. Card
inteiro iluminado fica bonito em captura de tela e ilegível em uso.

---

## Paleta

Use exatamente estas cores.

| uso | cor |
|---|---|
| fundo mais escuro | `#060B18` |
| fundo do painel | `#0A1020` |
| **cyan** — principal, bordas, seleção | `#4FC3FF` |
| **âmbar** — especial, alertas | `#FFB638` |
| **roxo** — missão de aliado | `#B45CFF` |
| **vermelho** — missão de galáxia | `#FF4B4B` |
| **verde** — pronto, concluído | `#50E36B` |
| linha fraca | `rgba(120, 160, 220, 0.14)` |
| linha forte | `rgba(120, 190, 255, 0.34)` |
| texto | `#DFE8F6` |
| texto apagado | `#7F93B3` |

Estilo: sci-fi limpo, linha fina, cantos chanfrados, pequenos colchetes e
recortes tecnológicos. Sofisticado e funcional, não carregado.

---

## Escala

**Desenhe tudo em 2×** e entregue em 2×. O jogo reduz na hora de usar, o que dá
borda limpa em tela comum e em tela retina. As medidas abaixo são as de USO (1×);
o arquivo deve ter o dobro.

---

## Grupo A — molduras e painéis

### A1. `missoes_moldura.png` — 9-slice
- Uso: **1180 × 736** · arquivo **2×**
- Margem de 9-slice: **72 px** (em 1×) de cada lado
- Moldura externa do modal. Cantos com colchete e nó circular; as faixas do meio
  serão **esticadas**, então nada de detalhe que não sobreviva a estiramento
- Miolo transparente

### A2. `missoes_painel_col.png` — 9-slice
- Uso: **203–223 × 620–650** · arquivo **2×**
- Margem de 9-slice: **28 px**
- Moldura discreta das colunas laterais (contatos, tipos). Linha fina, canto
  chanfrado, sem colchete grande. Miolo transparente

### A3. `missoes_ficha.png` — 9-slice
- Uso: **545 × 281** · arquivo **2×**
- Margem de 9-slice: **40 px**
- Painel da ficha do personagem. Um pouco mais presente que A2 — é o bloco
  nobre da tela

### A4. `missoes_confianca.png` — 9-slice
- Uso: **519 × 121** · arquivo **2×**
- Margem de 9-slice: **30 px**
- Caixa da escada de confiança. **Sem os nós desenhados dentro** — eles são A9

---

## Grupo B — abas e botões

### B1. `missoes_aba.png` e `missoes_aba_ativa.png` — 3-slice horizontal
- Uso: **112 × 31**, larguras de 90 a 200 · arquivo **2×**
- Margem de 3-slice: **22 px** à esquerda e à direita
- Canto superior esquerdo chanfrado (corte de 10 px)
- `aba`: borda apagada, miolo escuro. `aba_ativa`: borda cyan acesa com glow
- **Sem texto**

### B2. `missoes_botao.png` e `missoes_botao_ativo.png` — 3-slice
- Uso: **203 × 34**, larguras de 100 a 260 · arquivo **2×**
- Margem de 3-slice: **26 px**
- Um apagado, um com glow cyan
- **Sem texto**

### B3. `missoes_contador.png` — 3-slice
- Uso: **45 × 27**, larguras de 40 a 90 · arquivo **2×**
- Margem de 3-slice: **12 px**
- Cápsula pequena dos contadores do topo. Entregue **três variações de cor**:
  cyan, verde e âmbar

---

## Grupo C — cards

### C1. `missoes_card_contato.png` e `missoes_card_contato_sel.png` — 9-slice
- Uso: **219 × 64** · arquivo **2×**
- Margem de 9-slice: **16 px**
- `sel` tem uma barra de destaque vertical na borda esquerda e glow suave

### C2. `missoes_card.png` — 9-slice
- Uso: **541 × 157** (a altura varia com o conteúdo) · arquivo **2×**
- Margem de 9-slice: **20 px**
- **Borda em BRANCO PURO ou cinza neutro**, para o código tingir com a cor do
  tipo (cyan / roxo / vermelho). É a peça mais reaproveitada da tela

### C3. `missoes_card_especial.png` — 9-slice
- Uso: **541 × 150** · arquivo **2×**
- Margem de 9-slice: **28 px**
- Esta **não** é tingida: nasce dourada. Moldura âmbar mais elaborada, com
  cantos ornamentados e brilho controlado. Precisa parecer imediatamente
  diferente de C2

### C4. `missoes_moldura_item.png` — 9-slice
- Uso: **60 × 60** · arquivo **2×**
- Margem de 9-slice: **14 px**
- Caixa da recompensa exclusiva, dentro do card especial. Borda âmbar, miolo
  transparente — o ícone do item vai por cima

---

## Grupo D — nós e ícones de tipo

### D1. `missoes_no.png`, `missoes_no_aberto.png`, `missoes_no_travado.png`
- Uso: **30 × 30** · arquivo **2×**
- Hexágono apontando para cima, borda de neon
- `no`: apagado. `no_aberto`: aceso com glow. `no_travado`: apagado com cadeado
- As três com **a mesma silhueta e o mesmo centro**, para não "pular" ao trocar
- O algarismo romano é desenhado por baixo, fora da peça — **não grave I..V**

### D2. `missoes_fio.png`
- Uso: **20 × 2**, esticado horizontalmente · arquivo **2×**
- Ligação entre dois nós. Duas variações: apagada e acesa

### D3. Ícones de tipo de missão — **4 arquivos**
- Uso: **32 × 32** dentro de um hexágono · arquivo **2×**
- `tipo_principal.png` — cyan, alvo/mira concêntrica
- `tipo_aliado.png` — roxo, duas silhuetas de pessoa
- `tipo_galaxia.png` — vermelho, espiral galáctica
- `tipo_especial.png` — âmbar, losango/diamante facetado
- **Cada um precisa ter forma distinta**, não só cor diferente: a interface não
  pode depender de cor sozinha

### D4. Ícones de sinal de contato — **4 arquivos**
- Uso: **16 × 16** · arquivo **2×**
- `sinal_nova.png` — âmbar, exclamação em losango
- `sinal_pronta.png` — verde, tique em círculo
- `sinal_especial.png` — âmbar, losango facetado
- `sinal_travado.png` — cinza, cadeado

---

## Grupo E — ÍCONES DE RECOMPENSA ★

**É o grupo mais importante deste pedido.** Hoje as recompensas são texto; a tela
inteira ganha quando viram ícone, como no mockup.

- Uso: **28 × 28** dentro de uma moldura quadrada de canto chanfrado
- Arquivo **2× (56 × 56)**
- Entregue **cada um como PNG separado**
- Estilo consistente entre todos: mesma espessura de linha, mesma intensidade de
  brilho, mesmo enquadramento. Eles aparecem lado a lado na mesma linha

| arquivo | o que é | cor |
|---|---|---|
| `rec_xp.png` | cristal/losango de experiência | cyan `#4FC3FF` |
| `rec_sucata.png` | placas de sucata metálica | cinza-azulado |
| `rec_nucleo.png` | núcleo de energia esférico | cyan |
| `rec_cristal.png` | cristal facetado | roxo `#B45CFF` |
| `rec_recurso.png` | cubo de minério genérico | roxo |
| `rec_item.png` | peça de equipamento genérica | cyan |
| `rec_bau.png` | baú/contêiner fechado | âmbar `#FFB638` |
| `rec_medalha.png` | medalha hexagonal | âmbar |
| `rec_blueprint.png` | esquema técnico dobrado | cyan |
| `rec_confianca.png` | dois elos entrelaçados | roxo |
| `rec_espaco.png` | contêiner de carga com seta | verde `#50E36B` |
| `rec_exclusivo.png` | estrela de quatro pontas | âmbar, com mais brilho |

Mais **uma moldura vazia** para eles:

### E13. `rec_moldura.png`
- Uso: **34 × 34** · arquivo **2×**
- Quadrado de canto chanfrado, borda fina em **branco puro** para ser tingida
  pelo código, miolo transparente

---

## Como entregar

Uma pasta `Missoes` dentro de `spaceships new`, com os arquivos nos nomes acima.
Sem subpastas.

Se a IA insistir em devolver tudo numa chapa única em vez de arquivos separados:
tudo bem, mas **deixe muito espaço vazio entre as peças** (pelo menos 40 px) e
não encoste uma na outra — o recorte é feito por detecção de componentes conexos,
e peças coladas viram uma peça só.

---

## Prompt pronto para a IA de imagem

Copie daqui para baixo.

> Sci-fi game UI kit, dark holographic HUD, thin neon line art on near-black
> panels. This is a **mission/contract terminal** screen kit for a space game.
>
> Palette, use exactly: cyan `#4FC3FF` (primary, borders, selection), amber
> `#FFB638` (special, alerts), purple `#B45CFF` (ally), red `#FF4B4B` (galaxy),
> green `#50E36B` (ready/complete), panel fill `#0A1020`, deep background
> `#060B18`, text `#DFE8F6`.
>
> Style: clean vector-like edges, thin lines, chamfered corners, small bracket
> and circuit details, subtle scanline texture. **Glow lives on the BORDERS
> only** — interiors stay dark and low-contrast so white text drawn on top stays
> readable. Sophisticated and functional, not busy.
>
> **Critical rules — these are not optional:**
> 1. **Absolutely no text, no numbers, no letters, no roman numerals anywhere.**
>    All labels are drawn by the game on top.
> 2. **Fully transparent background with real alpha.** No checkerboard, no black
>    rectangle behind the art, no outer drop shadow. Any leftover background
>    becomes a glowing box in-game.
> 3. Deliver **separate PNG files**, each piece centered in its own canvas.
> 4. Draw everything at **2× the listed size**.
>
> Produce these pieces:
>
> **Frames (nine-slice, hollow transparent centers):**
> 1. `missoes_moldura.png` — 2360×1472, ornate outer modal frame, 144px corner
>    margins, bracketed corners with circular nodes, stretchable middle bands.
> 2. `missoes_painel_col.png` — 446×1300, subtle side-column frame, 56px corner
>    margins, thin lines, chamfered corners.
> 3. `missoes_ficha.png` — 1090×562, character dossier panel, 80px corner
>    margins, slightly more prominent than the previous one.
> 4. `missoes_confianca.png` — 1038×242, small panel for a progress chain,
>    60px corner margins, completely empty inside.
>
> **Tabs and buttons (three-slice horizontal, empty middles, no text):**
> 5. `missoes_aba.png` and `missoes_aba_ativa.png` — 224×62 tab shapes, 44px end
>    caps, top-left corner cut at 20px; one dim, one glowing cyan.
> 6. `missoes_botao.png` and `missoes_botao_ativo.png` — 406×68 buttons, 52px end
>    caps; one dim, one glowing cyan.
> 7. `missoes_contador.png` — 90×54 small rounded counter capsule, 24px end caps.
>    Give three color variants: cyan, green, amber.
>
> **Cards (nine-slice):**
> 8. `missoes_card_contato.png` and `missoes_card_contato_sel.png` — 438×128
>    contact row frames, 32px corner margins; the `_sel` one has a vertical
>    highlight bar on the left edge and a soft glow.
> 9. `missoes_card.png` — 1082×314 mission card frame, 40px corner margins,
>    border in **pure white or neutral gray so it can be tinted by code**.
> 10. `missoes_card_especial.png` — 1082×300 premium contract frame, 56px corner
>     margins, **gold/amber**, more ornate corners, controlled glow. Must read as
>     immediately more important than the plain card.
> 11. `missoes_moldura_item.png` — 120×120 reward item frame, 28px corner
>     margins, amber border, transparent center.
>
> **Nodes and type icons:**
> 12. `missoes_no.png`, `missoes_no_aberto.png`, `missoes_no_travado.png` — 60×60
>     upward-pointing hexagon nodes; dim, glowing, and dim-with-padlock. All
>     three share the exact same silhouette and center. **Empty inside.**
> 13. `missoes_fio.png` — 40×4 connector line, two variants: dim and lit.
> 14. Four 64×64 mission-type icons inside hexagons, each a **distinct shape**,
>     not just a different color: `tipo_principal.png` (cyan concentric
>     targeting reticle), `tipo_aliado.png` (purple two-person silhouette),
>     `tipo_galaxia.png` (red galaxy spiral), `tipo_especial.png` (amber faceted
>     diamond).
> 15. Four 32×32 status badges: `sinal_nova.png` (amber exclamation in a
>     diamond), `sinal_pronta.png` (green check in a circle),
>     `sinal_especial.png` (amber faceted diamond), `sinal_travado.png` (gray
>     padlock).
>
> **Reward icons — the most important set. Twelve 56×56 icons, consistent line
> weight, glow intensity and framing across all of them, since they appear side
> by side in a single row:**
> 16. `rec_xp.png` — cyan experience crystal/diamond.
> 17. `rec_sucata.png` — gray-blue stacked scrap metal plates.
> 18. `rec_nucleo.png` — cyan spherical energy core.
> 19. `rec_cristal.png` — purple faceted crystal.
> 20. `rec_recurso.png` — purple generic ore cube.
> 21. `rec_item.png` — cyan generic equipment part.
> 22. `rec_bau.png` — amber closed container/chest.
> 23. `rec_medalha.png` — amber hexagonal medal.
> 24. `rec_blueprint.png` — cyan folded technical schematic.
> 25. `rec_confianca.png` — purple two interlocked links.
> 26. `rec_espaco.png` — green cargo container with an arrow.
> 27. `rec_exclusivo.png` — amber four-pointed star, brighter than the rest.
> 28. `rec_moldura.png` — 68×68 chamfered square slot frame, thin **pure white**
>     border so it can be tinted, transparent center.
>
> Keep line weight and glow intensity consistent across every piece — they all
> appear on the same screen together.

---

## Depois que a arte chegar

O pipeline aceita as duas origens (arquivos soltos ou chapa), como já faz com
`moldura_modal.png` da Fabricação. O recorte vai para
`tools/interface.slices.mjs`, e as posições saem de **detecção**, não de régua —
a IA não respeitou a grade da última vez e medir é mais barato que negociar.

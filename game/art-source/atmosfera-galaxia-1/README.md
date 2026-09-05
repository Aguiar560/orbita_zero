# Atmosfera oceânica — galáxia 1

Artes originais geradas com a ferramenta integrada de imagem (`imagegen`), em
04/09/2026. Nuvens aprovadas para campanha; relé rejeitado e não integrado.
Nenhuma alteração no fundo original da campanha. PNGs preservados
nesta pasta; versões WebP com alpha em `assets-static/fundo/atmosfera-teste/`
e `public/assets/fundo/atmosfera-teste/`. Somente `nuvem.webp` vai à produção.
Conversão/otimização com Sharp.

## Prompts finais

### nuvem.png → nuvem.webp (1024 × 683)

Use case: stylized-concept. Asset type: transparent game environment sprite, single cloud bank for top-down sci-fi aerial shooter over dark teal ocean. Create one organic elongated cluster of volumetric marine stratocumulus wisps viewed strictly straight down from above. Muted blue-gray and seafoam highlights, irregular fractal lacy edges, varying semitransparent thin vapor around a few denser soft billows. Painterly realistic game rendering, softly lit from upper left. Entire cloud isolated on genuinely transparent alpha background, generous transparent padding on every edge, cloud never cropped. No ocean, ground, sky backdrop, stars, aircraft, text, border, watermark or checkerboard. Landscape composition.

### rele.png → rele.webp (768 × 512)

Use case: stylized-concept. Asset type: transparent scenery sprite for top-down sci-fi shooter above an ocean planet. A single abandoned orbital ocean-monitoring relay platform, viewed strictly vertically straight down, orthographic flat plan view, NOT isometric. Broad asymmetric hexagonal gunmetal hub, two weathered segmented solar collector wings, small circular antenna seen from directly above, exposed cables, a broken arm, tiny restrained cyan running lights and amber utility details. Worn blue-gray metal, industrial hard-surface realistic painted game art matching detailed pixel-art spaceships over a dark marine planet. Clearly a stationary environmental installation, not a combat ship. Soft light upper left. Isolated entire silhouette with generous padding on genuinely transparent alpha background. No ground, water, stars, sky, baked cast shadow, exhaust, text, logo, border or checkerboard.

## Uso

Composição por `src/render/AtmosferaOceanica.ts`, regras em
`src/data/atmosfera-oceanica.ts`. Nuvem carregada apenas ao entrar na galáxia 1,
normal ou teste, fora de Provação/laboratório. Sem colisão e sem mudanças no RNG.

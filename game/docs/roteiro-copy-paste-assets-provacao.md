# Roteiro para gerar os assets da Provação no ChatGPT

Use **uma única conversa** do ChatGPT para manter a direção artística consistente. Anexe `provacao.png` somente na primeira mensagem. Gere um asset por vez, baixe o PNG e renomeie com o nome indicado.

Se uma geração ficar errada, não avance. Use o prompt de correção no final deste documento e repita o asset.

---

## ETAPA 0 — Fixar a direção artística

Anexe `C:\Users\aguia\Downloads\provacao.png` e envie:

```text
Esta imagem é a referência visual oficial da nova tela da Provação do jogo Órbita Zero. Analise e mantenha nesta conversa a mesma linguagem visual: interface sci-fi dark premium, metal negro azulado, placas chanfradas, linhas finas de energia ciano, fundos quase pretos, contraste alto, detalhes mecânicos discretos e acabamento de videogame para PC.

Regras obrigatórias para todas as próximas imagens:
- gerar somente o asset solicitado, nunca a interface completa;
- vista frontal ortográfica, sem perspectiva de mockup;
- fundo realmente transparente em PNG RGBA, exceto quando eu pedir fundo ou retrato em WebP;
- sem texto, letras, números, logotipos ou watermark;
- peça centralizada, inteira e com margem transparente mínima de 8%;
- bordas nítidas, sem blur e sem bloom exagerado;
- não usar estilo mobile genérico, cartoon, plástico, steampunk ou fantasia medieval;
- manter espessura das linhas, cores e iluminação consistentes entre todos os assets desta conversa;
- quando eu escrever “9-slice”, criar centro uniforme, bordas retas e cantos que possam ser recortados sem deformação.

Não gere imagem ainda. Apenas confirme que entendeu e que usará a imagem anexada como referência durante toda a sequência.
```

---

# FASE 1 — Kit estrutural

Só avance à Fase 2 depois de aprovar estes seis assets. Eles definem o estilo de tudo.

## ETAPA 1 — Painel genérico

```text
Usando a referência visual e todas as regras já definidas, gere um único asset chamado prv_painel_9slice.png.

Moldura de painel retangular sci-fi preparada para 9-slice, arquivo-fonte 512×512. Metal grafite azulado, fundo interno quase preto e uniforme, borda em dois níveis, cantos chanfrados, filete ciano discreto somente na borda superior esquerda e inferior direita, pequenos encaixes técnicos nos quatro cantos. O centro precisa permanecer liso e uniforme para conteúdo variável. Sem cabeçalho embutido, sem ícones e sem texto. Fundo externo transparente. Mostre somente a peça isolada, perfeitamente frontal.
```

## ETAPA 2 — Moldura externa

```text
Gere um único asset chamado prv_moldura_externa.png, arquivo-fonte 2048×1366.

Moldura externa retangular muito larga para modal sci-fi de tela cheia, somente bordas e cantos; todo o interior deve ser transparente. Cantos tecnológicos cortados em 45 graus, duas linhas paralelas extremamente finas em ciano elétrico, placas de metal negro azulado, pequenos encaixes e interrupções assimétricas ao longo das bordas, quatro cantos mais detalhados. Espessura visual entre 18 e 28 pixels no arquivo final. Deve parecer estrutural, sofisticada e leve, como console de nave de alto nível. Sem painel preenchido, sem texto, sem ícones.
```

## ETAPA 3 — Barra superior

```text
Gere um único asset chamado prv_barra_superior_9slice.png, arquivo-fonte 1536×128.

Barra horizontal sci-fi longa preparada para 9-slice. Fundo quase preto com leve gradiente azul, borda superior e inferior de metal negro, linha ciano muito fina acompanhando a silhueta, cantos chanfrados, extremidades com pequenos trilhos e encaixes mecânicos. Área central ampla, escura, limpa e homogênea para receber título e botões em HTML. Sem divisórias fixas, sem ícones, sem letras e sem números. Fundo externo transparente.
```

## ETAPA 4 — Cabeçalho de seção

```text
Gere um único asset chamado prv_titulo_secao_9slice.png, arquivo-fonte 768×80.

Placa horizontal fina para título de seção, preparada para 9-slice. Fundo preto azulado, borda superior ciano, pequeno recorte diagonal nas duas pontas, detalhe de circuito no canto direito e espaço central totalmente limpo. Deve parecer um cabeçalho leve, não um botão. Sem texto, símbolo ou número. Fundo externo transparente.
```

## ETAPA 5 — Rodapé informativo

```text
Gere um único asset chamado prv_rodape_info_9slice.png, arquivo-fonte 1536×72.

Faixa horizontal baixa de informação preparada para 9-slice. Metal escuro quase preto, linhas ciano finas nas bordas, cantos chanfrados e encaixe vazio no lado esquerdo para um ícone circular. Centro amplo e limpo para frase em HTML. Sem ícone, texto ou número. Fundo externo transparente.
```

## ETAPA 6 — Botão primário

```text
Gere um único asset chamado prv_botao_primario_9slice.png, arquivo-fonte 768×144.

Botão primário horizontal grande preparado para 9-slice. Metal negro azulado, borda dupla ciano elétrica, cantos cortados em 45 graus, centro escuro uniforme para texto em HTML, pequenos pulsos de energia concentrados nos quatro cantos e brilho externo curto. Sem texto, sem ícone e sem preenchimento azul claro no centro. Fundo externo transparente.
```

---

# FASE 2 — Torre e cartões de piso

## ETAPA 7 — Fundo da torre

```text
Gere um único fundo chamado prv_torre_fundo.webp, 1024×1536.

Interior vertical de uma torre espacial colossal visto perfeitamente de frente. Arquitetura alienígena industrial em metal negro e azul petróleo, duas paredes laterais simétricas repletas de placas, trilhos, condutos e pequenas luzes ciano. O centro deve formar um poço vertical escuro e vazio onde cartões horizontais serão sobrepostos. Profundidade sugerida por sombras e parallax, sem perspectiva inclinada. Espaço estrelado muito discreto aparecendo apenas por fendas laterais. Sem cartões, chefes, números ou interface. Bordas superior e inferior visualmente contínuas para permitir repetição vertical.
```

## ETAPA 8 — Cartão-base de piso

```text
Gere um único asset chamado prv_piso_base_9slice.png, 1024×224.

Cartão horizontal largo de piso da torre preparado para 9-slice. Metal negro azulado, cantos chanfrados, painel interno escuro com textura extremamente sutil de circuito, trilhos mecânicos superior e inferior e sombra interna. Lado esquerdo com espaço vazio para número, centro grande vazio para retrato e lado direito com encaixe octogonal vazio para status. Borda azul aço discreta, sem brilho de seleção. Sem número, retrato, ícone ou texto. Fundo externo transparente.
```

## ETAPA 9 — Overlay selecionado

```text
Gere um único asset chamado prv_piso_selecionado_overlay.png, 1024×224.

Somente uma moldura luminosa para sobrepor ao cartão de piso já aprovado. Interior totalmente transparente. Contorno duplo ciano elétrico, quatro cantos reforçados, pequenos pulsos de energia e luz branca concentrada nos chanfros, brilho externo curto e controlado. Deve comunicar foco atual sem esconder o cartão ou o retrato abaixo. Sem fundo sólido, texto ou ícones.
```

## ETAPA 10 — Overlay concluído

```text
Gere um único asset chamado prv_piso_concluido_overlay.png, 1024×224.

Overlay de piso vencido para sobrepor ao cartão-base aprovado. Interior transparente, filete verde esmeralda discreto, leve vinheta verde nas laterais, pequenos circuitos ativos nos cantos e linha de energia contínua na borda inferior. Não incluir símbolo de check, texto ou número.
```

## ETAPA 11 — Overlay de chefe

```text
Gere um único asset chamado prv_piso_chefe_overlay.png, 1024×224.

Overlay de piso de chefe para sobrepor ao cartão-base aprovado. Interior transparente. Moldura vermelho carmesim escuro com energia rubra nas rachaduras, cantos mais agressivos e pontiagudos, pequenos sinais triangulares abstratos sem letras. Brilho vermelho concentrado e curto. Sem caveira, retrato, texto ou número.
```

## ETAPA 12 — Overlay bloqueado

```text
Gere um único asset chamado prv_piso_bloqueado_overlay.png, 1024×224.

Overlay de piso bloqueado para sobrepor ao cartão-base aprovado. Interior preto azulado translúcido com vinheta forte, bordas desativadas em azul acinzentado, circuitos apagados e duas pequenas placas metálicas cruzando os cantos. Deve deixar o cartão abaixo reconhecível, porém claramente inacessível. Sem cadeado, texto ou número.
```

## ETAPA 13 — Selo octogonal

```text
Gere um único asset chamado prv_selo_octogonal.png, 128×128.

Selo octogonal sci-fi vazio, vista frontal, moldura dupla de metal negro, oito lados regulares, centro transparente e pequenos canais de energia azul aço ao redor. Sem símbolo interno, texto ou número. Fundo transparente. A cor deve ser neutra o suficiente para recoloração por CSS.
```

## ETAPA 14 — Ícone de conclusão

```text
Gere um único asset chamado prv_icone_check.png, 96×96.

Símbolo de check angular futurista verde esmeralda, formado por dois segmentos metálicos iluminados, simples e legível quando reduzido para 24 pixels. Centralizado, sem círculo ou moldura externa, fundo transparente.
```

## ETAPA 15 — Ícone bloqueado

```text
Gere um único asset chamado prv_icone_cadeado.png, 96×96.

Cadeado tecnológico robusto em metal grafite, arco espesso, núcleo central escuro e pequena luz azul apagada. Perfeitamente frontal e legível em tamanho pequeno. Sem moldura externa, texto ou número. Fundo transparente.
```

## ETAPA 16 — Ícone de chefe

```text
Gere um único asset chamado prv_icone_chefe.png, 96×96.

Caveira alienígena mecânica estilizada e simétrica, olhos vermelhos, mandíbula angular e pequenos chifres tecnológicos. Silhueta forte e simples para leitura em 24 pixels. Sem moldura externa, texto ou número. Fundo transparente.
```

## ETAPAS 17–19 — Setas

Envie três vezes, alterando somente a direção e o nome:

```text
Gere um único asset chamado prv_seta_DIRECAO.png, 96×128.

Seta triangular holográfica apontando para DIRECAO, ciano elétrico, contorno duplo, centro azul translúcido e pequena base mecânica. Vista frontal, centralizada, fundo transparente. A forma, proporção e iluminação precisam permanecer iguais às outras setas desta família. Sem texto.
```

Substituições:

- `DIRECAO = esquerda`
- `DIRECAO = direita`
- `DIRECAO = baixo`

---

# FASE 3 — Coluna esquerda

## ETAPA 20 — Símbolo da Provação

```text
Gere um único asset chamado prv_alvo_torre.png, 128×128.

Ícone circular de alvo tecnológico para representar a Torre Eterna: três anéis concêntricos interrompidos, retículo central, quatro marcas cardeais e pequenos segmentos orbitais. Ciano brilhante sobre metal negro, simétrico, legível em 32 pixels. Sem letras, números ou moldura retangular. Fundo transparente.
```

## ETAPA 21 — Quadro de progresso

```text
Gere um único asset chamado prv_progresso_moldura_9slice.png, 640×384.

Moldura interna de estatísticas dividida visualmente em quatro quadrantes. Metal escuro e linhas azul petróleo muito finas, centro escuro uniforme, cantos chanfrados. Uma divisória vertical e uma horizontal com pequeno nó ciano no cruzamento. Sem números, títulos ou ícones. Fundo externo transparente.
```

## ETAPA 22 — Linha dos marcos

```text
Gere um único asset chamado prv_linha_marcos.png, 96×512.

Trilha vertical de progresso futurista: condutor fino ciano percorrendo o centro, quatro pontos de conexão igualmente espaçados e pequenos trechos apagados na parte inferior. Sem nós grandes, números ou recompensas. Fundo transparente.
```

## ETAPAS 23–25 — Nós dos marcos

```text
Gere um único asset chamado prv_marco_ESTADO.png, 64×64.

Nó circular de trilha de progresso, vista frontal, anel tecnológico duplo, centro simples e fundo transparente. ESTADO_VISUAL. Sem número ou texto. A forma e a escala devem ser idênticas às outras versões desta família.
```

Substituições:

- `ESTADO = feito`; `ESTADO_VISUAL = energia verde e pequeno check central`.
- `ESTADO = atual`; `ESTADO_VISUAL = energia ciano forte e núcleo azul luminoso`.
- `ESTADO = futuro`; `ESTADO_VISUAL = metal azul acinzentado e energia completamente apagada`.

## ETAPA 26 — Botão lateral

```text
Gere um único asset chamado prv_botao_lateral_9slice.png, 768×104.

Botão horizontal secundário preparado para 9-slice. Metal negro azulado, cantos chanfrados, borda ciano discreta, faixa interna escura, encaixe vazio para ícone à esquerda e área ampla vazia para texto em HTML. Estado neutro, sem brilho forte, sem ícone ou letras. Fundo externo transparente.
```

## ETAPA 27 — Ícone da loja

```text
Gere um único asset chamado prv_icone_loja.png, 96×96.

Carrinho de suprimentos espacial minimalista, corpo angular, duas rodas pequenas, ciano claro e metal azul. Silhueta forte, vista frontal, sem moldura ou texto. Fundo transparente.
```

## ETAPA 28 — Ícone de ranking

```text
Gere um único asset chamado prv_icone_ranking.png, 96×96.

Troféu futurista minimalista, taça angular com duas alças e base pequena, azul gelo com detalhes ciano. Vista frontal, sem moldura, texto ou número. Fundo transparente.
```

---

# FASE 4 — Coluna direita

## ETAPA 29 — Moldura do chefe

```text
Gere um único asset chamado prv_chefe_frame_9slice.png, 1024×416.

Moldura larga de cartão de chefe preparada para 9-slice. Metal negro, cantos agressivos, borda vermelho carmesim com linhas de energia e rachaduras tecnológicas discretas. Área direita ampla e vazia para retrato, área esquerda escura para ícone e texto em HTML. Sem retrato, caveira, letras, números ou medidor. Fundo externo transparente.
```

## ETAPA 30 — Medidor de poder vazio

```text
Gere um único asset chamado prv_poder_barra_base.png, 512×48.

Medidor horizontal segmentado futurista com seis segmentos trapezoidais alinhados. Estrutura de metal preto, todos os segmentos vazios em grafite escuro, pequenas separações regulares e contorno âmbar muito discreto. Fundo transparente, sem preenchimento, números ou texto. A barra será preenchida por CSS.
```

## ETAPA 31 — Cartão de modificador

```text
Gere um único asset chamado prv_mod_card_9slice.png, 384×224.

Cartão compacto de modificador preparado para 9-slice. Fundo preto azulado, borda metálica fina, canto superior esquerdo com encaixe hexagonal vazio para ícone e metade direita limpa para nome e porcentagem em HTML. Sem ícone, texto ou valor. Borda neutra para recoloração vermelha, roxa ou verde via CSS. Fundo externo transparente.
```

## ETAPA 32 — Slot de recompensa

```text
Gere um único asset chamado prv_recompensa_slot.png, 160×160.

Slot octogonal de recompensa, moldura tecnológica fina, centro preto transparente, cantos chanfrados, duas pequenas placas laterais e brilho azul discreto. Sem item dentro, sem letra e sem número. Base neutra azul aço para recoloração por raridade. Fundo transparente.
```

## ETAPA 33 — Moldura de conclusão

```text
Gere um único asset chamado prv_conclusao_frame_9slice.png, 1024×224.

Moldura horizontal premium de recompensa de conclusão preparada para 9-slice. Metal preto, borda dourado âmbar, circuitos dourados finos nos cantos, encaixe grande vazio à esquerda para baú e área limpa à direita para texto em HTML. Prestigiosa e tecnológica, sem aparência medieval. Sem baú, letras ou números. Fundo externo transparente.
```

## ETAPA 34 — Baú da torre

```text
Gere um único asset chamado prv_bau_torre.png, 256×256.

Baú de recompensa da Torre Eterna: caixa sci-fi cúbica robusta, metal negro e bronze dourado, cantos reforçados, fechadura hexagonal e fissuras internas emitindo luz âmbar. Vista isométrica suave de três quartos. Sem moedas, texto, número ou moldura externa. Fundo transparente.
```

## ETAPAS 35–36 — Tentativas

```text
Gere um único asset chamado prv_tentativa_ESTADO.png, 80×80.

Indicador octogonal pequeno de tentativa, moldura metálica ciano e centro simples. ESTADO_VISUAL. Vista frontal, sem número ou texto, fundo transparente. A forma precisa ser idêntica à outra versão desta família.
```

Substituições:

- `ESTADO = vazia`; `ESTADO_VISUAL = interior preto e energia apagada`.
- `ESTADO = cheia`; `ESTADO_VISUAL = núcleo azul-ciano luminoso com brilho curto`.

---

# FASE 5 — Barra superior e utilidades

## ETAPA 37 — Botão hexagonal

```text
Gere um único asset chamado prv_botao_hexagonal.png, 160×112.

Botão hexagonal horizontal de console espacial, metal negro, seis lados chanfrados, linha ciano fina e centro escuro vazio para receber ícone separado. Vista frontal, sem ícone, texto ou número. Fundo transparente.
```

## ETAPAS 38–41 — Recursos do topo

Envie individualmente:

```text
Gere um único ícone chamado NOME_DO_ARQUIVO, 96×96, fundo transparente, sem moldura, letras ou números. DESCRICAO. Mantenha o mesmo acabamento, iluminação e escala visual dos ícones anteriores.
```

Substituições:

- `prv_icone_cristal_azul.png`: cristal espacial azul-ciano alto e facetado, losango alongado, núcleo branco luminoso e facetas azul profundo.
- `prv_icone_cristal_vermelho.png`: cristal demoníaco vermelho carmesim, forma agressiva com três pontas inferiores, núcleo rubro e facetas negras.
- `prv_icone_cubo_roxo_a.png`: cubo alienígena roxo aberto, vista isométrica, faces segmentadas, núcleo violeta e moldura metálica escura.
- `prv_icone_cubo_roxo_b.png`: contêiner cúbico alienígena roxo selado, tampa hexagonal, quinas violeta luminosas e corpo púrpura escuro.

## ETAPAS 42–45 — Utilidades

```text
Gere um único asset chamado NOME_DO_ARQUIVO, 96×96.

Ícone utilitário sci-fi minimalista: SIMBOLO. Traço geométrico azul gelo/ciano, legível quando reduzido para 20 pixels, sem moldura externa, letras adicionais ou números. Fundo transparente. Manter a mesma espessura de traço e escala visual dos outros utilitários.
```

Substituições:

- `prv_icone_info.png`: símbolo de informação formado por ponto e haste geométrica.
- `prv_icone_ajuda.png`: ponto de interrogação angular e geométrico.
- `prv_icone_fechar.png`: X angular formado por quatro pequenas lâminas.
- `prv_icone_relogio.png`: relógio circular tecnológico com dois ponteiros.

---

# FASE 6 — Modificadores

Envie o modelo abaixo 11 vezes. Gere um ícone por mensagem.

```text
Gere um único ícone de modificador chamado NOME_DO_ARQUIVO, 128×128. Fundo transparente, sem cartão, moldura externa, letras ou números. DESCRICAO. O símbolo deve permanecer legível em 32 pixels e manter o mesmo volume, escala e iluminação dos modificadores já aprovados.
```

## ETAPAS 46–56

- `prv_mod_veloz.png`: três setas aerodinâmicas avançando para a direita com rastros ciano e sensação de aceleração.
- `prv_mod_blindado.png`: escudo hexagonal roxo robusto com três placas sobrepostas e núcleo violeta.
- `prv_mod_regenerador.png`: cruz tecnológica verde formada por quatro módulos, cercada por pulso circular de energia.
- `prv_mod_enxame.png`: nave-inseto central cercada por cinco drones verdes menores em composição radial.
- `prv_mod_refletor.png`: projétil ciano atingindo escudo espelhado e retornando como seta vermelha.
- `prv_mod_fragmentador.png`: núcleo cristalino roxo se dividindo em duas metades idênticas.
- `prv_mod_pressa.png`: cronômetro futurista âmbar com arco vermelho incompleto e ponteiro próximo do limite.
- `prv_mod_sufocante.png`: gerador de escudo azul cercado por anel preto interrompido, energia sendo drenada.
- `prv_mod_colosso.png`: couraça colossal vermelha frontal, ombros largos, núcleo pesado e placas laterais.
- `prv_mod_furia.png`: núcleo vermelho-laranja supercarregado com três garras e ondas pulsantes.
- `prv_mod_espelho.png`: dois cristais idênticos azul e roxo frente a frente, cores refletindo uma na outra.

---

# FASE 7 — Recompensas

Use o modelo abaixo oito vezes:

```text
Gere um único ícone de recompensa chamado NOME_DO_ARQUIVO, 128×128. Fundo transparente, sem slot externo, letras ou números. DESCRICAO. Deve ser legível em 40 pixels e manter o mesmo acabamento dos ícones de recompensa anteriores.
```

## ETAPAS 57–64

- `prv_rec_xp.png`: emblema hexagonal ciano com estrela abstrata e três raios ascendentes; não escrever XP.
- `prv_rec_sucata.png`: conjunto de placas metálicas, engrenagem quebrada e parafuso em aço escuro com reflexos âmbar.
- `prv_rec_nucleo.png`: núcleo energético roxo facetado flutuando entre duas garras tecnológicas.
- `prv_rec_cristal.png`: conjunto triangular de três cristais vermelhos altos, facetas rubras e núcleo branco.
- `prv_rec_medalha.png`: medalha espacial dourada com aro hexagonal, cristal azul central e duas fitas metálicas curtas.
- `prv_rec_item.png`: cápsula de equipamento azul, cilindro horizontal, tampas metálicas e janela ciano.
- `prv_rec_material.png`: cartucho industrial âmbar, corpo cilíndrico, anéis negros e janela laranja.
- `prv_rec_exclusivo.png`: relíquia alienígena branca e violeta flutuando dentro de halo hexagonal quebrado.

---

# FASE 8 — Retratos dos chefes

Comece gerando um retrato de teste. Se o resultado for aprovado, repita com os demais arquétipos e camadas.

## ETAPA 65 — Retrato de teste

```text
Gere um retrato panorâmico de chefe chamado prv_chefe_fortaleza_sucata.webp, 1024×512.

Chefe espacial do arquétipo fortaleza pertencente ao Cinturão de Sucata: entidade ou nave colossal frontal, ombros e couraça muito largos, placas grossas sobrepostas, núcleo protegido e canhões pesados embutidos. Metal gasto, aço, ferrugem e luzes azul acinzentadas. Postura imóvel e dominante, sensação de vida e escudo extremos. Chefe centralizado um pouco à direita, ocupando aproximadamente 65% da altura. Fundo panorâmico escuro com destroços discretos. Sem moldura, texto, número ou interface.
```

## ETAPAS 66–72 — Outros arquétipos

Use este modelo:

```text
Gere um retrato panorâmico de chefe chamado NOME_DO_ARQUIVO, 1024×512.

Chefe espacial do arquétipo ARQUETIPO: DESCRICAO_DO_ARQUETIPO. Use a paleta PALETA_DA_CAMADA. Chefe centralizado um pouco à direita e ocupando aproximadamente 65% da altura. Fundo panorâmico escuro coerente com a camada, partículas discretas. Sem moldura, texto, número ou interface.
```

Arquétipos:

- `artilheiro`: plataforma alienígena alongada com vários canhões de precisão, lentes, trilhos magnéticos e feixes de mira discretos.
- `investida`: nave predadora em forma de lança, proa afiada, asas recolhidas e motores intensos, prestes a avançar.
- `invocador`: nave-mãe com cavidades abertas, pequenos drones emergindo, núcleo central e braços controlando o enxame.
- `orbital`: núcleo alienígena cercado por dois ou três anéis mecânicos, satélites armados e trilhas circulares.
- `cacador`: caça mecânico predatório com garras, olhos luminosos e motores vetoriais, aparência rápida e agressiva.
- `dispersor`: nave larga em leque, muitos emissores distribuídos pelas asas e energia acumulada em arco.
- `espectro`: entidade parcialmente translúcida, partes desaparecendo em distorção, escudo luminoso e duplicatas residuais.

Paletas das dez camadas:

- Sucata: aço, ferrugem e azul acinzentado.
- Berçário: verde tóxico e biotecnologia.
- Gelo: azul gelo, branco e névoa.
- Tempestade: amarelo elétrico e azul.
- Forja: vermelho, laranja e carvão.
- Vazio: violeta, preto e distorção espacial.
- Praga: verde ácido, cinza e matéria orgânica.
- Fenda: magenta, roxo e espaço rachado.
- Arquitetos: vermelho escuro, pedra tecnológica e aço.
- Ápice: dourado, branco, violeta e energia primordial.

Para produzir os 100 chefes, repita o modelo usando nome, característica, arquétipo e camada encontrados em `src/data/provacao-chefes.ts`. O nome deve orientar o desenho, mas nunca deve aparecer escrito na imagem.

---

# Prompt de correção

Quando o resultado estiver quase certo, envie:

```text
Corrija o asset anterior sem mudar sua identidade visual. Preserve exatamente a composição, proporção, cores, espessura das bordas e estilo já aprovados. Faça somente estas correções:

1. remova completamente qualquer texto, letra, número, logotipo ou watermark;
2. entregue fundo realmente transparente em PNG RGBA;
3. centralize a peça e restaure margem transparente mínima de 8%;
4. mantenha todo o asset dentro do canvas, sem cortes;
5. reduza bloom e brilho externo para não contaminar assets vizinhos;
6. deixe bordas nítidas e perfeitamente frontais;
7. para 9-slice, torne o centro uniforme e as bordas retas.

Não redesenhe nem acrescente elementos. Gere somente o asset corrigido.
```

# Checklist antes de avançar

Depois de cada geração, confirme:

- [ ] O fundo é realmente transparente?
- [ ] Não existe texto ou número dentro da imagem?
- [ ] A peça está inteira e centralizada?
- [ ] O tamanho e a proporção correspondem ao prompt?
- [ ] A iluminação combina com os assets anteriores?
- [ ] O asset 9-slice tem centro uniforme?
- [ ] O nome do arquivo foi aplicado corretamente após baixar?


# Prompts de assets — tela da Provação

Referência visual: `C:\Users\aguia\Downloads\provacao.png` (1536×1024).

## Regras para todas as gerações

Use este prefixo antes de **cada** prompt específico:

> Interface sci-fi dark para jogo espacial chamado Órbita Zero, vista frontal ortográfica, acabamento premium de videogame, tecnologia alienígena militar, metal negro azulado, placas chanfradas, microdetalhes mecânicos, linhas finas de energia ciano, pequenos acentos brancos e azul profundo, contraste alto, iluminação controlada, bordas nítidas, simetria precisa, sem perspectiva de mockup. Um único asset isolado, centralizado, fundo totalmente transparente, PNG RGBA, sem texto, sem letras, sem números, sem logotipo, sem watermark, sem personagens humanos, sem elementos cortados. Preserve margem transparente mínima de 8% em torno da peça. Design compatível com a tela de referência da Torre Eterna.

Use este negativo em todas:

> Não gerar tela completa, HUD montada, cenário atrás da peça, tipografia, palavras, números, ícones extras, brilho excessivo, bloom que ultrapasse muito a borda, cantos arredondados genéricos de aplicativo mobile, plástico, cartoon, steampunk, fantasia medieval, ouro dominante, perspectiva inclinada, fotografia, ruído, blur ou baixa resolução.

As dimensões abaixo são de **arquivo-fonte em 2×**. O jogo deve exibi-las com metade desse tamanho. Molduras marcadas como `9-slice` precisam ter centro uniforme e bordas retas para serem recortadas sem deformação.

## 1. Estrutura da tela

### `prv_moldura_externa.png` — moldura do modal, 2048×1366

> Moldura externa retangular muito larga para um painel sci-fi de tela cheia, proporção 3:2, somente a borda e cantos, interior completamente transparente. Cantos tecnológicos recortados em ângulos de 45 graus, duas linhas paralelas extremamente finas em ciano elétrico, placas de metal negro azulado, pequenos encaixes e interrupções assimétricas ao longo das bordas, quatro cantos mais detalhados, espessura visual entre 18 e 28 pixels no arquivo final. Centro vazio. A moldura deve parecer estrutural e sofisticada, não pesada, exatamente como um console de nave de alto nível.

### `prv_barra_superior_9slice.png` — barra superior, 1536×128

> Barra horizontal sci-fi longa, preparada para 9-slice, fundo quase preto com leve gradiente azul, borda superior e inferior de metal negro, linha ciano muito fina acompanhando a silhueta, cantos chanfrados, área central limpa e homogênea para receber título e botões via HTML. Sem divisórias fixas, sem ícones. As extremidades podem ter pequenos trilhos e encaixes mecânicos; o centro deve permanecer escuro e legível.

### `prv_painel_9slice.png` — painel genérico, 512×512

> Moldura de painel retangular para 9-slice, metal grafite azulado, fundo interno quase preto com leve transparência aparente, borda de 2 níveis, cantos chanfrados, filete ciano discreto somente na borda superior esquerda e inferior direita, pequenos parafusos ou encaixes técnicos nos quatro cantos. Centro liso e uniforme para conteúdo variável. Sem cabeçalho embutido e sem texto.

### `prv_titulo_secao_9slice.png` — cabeçalho de seção, 768×80

> Placa horizontal fina para título de seção, preparada para 9-slice, fundo preto azulado, borda superior ciano, pequeno recorte diagonal nas duas pontas, detalhe de circuito no canto direito, espaço central totalmente limpo para texto. Visual leve, não deve parecer um botão.

### `prv_rodape_info_9slice.png` — rodapé informativo, 1536×72

> Faixa horizontal baixa de informação para a base do modal, preparada para 9-slice, metal escuro quase preto, linhas ciano finas nas bordas, canto esquerdo com encaixe para um ícone circular de informação, centro amplo e limpo para uma frase. Sem ícone e sem texto no próprio asset.

### `prv_torre_fundo.webp` — estrutura central, 1024×1536

> Interior vertical de uma torre espacial colossal visto perfeitamente de frente, arquitetura alienígena industrial em metal negro e azul petróleo, duas paredes laterais simétricas repletas de placas, trilhos, condutos e pequenas luzes ciano. O centro deve formar um poço vertical escuro e vazio onde cartões horizontais de pisos serão sobrepostos. Profundidade sugerida por parallax e sombras, mas sem perspectiva inclinada. Fundo espacial muito discreto aparecendo apenas por fendas laterais. Sem cartões, sem chefes, sem números, sem interface e sem texto. Imagem tileável verticalmente nas bordas superior e inferior.

## 2. Pisos da torre

### `prv_piso_base_9slice.png` — cartão neutro, 1024×224

> Cartão horizontal largo de piso da torre, preparado para 9-slice, metal negro azulado, cantos chanfrados, painel interno escuro com leve textura de circuito, trilhos mecânicos superior e inferior, sombra interna. Lado esquerdo com espaço vazio para número, centro grande vazio para retrato do chefe e lado direito com encaixe octogonal vazio para status. Borda azul aço muito discreta, sem brilho de seleção. Sem número, retrato ou ícone.

### `prv_piso_selecionado_overlay.png` — seleção ciano, 1024×224

> Apenas uma moldura luminosa para sobrepor ao cartão de piso selecionado, interior transparente. Contorno duplo ciano elétrico, quatro cantos reforçados, pequenos pulsos de energia e luz branca concentrada nos chanfros, brilho externo curto e controlado. Deve comunicar foco atual sem esconder o retrato abaixo. Sem fundo sólido, sem texto e sem ícones.

### `prv_piso_concluido_overlay.png` — piso vencido, 1024×224

> Overlay de estado concluído para o cartão de piso, interior quase todo transparente. Filete verde esmeralda discreto, leve vinheta verde nas laterais, pequenos circuitos ativos nos cantos e uma linha de energia contínua na borda inferior. Não incluir símbolo de check; ele será um asset separado. Sem texto.

### `prv_piso_chefe_overlay.png` — piso perigoso, 1024×224

> Overlay de piso de chefe, interior transparente, moldura vermelho carmesim escuro com energia rubra nas rachaduras, cantos mais agressivos e pontiagudos que os demais cartões, pequenos alertas triangulares abstratos sem letras. Brilho vermelho concentrado e curto, atmosfera ameaçadora, sem caveira embutida, sem texto.

### `prv_piso_bloqueado_overlay.png` — piso travado, 1024×224

> Overlay de piso bloqueado, interior translúcido preto azulado com vinheta forte, bordas desativadas em azul acinzentado, circuitos apagados e duas placas metálicas discretas cruzando os cantos. Deve deixar o cartão abaixo reconhecível porém claramente inacessível. Não incluir cadeado, número ou texto.

### `prv_selo_octogonal.png` — encaixe de status, 128×128

> Selo octogonal sci-fi vazio, vista frontal, moldura dupla de metal negro, oito lados regulares, centro transparente, pequenos canais de energia ao redor. Criar versão base em azul aço neutro; a cor será aplicada por CSS. Sem símbolo interno.

### `prv_icone_check.png` — concluído, 96×96

> Símbolo de check angular futurista, verde esmeralda intenso, formado por dois segmentos metálicos iluminados, legível em 24 pixels, centralizado, fundo transparente, sem círculo ou moldura externa.

### `prv_icone_cadeado.png` — bloqueado, 96×96

> Cadeado tecnológico robusto em metal grafite, arco espesso, núcleo central escuro e pequena luz azul apagada, perfeitamente frontal, leitura imediata em tamanho pequeno, fundo transparente, sem moldura externa.

### `prv_icone_chefe.png` — chefe, 96×96

> Caveira alienígena mecânica estilizada, simétrica, olhos vermelhos, mandíbula angular e pequenos chifres tecnológicos, silhueta simples e forte para leitura em 24 pixels, fundo transparente, sem moldura externa.

### `prv_seta_esquerda.png`, `prv_seta_direita.png`, `prv_seta_baixo.png` — navegação, 96×128

> Seta triangular holográfica de navegação, ciano elétrico, contorno duplo, centro azul translúcido, pequena base mecânica, vista frontal, fundo transparente. Gerar uma seta apontando para a direção solicitada; as três versões devem compartilhar exatamente a mesma forma, proporção e iluminação.

## 3. Coluna esquerda

### `prv_alvo_torre.png` — símbolo da Provação, 128×128

> Ícone circular de alvo tecnológico para representar a Torre Eterna: três anéis concêntricos interrompidos, retículo central, quatro marcas cardeais, pequenos segmentos orbitais, ciano brilhante sobre metal negro, simétrico, legível em 32 pixels, fundo transparente.

### `prv_progresso_moldura_9slice.png` — quadro de estatísticas, 640×384

> Moldura interna de estatísticas dividida visualmente em quatro quadrantes, metal escuro e linhas azul petróleo muito finas, centro transparente/escuro, cantos chanfrados. Uma divisória vertical e uma horizontal com pequeno nó ciano no cruzamento. Sem números, sem títulos e sem ícones.

### `prv_linha_marcos.png` — trilha vertical, 96×512

> Trilha vertical de progresso futurista: um condutor fino ciano percorrendo o centro, quatro pontos de conexão igualmente espaçados, pequenos trechos apagados abaixo do progresso atual, fundo transparente. Sem números e sem recompensas.

### `prv_marco_feito.png`, `prv_marco_atual.png`, `prv_marco_futuro.png` — nós, 64×64

> Nó circular de trilha de progresso, vista frontal, anel tecnológico duplo, centro simples, fundo transparente. Para `feito`, energia verde e pequeno check; para `atual`, energia ciano forte com núcleo azul; para `futuro`, metal azul acinzentado sem iluminação. Manter forma e escala idênticas entre os três estados.

### `prv_botao_lateral_9slice.png` — Loja/Ranking, 768×104

> Botão horizontal secundário para 9-slice, metal negro azulado, cantos chanfrados, borda ciano discreta, faixa interna escura, encaixe vazio para ícone à esquerda e ampla área vazia para texto. Estado neutro, sem brilho forte, sem ícone e sem letras.

### `prv_icone_loja.png` — loja, 96×96

> Carrinho de suprimentos espacial minimalista, corpo angular, duas rodas pequenas, ciano claro e metal azul, silhueta forte, fundo transparente, sem moldura.

### `prv_icone_ranking.png` — ranking, 96×96

> Troféu futurista minimalista, taça angular com duas alças e base pequena, azul gelo com detalhes ciano, vista frontal, fundo transparente, sem moldura.

## 4. Coluna direita

### `prv_chefe_frame_9slice.png` — destaque do chefe, 1024×416

> Moldura larga de cartão de chefe, preparada para 9-slice, metal negro, cantos agressivos, borda vermelha carmesim com linhas de energia e rachaduras tecnológicas discretas. Área direita ampla e vazia para retrato, área esquerda escura para ícone e texto em HTML. Sem retrato, caveira, letras ou medidor.

### `prv_poder_barra_base.png` — poder recomendado, 512×48

> Medidor horizontal segmentado futurista, seis segmentos trapezoidais alinhados, estrutura de metal preto, cinco segmentos com preenchimento âmbar luminoso e um vazio grafite apenas como demonstração de forma. Fundo transparente, sem números, sem rótulo. Gerar também uma versão totalmente vazia para preenchimento via máscara/CSS.

### `prv_mod_card_9slice.png` — cartão de modificador, 384×224

> Cartão compacto vertical de modificador, preparado para 9-slice, fundo preto azulado, borda metálica fina, canto superior esquerdo com encaixe hexagonal vazio para ícone, metade direita limpa para nome e porcentagem em HTML. Sem ícone, texto ou valor. A borda deve aceitar recoloração vermelha, roxa ou verde por CSS.

### `prv_recompensa_slot.png` — slot de recompensa, 160×160

> Slot octogonal de recompensa, moldura tecnológica fina, centro preto transparente, cantos chanfrados, duas pequenas placas laterais e brilho azul discreto. Sem item dentro. Gerar uma base neutra azul aço; raridade e elemento serão aplicados por cor no CSS.

### `prv_conclusao_frame_9slice.png` — recompensa de conclusão, 1024×224

> Moldura horizontal premium de recompensa de conclusão, preparada para 9-slice, metal preto, borda dourado âmbar, circuitos dourados finos nos cantos, encaixe grande vazio à esquerda para um baú e área limpa à direita para texto. Prestigiosa sem parecer medieval, sem baú e sem letras.

### `prv_bau_torre.png` — baú épico, 256×256

> Baú de recompensa da Torre Eterna, caixa sci-fi cúbica robusta, metal negro e bronze dourado, cantos reforçados, fechadura hexagonal, fissuras internas emitindo luz âmbar, vista isométrica suave de três quartos, fundo transparente, sem moedas e sem texto.

### `prv_tentativa_vazia.png`, `prv_tentativa_cheia.png` — pips, 80×80

> Indicador octogonal pequeno de tentativa, moldura metálica ciano, centro transparente. Versão vazia com interior preto e energia apagada; versão cheia com núcleo azul-ciano luminoso e brilho curto. Forma idêntica entre estados, sem número.

### `prv_botao_primario_9slice.png` — iniciar desafio, 768×144

> Botão primário horizontal grande para 9-slice, metal negro azulado, borda dupla ciano elétrica, cantos cortados em 45 graus, centro escuro uniforme para texto HTML, pequenos pulsos de energia nos quatro cantos, brilho externo curto. Sem texto, sem ícone e sem gradiente claro no centro.

## 5. Barra superior e utilidades

### `prv_botao_hexagonal.png` — base dos atalhos, 160×112

> Botão hexagonal horizontal de console espacial, metal negro, seis lados chanfrados, linha ciano fina, centro vazio e transparente/escuro para receber ícone separado. Vista frontal, sem ícone e sem texto.

### `prv_icone_cristal_azul.png` — cristal azul, 96×96

> Cristal espacial azul-ciano alto e facetado, formato de losango alongado, núcleo branco luminoso, facetas azul profundo, contorno tecnológico muito fino, fundo transparente.

### `prv_icone_cristal_vermelho.png` — cristal vermelho, 96×96

> Cristal demoníaco vermelho carmesim, formato agressivo com três pontas inferiores, núcleo rubro luminoso e facetas negras, simétrico, fundo transparente.

### `prv_icone_cubo_roxo_a.png` — cubo roxo aberto, 96×96

> Cubo de tecnologia alienígena roxo, vista isométrica, faces segmentadas, núcleo violeta brilhante, moldura metálica escura e pequenas runas geométricas abstratas sem letras, fundo transparente.

### `prv_icone_cubo_roxo_b.png` — cubo roxo selado, 96×96

> Contêiner cúbico alienígena roxo selado, vista isométrica, tampa marcada por hexágono, quinas violeta luminosas, corpo púrpura escuro, fundo transparente. Deve ser visualmente distinto do cubo aberto, mas da mesma família.

### `prv_icone_info.png`, `prv_icone_ajuda.png`, `prv_icone_fechar.png`, `prv_icone_relogio.png` — utilidades, 96×96

> Ícone utilitário sci-fi minimalista, traço geométrico azul gelo/ciano, legível em 20 pixels, fundo transparente e sem moldura externa. Gerar respectivamente: letra “i” abstrata como ponto e haste sem tipografia decorativa; ponto de interrogação geométrico; X angular de quatro lâminas; relógio circular com dois ponteiros. Manter a mesma espessura de traço e escala visual nas quatro versões.

## 6. Ícones dos 11 modificadores reais

Todos em 128×128, fundo transparente, símbolo central sem cartão ou moldura externa.

### `prv_mod_veloz.png`

> Três setas aerodinâmicas avançando para a direita com rastros de energia ciano, sensação de aceleração, metal azul, composição diagonal limpa.

### `prv_mod_blindado.png`

> Escudo hexagonal roxo robusto com três placas sobrepostas e núcleo violeta, simétrico, sensação de resistência elemental.

### `prv_mod_regenerador.png`

> Cruz médica tecnológica verde formada por quatro módulos metálicos, pulso circular de energia ao redor, símbolo de recuperação contínua.

### `prv_mod_enxame.png`

> Uma nave-inseto central cercada por cinco drones menores verdes, composição radial, silhuetas claras e separadas.

### `prv_mod_refletor.png`

> Projétil ciano atingindo um escudo espelhado e retornando como seta vermelha, leitura clara de reflexão, composição simétrica.

### `prv_mod_fragmentador.png`

> Núcleo cristalino roxo se partindo em duas metades idênticas, estilhaços controlados e linha de divisão luminosa.

### `prv_mod_pressa.png`

> Cronômetro futurista âmbar com arco vermelho incompleto e ponteiro próximo do limite, sensação urgente, sem números.

### `prv_mod_sufocante.png`

> Gerador de escudo azul envolvido por um anel preto interrompido e símbolo de bloqueio angular, energia sendo drenada, sem usar texto.

### `prv_mod_colosso.png`

> Silhueta frontal de couraça colossal vermelha, ombros largos, núcleo pesado, duas placas laterais, sensação de enorme vida e dano.

### `prv_mod_furia.png`

> Núcleo vermelho-laranja supercarregado com três garras de energia e ondas pulsantes, agressivo, sensação de múltiplos bônus simultâneos.

### `prv_mod_espelho.png`

> Dois cristais idênticos azul e roxo face a face, separados por eixo brilhante, cores refletindo uma na outra, símbolo de copiar elemento.

## 7. Ícones de recompensa

Todos em 128×128, fundo transparente, sem slot externo.

### `prv_rec_xp.png`

> Emblema hexagonal ciano com estrela de progressão abstrata no centro, três raios ascendentes, aparência de experiência, sem letras “XP”.

### `prv_rec_sucata.png`

> Pequeno conjunto de placas metálicas, engrenagem quebrada e parafuso, aço escuro com reflexos âmbar, leitura de sucata espacial.

### `prv_rec_nucleo.png`

> Núcleo energético roxo facetado, cristal central flutuando entre duas garras tecnológicas, brilho violeta controlado.

### `prv_rec_cristal.png`

> Conjunto de três cristais vermelhos altos, facetas rubras e núcleo branco, composição triangular, fundo transparente.

### `prv_rec_medalha.png`

> Medalha espacial dourada com aro hexagonal, pequeno cristal azul no centro e duas fitas metálicas curtas, prestígio militar sci-fi.

### `prv_rec_item.png`

> Cápsula de equipamento azul fechada, formato cilíndrico horizontal, tampas metálicas, janela ciano luminosa, sem símbolo de categoria.

### `prv_rec_material.png`

> Cartucho industrial âmbar com corpo cilíndrico, anéis negros e janela laranja, aparência de material raro refinado.

### `prv_rec_exclusivo.png`

> Relíquia alienígena branca e violeta, pequeno artefato flutuante com halo hexagonal quebrado, aparência única e extremamente rara.

## 8. Retratos dos chefes

Os retratos não devem trazer moldura nem texto. Gerar em 1024×512, composição panorâmica, chefe centralizado um pouco à direita, busto ou nave ocupando 65% da altura, fundo escuro da camada correspondente. Criar variações com as dez paletas das camadas reais:

1. Cinturão de Sucata — aço, ferrugem e azul acinzentado.
2. Berçário Verdejante — verde tóxico e biotecnologia.
3. Mortalha de Gelo — azul gelo, branco e névoa.
4. Tempestade Perpétua — amarelo elétrico e azul.
5. Forja Extinta — vermelho, laranja e carvão.
6. Vazio Silencioso — violeta, preto e distorção.
7. Praga Antiga — verde ácido, cinza e matéria orgânica.
8. Fenda Colapsante — magenta, roxo e espaço rachado.
9. Ruína dos Arquitetos — vermelho escuro, pedra tecnológica e aço.
10. Ápice — dourado, branco, violeta e energia primordial.

### `prv_chefe_fortaleza_[camada].webp`

> Chefe espacial do arquétipo fortaleza: entidade ou nave colossal frontal, ombros/couraça muito largos, placas grossas sobrepostas, núcleo protegido, canhões pesados embutidos, postura imóvel e dominante, sensação de vida e escudo extremos. Fundo panorâmico escuro da camada indicada, partículas discretas, sem moldura.

### `prv_chefe_artilheiro_[camada].webp`

> Chefe espacial do arquétipo artilheiro: plataforma de tiro alienígena alongada, múltiplos canhões de precisão, lentes e trilhos magnéticos, silhueta fina e ameaçadora, posicionado à distância, feixes de mira discretos. Fundo panorâmico da camada indicada, sem moldura.

### `prv_chefe_investida_[camada].webp`

> Chefe espacial do arquétipo investida: nave predadora em forma de lança, proa afiada, asas recolhidas, motores intensos, placas inclinadas para velocidade, sensação de estar prestes a avançar diretamente contra o jogador. Fundo da camada indicada, sem moldura.

### `prv_chefe_invocador_[camada].webp`

> Chefe espacial do arquétipo invocador: nave-mãe ou criatura mecânica com cavidades abertas e pequenos drones emergindo, núcleo central brilhante, braços ou antenas controlando o enxame, silhueta complexa mas legível. Fundo da camada indicada, sem moldura.

### `prv_chefe_orbital_[camada].webp`

> Chefe espacial do arquétipo orbital: núcleo alienígena central cercado por dois ou três anéis mecânicos giratórios, satélites armados e trilhas circulares de energia, composição perfeitamente radial. Fundo da camada indicada, sem moldura.

### `prv_chefe_cacador_[camada].webp`

> Chefe espacial do arquétipo caçador: criatura ou caça mecânico ágil, cabeça/proa predatória, garras laterais, olhos luminosos, motores vetoriais, postura inclinada para perseguição, aparência rápida e frágil. Fundo da camada indicada, sem moldura.

### `prv_chefe_dispersor_[camada].webp`

> Chefe espacial do arquétipo dispersor: nave larga em forma de leque, muitos emissores distribuídos pelas asas, bocas de canhão apontando em vários ângulos, energia acumulada em arco, comunica cobertura de área. Fundo da camada indicada, sem moldura.

### `prv_chefe_espectro_[camada].webp`

> Chefe espacial do arquétipo espectro: nave ou entidade parcialmente translúcida, partes desaparecendo em distorção espacial, escudo luminoso forte envolvendo núcleo frágil, duplicatas residuais e bordas fantasmagóricas. Fundo da camada indicada, sem moldura.

## 9. Regras de exportação e montagem

- Texto, números, porcentagens, nomes de chefes e títulos: sempre DOM/CSS.
- Molduras: PNG RGBA; fundos e retratos: WebP de alta qualidade.
- Ícones: manter área útil semelhante e exportar também versão 64×64.
- Não gerar sombras retangulares opacas; a transparência deve ser real.
- Gerar estados `normal`, `hover`, `pressed` e `disabled` dos botões a partir da mesma imagem-base, mudando apenas intensidade da energia e contraste.
- A moldura selecionada, os estados de piso e os ícones devem ser camadas independentes. Isso permite combinar `chefe + concluído`, `marco + selecionado` e outros estados sem duplicar imagens.
- Para os 100 chefes atuais, usar o prompt do arquétipo correspondente e substituir a criatura, a paleta da camada e a característica descrita em `src/data/provacao-chefes.ts`.

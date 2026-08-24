# Bateria de confrontos dos cascos

Gerada com 63 execuções no combate real: três cenários × sete arquétipos × três sementes.

Todas as execuções usam as hitboxes e escalas canônicas versionadas. As
sementes reinicializam tanto o RNG do combate quanto o piloto, portanto uma
mesma combinação de casco, cenário e semente é repetível no Laboratório.

## Elite

Um alvo resistente para medir dano sustentado, precisão e tempo de execução.

| Arquétipo | Casco | DPS mediano | Impactos/projétil | Abates | Dano recebido | Mortes |
|---|---|---:|---:|---:|---:|---:|
| Interceptador | Centurião Atlas | 47.6 | 27.1% | 0 | 1224 | 4 |
| Assalto | Aríete Vesper | 46.4 | 27.8% | 0 | 1054 | 2 |
| Artilharia | Peregrina do Sol | 78.3 | 38.6% | 1 | 714 | 1 |
| Baluarte | Bastião 8 | 44.9 | 25.6% | 0 | 1156 | 1 |
| Suporte | Lince Polar | 65.8 | 40.3% | 0 | 850 | 1 |
| Saturação | Asa Carmim | 36.1 | 19.1% | 0 | 1020 | 3 |
| Duelista | Lâmina Kheiron | 66.7 | 29.2% | 0 | 782 | 2 |

## Enxame

Oito alvos frágeis para medir cobertura, troca de alvo e excesso de dano.

| Arquétipo | Casco | DPS mediano | Impactos/projétil | Abates | Dano recebido | Mortes |
|---|---|---:|---:|---:|---:|---:|
| Interceptador | Centurião Atlas | 80.5 | 46.4% | 26 | 845 | 3 |
| Assalto | Aríete Vesper | 75.4 | 46.9% | 21 | 869 | 1 |
| Artilharia | Peregrina do Sol | 88.7 | 49.3% | 31 | 533 | 1 |
| Baluarte | Bastião 8 | 94.5 | 55.1% | 29 | 811 | 0 |
| Suporte | Lince Polar | 73.9 | 46.9% | 23 | 835 | 1 |
| Saturação | Asa Carmim | 103.3 | 56.1% | 37 | 682 | 2 |
| Duelista | Lâmina Kheiron | 102 | 54% | 39 | 811 | 3 |

## Cerco

Quatro emissores resistentes e muitos projéteis para medir sobrevivência por 120 segundos.

| Arquétipo | Casco | DPS mediano | Impactos/projétil | Abates | Dano recebido | Mortes |
|---|---|---:|---:|---:|---:|---:|
| Interceptador | Centurião Atlas | 49.4 | 34.4% | 0 | 4320 | 16 |
| Assalto | Aríete Vesper | 46.5 | 31.7% | 0 | 4788 | 10 |
| Artilharia | Peregrina do Sol | 57.5 | 32.9% | 0 | 3006 | 8 |
| Baluarte | Bastião 8 | 61.2 | 36.5% | 0 | 5688 | 6 |
| Suporte | Lince Polar | 49 | 33.2% | 0 | 3924 | 8 |
| Saturação | Asa Carmim | 53 | 34% | 0 | 4050 | 15 |
| Duelista | Lâmina Kheiron | 68 | 35.2% | 0 | 3618 | 14 |

## Decisões tomadas

- Artilharia caiu de 62 para 52 de dano-base, de 4 para 3 de perfuração e de
  40 para 32 de explosão. Continua líder contra o Elite, mas deixou de dominar
  todas as situações por uma margem desproporcional.
- Saturação subiu de 14 para 16 de dano e de 10 para 18 de explosão. Passou a
  liderar o DPS do Enxame e ficou em segundo lugar em abates, dentro da função.
- Baluarte perdeu a perfuração-base e teve a explosão reduzida de 18 para 10.
  A sobrevivência continua sendo sua vantagem, não dano em área gratuito.
- Duelista passou de 2 para 1 de perfuração. Com as hitboxes definitivas já
  entregou 66,7 DPS no Elite; não recebeu o aumento genérico sugerido pela
  primeira medição, que se revelou contaminada pela calibração provisória.

## Correções no protocolo

A primeira tentativa desta bateria foi descartada: os oito inimigos do Enxame
podiam nascer sobrepostos, multiplicando artificialmente perfuração e explosão,
e o contador de DPS não incluía o dano de área. A formação agora é dispersa
pela semente e todo dano de respingo entra nas métricas. `Impactos/projétil`
pode ultrapassar 100% quando um projétil perfura ou explode em mais de um alvo;
por isso ele não é chamado de precisão simples.

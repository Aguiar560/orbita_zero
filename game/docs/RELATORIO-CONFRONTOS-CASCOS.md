# Relatório inicial de confrontos dos cascos

Medição de 24/08/2026 feita no próprio `VerticalMode`, usando os novos presets
do Laboratório. Esta é uma primeira leitura comparável, não a calibragem final.

## Protocolo de linha

- um representante por arquétipo, nível 1 e sem equipamento;
- IA equilibrada e disparo automático;
- três Lanceiros com reposição contínua;
- 600 de vida, 30 de dano, tiro mirado a 1 salva/s;
- cerca de 65 segundos simulados por casco, em velocidade 8×;
- hitbox padrão 30×30 para que tamanho ainda não contamine a comparação.

| Arquétipo | Casco | DPS | Acertos | Precisão | Abates | Recebido | Mortes |
|---|---|---:|---:|---:|---:|---:|---:|
| Interceptador | Centurião Atlas | 33 | 109/580 | 18,8% | 2 | 720 | 2 |
| Assalto | Aríete Vesper | 34 | 96/452 | 21,2% | 2 | 990 | 2 |
| Artilharia | Peregrina do Sol | 75 | 86/252 | 34,1% | 8 | 780 | 2 |
| Baluarte | Bastião 8 | 41 | 87/348 | 25,0% | 4 | 2.000 | 1 |
| Suporte | Lince Polar | 48 | 138/464 | 29,7% | 4 | 960 | 1 |
| Saturação | Asa Carmim | 36 | 264/1.172 | 22,5% | 3 | 750 | 2 |
| Duelista | Lâmina Kheiron | 29 | 27/187 | 14,4% | 3 | 1.000 | 4 |

## Leitura inicial

1. **Artilharia está muito à frente no teste de linha.** Entrega 56% mais DPS
   que o segundo colocado e quatro vezes os abates do Assalto. Perfuração e dois
   projéteis convertem bem contra três alvos.
2. **Duelista é o pior generalista.** A Agulha rápida não compensa um único
   projétil e a fragilidade agressiva. Isso ainda precisa ser repetido contra um
   único elite; buffar agora poderia apagar justamente sua especialização.
3. **Baluarte cumpre o papel defensivo.** Recebe muito dano por não evitar tiro,
   mas morre metade das vezes. A hitbox larga definitiva poderá reduzir essa
   vantagem e precisa entrar antes do ajuste final.
4. **Suporte parece o melhor generalista.** Fica em segundo no DPS, empata com o
   Baluarte em mortes e ainda traz sorte/sincronia. É o principal candidato a
   estar comprando eficiência demais pelo custo ofensivo atual.
5. **Saturação gera volume, não resultado.** Seus quatro projéteis produzem o
   maior número de acertos, mas somente 36 DPS. Precisa do cenário de enxame para
   sabermos se a cobertura de área paga a diferença.

## Próxima bateria necessária

- **Elite:** um alvo, muita vida — valida Duelista e crítico.
- **Enxame:** oito alvos frágeis — valida Saturação e explosão.
- **Cerco:** projéteis densos por 120 s — valida Baluarte, Suporte e regeneração.
- Repetir cada cenário com três sementes após as hitboxes das 29 naves serem
  salvas, então ajustar os números pelo resultado mediano.


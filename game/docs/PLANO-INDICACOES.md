# Sistema de indicações — levantamento, implementação e operação

**Data:** 12/09/2026
**Estado:** implementado, versionado e público. Migração 0022 aplicada, segredo
Pix configurado e `INDICACOES_ATIVAS="1"` desde 12/09/2026.

## Regra implementada

- vínculo direto e permanente entre a conta nova e o indicador;
- comissão financeira de **10% do valor efetivamente pago**, em centavos;
- retenção de 7 dias antes de entrar no saldo disponível;
- uma solicitação de saque por Pix a cada 7 dias;
- chave Pix cifrada no banco e mascarada para o jogador;
- bônus únicos em cristais quando indicados diretos chegam ao nível 25;
- sem comissão em cascata;
- contas antigas/teste, autovínculo e código inválido não geram benefício.

Cristais e reais usam livros-caixa diferentes. A comissão jamais entra em
`saldos.cristal`; somente os bônus dos marcos usam a carteira do jogo.

## Comissão em dinheiro

`percentual_bps = 1.000`, isto é, 10%:

```text
comissao_centavos = floor(valor_pago_centavos * 1.000 / 10.000)
```

| Pacote | Valor atual | Comissão |
|---|---:|---:|
| Faísca | R$ 4,90 | R$ 0,49 |
| Piloto | R$ 14,90 | R$ 1,49 |
| Comando | R$ 24,90 | R$ 2,49 |
| Frota | R$ 49,90 | R$ 4,99 |
| Singularidade | R$ 99,90 | R$ 9,99 |

Os exemplos `80 → 8`, `270 → 27`, `500 → 50`, `1.100 → 110` e
`2.400 → 240` calculavam cristais e foram descartados. A quantidade de cristais
do pacote não participa da comissão.

## Retenção, reembolso e dívida

Quando o Mercado Pago confirma a compra, nasce uma linha `pendente` com
`liberar_em = criada_em + 604.800`. A tela mostra o valor em retenção, mas ele
não pode ser sacado. O cron promove lotes vencidos; o gatilho transacional do
D1 compensa eventual dívida, credita a sobra e registra o movimento de forma
idempotente.

Reembolso parcial reduz a comissão na mesma proporção acumulada; o integral a
zera. Antes da liberação, apenas o pendente diminui. Depois, o sistema retira do
disponível e transforma a falta em `divida_centavos`, abatida antes de ganhos
futuros. Cristais e outros recursos do jogo nunca cobrem estorno.

Bloquear um código congela os pendentes. Reativar devolve as linhas à fila.

## Saque semanal por Pix

A Central permite cadastrar CPF, CNPJ, e-mail, telefone ou chave aleatória,
informar um valor de **no mínimo R$ 15,00** até o saldo disponível e solicitar
uma retirada a cada sete dias. Valor em retenção não conta para o piso. A tela
mostra quanto falta; o servidor repete a validação. O histórico mostra em
análise, pago ou não concluído.

O Worker valida o formato e cifra a chave com AES-GCM usando o segredo
`INDICACOES_PIX_SECRET`. O D1 guarda cifra, tipo e máscara. Cada pedido congela
uma fotografia cifrada da chave; trocar a chave depois não altera o saque.

O fluxo atual é operacional e não envia dinheiro sozinho:

```text
jogador solicita → saldo fica reservado → operador confere/faz o Pix
→ operador registra a referência → pedido vira pago
```

A documentação pública localizada do Mercado Pago confirma Pix para cobrança,
consulta autenticada, idempotência e reembolsos, mas não uma API pública geral
para pagar qualquer chave Pix. Automatizar exige contratar e homologar um
produto de payout. Nunca reutilizar o endpoint de cobrança como payout.

## Marcos de nível 25

Conta apenas o nível calculado pelo servidor em `progresso.xp`. Cada marco usa
origem idempotente na carteira de cristais.

| Indicados no nível 25 | Bônus |
|---:|---:|
| 10 | 300 cristais |
| 25 | 700 cristais |
| 50 | 1.500 cristais |
| 75 | 2.500 cristais |
| 100 | 4.000 cristais |

Os valores de 10 e 25 vieram da definição do produto. Os de 50, 75 e 100 são
a curva inicial de balanceamento e permanecem configuráveis até aprovação.

## Dados e API

| Tabela | Responsabilidade |
|---|---|
| `codigos_indicacao` | código aleatório, dono e bloqueio |
| `decisoes_indicacao` | decisão única da conta nova |
| `recompensas_indicacao` | comissão, retenção e estorno por pagamento |
| `carteiras_indicacao` | disponível, reservado e dívida em centavos |
| `movimentos_indicacao` | auditoria financeira append-only |
| `dados_pix_indicacao` | tipo, cifra e máscara da chave atual |
| `saques_indicacao` | fotografia da chave e ciclo do pedido |
| `marcos_indicacao` | bônus já concedidos |
| `acoes_indicacao_admin` | bloqueio/reativação auditável |

| Rota | Função |
|---|---|
| `POST /sessao` (`reivindicar`) | sela o código da primeira entrada |
| `GET /indicacao` | agregados, marcos e saques do próprio jogador |
| `PUT /indicacao/pix` | valida, cifra e salva a chave |
| `POST /indicacao/saque` | reserva saldo e cria o pedido semanal |
| `POST /admin/indicacoes/codigo` | bloqueia/reativa com auditoria |
| `GET /admin/indicacoes/saques` | fila autorizada com chave decifrada |
| `POST /admin/indicacoes/saque` | registra Pix pago ou devolve pedido |

Contas já conhecidas são semeadas como `sem_indicacao` na migração para impedir
atribuição retroativa.

## Tela

O perfil abre uma central dedicada com quatro saldos (disponível, retenção,
reservado e total pago), código e link, chave Pix mascarada, solicitação
semanal, barra dos cinco marcos e os últimos 12 saques. Nomes, e-mails, UUIDs,
compras e valores individuais dos indicados não são exibidos.

## Antes do lançamento

- termos do programa: elegibilidade, estorno, suspensão, prazos e contestação;
- política de privacidade: finalidade, base legal, retenção e direitos sobre os
  dados Pix e o histórico financeiro;
- revisão contábil/fiscal da natureza e documentação dos pagamentos;
- verificação de titularidade e controles antifraude/KYC proporcionais;
- alertas de concentração, contas relacionadas, compra/reembolso e saque;
- acesso mínimo à rota que decifra a chave e nenhuma chave aberta em logs;
- conciliação, backup e dupla conferência operacional;
- homologação de cobrança, retenção, reembolso, bloqueio, Pix e duas sessões;
- migração antes do Worker, segredo configurado e ativação por grupo controlado.

Fontes oficiais consultadas: Banco Central para tipos/formatação de chaves Pix,
Mercado Pago para cobrança, idempotência e reembolsos, e LGPD/ANPD para dados
pessoais. Revisão jurídica e contábil continua requisito de lançamento.

## Critérios de aceite

- [x] comissão usa centavos pagos, não cristais;
- [x] percentual, retenção e estorno têm fórmula única e testes;
- [x] saldo financeiro está separado da economia do jogo;
- [x] chave Pix é validada, cifrada e mascarada;
- [x] saque de no mínimo R$ 15,00 a cada sete dias reserva saldo atomicamente;
- [x] marcos usam nível do servidor e origem idempotente;
- [x] contas antigas/teste e autovínculo são barrados;
- [x] tela dedicada e Wiki acompanham a regra;
- [x] flag ativada publicamente após migração, segredo e deploy intermediário;
- [x] valores de 50/75/100 jogadores autorizados com a abertura pública;
- [ ] aprovar termos, privacidade, contabilidade e antifraude;
- [ ] contratar payout se o Pix for automatizado;
- [x] migração remota, conferência do esquema e saúde do Worker;
- [x] commit e push autorizados explicitamente.

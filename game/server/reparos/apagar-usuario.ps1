# Apaga TODO o rastro de um usuário nos dois bancos do jogo.
#
# ## Para que serve
#
# Recomeçar do zero como jogador novo, sem apagar o banco inteiro. Nasceu de um
# teste do login: apagar a conta no Supabase dá um id NOVO na volta, e as linhas
# do id antigo ficam órfãs — invisíveis para o jogo, mas ocupando lugar no teto
# de escritas do plano gratuito. No alfa isso vira rotina: um testador pede para
# recomeçar, ou desiste e quer os dados fora.
#
# ## O que ele NÃO faz
#
# Não apaga a conta no Supabase. Isso exige a chave `service_role`, que é o
# segredo mais forte do projeto — quem a tem lê e escreve qualquer linha de
# qualquer usuário, ignorando toda regra. Ela não deve circular por script,
# terminal nem histórico de comando. O lugar de apagar a conta é o painel:
# Authentication > Users > o usuário > Delete user.
#
# A ordem certa é: apagar a conta no painel PRIMEIRO, copiar o id de lá, e só
# então rodar isto. Ao contrário, o jogo pode gravar de novo o que você apagou,
# porque a sessão ainda está de pé no navegador.
#
# ## Uso
#
#     cd D:\bbb\game\server
#     .\reparos\apagar-usuario.ps1 -Usuario <uuid>            # mostra o que faria
#     .\reparos\apagar-usuario.ps1 -Usuario <uuid> -Confirmar # apaga de verdade
#
# Sem `-Confirmar` ele só CONTA as linhas de cada tabela e não escreve nada.
# Apagar é irreversível e não tem desfazer no D1: a conferência vem antes.

param(
  [Parameter(Mandatory = $true)][string]$Usuario,
  [switch]$Confirmar
)

if ($Usuario -notmatch '^[0-9a-fA-F-]{36}$') {
  Write-Error "O id do usuário é um uuid de 36 caracteres. Recebi: '$Usuario'"
  exit 1
}

# O id vai para dentro de SQL, então uma aspa simples dentro dele quebraria a
# consulta. O padrão acima já barra isso; esta linha é o cinto de segurança.
$id = $Usuario.Replace("'", "''")

# Tabelas por banco, com a coluna que aponta o dono. `chat_conversas` tem duas
# pontas, e `chat_mensagens` guarda o autor com outro nome — por isso a lista é
# escrita à mão em vez de deduzida.
$jogo = @(
  'saves', 'marcas', 'apelidos', 'contas', 'limites', 'assinaturas',
  'transacoes', 'saldos', 'materiais', 'lotes', 'itens', 'frota',
  'naves_progresso', 'progresso', 'excedentes'
) | ForEach-Object { @{ tabela = $_; onde = "usuario = '$id'" } }

$chat = @(
  @{ tabela = 'chat_mensagens'; onde = "autor = '$id'" },
  @{ tabela = 'chat_conversas'; onde = "a = '$id' OR b = '$id'" },
  @{ tabela = 'chat_leituras';  onde = "usuario = '$id'" },
  @{ tabela = 'chat_bloqueios'; onde = "usuario = '$id' OR alvo = '$id'" },
  @{ tabela = 'chat_perfis';    onde = "usuario = '$id'" },
  @{ tabela = 'chat_sancoes';   onde = "usuario = '$id'" },
  @{ tabela = 'chat_denuncias'; onde = "denunciante = '$id'" }
)

function Executar([string]$banco, [array]$alvos) {
  # A contagem é UMA consulta com uma subconsulta por tabela, e não quinze
  # `SELECT` unidos por `UNION ALL`: o D1 recusa isso com "too many terms in
  # compound SELECT" bem antes de quinze. Como coluna, cada contagem é
  # independente, e o resultado ainda cabe em uma linha só de saída.
  $sql = if ($Confirmar) {
    ($alvos | ForEach-Object { "DELETE FROM $($_.tabela) WHERE $($_.onde);" }) -join ' '
  } else {
    'SELECT ' + (($alvos | ForEach-Object {
      "(SELECT COUNT(*) FROM $($_.tabela) WHERE $($_.onde)) AS $($_.tabela)"
    }) -join ', ')
  }

  Write-Host ""
  Write-Host "== $banco ==" -ForegroundColor Cyan
  npx wrangler d1 execute $banco --remote --command $sql
}

if (-not $Confirmar) {
  Write-Host "ENSAIO: nada será apagado. Repita com -Confirmar." -ForegroundColor Yellow
}

Executar 'orbita-zero' $jogo
Executar 'orbita-zero-chat' $chat

if ($Confirmar) {
  Write-Host ""
  Write-Host "Feito. O id $Usuario não tem mais rastro nos dois bancos." -ForegroundColor Green
}

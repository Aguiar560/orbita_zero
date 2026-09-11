$ErrorActionPreference = 'Stop'

$python = 'C:\Users\aguia\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$pacote = 'C:\Users\aguia\AppData\Local\Temp\orbita-edge-tts'
if (-not (Test-Path -LiteralPath $python)) { throw 'Runtime Python do workspace não encontrado.' }
if (-not (Test-Path -LiteralPath $pacote)) { throw 'Instale edge-tts na pasta temporária indicada antes de gerar a voz.' }

$env:PYTHONPATH = $pacote
$saida = Join-Path $PSScriptRoot 'narracao-ptbr.mp3'
$texto = 'Esse jogo joga sozinho. Mas não vence sozinho. Eu ignorei o elemento da galáxia, e minha nave foi destruída. Troquei a build, voltei ao setor, e uma chave caiu de um inimigo. Ela vale uma tentativa contra o chefe. Dessa vez, eu preparei a estratégia certa. São trinta galáxias e trezentos setores. Órbita Zero. Jogue grátis no navegador.'

& $python -m edge_tts `
  --voice 'pt-BR-AntonioNeural' `
  '--rate=-2%' `
  '--pitch=-2Hz' `
  --text $texto `
  --write-media $saida
if ($LASTEXITCODE -ne 0) { throw "edge-tts terminou com código $LASTEXITCODE" }
Write-Output 'Voz: pt-BR-AntonioNeural'
Write-Output "Arquivo: $saida"

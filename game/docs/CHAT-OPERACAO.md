# Chat — implementação e operação

04/09/2026. Global e particulares implementados e testados localmente; ativação
de produção iniciada após autorização do usuário. O planejamento original está
em [PLANO-CHAT.md](PLANO-CHAT.md). O histórico de publicação ao final deste
documento é a fonte para distinguir o que foi apenas preparado do que ficou ativo.

## O que existe

- Botão CHAT independente dos painéis reconstruídos pelo Shell; global, privadas, ajustes e moderação para contas autorizadas pelo servidor.
- Histórico paginado de 50 mensagens; janela de até 150 mensagens por conversa no cliente, sem gravá-las no save/localStorage. Conta anônima pode ler global; escrever exige conta não anônima e apelido no banco do jogo.
- Busca por prefixo de apelido, solicitação, aceite/recusa, conversas offline, não lidas, preferências de novos contatos, bloqueio e denúncia. Busca inclui jogadores que já abriram o chat; não consulta e-mails nem lista todas as contas.
- Texto/emojis, no máximo 400 pontos de código / 1600 bytes / 5 linhas. HTML é texto, links não são clicáveis. Sem anexos, áudio, presença, grupos ou monetização.
- Moderação server-side: evidência denunciada, acesso auditado, remoção com tombstone, silêncio/suspensão por 1–720 horas, revogação e encerramento da denúncia. Não existe consulta administrativa livre a privadas alheias.
- Painel recolhível no desktop, tela inteira em até 760px, altura via VisualViewport e safe areas; layout compacto quando o teclado reduz a altura. O combate continua, sem conceder controle idle/manual adicional. WASD/espaço/setas não controlam a nave enquanto o foco está nos campos/controles.

## Arquivos e arquitetura

| Camada | Arquivos |
|---|---|
| Contrato e validação pura | `src/shared/chat.ts` |
| Cliente HTTP/WebSocket, sessão e cache | `src/app/ChatClient.ts` |
| Interface | `src/ui/ChatPanel.ts`, `src/styles/chat.css`, integração em `Shell.ts` |
| Foco | `src/app/focoDeEntrada.ts`, listeners em `VerticalMode.ts` |
| Identidade validada | `server/src/auth.ts` agora também retorna anonimato e expiração |
| Worker social separado | `server/src/chat/worker.ts` |
| Coordenador/ACL/entrega | `server/src/chat/CentralChat.ts` |
| Histórico social separado | `server/chat-schema.sql` |
| Configuração exclusiva | `server/wrangler.chat.toml` |

Worker econômico não ganhou rotas sociais e o seu wrangler não foi alterado. `DB` no Worker social só consulta apelidos. Todas as escritas sociais usam `CHAT_DB`.

**Detalhe em relação à proposta:** WebSocket distribui eventos; envio e demais ações usam HTTPS com bearer token. Isso simplifica renovação e validação por ação. `POST /chat/api` com `op: ticket` cria ticket opaco de uso único, válido por 30s. O ticket vai no primeiro frame, nunca na URL. O socket tem 5s para autenticar e expira no menor prazo entre o JWT e 15 minutos, renovando por reconexão autenticada.

Cada mensagem tem id sequencial global usado como cursor da conversa e chave de idempotência por autor. D1 grava mensagem/outbox na mesma transação; alarme é agendado antes de gravar. O coordenador tenta distribuir e remove da outbox depois. Entrega pode se repetir; cliente deduplica por id. Histórico permite recuperar reconexões. Não há garantia de “exatamente uma vez”.

Limites persistidos no Durable Object: API 30 de rajada e reposição de 1/s; envio 3 de rajada e reposição a cada 2s; contato 3 de rajada e reposição a cada 20min; denúncia 5 de rajada e reposição a cada minuto; ticket 3 de rajada e reposição a cada 10s. Limite inicial 500 sockets, 3 por usuário e 20 sem autenticação; handshake por chave de rede diária, 6 de rajada e reposição a cada 5s. No máximo 200 conversas por jogador e 20 solicitações pendentes ao destinatário. Esses números são operacionais e devem ser ajustados após homologação.

Workers não expõe `bufferedAmount`: a proteção de aplicação fecha sockets após 256 eventos sem ping do cliente. O ping a cada 30s confirma liveness; falta de resposta por 15s provoca reconexão. Esse limite não substitui teste de fan-out nem proteção contra DDoS na borda.

## Ativação é uma etapa separada

O chat foi autorizado para ativação em 04/09/2026. O D1 social foi criado em ENAM
com escolha automática da Cloudflare; a conta administrativa existente foi definida
como moderadora inicial e a origem de produção foi cadastrada exatamente. Consulte
o final deste documento e o ROADMAP para saber o estado efetivamente publicado.

Antes de publicar:

1. Definir responsável e usuários moderadores (UUID Supabase). Usar `CHAT_MODERADORES`, separado da lista de admins do frontend. **Não confiar no controle de interface como autorização.**
2. Criar um D1 **novo** `orbita-zero-chat` na conta Cloudflare; substituir o placeholder no arquivo exclusivo do chat. Rever plano/cotas e configurar alertas de consumo. Não usar o id do banco econômico como `CHAT_DB`.
3. Aplicar `chat-schema.sql` somente no D1 social. O schema do jogo não é uma migração social.
4. Cadastrar origens exatas autorizadas em `ORIGENS` (produção `https://orbita-zero.vercel.app`, homologação com URL explícita). Não misturar previews/desenvolvimento com o histórico de produção.
5. Implantar inicialmente em ambiente de homologação com bancos e namespace DO próprios. Ativar `CHAT_ENABLED=true` nesse ambiente. Definir `VITE_CHAT_URL` no build de teste com a URL HTTPS do Worker social, sem barra final.
6. Repetir aceite com contas reais de teste, dispositivos Android/iOS, interrupções de rede, suspensão/hibernação e carga representativa do público. Os testes locais não provam comportamento de suspensão do Safari nem custo real.
7. Validar política de privacidade/retenção/idade do público, exclusão de conta e procedimento de resposta a denúncias. Aprovar atendimento humano antes de abrir para todos.
8. Publicar Worker antes do frontend, liberar grupo pequeno, observar erros/latência/denúncias/custos; só então ampliar.

Não existe bypass de autenticação, conta de demonstração ou chave de teste no Worker publicado. O emissor fictício só é configurado no simulador descartável dos testes.

### Comandos locais

No diretório `server/`:

```powershell
npm run chat:check
npm run chat:test
npm run chat:db:local
npm run chat:dev
```

`chat:check` é empacotamento dry-run, sem publicação. `chat:test` usa Miniflare/workerd e bancos descartáveis. O teste precisa que as dependências de `game/` e `server/` estejam instaladas. `chat:db:local` prepara o histórico local persistente para desenvolvimento manual, e `chat:dev` abre a porta 8788.

Para desenvolvimento manual, o DB local de contas também precisa da tabela `apelidos` e dos apelidos das contas de teste; não é carregado da produção automaticamente. O `.env.local` do Vite pode definir `VITE_CHAT_URL=http://127.0.0.1:8788`; reiniciar o Vite após mudar a variável. Não publicar essa URL local.

Na raiz `game/`, com Vite acessível:

```powershell
node tools/test-chat-browser.mjs
```

O teste de navegador usa Playwright do runtime local existente, sem instalar dependência do jogo. Caminhos alternativos via `PLAYWRIGHT_MODULE`, `CHROME_PATH` e `CHAT_TEST_VITE`; padrão Vite 127.0.0.1:5181. Usa perfis descartáveis, JWTs assinados por uma chave efêmera, impede requisições externas e concede acesso loopback somente no contexto de teste. Capturas em `.snapshots/chat/`.

### Retenção, desligamento e suporte

- Cron diário remove global com mais de 7 dias e particulares com mais de 90. Assim, a remoção física pode ocorrer até um ciclo depois. Denúncias/evidências duram até 180 dias e auditoria até 365; sanções vencidas também são limpas. Revise política de backups separadamente.
- Mensagens particulares não têm E2EE. A equipe só recebe texto privado no painel quando alguém daquela conversa o denuncia; consultar a fila é auditado.
- `CHAT_ENABLED=false` recusa novas ações; conexões existentes são fechadas na próxima atividade/alarme. Não é revogação instantânea de todos os sockets ociosos: validade máxima de sessão é 15 minutos.
- Não logar JWT, tickets, refresh tokens, corpo das conversas ou e-mails. Instrumentação de produção, dashboards, alertas e playbook de exclusão/backup ainda são requisitos de lançamento, não entregas verificadas nesta etapa.
- Para falha só no frontend, retirar `VITE_CHAT_URL` do próximo build evita acesso. Nunca apagar banco para “desligar o chat”.

## Verificação realizada

- Suíte completa: **962 testes passando** (inclui 6 testes do contrato social).
- Typecheck frontend/backend e build Vite passaram; Worker social empacotado em dry-run, sem deploy.
- **96 verificações de integração** com D1/DO/WebSocket reais locais: JWT/origem, global, ACL com terceiro jogador, solicitação/aceite, offline, não lidas, reenvio, bloqueio em socket aberto, denúncia/moderação/auditoria, limites, ticket de uso único, expiração de socket e retenção.
- Carga funcional local: **25 conexões × 25 mensagens = 625 entregas**, aproximadamente 1,7s na primeira execução. Não representa limite de produção nem medição de latência de rede pública.
- Navegador: duas contas, global/particulares/bloqueio, texto hostil sem HTML executável, logout limpa DOM/cache, listeners reais de WASD/espaço/foco/blur, layouts 1440×1000, 390×844 e viewport reduzida 390×460. Redução de viewport simula espaço do teclado, não um teclado nativo real.

Ainda pendentes para lançamento: recursos remotos e configuração, moderadores, revisão de privacidade/exclusão, observabilidade/alertas, carga em homologação e verificação física Android/iOS. Não há garantia de prontidão para tráfego público apenas por passar nesses testes.

## Ativação de produção — 04/09/2026

- Criado `orbita-zero-chat` no D1 exclusivo, localização automática **ENAM**,
  id `c4183434-fb2c-41e5-a106-0c27de89779e`. O primeiro banco, ainda vazio e
  criado por engano com hint WEUR, foi removido antes de qualquer migração e
  recriado corretamente. Nenhum dado de jogador foi perdido.
- `chat-schema.sql` aplicado remotamente: 16 consultas, 10 tabelas sociais mais
  tabelas internas SQLite/Cloudflare, região atendida ENAM/EWR na conferência.
- Worker `orbita-zero-chat` publicado com versão
  `adfc3b12-5532-494d-9ee7-80651561d890`, cron diário ativo, origem exata
  `https://orbita-zero.vercel.app`, feature ativa e administrador atual como
  moderador inicial. Saúde respondeu `{ok:true,ativo:true}`; token inválido, 401.
- Vercel recebeu `VITE_CHAT_URL` somente no ambiente Production, tipo Config,
  apontando para `https://orbita-zero-chat.orbitazero.workers.dev`.

O frontend ainda precisa ser commitado/publicado e validado contra as contas
reais. Atualizar esta seção apenas depois que esses passos forem medidos.

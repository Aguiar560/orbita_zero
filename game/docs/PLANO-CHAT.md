# Levantamento: chat global e mensagens privadas

Data: 04/09/2026. Escopo: análise do código local e documentação oficial. Nenhum serviço de chat foi criado, contratado ou publicado; nenhuma migração foi aplicada. As regras abaixo são propostas, não decisões já aprovadas.

> Atualização após aprovação: implementação local concluída em 04/09/2026.
> Este arquivo preserva o levantamento original; estado implementado, diferenças,
> testes e requisitos de publicação estão em [CHAT-OPERACAO.md](CHAT-OPERACAO.md).

## 1. Conclusão

É viável adicionar o chat à arquitetura atual. Não precisamos de outro login nem de um servidor tradicional ligado permanentemente. Precisamos de um subsistema social com autenticação, entrega em tempo real, histórico, reconexão, interface responsiva e moderação.

Recomendação: Supabase Auth existente + Worker de chat na Cloudflare + Durable Objects com WebSocket Hibernation + banco D1 separado para o histórico social. Não colocar conversas no save, no inventário ou na simulação de combate.

## 2. O que o projeto já tem

| Base existente | Evidência local | Aproveitamento |
|---|---|---|
| Login e renovação de sessão | `src/app/conta.ts` | Identidade única em todos os dispositivos |
| Verificação de JWT ES256 por JWKS | `server/src/auth.ts` | Autenticar acesso ao chat no servidor |
| API TypeScript em Cloudflare Worker | `server/src/index.ts`, `server/wrangler.toml` | Reutilizar padrões e infraestrutura |
| Apelidos únicos normalizados | `server/schema.sql`, `server/src/placar.ts` | Nome público do autor e busca de destinatário |
| Cadastro de contas e progressão no servidor | `server/migrations/0004-contas.sql`, `server/src/progresso.ts` | Regras antispam baseadas em dados do servidor |
| Construção de texto com `textContent` | `src/ui/dom.ts` | Renderização segura das mensagens |
| Shell desktop e navegação móvel | `src/ui/Shell.ts` | Botão, painel recolhível e tela móvel de chat |

Não encontrei implementação de chat, WebSockets, tabelas de conversas, bloqueios ou denúncias no código analisado. O Supabase é usado pelo cliente para autenticação, sem SDK de Realtime.

### Cuidados concretos identificados

1. `VerticalMode.onKeyDown` registra todas as teclas e não verifica se o foco está em um campo de texto. Digitar W/A/S/D ou espaço poderia controlar a nave e bloquear a digitação. Corrigir o filtro de foco e limpar teclas pressionadas ao abrir/focar o chat, perder foco ou trocar de tela.
2. `Usuario`, retornado por `usuarioDoToken`, contém apenas id e e-mail. Para diferenciar contas anônimas e controlar sessões longas, precisamos expor os atributos necessários validados no servidor, incluindo expiração. Não confiar em `sessao.anonima` ou no nível enviado pelo navegador.
3. A API recebe JWT em `Authorization` no HTTP. O WebSocket nativo do navegador não oferece esse mesmo parâmetro de cabeçalhos arbitrários. Precisamos desenhar explicitamente a autenticação do socket. [Interface WebSocket do navegador](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket).
4. `origemPermitida` produz cabeçalhos CORS; isso não é, por si só, rejeição de uma conexão WebSocket. A nova rota precisa negar origens não autorizadas explicitamente.
5. A sessão fica no `localStorage`. Texto de outros jogadores aumenta a importância de impedir XSS: sem HTML ou Markdown arbitrário, inclusive em apelidos e notificações. Revisar CSP sem quebrar os estilos existentes.
6. O limite de leitura em memória de `ritmo.ts` é local ao isolate. O antispam do chat precisa sobreviver a reinícios e múltiplas conexões; não basta copiar esse mapa em memória.

## 3. Primeira versão proposta

| Área | Comportamento |
|---|---|
| Global | Uma sala comum; autor, horário, texto e emojis; 50 mensagens recentes ao entrar; carregar anteriores por cursor |
| Particular | Conversa individual, lista de conversas, não lidas, envio para jogador offline e recuperação do histórico |
| Abrir privada | Clicar no apelido do global/ranking ou pesquisar apelido; identidade interna por id da conta, não pelo nome mutável |
| Solicitação | Primeiro contato entra como solicitação; aceitar, recusar ou bloquear; impedir rajada de mensagens antes do aceite |
| Segurança pessoal | Bloquear jogador, denunciar mensagem, desativar recebimento de novas privadas e silenciar avisos |
| Estado de envio | Enviando, enviado ao servidor, falhou e tentar novamente; não confundir confirmação do servidor com leitura |
| Conta | Sugestão: anônimos leem o global, mas enviar/receber privadas exige conta vinculada e apelido; validar regra no servidor |
| Conteúdo | Texto e emojis; sugestão de 400 caracteres e limite adicional em bytes; sem anexos ou links ativos inicialmente |
| Monetização | Chat básico disponível aos jogadores elegíveis, sem depender do VIP |

Não incluir na primeira entrega: voz, vídeos, imagens, grupos, clãs, trocas de itens pelo chat, tradução automática, notificações push ou indicador de digitação. Presença online e confirmação de leitura podem entrar depois; os contadores de não lidas já atendem o essencial.

## 4. Arquitetura recomendada

Fluxo: interface → conexão autenticada → Worker/Durable Object → validação e persistência → confirmação e entrega aos destinatários autorizados.

- **Cliente:** módulo independente de rede/estado social. Carregamento após o jogo iniciar; falha de chat nunca bloqueia “Iniciando sistemas” ou o combate.
- **Worker de chat:** preferencialmente implantação separada da API econômica, compartilhando o verificador de identidade. Dá rollback e desligamento independentes.
- **Durable Object:** coordena conexões e distribui eventos. Um coordenador inicial é uma opção de MVP para uma comunidade pequena; o teste de carga define quando dividir salas e caixas de entrada. Não pressupor capacidade ilimitada.
- **Histórico:** D1 específico de chat; acesso de servidor aos apelidos existentes. Separar bancos organiza dados e manutenção, mas não elimina cotas compartilhadas da conta.
- **Hibernação:** usar a API apropriada; reconstruir anexos de conexão e estado necessário ao acordar. Não manter timers desnecessários que impeçam hibernar. A Cloudflare documenta esse padrão para chat e coordenação em tempo real. [WebSockets em Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

### Autenticação sugerida

1. Cliente chama `POST /chat/ticket` por HTTPS, usando o JWT válido atual em `Authorization`.
2. Servidor confere identidade, elegibilidade e sanções; emite ticket opaco curto, de uso único e validade proposta de 30 segundos.
3. Cliente conecta por `wss` à origem permitida e envia o ticket na primeira mensagem, sem JWT em URL.
4. Até autenticar, a conexão não recebe histórico nem eventos. Limitar conexões pendentes e fechá-las rapidamente, por exemplo após 5 segundos.
5. Consumir o ticket atomicamente; vincular usuário e expiração à conexão. Renovar autorização durante sessões longas; fechar em logout e expiração sem renovação.

O servidor deriva autor, nome público, id e horário. O cliente nunca escolhe livremente quem é o remetente. Uma conexão com acesso ao global não ganha acesso às privadas de outros usuários.

### Entrega confiável

- Gerar `clientMessageId`; unicidade por autor impede duplicação ao reenviar.
- Persistir antes de confirmar e distribuir. Usar sequência por conversa para ordenar e buscar mensagens após reconexão.
- Tratar a janela “persistiu, mas caiu antes de distribuir”: registro pendente de entrega/reconciliação e recuperação por sequência; não prometer entrega exatamente uma vez.
- Reconectar com espera progressiva e variação aleatória. Celular suspenso deve recuperar lacunas ao voltar.
- Leitura é um cursor por participante; não gravar uma linha para cada leitor de cada mensagem global.
- Considerar duas abas e dois dispositivos do mesmo usuário. Uma falha temporária não pode duplicar mensagens ou zerar não lidas.
- Limitar buffers e desconectar clientes lentos; evitar que uma conexão prejudique toda a sala.

## 5. Dados que faltam

| Estrutura proposta | Informação |
|---|---|
| `chat_conversas` | Tipo global/privada; par único ordenado de usuários nas privadas; última sequência e estado da solicitação |
| `chat_participantes` | Usuário, conversa, último cursor lido, silenciada/arquivada |
| `chat_mensagens` | Id, conversa, sequência, autor, texto, horário do servidor, chave de idempotência e estado de remoção |
| `chat_bloqueios` | Quem bloqueou quem e quando |
| `chat_denuncias` | Mensagem reportada, motivo, denunciante, evidência necessária e andamento |
| `chat_sancoes` | Silenciamento ou banimento, escopo, duração, motivo e responsável |
| `chat_auditoria` | Ações administrativas e acessos excepcionais necessários à investigação |
| Preferências sociais | Recebimento de contatos e notificações; podem compor uma tabela própria |

Índices essenciais: conversa + sequência, autor + chave de idempotência, participante + conversa, par privado único, par de bloqueio e datas de expiração. Não armazenar e-mail, tokens ou IP no corpo das mensagens.

Histórico precisa de paginação, política de retenção e limpeza programada. Ponto de partida para decisão: global por 7 dias e privadas por 90 dias, com regras separadas para denúncias. São escolhas de produto a aprovar, não prazos legais presumidos. Informar os usuários e revisar privacidade, exclusão de conta, backups e público etário antes do lançamento.

## 6. Segurança e moderação antes de abrir ao público

- Conferir participação em **cada** consulta de histórico, envio e assinatura de privada; UUID difícil de adivinhar não substitui autorização.
- Verificar bloqueios e sanções no servidor, inclusive para conexões já abertas. Invalidar caches ao aplicar sanção.
- Limites por usuário, destinatário, conexão e rajada; limite de novos contatos. Sugestão inicial: uma mensagem a cada 2 segundos, rajada de 3, ajustada em testes.
- Validar tipo, comprimento, bytes, quebras de linha e Unicode; renderizar como texto. Bloquear mensagens vazias, pacotes gigantes e comandos desconhecidos.
- Combinar antispam, bloqueio e denúncia com revisão humana. Filtro de palavrão sozinho não resolve assédio, golpes nem contas alternativas.
- Não avisar publicamente quem denunciou. Bloqueio deve interromper novas privadas, mas não pode apagar a evidência necessária para investigar uma denúncia.
- Painel de moderação com papéis validados no servidor: remover mensagem, silenciar temporariamente, banir do chat e registrar justificativa.
- Sem acesso casual dos administradores a todas as privadas: acesso excepcional autorizado e auditado para tratar denúncias, com política transparente.
- “Privada” significa acesso restrito entre jogadores, **não criptografia ponta a ponta**. A proposta usa transporte seguro, mas permite tratamento pelo servidor.
- Logs técnicos sem tokens nem cópia indiscriminada do conteúdo das conversas.

Referência de controles: [OWASP — segurança de WebSockets](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html).

## 7. Interface sem prejudicar o jogo

Desktop: botão Comunicação com contador; painel recolhível/redimensionável, com abas Global e Privadas. Não criar uma quarta coluna fixa estreitando o campo. Mensagens novas não devem roubar foco nem abrir o painel automaticamente.

Celular: painel próprio ou folha expansível, com teclado virtual, área segura e altura dinâmica. Fechar deve devolver o foco ao jogo. O modo manual não pode receber comandos de movimento enquanto o jogador digita; decidir claramente se permanece vulnerável ou passa a um controle já permitido, sem conceder VIP implicitamente.

Lista limitada/virtualizada, atualização por eventos e sem reconstruir o DOM a cada frame do jogo. Auto-rolagem apenas quando o usuário estiver no fim; caso contrário, mostrar “novas mensagens”. Acessibilidade de foco, rótulos, contraste e avisos não intrusivos.

## 8. Alternativas e custos

**Cloudflare é a recomendação de encaixe no projeto.** Durable Objects com SQLite também existem no plano gratuito, mas exceder limites gratuitos causa falhas; hibernação reduz cobrança de duração. O plano Workers pago tem base de US$ 5/mês, com consumo adicional conforme os serviços. Isso não é orçamento total nem confirmação do plano da conta. [Durable Objects: preços](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Workers: preços](https://developers.cloudflare.com/workers/platform/pricing/).

O D1 gratuito inclui 5 milhões de linhas lidas/dia e 100 mil escritas/dia. Chat concorre com o restante do uso da conta: mensagens, índices, recibos e limpeza entram na conta. Orçar a partir de jogadores simultâneos, mensagens/minuto, retenção e reconexões; não só usuários cadastrados. [D1: preços](https://developers.cloudflare.com/d1/platform/pricing/).

**Supabase Realtime é uma alternativa válida**, mas adicionaria o serviço e sua integração, além de decisões sobre guardar mensagens e permissões no Postgres ou sincronizá-las com D1. Canais privados precisam de autorização/RLS; o canal por si só não é uma conversa persistente. No plano gratuito, a documentação lista 200 conexões simultâneas e 100 mensagens/s. Conferir também volume mensal e fan-out antes de escolher por preço. [Autorização](https://supabase.com/docs/guides/realtime/authorization), [Limites](https://supabase.com/docs/guides/realtime/limits).

Polling frequente contra D1 não é a recomendação para o chat: aumenta consultas e entrega mensagens com atraso. Pode servir como recuperação pontual, não como mecanismo principal.

Não consultei os painéis de cobrança, tráfego real ou contratos atuais. Para fechar orçamento faltam pico de simultâneos, atividade esperada, plano contratado e responsável pela moderação. Também reservar tempo operacional para denúncias; esse custo não aparece na fatura de hospedagem.

## 9. Plano de entrega e aceite

1. **Definir regras e preparar backend:** elegibilidade, retenção, contatos, papéis de moderação, migrações, bindings, flag e ambientes separados.
2. **Global em teste fechado:** autenticação, envio, histórico, reconexão, antispam, interface desktop/mobile e controles de foco.
3. **Privadas:** solicitação, busca, participação, offline, não lidas, bloqueios e sincronização entre dispositivos.
4. **Moderação e operação:** denúncias, sanções, auditoria, retenção, métricas, alertas e botão para desativar o chat sem parar o jogo.
5. **Validação e liberação gradual:** equipe/admins, pequeno grupo, público; frontend, Worker e migrações precisam de versões compatíveis e rollback.

Critérios mínimos antes de produção:

- Dois jogadores recebem o global; um terceiro não consegue ler nem injetar mensagens na privada dos outros.
- Usuário bloqueado ou silenciado não contorna a regra por outra aba ou conexão aberta.
- Reinício/hibernação, perda de rede e reenvio não perdem histórico nem duplicam mensagens.
- Token expirado, ticket repetido, origem indevida, HTML malicioso e rajadas são recusados/tratados com segurança.
- Logout/troca de conta limpam dados privados do cliente.
- Digitar WASD/espaço não move a nave; fechar o chat não deixa teclas presas.
- Teclado móvel não cobre o campo de envio; chat fechado não prejudica FPS ou boot.
- Teste de carga com volume de mensagens, leitores, duas abas e fan-out previstos; medir latência, erros, consumo e memória, não apenas conexão aberta.
- Sem mistura de mensagens entre ambiente local, homologação e produção.

## 10. Decisões pendentes

Sugestão inicial: chat básico sem VIP; conta vinculada + apelido para conversar; anônimos apenas lendo global; privadas por solicitação; texto/emojis; sem anexos; retenção 7/90 dias; equipe com capacidade de tratar denúncias.

Antes de implementar, aprovar essas regras, indicar quem moderará e informar a estimativa de jogadores simultâneos. O chat é um módulo novo de produto e operação, não apenas uma caixa de texto.

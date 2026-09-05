# Ligar Google e Facebook — passo a passo

O código já está pronto: os botões existem em `ui/Login.ts` e
`app/conta.ts:entrarComProvedor` monta a URL. O que falta é **configuração de
painel**, em três lugares.

Medido em 04/09: `/auth/v1/authorize?provider=google` responde **400** enquanto
o provedor estiver desligado. É esse 400 que some quando o passo 2 terminar.

## Os dois endereços que você vai colar

Anote os dois antes de começar — eles vão para lugares diferentes, e trocá-los é
o erro mais comum.

| Onde cola | Valor |
|---|---|
| **No Google e no Facebook** (callback) | `https://vzsiorkeykcbcpmismyy.supabase.co/auth/v1/callback` |
| **No Supabase** (redirect) | `http://localhost:5180/` e `https://orbita-zero.vercel.app/` |

O primeiro é para onde o *provedor* devolve — sempre o Supabase, nunca o jogo. O
segundo é para onde o *Supabase* devolve — o jogo.

---

## 1. Google

### 1.1 Tela de consentimento

*Google Cloud Console* → escolha ou crie um projeto → **APIs e serviços** →
**Tela de permissão OAuth**.

- Tipo: **Externo**.
- Nome do app: `Órbita Zero`. E-mail de suporte e de contato: o seu.
- Escopos: **não acrescente nenhum**. Os padrões (`email`, `profile`,
  `openid`) bastam, e pedir mais aciona verificação da Google.

**A armadilha do alfa.** A tela nasce em **Testing**, e nesse modo *só quem está
na lista de usuários de teste consegue entrar* — até 100 pessoas. Duas saídas:

- **Deixar em Testing** e adicionar o e-mail de cada testador em *Usuários de
  teste*. Combina com alfa fechado, e é o caminho curto.
- **Publicar** (`In production`). Com só os escopos básicos não exige
  verificação, e aí qualquer conta Google entra.

Se um testador disser "o Google diz que o app não foi verificado" ou "acesso
bloqueado", é isto — não é o código.

### 1.2 Credencial

**Credenciais** → **Criar credenciais** → **ID do cliente OAuth**.

- Tipo: **Aplicativo da Web**.
- *Origens JavaScript autorizadas*: pode deixar vazio. O jogo não chama a
  Google direto; quem chama é o Supabase.
- *URIs de redirecionamento autorizados*: **exatamente**

  ```
  https://vzsiorkeykcbcpmismyy.supabase.co/auth/v1/callback
  ```

Guarde o **Client ID** e o **Client Secret**.

---

## 2. Facebook

*Facebook for Developers* → **Meus apps** → **Criar app**.

- Caso de uso: **Autenticar e solicitar dados com o Login do Facebook**.
- Adicione o produto **Login do Facebook** → plataforma **Web**.

Em **Login do Facebook → Configurações**:

- *URIs de redirecionamento do OAuth válidos*:

  ```
  https://vzsiorkeykcbcpmismyy.supabase.co/auth/v1/callback
  ```

- *Login do OAuth do cliente*: **Sim**
- *Login do OAuth da Web*: **Sim**

Em **Configurações → Básico**, guarde o **ID do app** e a **Chave secreta**.

**A armadilha aqui é a mesma, com outro nome.** O app nasce em
**Desenvolvimento**, e nesse modo só administradores, desenvolvedores e
testadores do app conseguem entrar. Para abrir a qualquer um é preciso passar
para **Ativo**, e aí o Facebook **exige URL de política de privacidade** — que o
jogo ainda não tem.

Para um alfa fechado, deixar em Desenvolvimento e cadastrar os testadores em
*Funções* resolve sem precisar da política.

---

## 3. Supabase

*Authentication* → **Providers**.

- **Google**: ligue, cole Client ID e Client Secret, salve.
- **Facebook**: ligue, cole App ID e App Secret, salve.

*Authentication* → **URL Configuration**:

- **Site URL**: `https://orbita-zero.vercel.app`
- **Redirect URLs**, uma por linha:

  ```
  http://localhost:5180/
  https://orbita-zero.vercel.app/
  https://orbita-zero-*.vercel.app/**
  ```

As três são necessárias por motivos diferentes: a primeira para você desenvolver,
a segunda para o site, e a **terceira para os deploys de preview da Vercel**, que
ganham um host novo a cada build — sem ela, testar login numa branch nunca
funciona e parece defeito intermitente.

> O código manda `location.origin + location.pathname`, que na raiz termina em
> `/`. Por isso as URLs acima têm a barra final. Sem ela o Supabase recusa o
> retorno, e a recusa acontece **no site dele** — o jogo nem fica sabendo.

---

## Como saber que funcionou

No console do navegador, com o jogo aberto:

```js
const u = new URL('https://vzsiorkeykcbcpmismyy.supabase.co/auth/v1/authorize');
u.searchParams.set('provider', 'google');
u.searchParams.set('redirect_to', location.origin + '/');
(await fetch(u, { redirect: 'manual' })).status
```

- **400** → provedor ainda desligado no Supabase (passo 2 incompleto).
- **302** → ligado. Pode clicar no botão de verdade.

Depois disso, o teste real é clicar em *Continuar com Google*, autorizar, e
verificar que a volta cai **direto no jogo** — não na tela de login de novo. Se
cair no login, o endereço de retorno não está autorizado.

---

## O que NÃO precisa mudar

- `ORIGENS` no `server/wrangler.toml` já cobre os três hosts. Ela governa o CORS
  da API do jogo, que é outra coisa do login — mas as listas coincidem, e vale
  lembrar de mexer nas duas se um host novo aparecer.
- A chave `anon` em `data/servidor.ts` continua pública por desenho. Ela permite
  falar com a API de autenticação, que é o que se quer; quem protege os dados é
  a checagem de token no Worker.

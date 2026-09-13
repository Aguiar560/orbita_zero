# O e-mail de confirmação de conta

O Supabase envia este e-mail; o jogo não. Nada dele está no código — o cliente
só chama `signup` em [`src/app/conta.ts`](../src/app/conta.ts), sem template,
sem remetente e sem redirect. Este documento existe porque, por padrão, a
mensagem chega com a cara do Supabase e **o jogador não reconhece de quem é**.

## O que muda onde, e o que cada coisa custa

| o quê | onde | depende de |
|---|---|---|
| Assunto e corpo | Dashboard → Authentication → Emails → Templates → *Confirm signup* | **SMTP próprio** |
| Remetente (`De`) | Dashboard → Authentication → Emails → **SMTP Settings** | **SMTP próprio** |
| Destino do link | Dashboard → Authentication → **URL Configuration** (Site URL) | nada |

## Os três viram UM: sem SMTP próprio, nada de template

O painel diz com todas as letras: *"Set up custom SMTP to edit templates —
emails will be sent using the default templates"*. Enquanto o projeto usa o SMTP
compartilhado do Supabase, **assunto e corpo ficam travados** no texto padrão em
inglês. Não é possível separar "trocar o texto" de "trocar o remetente": é a
mesma configuração.

Isso não custa dinheiro ao Supabase — SMTP próprio existe no plano gratuito. O
que ele exige é um provedor de e-mail transacional, e os principais têm faixa
gratuita que cobre com folga o volume de um alfa: Resend (~3.000/mês), Brevo
(~300/dia), Mailjet (~6.000/mês). Confirme o número na página de cada um antes
de decidir — essas faixas mudam.

O caminho, na ordem:

1. Conta no provedor e **domínio `orbitazero.com.br` verificado** — dois ou três
   registros DNS (SPF e DKIM).
2. **SMTP Settings** no Supabase: host, porta, usuário, senha, mais *Sender
   name* (`Órbita Zero`) e *Sender email*.
3. Os templates destravam, e o corpo abaixo entra.

> **E o alerta que transforma isto de estética em operação:** o SMTP embutido do Supabase é para
> desenvolvimento e limita os envios por hora. Com a confirmação de e-mail
> obrigatória, ele é a peça que silenciosamente para de entregar — e o sintoma
> chega como "criei a conta e o e-mail não veio", indistinguível de defeito
> nosso. Configurar SMTP próprio deixou de ser enfeite no dia em que a
> confirmação virou obrigatória.

## O template, pronto para colar

**Assunto:**

```
Confirme seu e-mail e assuma o comando · Órbita Zero
```

**Corpo** (cola no campo de mensagem do template *Confirm signup*):

```html
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background:#04090f;margin:0;padding:32px 12px;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:520px;background:#070e16;border:1px solid rgba(93,195,245,.16);border-radius:14px;">
        <tr>
          <td style="padding:28px 28px 8px;">
            <p style="margin:0 0 6px;color:#5dc3f5;font:700 11px/1 'Trebuchet MS',Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;">
              Órbita Zero
            </p>
            <h1 style="margin:0;color:#d6e6ef;font:700 24px/1.25 'Trebuchet MS',Arial,sans-serif;">
              Confirme seu e-mail
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 28px 0;">
            <p style="margin:0 0 18px;color:#a9b9c6;font:400 15px/1.6 Arial,sans-serif;">
              Sua conta de piloto está quase pronta. Confirme o e-mail para
              sincronizar seu progresso entre dispositivos e assumir o comando.
            </p>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 18px;">
              <tr>
                <td style="background:#5dc3f5;border-radius:8px;">
                  <a href="{{ .ConfirmationURL }}"
                     style="display:inline-block;padding:13px 26px;color:#04090f;font:700 14px/1 'Trebuchet MS',Arial,sans-serif;letter-spacing:.08em;text-decoration:none;text-transform:uppercase;">
                    Confirmar e entrar
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;color:#7d919f;font:400 12px/1.6 Arial,sans-serif;">
              Se o botão não funcionar, copie este endereço no navegador:
            </p>
            <p style="margin:0 0 22px;word-break:break-all;">
              <a href="{{ .ConfirmationURL }}" style="color:#5dc3f5;font:400 12px/1.6 Arial,sans-serif;">{{ .ConfirmationURL }}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 26px;border-top:1px solid rgba(93,195,245,.16);">
            <p style="margin:18px 0 0;color:#7d919f;font:400 12px/1.6 Arial,sans-serif;">
              Se não foi você que criou esta conta, é só ignorar esta mensagem —
              nada acontece sem a confirmação.
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:14px 0 0;color:#54697a;font:400 11px/1.5 Arial,sans-serif;">
        Órbita Zero · orbitazero.com.br
      </p>
    </td>
  </tr>
</table>
```

### Por que ele é feito de tabelas e estilo inline

Não é preguiça nem código antigo: cliente de e-mail não carrega CSS externo e
descarta a maior parte do `<style>`. Gmail, Outlook e os aplicativos de celular
concordam sobre tabelas com atributo `style` — e discordam sobre quase todo o
resto. A mesma regra vale para a fonte: `Chakra Petch` não existe na caixa de
entrada de ninguém, então o e-mail usa a família segura mais próxima e deixa a
identidade por conta da cor e do traço.

O fundo escuro tem um porém conhecido: alguns clientes forçam tema claro e
invertem cores. O texto foi escrito para continuar legível se isso acontecer —
nenhuma informação depende só da cor.

### As variáveis disponíveis

`{{ .ConfirmationURL }}` é o link; as outras são `{{ .SiteURL }}`,
`{{ .Email }}`, `{{ .Token }}` e `{{ .TokenHash }}`. Use `.ConfirmationURL` e
não monte o link à mão: ele carrega o token e o retorno corretos.

## Antes de dar por pronto, confira o destino

O link usa o **Site URL** do projeto, porque o `signup` do jogo não manda
`emailRedirectTo`. Se esse campo estiver apontando para um endereço antigo, o
jogador confirma e cai no lugar errado.

Dá para tirar isso do painel e trazer para o código: passar `emailRedirectTo` na
chamada de cadastro faria o link voltar para a origem de onde a pessoa se
cadastrou — produção em produção, `localhost:5180` quando se testa — em vez de
depender de um campo único. São poucas linhas em `conta.ts` e uma entrada na
lista de *Redirect URLs* do painel.

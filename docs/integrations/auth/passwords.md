---
area: auth
type: integration
status: current
related:
  - ./sign-up.md
  - ./sign-in.md
  - ./link-providers.md
  - ./change-password.md
  - ../../auth/concepts/local-password-policy.md
---

# Contrato de senhas locais

Credenciais do provider `EMAIL` usam simultaneamente:

- mínimo de 6 e máximo de 50 caracteres;
- máximo inclusivo de 72 bytes em UTF-8.

O limite em bytes importa para caracteres acentuados, outros alfabetos e emoji.
Por exemplo, 36 ocorrências de `é` ocupam 72 bytes; adicionar um caractere ASCII
leva a entrada a 73 bytes.

## Validação no frontend

O navegador pode antecipar a mesma medição para melhorar a experiência:

```ts
const PASSWORD_MAX_UTF8_BYTES = 72;

export function isPasswordWithinByteLimit(password: string): boolean {
  return new TextEncoder().encode(password).byteLength <= PASSWORD_MAX_UTF8_BYTES;
}
```

Essa validação não substitui a resposta do backend. Não corte a senha e não
normalize Unicode antes de enviá-la, pois isso mudaria o segredo digitado.

## Respostas

Cadastro, vínculo do provider `EMAIL` e alteração de senha respondem
`400 VALIDATION_ERROR` quando o campo ultrapassa o limite:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed.",
  "path": "/auth/sign-up",
  "timestamp": "2026-08-13T12:00:00.000Z",
  "details": {
    "fields": [
      {
        "field": "password",
        "messages": [
          "password must not exceed 72 bytes when encoded as UTF-8."
        ]
      }
    ]
  }
}
```

Na alteração de senha, `field` pode ser `currentPassword` ou `newPassword`.

No login, uma entrada acima do limite recebe o mesmo `401 Invalid credentials`
das demais falhas de autenticação. O frontend não deve tentar distinguir senha
incorreta, conta inexistente ou excesso de bytes pela resposta.

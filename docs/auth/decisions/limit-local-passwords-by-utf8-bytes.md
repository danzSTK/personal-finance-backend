---
area: auth
type: decision
status: current
related:
  - ../concepts/local-password-policy.md
  - ../../integrations/auth/passwords.md
---

# Limitar senhas locais por bytes UTF-8

## Decisão

Manter o limite de 6 a 50 caracteres e adicionar um limite máximo inclusivo de
72 bytes UTF-8 para toda senha criada, alterada ou comparada pelo serviço
compartilhado de hash.

A medição é centralizada em uma função baseada em
`Buffer.byteLength(value, 'utf8')`. DTOs a reutilizam por meio de um decorator e
`BcryptHashService` a executa antes de `hash()` e `compare()`.

## Motivos

- bcrypt considera apenas os primeiros 72 bytes de uma senha;
- limite de caracteres não protege entradas Unicode multibyte;
- validar também no serviço protege consumidores que não passam por HTTP;
- rejeitar preserva o segredo original, enquanto truncar ou normalizar o
  modificaria silenciosamente;
- o login não deve revelar uma nova razão distinguível para falha de
  autenticação.

## Consequências

- uma senha pode ter menos de 50 caracteres e ainda ser inválida em bytes;
- frontends podem antecipar a validação com um codificador UTF-8, mas o backend
  continua autoritativo;
- `hash()` e `compare()` podem lançar `PASSWORD_BYTE_LIMIT_EXCEEDED` para
  consumidores internos;
- a estratégia local converte exclusivamente esse erro em `401 Invalid
  credentials`;
- não há truncamento, normalização Unicode, migração de dados ou nova
  dependência.

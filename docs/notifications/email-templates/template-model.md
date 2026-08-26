---
area: notifications
type: email-template-model
status: current
related:
  - ./README.md
  - ./design-system.md
  - ../../platform/email-provider.md
  - ../../database/schema.md
---

# Modelo Dos Templates De E-mail

## Identidade

Um template é identificado por:

```text
template_key + template_version
```

Exemplo: `welcome-email:v1`.

A chave descreve a finalidade lógica. A versão fixa o conteúdo e o contrato de
parâmetros usados por uma intenção. Nenhum desses campos contém referência à
Brevo.

## Fontes Do Contrato

| Artefato                                      | Responsabilidade                                   |
| --------------------------------------------- | -------------------------------------------------- |
| `email-template.contract.ts`                  | chaves, versões e tipos TypeScript                 |
| `email-template-contract.registry.ts`         | schemas Zod e validação runtime                    |
| `api/email-templates/<key>/vN/template.html`  | HTML puro da versão                                |
| `docs/notifications/email-templates/<key>.md` | finalidade, origem e segurança                     |
| configuração de mail                          | mapping da referência lógica para o provider ativo |

Os quatro primeiros artefatos devem mudar juntos. O ID externo fica somente na
configuração da infraestrutura.

## Ciclo De Vida

1. Registrar chave, versão, tipo e schema.
2. Criar o HTML no diretório versionado.
3. Executar `npm run email-templates:validate` a partir de `api/`.
4. Documentar parâmetros, origem, sensibilidade e idempotência.
5. Publicar a versão no provider pelo processo operacional vigente.
6. Configurar o ID retornado na variável de ambiente da mesma versão.
7. Ativar a versão para novas intenções.

Uma versão publicada é imutável. Alterações de conteúdo entregue, assunto,
semântica ou placeholders exigem `vN+1` e novo mapping. Intenções persistidas
continuam usando sua versão original.

## Validação

A criação da intenção valida os parâmetros antes do `INSERT`. O worker repete a
validação depois de carregar o JSONB e antes do provider.

O validador de fontes exige:

- contrato para todo HTML e HTML para todo contrato;
- igualdade entre placeholders `params.*` e parâmetros declarados;
- doctype, `lang="pt-BR"`, título e preheader;
- tabelas de apresentação e texto alternativo nas imagens;
- ausência de `script`, `form` e `iframe`.

Falha de contrato ou mapping é permanente para a intenção. Falha temporária do
provider continua retentável.

## Persistência

`email_messages` guarda:

- chave e versão lógica;
- destinatário;
- parâmetros validados;
- idempotência e estado operacional;
- prazo opcional `deliver_before` para impedir uma tentativa sem utilidade;
- provider e message id somente como resultado do envio.

O banco não guarda HTML nem ID externo do template.

## Segurança

- Não registrar HTML ou valores de parâmetros em logs.
- Não usar senha, hash, cookie, JWT, JTI ou credenciais como parâmetro.
- Aceitar somente URLs web absolutas com protocolo `https` ou `http`; templates
  reais devem usar `https`.
- Marcar links com bearer token como sensíveis.
- Manter mappings e API keys em configuração de ambiente.

`email-verification:v1` ainda persiste a URL de verificação completa no JSONB.
Esse comportamento está documentado e será avaliado em estudo de criptografia
separado antes da produção.

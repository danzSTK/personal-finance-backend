---
name: email-template-constructor
description: Cria, altera, versiona e revisa templates HTML de e-mail transacional da Danfy. Use ao trabalhar em api/email-templates, adicionar uma chave ou versão ao catálogo de notifications, modificar conteúdo ou placeholders, ou validar consistência visual, compatibilidade, acessibilidade e segurança de um template.
---

# Email Template Constructor

Construir templates com baixa liberdade visual. Tratar o catálogo TypeScript,
os schemas Zod, o HTML versionado e a documentação como um único contrato.

## Fluxo Obrigatório

1. Ler `docs/notifications/email-templates/template-model.md`.
2. Ler `docs/notifications/email-templates/design-system.md` por completo.
3. Ler a documentação da chave em `docs/notifications/email-templates/`.
4. Inspecionar o contrato em
   `api/src/modules/notifications/domain/templates/email-template.contract.ts` e
   o schema em
   `api/src/modules/notifications/application/templates/email-template-contract.registry.ts`.
5. Preservar uma versão publicada. Criar `vN+1` quando conteúdo, assunto,
   semântica ou parâmetros mudarem.
6. Criar ou editar somente
   `api/email-templates/<template-key>/v<version>/template.html`.
7. Atualizar contrato, schema, versão ativa e documentação quando necessário.
8. Executar, a partir de `api/`, `npm run email-templates:validate`.
9. Executar os testes do registro e do validador antes de concluir.

## Regras De Construção

- Reutilizar exatamente a linguagem visual descrita na referência
  [Danfy email design system](references/danfy-email-design-system.md).
- Usar HTML baseado em tabelas com `role="presentation"`.
- Manter estilos críticos inline e media queries compatíveis no `<head>`.
- Incluir `<!doctype html>`, `lang="pt-BR"`, `<title>` e preheader oculto.
- Incluir texto alternativo em toda imagem.
- Usar somente assets HTTPS públicos aprovados.
- Não usar JavaScript, formulário, iframe, asset local ou CSS dependente de
  execução no cliente.
- Usar apenas placeholders `{{ params.<nome> }}` declarados no contrato da mesma
  chave e versão.
- Manter placeholders em `snake_case`.
- Não colocar senha, hash, cookie, JWT, JTI, API key ou segredo em HTML.
- Não registrar valores de params durante construção ou validação.

## Versionamento

- Tratar cada diretório `vN` publicado como imutável.
- Criar nova versão para alteração perceptível no conteúdo entregue ou no
  contrato.
- Não trocar a versão de uma intenção já persistida.
- Manter mappings antigos enquanto uma intenção reenfileirável puder referenciá-los.
- Nunca inserir IDs de provider no domínio, HTML ou documentação do template.

## Saída Esperada

Entregar:

- HTML no caminho canônico;
- contrato e schema sincronizados;
- documentação da chave e versão atualizada;
- resultado do validador;
- testes relevantes executados;
- lista objetiva de mudanças visuais ou contratuais.

Não considerar o trabalho concluído quando o validador falhar.

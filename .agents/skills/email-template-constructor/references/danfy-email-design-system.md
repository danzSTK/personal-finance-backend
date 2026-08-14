# Danfy Email Design System

Use esta referência junto da documentação oficial em
`docs/notifications/email-templates/design-system.md`. A documentação oficial é
a fonte canônica; este arquivo contém o checklist mínimo necessário durante a
construção.

## Identidade

- Fundo escuro: `#09090d`.
- Superfície principal escura: `#161622`.
- Painel escuro: `#1f1f2d`.
- Texto principal escuro: `#f6f4ff`.
- Texto secundário escuro: `#bdb7d3`.
- Marca escura: `#a970ff`.
- Ação escura: `#8b5cf6`.
- Fundo claro: `#f3f1f8`.
- Superfície clara: `#ffffff`.
- Painel claro: `#f5f3fa`.
- Texto principal claro: `#171421`.
- Texto secundário claro: `#5f5872`.
- Marca clara: `#6d28d9`.
- Ação clara: `#7c3aed`.
- Fonte: `Inter`, seguida por fontes seguras do sistema.
- Largura máxima do conteúdo: `640px`.

## Estrutura

- Cabeçalho com wordmark Danfy e identificação curta da mensagem.
- Card principal com raio externo de `30px`.
- Título entre `25px` e `29px`, peso `800`.
- Corpo entre `16px` e `17px`, line-height confortável.
- Botão primário arredondado, contraste AA e área de clique ampla.
- Rodapé com assinatura da equipe e orientação de suporte ou segurança.
- Breakpoint móvel em `520px`.
- Light mode por `prefers-color-scheme` sem prejudicar o dark mode padrão.

## Compatibilidade E Segurança

- Usar tabelas de apresentação e atributos HTML tradicionais.
- Duplicar cores importantes em propriedade curta e `background-color` quando
  isso melhorar compatibilidade.
- Não depender de webfont carregada remotamente.
- Não esconder informação essencial apenas por CSS.
- Manter links absolutos e HTTPS fora de ambientes documentados de teste.
- Usar entidades HTML quando necessário para compatibilidade de caracteres.
- Revisar texto alternativo, preheader e leitura sem imagens.

## Contrato

- Conferir cada placeholder contra o schema Zod da mesma versão.
- Não criar placeholder opcional sem documentar sua ausência no HTML.
- Não reutilizar uma versão para mudar placeholders.
- Executar `npm run email-templates:validate` a partir de `api/`.

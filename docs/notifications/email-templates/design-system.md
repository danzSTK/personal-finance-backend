---
area: notifications
type: email-design-system
status: current
related:
  - ./README.md
  - ./template-model.md
---

# Design System Dos E-mails Danfy

## Princípios

- Manter leitura clara sem imagens e em clientes com CSS limitado.
- Usar dark mode como apresentação base e oferecer light mode.
- Priorizar uma ação principal por mensagem.
- Preservar a mesma identidade em todos os e-mails transacionais.
- Não criar novas cores, raios ou escalas tipográficas sem decisão registrada.

## Tokens

| Papel            | Dark      | Light     |
| ---------------- | --------- | --------- |
| Fundo            | `#09090d` | `#f3f1f8` |
| Superfície       | `#161622` | `#ffffff` |
| Painel           | `#1f1f2d` | `#f5f3fa` |
| Texto principal  | `#f6f4ff` | `#171421` |
| Texto secundário | `#bdb7d3` | `#5f5872` |
| Marca/link       | `#a970ff` | `#6d28d9` |
| Ação principal   | `#8b5cf6` | `#7c3aed` |
| Divisor          | `#2c2c3a` | `#e2ddeb` |

Fonte: `Inter`, com fallback para `-apple-system`, `BlinkMacSystemFont`,
`Segoe UI`, `Arial` e `sans-serif`.

## Layout

- Largura máxima: `640px`.
- Card principal: raio externo de `30px`.
- Painéis internos: raio de `18px`.
- Botão principal: raio de `999px` e texto branco em peso `800`.
- Título desktop: `29px/35px`, peso `800`.
- Título móvel: `25px/31px`.
- Corpo desktop: `17px/27px`.
- Corpo móvel: `16px/25px`.
- Breakpoint móvel: `520px`.
- Padding móvel lateral: `24px`.

## Estrutura Obrigatória

1. Preheader oculto e útil.
2. Cabeçalho com wordmark Danfy e rótulo curto da mensagem.
3. Título principal.
4. Saudação usando o parâmetro de nome aprovado.
5. Contexto objetivo e ação principal quando aplicável.
6. Painel de informação ou segurança quando necessário.
7. Rodapé com assinatura da equipe e suporte/orientação pertinente.

O wordmark atual usa:

```text
https://assets.danfy.app/danfy-assets/png/wordmark/danfy_wordmark_light.png
```

## Compatibilidade

- HTML em tabelas com `role="presentation"`.
- Estilos críticos inline.
- Media queries apenas como melhoria progressiva.
- Cores de fundo duplicadas com `background` e `background-color` quando útil.
- Imagens com dimensões, `display:block` e `alt` descritivo.
- Links absolutos; HTTPS em ambientes reais.
- Sem JavaScript, formulário, iframe, vídeo ou asset local.

## Construção E Revisão

Use a skill de repositório `email-template-constructor`. Ao finalizar, execute:

```bash
cd api
npm run email-templates:validate
```

Revise também o conteúdo sem imagens, em largura móvel e nos dois esquemas de
cor. A validação automatizada não substitui revisão visual no provider.

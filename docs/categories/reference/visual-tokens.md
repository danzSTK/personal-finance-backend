---
area: categories
type: reference
status: current
related:
  - ../README.md
  - ../../integrations/categories/get-category-metadata.md
---

# Category Visual Tokens

O backend mantém um catálogo oficial de tokens visuais usados por categorias.

Esses tokens existem para separar contrato de produto de implementação visual:

```text
iconKey: "wallet"
colorToken: "green"
```

não significa "use obrigatoriamente o componente Wallet da Lucide com a classe verde X". Significa "use o ícone e a cor oficiais que o produto chama de wallet e green".

Hoje o frontend pode mapear esses tokens para Lucide React e Tailwind. Amanhã pode trocar para SVG local, design tokens próprios ou outro pacote sem mudar o banco.

## Fluxo

```text
Backend define catálogo permitido
        ↓
Frontend consulta ou replica esse catálogo
        ↓
Usuário escolhe uma opção na UI
        ↓
Frontend envia iconKey/colorToken
        ↓
Backend valida
        ↓
Backend salva os tokens
        ↓
Frontend renderiza com iconMap/colorMap
```

## Regras

- o backend salva `iconKey` e `colorToken`, não SVG, classe CSS ou hexadecimal escolhido livremente;
- `hex` existe no metadata para preview e fallback visual do frontend;
- o backend valida que `iconKey` e `colorToken` pertencem ao catálogo oficial;
- o banco usa `varchar`, não enum SQL, para facilitar evolução do catálogo;
- categorias default criadas pelo backend devem usar os mesmos tokens oficiais;
- tokens inválidos devem falhar na validação antes de persistir.

## Contrato Atual

O catálogo público para o frontend está em:

```http
GET /categories/metadata
```

Documentação de integração: [Get category metadata](../../integrations/categories/get-category-metadata.md).

## Onde Mora No Código

- enums permitidos: `api/src/common/models/enums/color-token.enum.ts` e `api/src/common/models/enums/icon-key.enum.ts`;
- metadata com labels e hex: `api/src/common/models/constants/visual-tokens.constants.ts`;
- validação de domínio: `api/src/modules/categories/domain/entities/category.entity.ts`;
- contrato HTTP: `api/src/modules/categories/presentation/dto/create-category.dto.ts` e `update-category.dto.ts`.

---
name: modular-documentation
description: Use when creating, updating, organizing, or reviewing living domain documentation in docs/<module>/ following Danfy's modular standard (concepts, flows, decisions, references, and README maps).
---

# Modular Documentation (Documentação Viva de Domínio)

Siga esta skill sempre que criar, alterar, organizar ou revisar a documentação modular de um domínio em `docs/<modulo>/`.

---

## 1. Filosofia Central

> **Documentamos o domínio, as regras e os porquês — nunca a sintaxe óbvia do código.**

- **O que documentar:** Regras de negócio, fluxos operacionais de ciclo de vida, invariantes de integridade, alternativas descartadas e justificativas de decisões arquiteturais.
- **O que NÃO documentar:** Não faça tutoriais de código. Não descreva "a classe X herda de Y", "o controller injeta o use case Z" ou "o método faz um if no parâmetro". O código se autoexplica para sintaxe; a documentação existe para explicar **por que** ele existe e **como o negócio funciona**.

---

## 2. Estrutura Modular por Domínio

Cada módulo em `docs/<modulo>/` é organizado nos seguintes pilares:

```text
docs/<modulo>/
├── README.md              # Índice do módulo: mapa de leitura, estado atual e pendências
├── concepts/              # O "O QUÊ": conceitos de domínio, identidade, ownership e fronteiras
├── flows/                 # O "COMO OPERA" (Principal): fluxos de ciclo de vida, passos observáveis, idempotência
├── decisions/             # O "PORQUÊ" (Principal): decisões arquiteturais, alternativas descartadas e trade-offs
└── reference/             # O "CONTRATO": esquemas, invariantes de validação, tabelas de códigos e open questions
```

---

## 3. Frontmatter Canônico (YAML)

Todo documento Markdown em `docs/<modulo>/` (com exceção do `README.md` raiz do projeto) deve iniciar com metadados estruturados:

```yaml
---
area: <modulo>          # Nome do módulo (ex: assets, accounts, auth, transactions)
type: <tipo>            # concept | flow | decision | reference | index
status: <status>        # draft | current | deprecated
related:                # Links relativos para documentos relacionados
  - ./outro-documento.md
  - ../concepts/conceito.md
---
```

---

## 4. Regras de Ouro

1. **Atomicidade:** Cada arquivo deve tratar de **apenas um** fluxo, **uma** decisão ou **um** conceito. Nunca agrupe múltiplas decisões em um arquivo genérico.
2. **Nomenclatura:** Arquivos em `kebab-case.md` com nomes claros e descritivos em inglês ou português conforme o módulo (ex.: `asynchronous-deletion-via-reconciler.md`, `asset-status.md`).
3. **Mantenha o README do Módulo Atualizado:** Ao criar um novo fluxo, decisão ou conceito, adicione imediatamente o link no `docs/<modulo>/README.md` sob a seção correspondente.
4. **Decisões Registram Motivos:** Uma decisão deve conter a seção `## Decisão` e `## Motivos` (incluindo o que aconteceria se a alternativa fosse escolhida).
5. **Fluxos Tratam Falhas e Idempotência:** Um documento de fluxo não pode conter apenas o "caminho feliz". Deve explicitar: o que acontece se o provedor cair, como funciona a idempotência e qual o estado resultante.

---

## 5. Modelos e Referências da Skill

Consulte os templates específicos antes de redigir:

- **Decisões:** leia `references/decision-template.md` para estruturar decisões arquiteturais e trade-offs.
- **Fluxos:** leia `references/flow-template.md` para estruturar fluxos ponta a ponta com estados e falhas.
- **Conceitos:** leia `references/concept-template.md` para modelar termos de negócio, identidade e ownership.
- **Índice do Módulo:** leia `references/module-index-template.md` para estruturar o `README.md` raiz de cada módulo.
- **Frontmatter e Status:** leia `references/frontmatter-spec.md` para a lista completa de tipos e status válidos.

---

## 6. Exemplos Canônicos no Repositório

Use estas pastas como fonte de referência do padrão aplicado:

- `docs/assets/`: padrão de ouro para ciclo de vida de arquivos, separação de storage e reconciliação assíncrona.
- `docs/accounts/`: padrão de ouro para modelagem de agregados separados (`account` e `account-template`) e decisões.
- `docs/auth/`: padrão para fluxos de autenticação, políticas de segurança e referência de chaves Redis.

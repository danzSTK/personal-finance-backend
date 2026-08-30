---
area: accounts
feature: account-templates
type: spec-requirements
status: approved
issue: 91
related:
  - ../../../../accounts/README.md
  - ../../../../accounts/concepts/account.md
  - ../../../../accounts/reference/invariants.md
  - ../../../../database/migration-rollout.md
  - ../../../../architecture/compatibility.md
  - ../../../../database/schema.md
  - ../../../../integrations/accounts/create-account.md
  - ../../../../integrations/accounts/update-account.md
  - ../../../../integrations/accounts/list-accounts.md
---

# Requirements - Account Templates

## Objetivo

Separar a identidade visual dos dados financeiros de uma account, fazendo com que toda identidade visual seja representada por um `account_template`.

A primeira entrega deve disponibilizar um catálogo global com dez instituições curadas pela Danfy, manter templates customizados privados para representar contas não institucionais e preservar a compatibilidade de banco e HTTP necessária para usar a v0.3 como imagem de rollback até a janela da v0.5.

## Contexto E Fontes

- GitHub issue [#91](https://github.com/danzSTK/personal-finance-backend/issues/91).
- Decisões registradas em `docs/accounts/decisions/`.
- Contrato atual de account em `docs/accounts/**` e `docs/integrations/accounts/**`.
- Schema e migrations atuais de `accounts`.
- Processo obrigatório `expand -> migrate -> contract`.

Hoje `accounts.color` e `accounts.icon` misturam dados financeiros com apresentação. `POST /accounts`, `PATCH /accounts/:id` e os responses de account também expõem esses campos diretamente.

## Escopo

- Criar o conceito e a persistência de `account_templates`.
- Diferenciar templates `INSTITUTIONAL` globais de templates `CUSTOM` privados de um usuário.
- Adicionar `accounts.template_id` como referência à identidade visual.
- Disponibilizar um endpoint autenticado para listar templates institucionais ativos.
- Aceitar um objeto discriminado `template` na criação e atualização de account.
- Retornar os metadados do template associado nos responses de account.
- Provisionar dez templates institucionais por seed explícito, idempotente e determinístico.
- Manter o catálogo versionado no repositório.
- Criar um comando explícito de curadoria para consultar a BrasilAPI v1, baixar os SVGs indicados por `logo_url`, validá-los e armazenar os bytes SVG no Object Storage da Danfy.
- Preservar temporariamente `accounts.color`, `accounts.icon` e os campos HTTP `color`/`icon` para compatibilidade com a v0.3.
- Migrar accounts existentes e accounts criadas por escritores legados para templates customizados.
- Documentar e validar o rollout até o contract previsto para a v0.5.

## Fora De Escopo

- Remover `accounts.color` ou `accounts.icon` durante a fase expand/migrate.
- Tornar `accounts.template_id` `NOT NULL` enquanto a v0.3 puder ser usada em rollback.
- Permitir que usuários alterem templates institucionais.
- Permitir upload de logos customizadas por usuários.
- Tornar templates customizados reutilizáveis ou gerenciáveis por um catálogo público nesta entrega.
- Sincronizar automaticamente a BrasilAPI.
- Consultar BrasilAPI ou o CDN indicado por `logo_url` em requests, no startup normal, no worker normal ou no seed.
- Reutilizar a tabela `assets` para logos institucionais.
- Definir atualização automática de marca, nome ou logo de uma instituição.
- Executar o contract da v0.5 nesta entrega.

## Regras De Negócio

### Identidade Visual

- Toda account criada pela imagem nova deve terminar associada a um template.
- Uma account pode referenciar um template institucional global ou um template customizado pertencente ao mesmo usuário.
- A account armazena somente `templateId` como referência visual nova.
- O `type` recebido em `template` expressa a intenção do comando HTTP e não é persistido como uma classificação confiável enviada pelo cliente.
- Quando `template.type=institutional`, o backend usa `template.templateId` somente como referência e confirma no catálogo persistido que o recurso é institucional, ativo e selecionável.
- Quando `template.type=custom`, o backend cria ou atualiza um template classificado como `CUSTOM` por regra própria; o cliente não escolhe diretamente o valor persistido de `template_type`.
- Template institucional é imutável pelo usuário.
- Template customizado representa a identidade visual de uma account não institucional.
- A associação de um template customizado deve validar ownership usando o `userId` autenticado.
- Um template de outro usuário nunca pode ser lido como selecionável nem associado à account.

### Catálogo Institucional

- Os templates institucionais são globais e compartilhados; não há cópia por usuário.
- A primeira versão contém exatamente as dez instituições curadas na seção "Catálogo Inicial".
- A cor institucional é um token específico da instituição, como `nubank`; o backend não persiste hexadecimal nem classe CSS.
- O frontend é responsável por mapear `colorToken` para uma cor do design system.
- O logo em runtime é servido pelo Object Storage da Danfy.
- A tabela persiste somente a storage key relativa; bucket e base URL são configuração interna.
- Templates institucionais inativos deixam de aparecer no catálogo e não podem ser escolhidos por novas associações.
- Accounts já associadas a um template institucional inativo continuam recebendo seus metadados e renderizando sua identidade.
- Templates referenciados por accounts não são removidos fisicamente.

### Provisionamento E Curadoria

- O seed consome somente dados versionados no repositório.
- Reexecutar o seed não cria duplicatas e converge os registros conhecidos para o conteúdo versionado.
- O seed não roda em migration nem no startup normal.
- O comando de curadoria é uma operação separada do seed e pode acessar rede.
- A BrasilAPI fornece `code`, `ispb`, `name`, `fullName` e `logo_url` para conferência do catálogo.
- O catálogo versiona a `logo_url` exata retornada pela BrasilAPI para cada instituição selecionada.
- O comando aceita download somente por HTTPS no host `cdn.jsdelivr.net` e no prefixo versionado `npm/logos-bancos-br@0/logos/svg/`; redirects para origem fora da allowlist são rejeitados.
- Resposta não `200`, content type inesperado, bytes que não representem SVG, SVG acima do limite definido, checksum divergente, markup ativo proibido ou upload não confirmado interrompem a curadoria daquela instituição.
- O SVG é preservado para manter qualidade vetorial no frontend. O comando rejeita DTD/entities, `script`, `foreignObject`, atributos de evento e referências externas executáveis.
- O catálogo/manifesto de curadoria registra o checksum SHA-256 esperado do SVG; alteração de bytes sob a mesma `logo_url` exige revisão explícita antes de sobrescrever o objeto controlado.
- Os arquivos ficam com `Content-Type: image/svg+xml` no bucket público configurado como `danfy-public-bucket`, sob `banking-institutions-icons/<slug>.svg`.

### Compatibilidade Com V0.3

- A migration expand deve manter `accounts.color` e `accounts.icon` com seus tipos, nulabilidade e comportamento atuais.
- `accounts.template_id` nasce nullable.
- A imagem v0.3 deve continuar criando, lendo e atualizando accounts depois da migration expand.
- A imagem nova deve aceitar requests legadas que enviem `color` e/ou `icon` sem `template`.
- Requests legadas devem criar ou atualizar um template customizado privado e manter os campos legados em dual-write.
- Requests com `template.type=institutional` devem atualizar a associação e também preencher `color`/`icon` legados com um fallback compatível para a v0.3.
- Requests com `template.type=custom` devem criar ou atualizar o template customizado privado e projetar `colorToken`/`iconKey` nos campos legados.
- `template` não pode ser combinado com `color` ou `icon` no mesmo request; payload misto deve falhar com erro de validação sem alteração parcial.
- Durante a compatibilidade, responses de account devem retornar o novo objeto `template` e preservar `color`/`icon` como campos deprecated.
- A imagem nova deve tolerar cache e linhas criadas pela v0.3 sem `template_id`, usando os campos legados como fallback até reconciliá-las.
- Se a v0.3 alterar `color`/`icon` de uma account já associada, a imagem nova deve detectar a divergência e materializar/atualizar um template customizado, preservando a última escolha legada.
- O contract só pode ocorrer quando a v0.3 não for mais uma imagem elegível de rollback e os gates documentados estiverem comprovados.

## Catálogo Inicial

| Nome de exibição | Código | ISPB       | `logo_url` versionada                                                   | `colorToken`      |
| ---------------- | -----: | ---------- | ----------------------------------------------------------------------- | ----------------- |
| Nubank           |    260 | `18236120` | `https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/18236120.svg` | `nubank`          |
| Inter            |     77 | `00416968` | `https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/00416968.svg` | `inter`           |
| Itaú             |    341 | `60701190` | `https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/60701190.svg` | `itau`            |
| Bradesco         |    237 | `60746948` | `https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/60746948.svg` | `bradesco`        |
| Santander        |     33 | `90400888` | `https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/90400888.svg` | `santander`       |
| Banco do Brasil  |      1 | `00000000` | `https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/00000000.svg` | `banco-do-brasil` |
| Caixa            |    104 | `00360305` | `https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/00360305.svg` | `caixa`           |
| C6 Bank          |    336 | `31872495` | `https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/31872495.svg` | `c6`              |
| PicPay           |    380 | `22896431` | `https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/22896431.svg` | `picpay`          |
| Mercado Pago     |    323 | `10573521` | `https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/10573521.svg` | `mercado-pago`    |

Os identificadores bancários acima foram conferidos em 29/08/2026 no endpoint `GET https://brasilapi.com.br/api/banks/v1`. O catálogo versionado, e não a resposta futura da API, é a entrada do seed.

## Fluxos

### Selecionar Template Institucional

1. O cliente lista templates institucionais ativos.
2. O usuário envia `template: { type: "institutional", templateId }`.
3. O backend valida que o template é institucional, ativo e selecionável.
4. O backend associa o template à account e atualiza os campos legados dentro da mesma operação.
5. O response retorna o template completo e os campos legados deprecated.

### Criar Ou Atualizar Com Payload Legado

1. A v0.3 envia `color`/`icon` sem `template`.
2. O backend valida os tokens legados.
3. O backend cria ou atualiza um template `CUSTOM` pertencente ao usuário.
4. O backend associa a account ao template e mantém `color`/`icon` em dual-write.
5. O response continua utilizável pela v0.3 e informa o template para clientes novos.

### Reconciliar Accounts Sem Template

1. Um comando explícito seleciona accounts com `template_id IS NULL` em lotes.
2. Cada account é bloqueada e reconciliada em uma transação curta.
3. O comando cria um template customizado a partir de `color`/`icon` e associa a account.
4. Reexecuções ignoram accounts já reconciliadas.
5. Accounts criadas por uma v0.3 após uma execução anterior são reconciliadas em nova execução.

## Casos De Borda

- `template.templateId` inexistente, inativo, customizado ou não selecionável no fluxo `institutional` deve retornar erro sem salvar a account.
- O backend nunca deve converter um template persistido `CUSTOM` em institucional nem aceitar sua seleção pelo branch `institutional`, mesmo quando o cliente declara esse `type`.
- No branch `custom`, a classificação persistida deve ser criada pelo backend e o payload não deve aceitar `templateId`, owner ou metadados institucionais.
- Uma account legada com `color=null` e `icon=null` ainda deve receber um template customizado válido, com ambos opcionais.
- Falha ao salvar template e account não pode deixar associação parcial; as escritas participam da mesma transação.
- Falha de BrasilAPI, CDN de origem ou Object Storage afeta apenas o comando explícito de curadoria, nunca a leitura cotidiana de accounts.
- `logo_url` ausente, fora da allowlist ou divergente do catálogo interrompe a curadoria e exige revisão.
- Mudança de checksum sob uma `logo_url` já curada não pode substituir silenciosamente o asset vigente.
- O seed não deve persistir bucket, URL assinada nem URL externa de origem.
- Uma alteração de logo institucional deve substituir o objeto de forma controlada e versionada; a política completa de lifecycle permanece fora de escopo.

## Critérios De Aceitação

- [ ] Dada uma account criada pela imagem nova, sua identidade visual é obtida por um `account_template` associado.
- [ ] Dado um template institucional, usuários diferentes podem selecioná-lo sem criar cópias por usuário.
- [ ] Dado um template customizado, somente seu owner pode associá-lo ou alterá-lo.
- [ ] Dado um template institucional, o usuário não consegue alterar `colorToken`, logo ou metadados bancários.
- [ ] Dado `GET /account-templates`, somente templates institucionais ativos são listados.
- [ ] Dada uma account associada a template institucional inativo, ela ainda retorna metadados suficientes para renderização.
- [ ] Dado um response de account durante a janela compatível, `template` e os campos deprecated `color`/`icon` estão presentes conforme o contrato.
- [ ] Dado `template: { type: "institutional", templateId }`, a API associa somente um template institucional ativo confirmado pelo backend.
- [ ] Dado `template: { type: "custom", colorToken, iconKey }`, a API cria ou atualiza um template classificado como customizado pelo backend.
- [ ] Dado um request legado sem `template`, a operação continua válida e produz um template customizado associado.
- [ ] Dado um request misto com `template` e `color`/`icon`, a API rejeita o payload sem escrita parcial.
- [ ] Dada a migration expand aplicada, a imagem v0.3 continua criando, listando e atualizando accounts.
- [ ] Dada uma imagem nova antes da migration expand, a ativação é bloqueada pela ordem de deploy documentada.
- [ ] Dada uma account com `template_id IS NULL`, a imagem nova consegue lê-la e o comando de reconciliação consegue associá-la de forma idempotente.
- [ ] Dada a repetição do seed, continuam existindo somente os dez templates institucionais identificados por suas chaves estáveis.
- [ ] Dada indisponibilidade da BrasilAPI ou do CDN de origem, o seed e o runtime continuam funcionando com o catálogo e os assets já versionados/armazenados.
- [ ] Dada `logo_url` ausente, inválida ou fora da allowlist, a curadoria falha sem publicar um asset incorreto.
- [ ] Dado um template retornado pela API, `colorToken` é um token do catálogo de account templates e a URL pública é derivada pela aplicação a partir da storage key.
- [ ] O Swagger, os contratos de integração, `docs/database/schema.md` e o registro de compatibilidade refletem o estado realmente implantado.

## Expectativas Para O Frontend

- Clientes novos enviam `template: { type: "institutional", templateId }` para selecionar uma instituição.
- Clientes novos enviam `template: { type: "custom", colorToken, iconKey }` para definir uma identidade customizada.
- Clientes novos renderizam `template.colorToken` e `template.logoUrl`/`template.iconKey`.
- O frontend não monta URLs com bucket ou storage key.
- O frontend não consulta BrasilAPI nem o CDN externo de origem.
- `color` e `icon` no nível da account são deprecated e existem somente durante a janela de compatibilidade.

## Aprovação

Spec aprovada em 29/08/2026. A implementação deve preservar SVG como formato canônico dos logos e seguir as fases e gates registrados neste conjunto de documentos.

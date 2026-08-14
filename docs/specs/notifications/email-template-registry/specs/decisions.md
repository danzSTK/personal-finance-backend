---
area: notifications
feature: email-template-registry
type: spec-decisions
status: current
related:
  - ./requirements.md
  - ./design.md
---

# Decisions - Email Template Registry

## DEC-001 - Identificar templates por chave lógica

Status: accepted

Decision:
Consumidores usam uma chave lógica estável, nunca o ID externo da Brevo.

Reason:
O ID pertence ao provider e acopla domínio, aplicação, persistência e testes à
Brevo.

Impact:
IDs deixam de aparecer em entidades, casos de uso, eventos e documentação de
domínio.

## DEC-002 - Resolver provider por chave e versão

Status: accepted

Decision:
O adapter Brevo resolve a combinação `templateKey + templateVersion` para seu
ID numérico.

Reason:
Resolver apenas pela chave faria mensagens antigas usarem silenciosamente um
novo contrato após troca de template.

Impact:
Cada versão publicada possui mapping próprio e o mapping antigo deve sobreviver
enquanto houver mensagens reenfileiráveis.

## DEC-003 - Preservar chaves com hífen

Status: accepted

Decision:
Manter `welcome-email` e `email-verification` e usar hífen nas novas chaves.

Reason:
Essas chaves já estão persistidas, documentadas e usadas como tags. Renomeá-las
não melhora o isolamento do provider e exigiria migração adicional.

Impact:
Nomes de constantes TypeScript podem continuar em maiúsculas, mas seus valores
persistidos seguem `kebab-case`.

## DEC-004 - Versionar templates desde o v1

Status: accepted

Decision:
Adicionar `template_version` inteiro positivo e tratar os templates atuais como
versão `1`.

Reason:
Versão torna explícito o contrato aplicado a cada intenção e preserva retry,
auditoria e evolução de parâmetros.

Impact:
Novas intenções usam a versão ativa; intenções existentes nunca são promovidas
automaticamente.

## DEC-005 - Usar tipagem estática e validação Zod

Status: accepted

Decision:
Relacionar chave, versão e parâmetros no TypeScript e validar o payload com
schemas Zod estritos.

Reason:
Tipagem impede erros na autoria, mas desaparece em runtime e não protege JSONB
reconstituído do banco. Zod já é dependência do projeto.

Impact:
Campos ausentes, extras ou com tipo incorreto falham antes da persistência e
antes do provider.

## DEC-006 - Revalidar na fronteira do worker

Status: accepted

Decision:
Validar novamente o contrato carregado de `email_messages` imediatamente antes
do envio.

Reason:
PostgreSQL é uma fronteira externa ao sistema de tipos e pode conter registros
antigos ou alterados.

Impact:
Falhas de contrato são permanentes e não consomem tentativas inúteis na Brevo.

## DEC-007 - Não criar tabela de catálogo

Status: accepted

Decision:
Manter o catálogo de templates no código versionado, sem tabela
`email_templates`.

Reason:
Os contratos TypeScript, schemas e código consumidor precisam ser publicados em
conjunto. Uma tabela configurável permitiria combinações que o binário não sabe
interpretar.

Impact:
Adicionar template ou versão exige deploy, documentação e mapping de ambiente.

## DEC-008 - Remover provider_template_id da intenção

Status: accepted

Decision:
Remover `provider_template_id` de `email_messages` na migration direta desta
feature.

Reason:
O ID não descreve a intenção de negócio e pode variar por ambiente ou provider.

Impact:
Mensagens reenfileiráveis dependem do mapping da chave e versão no ambiente do
worker. A migration aborta antes de alterar o schema se encontrar mensagens em
estado reenfileirável ou chaves históricas desconhecidas.
O método `down` da migration mantém os antigos valores `2` e `3` exclusivamente
para reconstruir o schema histórico em um rollback; eles não participam do
catálogo, do domínio nem da resolução runtime.

## DEC-009 - Provider representa resultado operacional

Status: accepted

Decision:
`provider` deixa de ser obrigatório na criação e passa a representar o provider
que efetivamente aceitou o envio.

Reason:
A intenção escolhe o conteúdo lógico; a infraestrutura e o ambiente escolhem o
provider.

Impact:
A coluna se torna nullable. O provider e seu message ID são registrados no
resultado, sem voltar a acoplar a criação da intenção.
Mensagens históricas `SENT` preservam o provider que as aceitou; nos demais
estados permitidos pela migration, o valor legado é limpo por descrever intenção
e não resultado.

## DEC-010 - Usar migration direta sem compatibilidade transitória

Status: accepted

Decision:
Adicionar e preencher a versão, validar o estado existente e remover a coluna
antiga na mesma migration transacional.

Reason:
O ambiente ainda não possui backlog de jobs ou mensagens de e-mail pendentes e
não precisa manter workers antigos durante a implantação.

Impact:
A implantação deve parar processos antigos e confirmar a ausência de mensagens
reenfileiráveis. Se a premissa falhar, a migration aborta e a decisão deve voltar
para expand-contract antes de prosseguir.

## DEC-011 - IDs vêm de variáveis sem default

Status: accepted

Decision:
Cada chave e versão Brevo possui variável de ambiente com inteiro positivo e sem
default numérico no código.

Reason:
IDs podem variar entre contas e ambientes. Defaults escondem configuração
incorreta e recriam hardcode.

Impact:
Worker Brevo com mail habilitado falha cedo quando um mapping ativo estiver
ausente. Noop e API não exigem mappings.

## DEC-012 - Backend é a fonte oficial dos HTMLs

Status: accepted

Decision:
Versionar HTML puro em `api/email-templates/<key>/v<version>/template.html`.

Reason:
O backend produz, valida, persiste e envia o contrato. Manter os arquivos no
frontend divide ownership e permite divergência.

Impact:
Os dois HTMLs atuais são copiados e validados no backend antes de serem removidos
do repositório frontend.

## DEC-013 - Não automatizar publicação na Brevo nesta feature

Status: accepted

Decision:
Manter publicação/sincronização do HTML com a Brevo como procedimento manual
documentado.

Reason:
Automatizar criação e atualização remota exige credenciais, lifecycle, rollback
e controles operacionais que não são necessários para corrigir o contrato.

Impact:
O repositório é a fonte de verdade, mas o operador ainda publica cada versão e
configura seu ID no ambiente.

## DEC-014 - Validar HTML contra o catálogo

Status: accepted

Decision:
Criar um validador determinístico que compare placeholders com o contrato e
verifique regras estruturais e de segurança.

Reason:
Uma skill ou revisão humana isolada não garante que HTML e TypeScript permaneçam
sincronizados.

Impact:
O comando será usado localmente, pela skill e pela CI.

## DEC-015 - Criar uma skill de baixa liberdade visual

Status: accepted

Decision:
Criar a skill de repositório `email-template-constructor` com regras rígidas do
design system Danfy e validação obrigatória.

Reason:
Templates de e-mail têm compatibilidade frágil e precisam manter identidade
visual consistente.

Impact:
A skill referencia contratos e documentação canônicos, não cria um segundo
catálogo e não inclui documentação auxiliar desnecessária.

## DEC-016 - Manter idempotência independente da versão

Status: accepted

Decision:
Não incluir `template_version` na chave de idempotência de negócio.

Reason:
Uma nova versão visual não cria um novo fato que autorize enviar novamente o
mesmo e-mail.

Impact:
Reprocessar o mesmo evento recupera a intenção original e sua versão original.

## DEC-017 - Manter placeholders em snake_case

Status: accepted

Decision:
Preservar nomes como `first_name` e `verification_url` no contrato enviado ao
provider.

Reason:
Os HTMLs atuais já usam esse padrão. Misturar camelCase e snake_case aumenta o
risco de divergência sem benefício funcional.

Impact:
Interfaces TypeScript devem representar exatamente os nomes usados no HTML.

## DEC-018 - Não incluir templates de senha nesta spec

Status: accepted

Decision:
Esta feature migra `welcome-email:v1` e `email-verification:v1`; os templates de
alteração de senha serão registrados na spec de notificações de auth.

Reason:
Separar a fundação do comportamento novo reduz risco de misturar migration,
refactor do provider, design de e-mail e handlers de segurança em uma única
entrega.

Impact:
A próxima spec usa o catálogo, o versionamento, o validador e a skill já
estabelecidos.

## DEC-019 - Registrar o risco de verification_url

Status: accepted

Decision:
Documentar que `email-verification:v1` persiste atualmente a URL completa com
token em `template_params` e exigir decisão separada antes da produção.

Reason:
O token bruto não pode ser reconstruído a partir do hash do challenge, mas sua
persistência em JSONB amplia a superfície de exposição. Esconder esse fato na
documentação seria incorreto.

Impact:
Esta spec impede logs do valor, mas não escolhe silenciosamente criptografia,
referência indireta ou mudança do fluxo de challenge.

## DEC-020 - Não documentar valores numéricos externos

Status: accepted

Decision:
Documentos de domínio e templates informam somente o nome da variável de mapping,
sem o ID concreto da Brevo.

Reason:
O valor varia por ambiente e não faz parte do contrato lógico.

Impact:
Números existentes são removidos da documentação oficial e permanecem apenas na
configuração segura de cada ambiente.

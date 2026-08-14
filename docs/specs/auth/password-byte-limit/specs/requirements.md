# Requisitos — limite UTF-8 de senhas locais

## Objetivo

Impedir que qualquer senha criada, alterada ou comparada pelo backend seja
truncada silenciosamente pelo bcrypt, centralizando o limite máximo de 72 bytes
UTF-8 sem remover o limite atual de 50 caracteres.

Fonte de rastreamento: issue #80.

## Escopo

- Cadastro com provider `EMAIL`.
- Vínculo posterior do provider `EMAIL`.
- Login local.
- Confirmação da senha atual e definição da nova senha.
- Serviço compartilhado de hash usado por fluxos atuais e futuros.
- Contratos HTTP, Swagger, erros da plataforma e documentação de integração.

## Regras

- O tamanho deve ser calculado sobre a string recebida com
  `Buffer.byteLength(password, 'utf8')`.
- A aplicação não deve normalizar, cortar ou modificar o segredo para adequá-lo
  ao limite.
- Exatamente 72 bytes são permitidos; 73 bytes ou mais são rejeitados antes de
  chamar bcrypt.
- O limite de 6 a 50 caracteres continua válido e independente do limite em
  bytes.
- Fluxos HTTP de criação ou alteração devem rejeitar o campo na borda com o
  contrato `VALIDATION_ERROR`.
- O serviço compartilhado de hash deve preservar o invariante mesmo quando um
  consumidor ignora a camada HTTP.
- `hash()` e `compare()` não podem encaminhar ao bcrypt uma entrada acima do
  limite e devem lançar um erro específico e framework-independent.
- O login deve converter somente esse erro interno em credenciais inválidas e
  preservar a resposta genérica `401`, sem expor política de senha ou existência
  de conta.
- Erros, detalhes e logs nunca podem conter a senha, seu prefixo ou hash.

## Casos especiais

- ASCII pode chegar a 50 bytes pelo limite atual de caracteres.
- Acentos, alfabetos multibyte e emoji podem ultrapassar 72 bytes antes de 50
  caracteres e devem ser rejeitados.
- Uma entrada acima do limite usada em comparação nunca pode autenticar por
  compartilhar os primeiros 72 bytes com outra senha.
- Não existem credenciais legadas conhecidas acima do limite; não haverá
  migração ou reprocessamento de hashes.

## Critérios de aceitação

- [ ] Entradas de 72 bytes passam por hash e comparação normalmente.
- [ ] Entradas de 73 bytes ou mais nunca chegam ao bcrypt.
- [ ] Cadastro, vínculo `EMAIL` e alteração de senha retornam erro de validação
      associado ao campo quando o limite é excedido.
- [ ] Consumidores internos recebem `PASSWORD_BYTE_LIMIT_EXCEEDED` se chamarem o
      serviço com entrada acima do limite.
- [ ] Login acima do limite permanece uma falha genérica `401`.
- [ ] Nenhuma variante acima do limite autentica por truncamento.
- [ ] Swagger e documentação explicam que caracteres e bytes são limites
      simultâneos.
- [ ] Testes cobrem ASCII, acentos, emoji e as fronteiras de 72 e 73 bytes.

## Fora de escopo

- Trocar bcrypt por outro algoritmo.
- Alterar custo, salt ou formato dos hashes.
- Normalizar Unicode em senhas.
- Migration, inspeção de senhas existentes ou reset compulsório.

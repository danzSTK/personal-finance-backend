---
applyTo: "**/*.spec.ts"
---

# Regras: Testes — Estratégia por Camada

## Testes de Domínio (domain/entities, domain/value-objects)
- PURO Node.js — PROIBIDO instanciar `Test.createTestingModule()` do NestJS
- Sem mocks: testam comportamento real da entidade/VO
- Estrutura de teste para Value Objects:
describe('Email VO', () => {
describe('create()', () => {
it('deve normalizar para minúsculo e remover espaços')
it('deve lançar erro para email inválido')
it('deve lançar erro para email acima do tamanho máximo')
})
describe('equals()', () => {
it('deve retornar true para emails idênticos')
})

- Estrutura de teste para Entidades de Domínio:
describe('User Entity', () => {
describe('addAuthProvider()', () => {
it('deve adicionar provider com sucesso')
it('deve lançar exceção se provider duplicado')
})
})

**O PLANO:** Substituir o `$SELECTION_PLACEHOLDER$` pelo trecho de estrutura de testes da entidade de domínio, alinhando com o restante das instruções.

**O PORQUÊ:** Mantém a documentação de testes consistente e evita ambiguidades sobre como estruturar specs de entidades.

**O COMO:** Inserir o bloco `describe('User Entity'...)` dentro da seção de “Estrutura de teste para Entidades de Domínio”, mantendo a mesma indentação e formatação usada nas instruções.

**VALIDAÇÃO:** Esse plano faz sentido para você? Quer que eu mostre o código já formatado ou prefere ajustar algo antes?
})

## Testes de Use Case (application/use-cases)
- Usar `@nestjs/testing` com `Test.createTestingModule()`
- Mockar SEMPRE a interface `IRepository`, nunca a implementação TypeORM ou o CachedRepository
- Mock via objeto literal tipado:
```typescript
const mockUserRepository: jest.Mocked<IUserRepository> = {
  findByEmail: jest.fn(),
  findByUserName: jest.fn(),
  save: jest.fn(),
  // ...demais métodos
};

Estrutura obrigatória por Use Case:

describe('CreateUserUseCase', () => {
  describe('execute()', () => {
    it('deve criar usuário com sucesso quando dados válidos')
    it('deve lançar ConflictException se email já cadastrado')
    it('deve lançar ConflictException se username já cadastrado')
    it('deve chamar repository.save() exatamente uma vez')
  })
})

Verificar que save() foi chamado com a entidade de domínio correta (não primitivos)

Testes de Repositório/Infraestrutura
Usar @nestjs/testing com banco em memória (SQLite) ou container Docker (Testcontainers)

Testam a implementação TypeORM real (user.repository.ts), não a interface

NÃO testar o CachedRepository com Redis real — mockar o REDIS_CLIENT

Testes de Controller (E2E)
Ficam em test/ (raiz do projeto api)

Usar supertest com a aplicação NestJS completa inicializada

Testar fluxos completos: request HTTP → response HTTP, incluindo status codes e formato do body

Regras Gerais
Cobertura mínima: 90% em domain/ e application/use-cases/; 70% em infrastructure/

Nome do arquivo: <nome>.use-case.spec.ts, <nome>.value-object.spec.ts, <nome>.entity.spec.ts

Um describe raiz por arquivo, com describe internos por método/cenário

beforeEach() para reset de mocks: jest.clearAllMocks()

Nenhum teste com setTimeout ou dependência de ordem de execução




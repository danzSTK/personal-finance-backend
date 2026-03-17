---
applyTo: "api/src/modules/*/application/**"
---

# Regras: Camada de Aplicação (Use Cases)

## Estrutura
- Um diretório por Use Case: `application/use-cases/<acao>/`
- Cada diretório contém: `<acao>.use-case.ts` e `<acao>.dto.ts`
- Use Case é um `@Injectable()` com método `execute(dto, options?)`

## Responsabilidades do Use Case
- Orquestra domínio + infraestrutura: busca via repositório → cria/opera entidade de domínio → persiste
- NÃO contém lógica de negócio — essa lógica fica nas entidades/VOs de domínio
- NÃO importa entidades TypeORM diretamente — usa apenas interfaces `IRepository` do domínio
- PODE lançar `HttpException` do NestJS quando necessário (ex: `ConflictException`, `NotFoundException`)

## DTOs de Use Case
- Tipados com interfaces TypeScript simples (não `class` com decorators — esses ficam na `presentation`)
- Representam o contrato entre a camada de apresentação e a aplicação

## Injeção de Dependência
- Depende de `IRepository` (interface), nunca da implementação concreta
- O binding interface → implementação é feito no `<nome>.module.ts`

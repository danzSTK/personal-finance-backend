---
applyTo: "api/src/modules/*/presentation/**"
---

# Regras: Camada de Apresentação

## Controllers
- Ficam em `presentation/http/`
- São FINOS: deserializa request → chama Use Case → serializa response
- NUNCA contêm lógica de negócio ou chamadas diretas a repositórios
- Todos os endpoints protegidos com `@UseGuards(JwtAuthGuard)` por padrão
- Endpoints públicos explicitados com `@Public()` decorator (Todos os locais que existevem fora desse padrão devem ser revisados para garantir que estão usando o decorator `@Public()`)
- Usar `@CurrentUser()` decorator para acessar o usuário autenticado — nunca ler do body

## DTOs de Apresentação
- Ficam em `presentation/dto/`
- Request DTOs: classes com decorators `class-validator` e `class-transformer`
  - `@Type()` obrigatório em campos numéricos, datas e objetos aninhados
- Response DTOs: classes ou interfaces que mapeiam o resultado do Use Case
  - NUNCA retornar entidade de domínio ou ORM entity diretamente — sempre um DTO de response
- Campos sensíveis (`passwordHash`, tokens) NUNCA presentes no response DTO
- Deve existir DTO de entrada e saída para cada endpoint, mesmo que sejam idênticos — isso deixa claro o contrato de entrada/saída e permite evolução independente no futuro

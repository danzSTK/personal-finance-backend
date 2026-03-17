---
applyTo: "api/src/modules/**"
---

# Regras para Módulos de Domínio

- Cada módulo DEVE ter: Controller, Service, Module, DTO folder, e um arquivo de testes `.spec.ts`
- Services não podem importar outros Services diretamente — use eventos ou injeção via interface
- Controllers só chamam métodos do próprio Service do módulo
- Nunca expor a entidade TypeORM direto no response — use um DTO de response
- Módulos podem ter submódulos, mas devem ser organizados hierarquicamente (ex: `users/profile`, `users/settings`)

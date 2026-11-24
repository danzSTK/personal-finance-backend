# Seguranca: Abuso de Recursos, Configuracao, Processos e Supply Chain

Referencia do `security-review` para protecao contra DoS (OWASP API4), configuracao/segredos, separacao API/Worker e supply chain.

---

## 1. Abuso de Recursos e Rate Limiting (OWASP API4)

- [ ] **Throttling em endpoints sensiveis:** endpoints de autenticacao, cadastro, recuperacao/alteracao de senha, verificacao/reenvio de e-mail e uploads mantem limites de taxa apropriados (`ThrottlerGuard` + `@Throttle()` / `PasswordChangeCostGuard` / scripts Lua atomicos quando aplicavel).
- [ ] **Limite de bcrypt (72 bytes UTF-8):** toda entrada de senha local usa `@IsPasswordWithinUtf8ByteLimit()` (ou verificacao equivalente via `password-byte-length.util.ts`) para evitar truncamento silencioso do bcrypt e custo excessivo de CPU.
- [ ] **Paginacao e consultas limitadas:** endpoints de listagem, busca, exportacao e comandos de reconciliacao impoem limite maximo (`maxLimit` / `batchSize`) para impedir exaustao de memoria ou CPU.
- [ ] **Regex e parsing:** evitar expressoes regulares sujeitas a backtracking catastrofico (ReDoS) em validadores de entrada do usuario.
- [ ] **Operacoes sincronas pesadas na API:** envio de e-mails, reconciliacao em lote e exclusoes no R2 devem ficar assincronos no worker (BullMQ / Outbox), nunca bloqueando requests HTTP.

---

## 2. Configuracao, Segredos e Separacao de Processos (`API` vs `Worker`)

- [ ] **Sem `process.env` solto:** toda configuracao e secret vem de `ConfigService` / namespaces de `api/src/config/` validados no boot (Joi/Zod).
- [ ] **Secrets minimos por `PROCESS_ROLE`:**
  - confirmar que novos secrets exigidos apenas no `worker` (ex.: credenciais de provedor de e-mail/reconciler) nao vazam como obrigatorios na `api`, e vice-versa;
  - confirmar que o `worker` continua sem abrir porta HTTP publica.
- [ ] **Sem segredos hardcoded:** verificar todo o diff — inclusive testes, fixtures (`container-smoke.env`), `.env.exemple` e scripts — para garantir que nenhuma chave real, senha de producao, token de API ou credencial de OAuth/R2/Brevo foi commitada.
- [ ] **Superficie de documentacao/diagnostico:**
  - endpoints de `/health` nao expoem versoes internas, connection strings, hosts internos ou stack traces;
  - avalie se novos endpoints ou esquemas no Swagger (`/docs`) nao expoem detalhes sensiveis de infraestrutura ou rotas internas indevidas.

---

## 3. Supply Chain, Containers e CI/CD

Sempre que o diff alterar `api/package.json`, `api/package-lock.json`, `Dockerfile*`, `docker-compose*.yml`, `.github/workflows/*.yml` ou `.trivyignore`:

- [ ] **Novas dependencias npm:** confirmar que o pacote e legitimo, necessario, mantido e alinhado a stack (evitar dependencias duplicadas ou suspeitas introduzidas automaticamente).
- [ ] **Workflows GitHub Actions:**
  - `permissions:` segue menor privilegio (ex.: `contents: read`);
  - nao interpola `${{ github.event.pull_request.title }}` / inputs nao confiaveis diretamente em comandos `run:` (command injection em CI);
  - actions de terceiros seguem o padrao de versionamento/seguranca do repositorio e nao vazam secrets em logs.
- [ ] **Containers e Docker Compose:**
  - imagem continua executando como usuario nao-root;
  - portas de banco/Redis/worker nao ficam expostas publicamente em `docker-compose.yml` de producao;
  - mudancas em `.trivyignore` trazem justificativa explicita e escopo minimo (nunca ignorar CVE critica sem explicacao e plano de mitigacao).

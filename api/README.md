# Danfy Finance Backend — API

Este diretório contém o código NestJS compartilhado pela API HTTP, pelo worker assíncrono e pelos comandos operacionais do Danfy Backend.

O ponto de entrada principal do projeto é o [README da raiz](../README.md).

## Desenvolvimento

Execute os comandos Node.js a partir deste diretório:

```bash
npm ci
npm run start:dev
```

Em outro terminal, mantenha o worker ativo:

```bash
npm run start:worker:dev
```

PostgreSQL, Redis e o Redis dedicado do BullMQ devem estar disponíveis antes da inicialização. O fluxo completo, incluindo variáveis de ambiente e migrations, está no [guia de desenvolvimento local](../docs/getting-started.md).

## Referências

- [Comandos principais](../docs/commands.md)
- [Arquitetura e organização do código](../docs/architecture.md)
- [Documentação técnica](../docs/README.md)
- [Documentação pública da API](https://api.danfy.app/docs)
- [Política de segurança](../SECURITY.md)

## License

Este software é disponibilizado sob a [PolyForm Strict License 1.0.0](../LICENSE). Os direitos sobre o nome e a identidade visual da Danfy são tratados separadamente em [TRADEMARKS.md](../TRADEMARKS.md).

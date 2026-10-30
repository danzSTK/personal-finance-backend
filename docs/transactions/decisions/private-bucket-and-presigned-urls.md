---
area: transactions
type: decision
status: accepted
related:
  - ../README.md
  - ../../storage/README.md
  - ../concepts/transaction-attachment.md
---

# Decisão: Bucket Privado e Presigned URLs de Leitura

## Contexto

Comprovantes fiscais e recibos bancários contêm dados financeiros altamente confidenciais e protegidos por leis de privacidade (CPFs, nomes completos, dados de conta e chaves PIX). Diferente de avatares públicos de perfil, comprovantes não podem ser expostos via CDN pública ou URLs perpétuas.

## Decisão

1. **Bucket Privado Exclusivo:** Todos os comprovantes de transações são armazenados em `R2_PRIVATE_BUCKET_NAME`.
2. **Presigned URLs de Leitura:** O acesso ocorre através de URLs assinadas geradas pelo `@aws-sdk/s3-request-presigner` com validade de 300 segundos (5 minutos).
3. **Janela de Cache do Cliente:** A API responde com `cacheMaxAgeSeconds: 240` (4 minutos) para orientar o cache do TanStack Query no frontend, garantindo uma margem de segurança de 60 segundos antes da expiração da URL física.
4. **Isolamento de Segurança:** O método `buildSignedReadUrl` rejeita a assinatura de URLs para qualquer bucket que não seja o bucket privado.

## Consequências

- Alta segurança e conformidade de dados sensíveis;
- Proteção contra download não autorizado de terceiros;
- Economia de banda sem requisições excessivas de renovação de URL graças ao cache de 4 minutos no cliente.

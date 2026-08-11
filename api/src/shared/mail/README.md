# Mail Infrastructure

Infraestrutura compartilhada para envio de e-mails transacionais.

Use `MailService` como fachada. O SDK da Brevo fica restrito ao `BrevoMailProvider`, atrás da porta `MailProvider`.

Consumidores de templates enviam uma referência lógica `{ key, version }`. O
adapter ativo traduz essa referência para o identificador externo. IDs da Brevo
não podem aparecer no domínio, nos casos de uso ou em `email_messages`.

Por padrão, envios com template não sobrescrevem o `sender`: a identidade
configurada na versão hospedada é aplicada pela Brevo. `MAIL_DEFAULT_FROM_EMAIL`
é usado nos envios HTML/texto sem template. Um consumidor ainda pode informar
`from` explicitamente quando a regra de negócio exigir uma sobrescrita.

Este módulo não decide quando enviar, não cria filas e não monta parâmetros de
negócio. O catálogo e a validação dos contratos pertencem a notifications.

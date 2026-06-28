# Mail Infrastructure

Infraestrutura compartilhada para envio de e-mails transacionais.

Use `MailService` como fachada. O SDK da Brevo fica restrito ao `BrevoMailProvider`, atrás da porta `MailProvider`.

Este módulo não cria notifications, filas, workers, consumers ou templates de negócio.

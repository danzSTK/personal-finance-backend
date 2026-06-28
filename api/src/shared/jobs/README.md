# Jobs Infrastructure

Infraestrutura compartilhada para registrar BullMQ no NestJS.

Este módulo configura conexão, prefixo e opções padrão de jobs. Ele não registra filas concretas, producers ou processors.

Módulos futuros devem registrar suas próprias filas e manter nomes de jobs, payloads versionados e políticas específicas perto do módulo consumidor.

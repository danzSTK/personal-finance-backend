# Checklist de impacto de dependências de teste

Usar esta checklist antes de adicionar uma dependência de execução ou alterar uma
já existente em testes E2E ou de integração.

## Inventário

- Nome, versão e finalidade da dependência.
- Arquivos e cenários que a utilizam.
- Se é pacote npm, binário, processo, container, serviço ou API.
- Se já existe no `package-lock.json`, no runner e no job correto.

## Disponibilidade local

- Pré-requisitos além de Node.js.
- Docker, arquitetura de CPU e espaço em disco necessários.
- Imagem e tag exatas.
- Portas fixas ou efêmeras.
- Necessidade de rede para primeiro download.
- Comando reproduzível sem `.env` pessoal.

## Disponibilidade na CI

- Workflow e job responsáveis.
- Runner e permissões disponíveis.
- Serviço ou Testcontainer responsável pelo provisionamento.
- Cache ou download necessário.
- Variáveis sintéticas e ausência de secrets de produção.
- Timeout atual e duração medida antes/depois.
- Execução sequencial, paralela e pico de recursos.

## Confiabilidade

- Estratégia de readiness sem espera arbitrária.
- Isolamento de dados, redes, filas e namespaces.
- Cleanup em sucesso, falha e inicialização parcial.
- Ausência de ordem implícita entre testes ou arquivos.
- Diagnóstico que diferencia ambiente de regressão funcional.
- Proibição de retry usado apenas para esconder flakiness.

## Segurança e custo

- Nenhum dado ou endpoint de produção.
- Nenhuma credencial real em código, logs ou artefatos.
- Nenhuma chamada cobrada ou efeito externo.
- Logs sem senha, hash, JWT, PII ou secret.
- Imagens e dependências com origem e versão explícitas.

## Saída obrigatória

Registrar na spec ativa:

1. dependência anterior e nova;
2. alternativas consideradas;
3. impacto local e na CI;
4. falhas possíveis e mitigação;
5. necessidade ou não de alterar a pipeline;
6. comandos usados para validação;
7. páginas de `docs/tests` atualizadas.

Se a pipeline precisar mudar, comunicar o usuário e obter aprovação antes de
editar o workflow.


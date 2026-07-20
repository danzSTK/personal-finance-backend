# Backend CI — Decisoes

## DEC-001 - Separar CI E CD

Status: accepted

Decision:
A validacao de codigo fica em `backend-ci.yml`; publicacao de imagem e deploy terao workflow separado.

Reason:
CI executa codigo de pull requests com permissao somente de leitura. CD exigira credenciais, ambientes protegidos, verificacao de saude e rollback.

Impact:
Esta entrega referencia a issue 38, mas nao a encerra.

## DEC-002 - Usar Tres Jobs Independentes

Status: accepted

Decision:
Qualidade, testes unitarios/E2E e integracao executam em jobs paralelos.

Reason:
Os resultados ficam claros e uma falha nao esconde as demais suites.

Impact:
`npm ci` executa uma vez por job, trocando algum consumo adicional por isolamento e menor tempo total.

## DEC-003 - Nao Executar Em Mudancas Somente De Documentacao

Status: accepted

Decision:
Usar filtros de caminho e excluir arquivos Markdown dos gatilhos automaticos.

Reason:
Mudancas somente documentais nao alteram o comportamento ou build do backend.

Impact:
Antes de tornar os jobs obrigatorios, sera necessario evitar que PRs documentais fiquem bloqueados por checks que nao iniciaram.

## DEC-004 - Nao Impor Threshold Global De Cobertura Nesta Fase

Status: accepted

Decision:
Executar cobertura e registrar o resultado sem reprovar por percentual minimo.

Reason:
O baseline global mistura camadas com alvos diferentes; o projeto define metas de 90% para dominio/aplicacao e 70% para infraestrutura.

Impact:
Thresholds por caminho/camada ficam para uma evolucao posterior da CI.

## DEC-005 - Usar Configuracao Ficticia No Job De Testes

Status: accepted

Decision:
Declarar no job `tests` valores locais ficticios para todas as variaveis obrigatorias validadas pelo `ConfigModule`.

Reason:
O Jest coleta cobertura de arquivos nao importados diretamente pelas suites e pode carregar a configuracao global. O runner nao possui o `.env` de desenvolvimento.

Impact:
Os testes reproduzem a validacao de configuracao sem armazenar secrets ou acessar servicos externos; e-mail permanece desabilitado e os endpoints apontam para `localhost`.

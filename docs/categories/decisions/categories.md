minhas proprias anotações:

Olha eu vejo que para classificar que é o uso básico temos que decidir se o sistema vai ter as categorias globais ou setadas por default para o usuário ao se junta na plataforma

Para classificação (A mais simples) precisamos decidir se o usuário cria suas categorias ou se elas vem default para ele ou até mesmo ambos Se categoria vir default ela vem default do sistema como um todo ou ao se juntar a nós essas categorias são criadas automaticamente?

### O que é

Categorias de transações é o motivo financeiro daquele movimento, ele não é um marcador solto simples para filtros isso no caso seria uma tag

UMA CATEGORIA DEVE RESPONDER “ESSE DINHEIRO SAIU POR QUÊ?”

A categoria é o que permite o app dizer: “você gastou R$ 300 em assinaturas este mês”, “seu lazer está alto”, “essa transação entra no orçamento”, “isso é renda”, “isso não deve contar como despesa porque é transferência”.

### Responsabilidades:

1. Classificação. É o uso básico. Alimentação, Transporte, Moradia, Saúde, Lazer, Compras, Renda, Investimentos
2. Orçamento. Algumas categorias podem ter limites ou meta mensal. Por exemplo: “Restaurantes: Limite de R$ 500/mês”. Aqui a categoria começa a influenciar regra de negócio. Não é só organização; ela vira um “Envelope” de dinheiro.
3. Semântica contábil simples. Uma categoria pode dizer se aquela transação é uma despesa, uma renda, uma transferência, um investimento ou algo neutro. Isso é importante porque nem todo movimento deve afetar relatório do mesmo jeito. Transferência entre contas, por exemplo
4. Automação: Depois que o usuário lançar “Netflix” como “Assinatura”, o sistema pode sugerir automaticamente essa categoria na próxima transação parecida.
5. Análise comportamental. Categoria ajuda o usuário a entender padrão de vida. “Compras” pode ser uma categoria simples, mas “Roupas”, “Eletrônicos” e “Delivery” podem mostrar vícios de gastos diferentes. O YNAB comenta que categorias podem ser detalhadas quando o usuário precisa de mais clareza, mas também alerta que simplicidade é valiosa.

### Regras


Uma transaction de despesa só pode usar categoria de despesa.
Uma transaction de renda só pode usar categoria de renda.
Transferência entre contas não deve cair em "despesa comum".
Categoria usada em transações não deve ser deletada diretamente -> para deletar temos que obrigar o usuário a transferir as transações dessa categoria para outra.
Uma categoria pode ser arquivada mesmo com transações dentro delas , mas não pode criar novas transações em uma categoria arquivada. Uma categoria arquivada se mantém no histórico passado.
Categorias padrões podem ser renomeadas pelo usuário, mas não deletadas fisicamente mas podem arquivar.
Toda transação manual de receita/despesa deve  ser categorizada, transações sem categorias são rejeitadas pelo sistema.
Nome de categoria deve ser único por usuário dentro do mesmo tipo ou dentro do mesmo grupo.

Teremos tipos de categoria para cada tipo de movimentação como o tipo: Renda -> Quando o usuário faz uma transação onde aumenta seu saldo; Despesa -> reduz o saldo, aqui mora transações de consumo; Transferência -> Move dinheiro entre contas do mesmo usuário e isso n conta como despesa ou receita; Ajuste -> Corrije o saldo sem representar consumo real ele nem é uma transferência, muito menos uma receita ou despesa ele provavelmente vai aumentar ou reduzir o saldo final de uma account mas  isso só caracteriza saldo inicial; Investimento -> estudando... 

### Categoria não deve ser usada para tudo.
Não use categoria para representar banco. Banco é conta.
Não use categoria para representar pessoa. Pessoa é payee/merchant/contact.
Não use categoria para representar projeto especifico demais. Isso provavelmente é uma tag.
Não use categoria para representar recorrência. Recorrência é regra de transação.

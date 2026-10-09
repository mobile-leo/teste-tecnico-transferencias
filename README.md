
# Transferências Financeiras

Aplicação para gerenciamento de pessoas, contas bancárias e transferências financeiras, permitindo consultar saldos e realizar transferências imediatas ou agendadas.

<img width="1672" height="941" alt="stack" src="https://github.com/user-attachments/assets/fad5910c-d767-4c67-a6cf-e9c471fc9b8b" />

Repositório: [github.com/mobile-leo/teste-tecnico-transferencias](https://github.com/mobile-leo/teste-tecnico-transferencias)

## Materiais de apoio

### Anexo do teste técnico

Documento original com os requisitos propostos para o desenvolvimento da aplicação:

[Visualizar PDF do teste técnico](https://github.com/mobile-leo/teste-tecnico-transferencias/blob/master/Teste_Tecnico-Desenvolvedor-Btsa.pdf)

## Executando o projeto

É necessário possuir **Docker Desktop** com o **Docker Compose** instalado e em execução.

Na pasta raiz do projeto, execute:

```bash
docker compose up -d --build
```

Para verificar se os serviços foram inicializados corretamente:

```bash
docker compose ps
```

Após a inicialização, acesse:

- **Aplicação Web:** http://localhost/
- **Documentação da API - Swagger:** http://localhost/swagger/
- **Kafka UI:** http://localhost/kafka-ui/

> O Swagger fica habilitado porque o container do backend sobe com `ASPNETCORE_ENVIRONMENT=Development`.

## Encerrando a aplicação

Para interromper os containers:

```bash
docker compose down
```

Os dados armazenados no PostgreSQL permanecem preservados através do volume:

```text
bank_pgdata
```

Caso também seja necessário remover os dados persistidos localmente:

```bash
docker compose down -v
```

## Tecnologias e arquitetura

A aplicação foi construída com **React 19** e **TypeScript** no frontend, **ASP.NET Core 10** no backend, **PostgreSQL** para persistência e **Kafka** para processamento assíncrono.

Todo o ambiente é executado com **Docker Compose**, utilizando **Nginx** como ponto de entrada da aplicação.

### Backend

O backend usa **Minimal APIs** organizadas por funcionalidade (*feature folders*), em vez da divisão tradicional em camadas MVC:

- **Domain**, com as entidades (pessoas, contas, transferências e mensagens do Outbox);
- **Data**, com o `DbContext` do **Entity Framework Core** e as **Migrations**, aplicadas automaticamente na inicialização;
- **Features/People**, **Features/Accounts** e **Features/Transfers**, com os endpoints e as regras de negócio de cada área;
- **Features/Messaging**, com a integração com o Kafka e o padrão Outbox;
- **Common**, com os tipos de erro compartilhados.

Pontos principais do funcionamento:

- **Transferências imediatas** são executadas em uma transação, com bloqueio de linha no PostgreSQL nas contas envolvidas. Assim, duas transferências simultâneas sobre a mesma conta são serializadas e o saldo nunca é lido de forma inconsistente.
- **Limites e cheque especial** são validados por uma política dedicada (`LimitPolicy`), considerando o horário diurno e noturno configurado em `TransferRules`.
- **Transferências agendadas** são registradas com status pendente. Um *worker* em segundo plano identifica as que venceram e grava um evento na tabela **Outbox**, dentro da mesma transação.
- O **publicador do Outbox** envia os eventos ao tópico `scheduled-transfers` do **Kafka**, e um **consumidor** processa cada mensagem executando a transferência. Isso garante que nenhum evento seja perdido caso o broker esteja indisponível no momento do agendamento.
- **Idempotência**: a criação de transferências aceita o cabeçalho `Idempotency-Key`. Repetir a mesma chave não gera uma segunda transferência.
- **Cancelamento** de transferências agendadas ainda pendentes.

### Frontend

O frontend foi desenvolvido em **React 19** com **Vite**, **TypeScript** e **Tailwind CSS 4**, com navegação por abas no cabeçalho.

Principais bibliotecas:

- **React Router** para as rotas;
- **SWR** para busca, cache e revalidação de dados;
- **Radix UI** (Dialog) para modais acessíveis;
- **Sonner** para notificações;
- **Lucide** para ícones.

A aplicação permite:

- cadastrar pessoas e contas;
- consultar saldo, cheque especial e status da conta;
- realizar transferências imediatas;
- agendar e cancelar transferências;
- acompanhar transferências enviadas, recebidas e agendadas;
- visualizar o comprovante de cada transferência.

A comunicação com o backend é feita pela API REST, com tipos compartilhados, tratamento centralizado de erros e envio automático do `Idempotency-Key` nas transferências.

Para desenvolver apenas o frontend, sem backend, existe um modo com dados simulados:

```bash
cd FRONTEND
npm install
npm run dev:mock
```

### Infraestrutura

- **PostgreSQL 16** para persistência dos dados;
- **Kafka** (modo KRaft, sem Zookeeper) para processamento assíncrono, com o tópico criado pelo serviço `kafka-init`;
- **Kafka UI** para inspeção de tópicos, consumidores e mensagens;
- **Nginx** como gateway: `/` serve o frontend, `/api/` e `/swagger/` vão para o backend e `/kafka-ui/` para o Kafka UI;
- **Docker Compose** para orquestração dos serviços;
- **Swagger** para documentação e testes da API.

## Estrutura de pastas

```text
.
├── BACKEND/       API ASP.NET Core 10 (Minimal APIs, EF Core, Kafka)
├── FRONTEND/     Aplicação React + Vite
├── docs/               Material de estudo
├── docker-compose.yml  Orquestração dos serviços
└── nginx.conf          Gateway da aplicação
```

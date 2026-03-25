# listenMonday

Serviço Node.js que escuta notificações PostgreSQL (`LISTEN/NOTIFY`) e sincroniza pedidos com um board do Monday.com em tempo real.

## Como funciona

1. O banco de dados dispara um `NOTIFY orders_changed` com um payload JSON contendo o `code` do pedido.
2. O serviço recebe o evento e consulta duas views no schema `Geral`:
   - `vw_monday_pedidos_logistica_diferente_pedidos_entregues` — pedidos ativos
   - `vw_monday_pedidos_logistica_apenas_entregues` — pedidos finalizados/recusados
3. Com base no resultado, o serviço:
   - **Cria** um novo item no board se o pedido não existir no Monday.
   - **Atualiza** as colunas do item se houver diferença entre o banco e o Monday.
   - **Ignora** se não houver diferenças ou se o pedido não estiver em nenhum dos views.

## Estrutura

```
listenMonday/
├── app.js                  # Entry point — conecta ao PG e registra o listener
├── config/
│   └── index.js            # Variáveis de ambiente, queries SQL, mapeamento EQUIV
├── db/
│   └── client.js           # Conexão com o banco e consultas às views
├── monday/
│   ├── client.js           # Chamadas HTTP para a API do Monday
│   ├── mapping.js          # ID2FIELD, FIELD2ID, status labels e sinônimos
│   ├── mutations.js        # Builders de mutations GraphQL e conversão de colunas
│   └── sync.js             # Lógica principal de sincronização e cache do mapa
└── utils/
    └── formatters.js       # Normalização, conversão e formatação de valores
```

## Pré-requisitos

- Node.js 18+
- PostgreSQL com suporte a `LISTEN/NOTIFY`
- Token da API do Monday.com

## Instalação

```bash
npm install
```

## Configuração

Crie um arquivo `.env` na raiz com as seguintes variáveis:

```env
DB_NAME=seu_banco
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_HOST=localhost
DB_PORT=5432

MONDAY_API_TOKEN=seu_token_aqui
MONDAY_BOARD_ID=123456789
```

## Uso

```bash
node app.js
```

O serviço ficará em escuta indefinida. Para encerrar, pressione `Ctrl+C`.

## Mapeamento de colunas

O arquivo `config/index.js` define o objeto `EQUIV`, que mapeia colunas do banco para campos do Monday:

| Coluna DB         | Campo Monday         |
|-------------------|----------------------|
| `dealstatus`      | `status`             |
| `address_state`   | `Estado`             |
| `address_city`    | `Cidade`             |
| `totalvalue`      | `Valor_Pedido`       |
| `transportadora`  | `Transportadora`     |
| `notafiscal`      | `NF`                 |
| `infull`          | `Infull`             |
| `ontime`          | `Ontime`             |
| ...               | ...                  |

## Cache do mapa de itens

O mapa `code → item_id` do board é carregado na inicialização e revalidado a cada **10 minutos** (`MAP_TTL_SEC=600`). Após criar um novo item, o mapa é recarregado imediatamente.

## Dependências

| Pacote   | Uso                              |
|----------|----------------------------------|
| `pg`     | Cliente PostgreSQL + LISTEN/NOTIFY |
| `axios`  | Chamadas HTTP para a API Monday  |
| `dotenv` | Leitura de variáveis de ambiente |
# listenMonday

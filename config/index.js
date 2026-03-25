require('dotenv').config();

const DB_CFG = {
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
};

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN || '';
const MONDAY_URL = 'https://api.monday.com/v2';
const BOARD_ID = parseInt(process.env.MONDAY_BOARD_ID || '0', 10);

const VIEW_SQL = `SELECT * FROM "Geral".vw_monday_pedidos_logistica_diferente_pedidos_entregues WHERE code = $1`;
const VIEW_SQL_FINAL = `SELECT * FROM "Geral".vw_monday_pedidos_logistica_apenas_entregues WHERE code = $1`;

const MAP_TTL_SEC = 600;

const EQUIV = {
  dealstatus:      'status',
  address_state:   'Estado',
  address_city:    'Cidade',
  address_cep:     'CEP',
  address_number:  'Numero',
  address_patio:   'Logradouro',
  type:            'Modal',
  freight_price:   'Valor_frete_pied',
  totalvalue:      'Valor_Pedido',
  transportadora:  'Transportadora',
  frete_faturado:  'Valor_frete_faturado',
  notafiscal:      'NF',
  infull:          'Infull',
  ontime:          'Ontime',
  responsible:     'Consultor',
};

module.exports = { DB_CFG, MONDAY_API_TOKEN, MONDAY_URL, BOARD_ID, VIEW_SQL, VIEW_SQL_FINAL, MAP_TTL_SEC, EQUIV };

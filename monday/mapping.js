const ID2FIELD = {
  code:                 'code',
  status:               'status',
  color_mktg1t01:       'prioridade',
  text_mkr5twgd:        'Estado',
  text_mkr6hbg:         'Modal',
  text_mkr53qry:        'NF',
  text_mkr58frc:        'Localidade',
  text_mkr53b69:        'CEP',
  text_mkr5ax2d:        'Logradouro',
  text_mkr5hrz:         'Numero',
  text_mkr5wd8x:        'Cidade',
  numeric_mksr62zz:     'Valor_Pedido',
  numeric_mksrp26m:     'Valor_frete_pied',
  numeric_mksrjwek:     'Valor_frete_faturado',
  numeric_mksep4r7:     'Saldo_de_Frete',
  date_mkr5v3sw:        'Data_SEP',
  date_mkr5sypr:        'Data_Coleta',
  data:                 'Preve_Entrega',
  text_mkr5y15t:        'Transportadora',
  timerange_mkr6t4za:   'Prazo',
  text_mkr5gm3w:        'Volumes',
  text_mkr58rc4:        'Consultor',
  boolean_mksxh0ng:     'Ontime',
  boolean_mksxwj43:     'Infull',
  color_mkwgwtw5:       'Conf',
};

const FIELD2ID = Object.fromEntries(Object.entries(ID2FIELD).map(([k, v]) => [v, k]));

const STATUS_LABELS_TO_INDEX = {
  'COLETADO':               3,
  'ENTREGUE':               4,
  'ABANDONADO':             6,
  'SEPARAÇÃO':              7,
  'COLETA A SER AGENDADA':  12,
  'COLETA AGENDADA':        14,
  'FINALIZADO':             0,
  'RECUSADO':               6,
  'REPASSE':                1,
};

const STATUS_SYNONYMS = {
  'SEPARACAO':           'SEPARAÇÃO',
  'COLETADO':            'COLETADO',
  'ENTREGUE':            'ENTREGUE',
  'ABANDONADO':          'ABANDONADO',
  'COLETA A SER AGENDADA': 'COLETA A SER AGENDADA',
  'COLETA AGENDADA':     'COLETA AGENDADA',
  'PESO E VOLUME':       'SEPARAÇÃO',
  'PEDIDO COLETADO':     'COLETADO',
  'RECUSADO':            'ABANDONADO',
  'FINALIZADO':          'FINALIZADO',
  'REPASSE':             'REPASSE',
};

module.exports = { ID2FIELD, FIELD2ID, STATUS_LABELS_TO_INDEX, STATUS_SYNONYMS };

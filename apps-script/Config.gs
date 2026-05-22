// Config.gs
// Constantes estáticas do projeto. Valores que mudam por ambiente leem de
// PropertiesService (Script Properties), com fallback para o default daqui.

const DEFAULTS = {
  GA4_WEB_PROPERTY_ID:   '267511960',
  GA4_APP_PROPERTY_ID:   '387307776',
  SHEETS_DOC_ID:         '1QvP4QVP0ApZ5XdbDoBUBecM-g2R99pWxyuhyd7AnN_0',
  CUTOFF_DATE:           '2026-05-26',
  REPROCESS_DAYS:        '3',
  TIMEZONE:              'America/Sao_Paulo',
  // RevenueCat — preencher via Script Properties quando ativar a fase 2.
  REVENUECAT_PROJECT_ID: '',
  REVENUECAT_API_KEY:    '',
};

/** Lê uma config: Script Properties tem prioridade, default cai aqui. */
function cfg(key) {
  const fromProps = PropertiesService.getScriptProperties().getProperty(key);
  if (fromProps !== null && fromProps !== '') return fromProps;
  if (key in DEFAULTS) return DEFAULTS[key];
  throw new Error('Config ausente: ' + key);
}

// --- GA4 ---------------------------------------------------------------------

const PAGE_PATH_FILTERS = {
  lp:                 { contains: ['/assine'],         not_contains: ['checkout'] },
  checkout:           { contains: ['/checkout'],       not_contains: ['/obrigado'] },
  p1a_dados_pessoais: { contains: ['dados-pessoais'],  not_contains: [] },
  p1a_pagamento:      { contains: ['/pagamento'],      not_contains: [] },
  vendas:             { contains: ['/obrigado'],       not_contains: [] },
};

const DEVICE_CATEGORIES = ['desktop', 'mobile'];

// Métricas GA4 (decisão fechada):
//   - Visitantes Únicos, LP, Checkout, P-1A e Vendas Web usam `totalUsers`
//   - App Novos Usuários usa `firstOpens`
const GA4_METRIC_USERS    = 'totalUsers';
const GA4_METRIC_APP_NEW  = 'firstOpens';

// --- RevenueCat --------------------------------------------------------------

const REVENUECAT_PRODUCTS = {
  android: [
    'i10_oneyear_android:i10-parcelas-12x',
    'i10_oneyear_android:i10-oneyear-android',
    'i10_oneyear_android:i10-rec',
  ],
  ios: ['AppI10Pro'],
};

const REVENUECAT_STORE_FILTERS = {
  android: 'PLAY_STORE',
  ios:     'APP_STORE',
};

const REVENUECAT_EVENT_TYPES = {
  vendas_novas: ['INITIAL_PURCHASE'],
  renovacoes:   ['RENEWAL'],
};

// --- Sheets ------------------------------------------------------------------

const SHEET_TABS = {
  total:       'Total',
  web_total:   'Web Total',
  web_desktop: 'Web Desktop',
  web_mobile:  'Web Mobile',
  app:         'App',
  web_legado:  'Web Legado Agregado',
  notas:       'Notas Metodológicas',
};

const SHEET_TABS_ORDER = [
  'total',
  'web_total',
  'web_desktop',
  'web_mobile',
  'app',
  'web_legado',
  'notas',
];

// --- Schemas das abas --------------------------------------------------------

const TOTAL_HEADERS = [
  'Dia da Semana', 'Data', 'Status',
  'Visitantes Únicos', 'Novos Usuários', 'Vendas Novas', 'Renovações',
];

// Web Desktop / Web Mobile / Web Total / Web Legado Agregado — schema idêntico.
const WEB_HEADERS = [
  'Dia da Semana', 'Data', 'Visitantes Únicos', 'Cadastros',
  'Visitantes LP', 'Visitantes Checkout', 'Vendas',
  'Conversão por Usuários Únicos', 'Conversão por Cadastros',
  'Visitantes x LP', 'LP para Checkout', 'Conversão LP', 'Conversão Checkout',
  'Visitantes Dados Pessoais P-1A', 'Dados Pessoais p/ Pagamento P-1A',
  'Visitantes Pagamento P-1A', 'Pagamento p/ Obrigado P-1A',
  'Obrigado P-1A', 'OBS',
];

const APP_HEADERS = [
  'Dia da Semana', 'Data', 'Visit. Únicos App', 'Novos Usuários App',
  'Vendas Novas Android', 'Vendas Novas iOS', 'Renovações App',
  'Total App', 'OBS',
];

// Coluna (1-indexed) que guarda a Data em cada aba — usada pelo upsert.
const DATE_COLUMN = 2;

// Linha onde começam os dados em cada aba (1-indexed).
//   Web Legado tem linha 1 = aviso vermelho, linha 2 = headers, linha 3 = dados.
//   As demais abas têm linha 1 = headers, linha 2 = dados.
const DATA_START_ROW = {
  total:       2,
  web_total:   2,
  web_desktop: 2,
  web_mobile:  2,
  app:         2,
  web_legado:  3,
  notas:       1,
};

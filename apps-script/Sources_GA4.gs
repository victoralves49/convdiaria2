// Sources_GA4.gs
// Extração GA4 (web e app) via Advanced Service AnalyticsData v1beta.
//
// fetchGa4Web(startDate, endDate)
//   → {
//       desktop: { 'YYYY-MM-DD': { users, lp, checkout, p1a_dp, p1a_pgto, vendas } },
//       mobile:  { 'YYYY-MM-DD': { ... } }
//     }
//
// fetchGa4AppUsers(startDate, endDate)
//   → { 'YYYY-MM-DD': { totalUsers, firstOpens } }
//
// O range [startDate, endDate] é inclusivo. As keys do retorno cobrem TODO o
// range — datas sem dados retornadas pela API ficam zeradas (não viram undefined).

// Mapeamento entre key da métrica interna e config de filtro de path.
const _GA4_WEB_QUERIES = [
  { metric: 'users',    pathFilter: null },
  { metric: 'lp',       pathFilter: null /* preenchido em fetchGa4Web */ },
  { metric: 'checkout', pathFilter: null },
  { metric: 'p1a_dp',   pathFilter: null },
  { metric: 'p1a_pgto', pathFilter: null },
  { metric: 'vendas',   pathFilter: null },
];

/**
 * Extrai métricas GA4 da property Web para [startDate, endDate] inclusive.
 * Faz 6 requests (1 por métrica), cada um retornando date × deviceCategory.
 */
function fetchGa4Web(startDate, endDate) {
  const propertyId = cfg('GA4_WEB_PROPERTY_ID');
  const startIso = _isoDate(startDate);
  const endIso   = _isoDate(endDate);

  const queries = [
    { metric: 'users',    pathFilter: null },
    { metric: 'lp',       pathFilter: PAGE_PATH_FILTERS.lp },
    { metric: 'checkout', pathFilter: PAGE_PATH_FILTERS.checkout },
    { metric: 'p1a_dp',   pathFilter: PAGE_PATH_FILTERS.p1a_dados_pessoais },
    { metric: 'p1a_pgto', pathFilter: PAGE_PATH_FILTERS.p1a_pagamento },
    { metric: 'vendas',   pathFilter: PAGE_PATH_FILTERS.vendas },
  ];

  // Inicializa estrutura completa zerada
  const out = { desktop: {}, mobile: {} };
  DEVICE_CATEGORIES.forEach(function (d) {
    _forEachDay(startDate, endDate, function (_, iso) {
      out[d][iso] = { users: 0, lp: 0, checkout: 0, p1a_dp: 0, p1a_pgto: 0, vendas: 0 };
    });
  });

  queries.forEach(function (q) {
    const rows = _runGa4WebReport(propertyId, startIso, endIso, q.pathFilter);
    rows.forEach(function (r) {
      if (DEVICE_CATEGORIES.indexOf(r.device) === -1) return; // ignora tablet, etc.
      const bucket = out[r.device][r.date];
      if (!bucket) return; // data fora do range esperado (não deveria ocorrer)
      bucket[q.metric] = r.value;
    });
  });

  return out;
}

/**
 * Extrai totalUsers e firstOpens da property App por dia.
 * Faz 1 request com 2 métricas.
 */
function fetchGa4AppUsers(startDate, endDate) {
  const propertyId = cfg('GA4_APP_PROPERTY_ID');
  const startIso = _isoDate(startDate);
  const endIso   = _isoDate(endDate);

  const resp = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: startIso, endDate: endIso }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: GA4_METRIC_USERS },    // totalUsers
      { name: GA4_METRIC_APP_NEW },  // firstOpens
    ],
    limit: 100000,
  }, 'properties/' + propertyId);

  const out = {};
  _forEachDay(startDate, endDate, function (_, iso) {
    out[iso] = { totalUsers: 0, firstOpens: 0 };
  });

  (resp.rows || []).forEach(function (row) {
    const iso = _isoFromGa4Date(row.dimensionValues[0].value);
    if (!out[iso]) return;
    out[iso].totalUsers = parseInt(row.metricValues[0].value, 10) || 0;
    out[iso].firstOpens = parseInt(row.metricValues[1].value, 10) || 0;
  });

  return out;
}

// =============================================================================
// Internals
// =============================================================================

function _runGa4WebReport(propertyId, startIso, endIso, pathFilter) {
  const request = {
    dateRanges: [{ startDate: startIso, endDate: endIso }],
    dimensions: [{ name: 'date' }, { name: 'deviceCategory' }],
    metrics:    [{ name: GA4_METRIC_USERS }],
    limit: 100000,
  };
  if (pathFilter) request.dimensionFilter = _buildPathFilter(pathFilter);

  const resp = AnalyticsData.Properties.runReport(request, 'properties/' + propertyId);
  return (resp.rows || []).map(function (row) {
    return {
      date:   _isoFromGa4Date(row.dimensionValues[0].value),
      device: row.dimensionValues[1].value,
      value:  parseInt(row.metricValues[0].value, 10) || 0,
    };
  });
}

function _buildPathFilter(pathFilter) {
  const expressions = [];
  (pathFilter.contains || []).forEach(function (substr) {
    expressions.push({
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'CONTAINS', value: substr, caseSensitive: false },
      },
    });
  });
  (pathFilter.not_contains || []).forEach(function (substr) {
    expressions.push({
      notExpression: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: { matchType: 'CONTAINS', value: substr, caseSensitive: false },
        },
      },
    });
  });
  if (expressions.length === 1) return expressions[0];
  return { andGroup: { expressions: expressions } };
}

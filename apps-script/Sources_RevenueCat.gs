// Sources_RevenueCat.gs
// RevenueCat REST API v2. Desabilitado na fase 1 (sem Script Properties).
//
// Contrato planejado:
//
//   fetchRevenueCat(startDate, endDate)
//     → { 'YYYY-MM-DD': { vendas_android, vendas_ios, renovacoes } }
//
// Endpoint: GET https://api.revenuecat.com/v2/projects/{project_id}/events
// Filtros: type IN [INITIAL_PURCHASE, RENEWAL], store por venda, date range.
// Paginação via `next_page` token.

// Sources_GA4.gs
// Extração GA4 (web e app). A ser implementado na fase 2.
//
// Contratos planejados:
//
//   fetchGa4Web(startDate, endDate)
//     → { desktop: { 'YYYY-MM-DD': { users, lp, checkout, p1a_dp, p1a_pgto, vendas } },
//         mobile:  { 'YYYY-MM-DD': { ... } } }
//
//   fetchGa4AppUsers(startDate, endDate)
//     → { 'YYYY-MM-DD': { totalUsers, firstOpens } }
//
// Usa AnalyticsData (Advanced Service) que já está habilitado em appsscript.json.

// Transformers_Builder.gs
// Consolida dados das fontes em rows prontos pra upsert no Sheets.
//
// Contrato de saída — UpsertRow:
//   {
//     date: 'YYYY-MM-DD',
//     cells: Array<value>,   // 1 entrada por coluna, na ordem da aba (1-indexed pela aba)
//   }
//
// Convenções dentro de `cells`:
//   - String começando com '=' → fórmula. Pode conter '{ROW}' como placeholder
//     do número real da linha; o destino substitui antes de escrever.
//   - null → "preservar valor existente nesta célula" (não sobrescrever).
//   - Date | number | string → valor literal.

const ROW_PLACEHOLDER = '{ROW}';

/**
 * Constrói rows para a aba Web Desktop ou Web Mobile.
 *
 * @param {Object<string, Object>} webDeviceData webData[device] retornado por fetchGa4Web.
 * @returns {Array<{date: string, cells: Array}>}
 */
function buildWebRows(webDeviceData) {
  const dates = Object.keys(webDeviceData).sort();
  const R = ROW_PLACEHOLDER;

  return dates.map(function (iso) {
    const d = webDeviceData[iso];
    return {
      date: iso,
      cells: [
        '=TEXT(B' + R + ';"dddd")',                     // A: Dia da semana
        _dateFromIso(iso),                              // B: Data
        d.users,                                        // C: Visitantes Únicos
        null,                                           // D: Cadastros (preservar — manual)
        d.lp,                                           // E: Visitantes LP
        d.checkout,                                     // F: Visitantes Checkout
        d.vendas,                                       // G: Vendas
        '=IFERROR(G' + R + '/C' + R + ';0)',            // H: Conversão por Usuários Únicos
        '=IFERROR(G' + R + '/D' + R + ';0)',            // I: Conversão por Cadastros
        '=IFERROR(E' + R + '/C' + R + ';0)',            // J: Visitantes x LP
        '=IFERROR(F' + R + '/E' + R + ';0)',            // K: LP para Checkout
        '=IFERROR(G' + R + '/E' + R + ';0)',            // L: Conversão LP
        '=IFERROR(G' + R + '/F' + R + ';0)',            // M: Conversão Checkout
        d.p1a_dp,                                       // N: Visitantes Dados Pessoais P-1A
        '=IFERROR(P' + R + '/N' + R + ';0)',            // O: Dados Pessoais p/ Pagamento P-1A
        d.p1a_pgto,                                     // P: Visitantes Pagamento P-1A
        '=IFERROR(R' + R + '/P' + R + ';0)',            // Q: Pagamento p/ Obrigado P-1A
        '=G' + R,                                       // R: Obrigado P-1A
        null,                                           // S: OBS (preservar — manual)
      ],
    };
  });
}

/**
 * Constrói rows para a aba App.
 *
 * @param {Object<string, {totalUsers: number, firstOpens: number}>} appUsers
 * @param {?Object<string, {vendas_android: number, vendas_ios: number, renovacoes: number}>} rcData
 *        Pode ser null/{}/incompleto enquanto RevenueCat não estiver habilitado.
 * @returns {Array<{date: string, cells: Array}>}
 */
function buildAppRows(appUsers, rcData) {
  const dates = Object.keys(appUsers).sort();
  const R = ROW_PLACEHOLDER;
  const rc = rcData || {};

  return dates.map(function (iso) {
    const u  = appUsers[iso];
    const rv = rc[iso] || { vendas_android: 0, vendas_ios: 0, renovacoes: 0 };
    return {
      date: iso,
      cells: [
        '=TEXT(B' + R + ';"dddd")',                     // A: Dia da semana
        _dateFromIso(iso),                              // B: Data
        u.totalUsers,                                   // C: Visit. Únicos App
        u.firstOpens,                                   // D: Novos Usuários App
        rv.vendas_android,                              // E: Vendas Novas Android
        rv.vendas_ios,                                  // F: Vendas Novas iOS
        rv.renovacoes,                                  // G: Renovações App
        '=E' + R + '+F' + R + '+G' + R,                 // H: Total App
        null,                                           // I: OBS (preservar — manual)
      ],
    };
  });
}


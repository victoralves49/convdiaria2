// Scripts_SetupSheet.gs
// One-shot: monta as 7 abas da planilha de destino com headers, fórmulas,
// formatação, locale e timezone. Rodar UMA vez no editor (botão Run).
//
// Idempotente: pode ser re-executado sem destruir dados existentes — só
// reescreve headers, fórmulas pré-populadas (abas Total e Web Total) e
// formatação. Linhas de dados das abas que recebem ETL/backfill não são
// tocadas.

const SETUP_SHEET_DEFAULT_BLANK_NAMES = [
  'Sheet1', 'Sheet 1', 'Página1', 'Página 1', 'Hoja1', 'Hoja 1', 'Folha1', 'Folha 1',
];

const SETUP_HEADER_BG     = '#E7E7E7';
const SETUP_PRE_CUTOFF_BG = '#F3F3F3';
const SETUP_WARNING_BG    = '#F4CCCC';
const SETUP_WARNING_FG    = '#990000';

function setupSheetTabs() {
  const ss = SpreadsheetApp.openById(cfg('SHEETS_DOC_ID'));

  // Locale + timezone (necessários para fórmulas com ";" e TEXT(date,"dddd") em PT-BR)
  if (ss.getSpreadsheetLocale() !== 'pt_BR') ss.setSpreadsheetLocale('pt_BR');
  if (ss.getSpreadsheetTimeZone() !== cfg('TIMEZONE')) ss.setSpreadsheetTimeZone(cfg('TIMEZONE'));

  // 1. Garantir existência das 7 abas (sem destruir as que já existem)
  const sheets = {};
  SHEET_TABS_ORDER.forEach(function (key) {
    const name = SHEET_TABS[key];
    let s = ss.getSheetByName(name);
    if (!s) s = ss.insertSheet(name);
    sheets[key] = s;
  });

  // 2. Aplicar schema em cada aba
  _setupTotal(sheets.total);
  _setupWebTotal(sheets.web_total);
  _setupWebOperational(sheets.web_desktop);
  _setupWebOperational(sheets.web_mobile);
  _setupApp(sheets.app);
  _setupWebLegado(sheets.web_legado);
  _setupNotasMetodologicas(sheets.notas);

  // 3. Reordenar abas na ordem canônica
  SHEET_TABS_ORDER.forEach(function (key, idx) {
    ss.setActiveSheet(sheets[key]);
    ss.moveActiveSheet(idx + 1);
  });

  // 4. Apagar Sheet1/Página1 vazia se sobrou (planilhas novas vêm com uma)
  ss.getSheets().forEach(function (s) {
    const isDefault = SETUP_SHEET_DEFAULT_BLANK_NAMES.indexOf(s.getName()) !== -1;
    const isOurs = SHEET_TABS_ORDER.some(function (k) { return SHEET_TABS[k] === s.getName(); });
    if (isDefault && !isOurs && s.getLastRow() <= 1 && s.getLastColumn() <= 1) {
      try { ss.deleteSheet(s); } catch (e) { /* não dá pra deletar a última aba */ }
    }
  });

  SpreadsheetApp.flush();
  Logger.log('Setup das 7 abas concluído.');
}

// =============================================================================
// Aba 1 — Total (7 cols, pré-populada 01/01/2026 a 31/12/2026)
// =============================================================================

function _setupTotal(sheet) {
  _writeHeader(sheet, 1, TOTAL_HEADERS);

  const start = new Date(2026, 0, 1);
  const end = new Date(2026, 11, 31);
  const days = _daysBetween(start, end) + 1;
  const cutoff = new Date(2026, 4, 26);
  const preCutoffDays = _daysBetween(start, cutoff);

  const matrix = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const r = i + 2;
    const dateRef = 'B' + r;

    const visPre  = "SUMIF('Web Legado Agregado'!B:B;" + dateRef + ";'Web Legado Agregado'!C:C)" +
                    "+SUMIF('App'!B:B;" + dateRef + ";'App'!C:C)";
    const visPos  = "SUMIF('Web Desktop'!B:B;" + dateRef + ";'Web Desktop'!C:C)" +
                    "+SUMIF('Web Mobile'!B:B;" + dateRef + ";'Web Mobile'!C:C)" +
                    "+SUMIF('App'!B:B;" + dateRef + ";'App'!C:C)";

    const novPre  = "SUMIF('Web Legado Agregado'!B:B;" + dateRef + ";'Web Legado Agregado'!D:D)" +
                    "+SUMIF('App'!B:B;" + dateRef + ";'App'!D:D)";
    const novPos  = "SUMIF('Web Desktop'!B:B;" + dateRef + ";'Web Desktop'!D:D)" +
                    "+SUMIF('Web Mobile'!B:B;" + dateRef + ";'Web Mobile'!D:D)" +
                    "+SUMIF('App'!B:B;" + dateRef + ";'App'!D:D)";

    const appVendasNovas =
      "SUMIF('App'!B:B;" + dateRef + ";'App'!E:E)+SUMIF('App'!B:B;" + dateRef + ";'App'!F:F)";

    const vendPre = "SUMIF('Web Legado Agregado'!B:B;" + dateRef + ";'Web Legado Agregado'!G:G)+" + appVendasNovas;
    const vendPos = "SUMIF('Web Desktop'!B:B;" + dateRef + ";'Web Desktop'!G:G)" +
                    "+SUMIF('Web Mobile'!B:B;" + dateRef + ";'Web Mobile'!G:G)+" + appVendasNovas;

    matrix.push([
      '=TEXT(' + dateRef + ';"dddd")',
      d,
      '=IF(' + dateRef + '<DATE(2026;5;26);"Metodologia legada";"GA4 + RevenueCat")',
      '=IF(' + dateRef + '<DATE(2026;5;26);' + visPre + ';' + visPos + ')',
      '=IF(' + dateRef + '<DATE(2026;5;26);' + novPre + ';' + novPos + ')',
      '=IF(' + dateRef + '<DATE(2026;5;26);' + vendPre + ';' + vendPos + ')',
      "=IF(" + dateRef + "<DATE(2026;5;26);0;SUMIF('App'!B:B;" + dateRef + ";'App'!G:G))",
    ]);
  }

  sheet.getRange(2, 1, days, TOTAL_HEADERS.length).setValues(matrix);

  // Formatação
  sheet.getRange(2, 2, days, 1).setNumberFormat('dd/mm/yyyy');
  sheet.getRange(2, 4, days, 4).setNumberFormat('#,##0');

  if (preCutoffDays > 0) {
    sheet.getRange(2, 1, preCutoffDays, TOTAL_HEADERS.length).setBackground(SETUP_PRE_CUTOFF_BG);
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, TOTAL_HEADERS.length);
}

// =============================================================================
// Aba 2 — Web Total (19 cols, pré-populada 26/05/2026 a 31/12/2026, 100% fórmula)
// =============================================================================

function _setupWebTotal(sheet) {
  _writeHeader(sheet, 1, WEB_HEADERS);

  const start = new Date(2026, 4, 26);
  const end = new Date(2026, 11, 31);
  const days = _daysBetween(start, end) + 1;

  const matrix = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const r = i + 2;
    matrix.push([
      '=TEXT(B' + r + ';"dddd")',
      d,
      _sumWebSheets('C', r),
      _sumWebSheets('D', r),
      _sumWebSheets('E', r),
      _sumWebSheets('F', r),
      _sumWebSheets('G', r),
      '=IFERROR(G' + r + '/C' + r + ';0)',
      '=IFERROR(G' + r + '/D' + r + ';0)',
      '=IFERROR(E' + r + '/C' + r + ';0)',
      '=IFERROR(F' + r + '/E' + r + ';0)',
      '=IFERROR(G' + r + '/E' + r + ';0)',
      '=IFERROR(G' + r + '/F' + r + ';0)',
      _sumWebSheets('N', r),
      '=IFERROR(P' + r + '/N' + r + ';0)',
      _sumWebSheets('P', r),
      '=IFERROR(R' + r + '/P' + r + ';0)',
      '=G' + r,
      '', // OBS — manual
    ]);
  }

  sheet.getRange(2, 1, days, WEB_HEADERS.length).setValues(matrix);
  _applyWebFormats(sheet, 2, days);

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, WEB_HEADERS.length);
}

// =============================================================================
// Abas 3 e 4 — Web Desktop e Web Mobile (só headers; ETL preenche)
// =============================================================================

function _setupWebOperational(sheet) {
  _writeHeader(sheet, 1, WEB_HEADERS);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, WEB_HEADERS.length);
}

// =============================================================================
// Aba 5 — App (só headers; backfill + ETL preenchem)
// =============================================================================

function _setupApp(sheet) {
  _writeHeader(sheet, 1, APP_HEADERS);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, APP_HEADERS.length);
}

// =============================================================================
// Aba 6 — Web Legado Agregado (linha 1 aviso, linha 2 headers, linha 3+ backfill)
// =============================================================================

function _setupWebLegado(sheet) {
  const numCols = WEB_HEADERS.length;

  // Linha 1: aviso vermelho merged
  const warn = sheet.getRange(1, 1, 1, numCols);
  warn.breakApart();
  warn.merge();
  warn.setValue(
    '⚠️ HISTÓRICO LEGADO — Fonte: Statcounter. Período: 01/jan/2026 a 25/mai/2026. ' +
    'Não somar com Web Desktop / Web Mobile / App pós-26/05 (mudança metodológica).'
  );
  warn.setBackground(SETUP_WARNING_BG);
  warn.setFontColor(SETUP_WARNING_FG);
  warn.setFontWeight('bold');
  warn.setHorizontalAlignment('center');
  warn.setVerticalAlignment('middle');
  warn.setWrap(true);
  sheet.setRowHeight(1, 44);

  // Linha 2: headers
  _writeHeader(sheet, 2, WEB_HEADERS);

  sheet.setFrozenRows(2);
  sheet.autoResizeColumns(1, numCols);
}

// =============================================================================
// Aba 7 — Notas Metodológicas (texto fixo)
// =============================================================================

function _setupNotasMetodologicas(sheet) {
  const blocks = [
    { type: 'title',   text: 'Notas Metodológicas — Conversão Diária V2' },
    { type: 'blank' },
    { type: 'section', text: 'MIGRAÇÃO STATCOUNTER → GA4' },
    { type: 'body',    text:
      'Em 26/05/2026 a base de dados web migrou de Statcounter para Google Analytics 4. ' +
      'Números absolutos podem diferir entre os dois períodos por diferença na metodologia ' +
      'de captura (cookies de terceiros, anti-tracking, bots, etc.). Use a aba "Web Legado ' +
      'Agregado" para comparar histórico pré-cutoff.' },
    { type: 'blank' },
    { type: 'section', text: 'VENDAS WEB = PROXY VIA PAGEVIEW /obrigado' },
    { type: 'body',    text:
      'A métrica "Vendas" nas abas Web Desktop / Web Mobile usa GA4 como proxy: usuários ' +
      'únicos com pageview em URL contendo "/obrigado". Caveats: não desconta refunds, ' +
      'vulnerável a ad blockers (subestima), e bots/spiders podem inflar (superestima). ' +
      'Para fonte autoritativa de vendas, consultar backend Investidor10.' },
    { type: 'blank' },
    { type: 'section', text: 'CADASTROS WEB = MANUAL' },
    { type: 'body',    text:
      'A coluna "Cadastros" (col 4) das abas Web Desktop e Web Mobile é preenchida ' +
      'manualmente a partir do backend Investidor10. O ETL preserva essa coluna ao ' +
      'reescrever as demais.' },
    { type: 'blank' },
    { type: 'section', text: 'JANELA DE REPROCESSAMENTO' },
    { type: 'body',    text:
      'O ETL roda diariamente às 06:00 BRT e reescreve os últimos 3 dias (D-1, D-2, D-3) ' +
      'para capturar ajustes tardios das fontes. GA4 estabiliza dados após ~48h.' },
    { type: 'blank' },
    { type: 'section', text: 'DEFINIÇÕES DE MÉTRICAS' },
    { type: 'bullet',  text: 'Visitantes Únicos (Web): GA4 totalUsers filtrado por deviceCategory.' },
    { type: 'bullet',  text: 'Visitantes LP: GA4 totalUsers, deviceCategory + pagePath contém "/assine" (excluindo "checkout").' },
    { type: 'bullet',  text: 'Visitantes Checkout: GA4 totalUsers, deviceCategory + pagePath contém "/checkout" (excluindo "/obrigado").' },
    { type: 'bullet',  text: 'Visitantes Dados Pessoais P-1A: GA4 totalUsers, deviceCategory + pagePath contém "dados-pessoais".' },
    { type: 'bullet',  text: 'Visitantes Pagamento P-1A: GA4 totalUsers, deviceCategory + pagePath contém "/pagamento".' },
    { type: 'bullet',  text: 'Vendas (Web): GA4 totalUsers com pageview em pagePath contém "/obrigado".' },
    { type: 'bullet',  text: 'Visit. Únicos App: GA4 totalUsers (property 387307776).' },
    { type: 'bullet',  text: 'Novos Usuários App: GA4 firstOpens (property 387307776).' },
    { type: 'bullet',  text: 'Vendas Novas Android / iOS: RevenueCat event type INITIAL_PURCHASE filtrado por store.' },
    { type: 'bullet',  text: 'Renovações App: RevenueCat event type RENEWAL.' },
    { type: 'blank' },
    { type: 'section', text: 'OVERLAP DOS PATH FILTERS' },
    { type: 'body',    text:
      'URLs como "/checkout/dados-pessoais" contam tanto em "Visitantes Checkout" quanto em ' +
      '"Visitantes Dados Pessoais P-1A". O overlap é proposital — P-1A é o detalhamento do ' +
      'funil dentro do checkout.' },
    { type: 'blank' },
    { type: 'section', text: 'ABA TOTAL — REGRA HÍBRIDA' },
    { type: 'body',    text:
      'A aba "Total" aplica regra híbrida por data: linhas com data < 26/05/2026 somam ' +
      '"Web Legado Agregado" + App; linhas com data >= 26/05/2026 somam Web Desktop + Web ' +
      'Mobile + App. Renovações pré-cutoff são forçadas a 0 (Statcounter não distinguia ' +
      'renovações).' },
  ];

  const values = blocks.map(function (b) { return [b.text || '']; });
  sheet.getRange(1, 1, values.length, 1).setValues(values);

  // Formatação por tipo de bloco
  blocks.forEach(function (b, idx) {
    const row = idx + 1;
    if (b.type === 'title') {
      sheet.getRange(row, 1).setFontSize(14).setFontWeight('bold');
    } else if (b.type === 'section') {
      sheet.getRange(row, 1).setFontWeight('bold').setFontSize(11);
    }
  });

  sheet.getRange(1, 1, values.length, 1).setWrap(true).setVerticalAlignment('top');
  sheet.setColumnWidth(1, 900);
}

// =============================================================================
// Helpers
// =============================================================================

function _writeHeader(sheet, row, headers) {
  const range = sheet.getRange(row, 1, 1, headers.length);
  range.setValues([headers]);
  range.setFontWeight('bold');
  range.setBackground(SETUP_HEADER_BG);
  range.setHorizontalAlignment('center');
  range.setWrap(true);
}

/** SUMIF de uma coluna do Web Desktop + Web Mobile. */
function _sumWebSheets(col, row) {
  return "=SUMIF('Web Desktop'!B:B;B" + row + ";'Web Desktop'!" + col + ":" + col + ")" +
         "+SUMIF('Web Mobile'!B:B;B" + row + ";'Web Mobile'!" + col + ":" + col + ")";
}

function _applyWebFormats(sheet, startRow, numRows) {
  // C-G: contagens (5 cols)
  sheet.getRange(startRow, 2, numRows, 1).setNumberFormat('dd/mm/yyyy');
  sheet.getRange(startRow, 3, numRows, 5).setNumberFormat('#,##0');
  // H-M: conversões (6 cols)
  sheet.getRange(startRow, 8, numRows, 6).setNumberFormat('0.00%');
  // N: contagem
  sheet.getRange(startRow, 14, numRows, 1).setNumberFormat('#,##0');
  // O: %
  sheet.getRange(startRow, 15, numRows, 1).setNumberFormat('0.00%');
  // P: contagem
  sheet.getRange(startRow, 16, numRows, 1).setNumberFormat('#,##0');
  // Q: %
  sheet.getRange(startRow, 17, numRows, 1).setNumberFormat('0.00%');
  // R: contagem
  sheet.getRange(startRow, 18, numRows, 1).setNumberFormat('#,##0');
}

function _daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / MS);
}

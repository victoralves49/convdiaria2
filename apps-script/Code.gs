// Code.gs
// Entry points do ETL Conversão Diária V2.
//
//   runEtl()              — chamado pelo trigger diário 06:00 BRT. Janela D-1 a D-N.
//   runEtlForRange(s, e)  — uso programático com Date objects.
//   runEtlBackfill(s, e)  — uso manual no editor: strings 'YYYY-MM-DD'.
//   runSmokeTest()        — valida acesso GA4 web/app + Sheets (sem escrever nada).
//   installTrigger()      — cria/recria o trigger time-driven 06:00 BRT.
//   uninstallTriggers()   — remove todos os triggers deste script.

/**
 * Trigger handler diário. Janela = D-1 a D-(REPROCESS_DAYS).
 * Default REPROCESS_DAYS=3 → reescreve ontem, anteontem e tresdiasatrás.
 */
function runEtl() {
  const today = new Date();
  const reproDays = parseInt(cfg('REPROCESS_DAYS'), 10) || 3;
  const endDate   = _addDays(today, -1);
  const startDate = _addDays(today, -reproDays);
  return runEtlForRange(startDate, endDate);
}

/**
 * ETL executado sobre um range arbitrário. Útil pra backfill rápido de
 * alguns dias após resolver problema de fonte. NÃO usa pra grande backfill
 * (~6 meses) — pode estourar timeout de 6min do Apps Script. Use o
 * Scripts_Backfill.gs nesses casos.
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Object} estatísticas por aba
 */
function runEtlForRange(startDate, endDate) {
  const rangeLabel = _isoDate(startDate) + ' → ' + _isoDate(endDate);
  Logger.log('ETL iniciado. Range: ' + rangeLabel);

  // 1. Extrair
  const webData  = fetchGa4Web(startDate, endDate);
  const appUsers = fetchGa4AppUsers(startDate, endDate);
  const rcData   = fetchRevenueCat(startDate, endDate);

  // 2. Transformar
  const webDesktopRows = buildWebRows(webData.desktop);
  const webMobileRows  = buildWebRows(webData.mobile);
  const appRows        = buildAppRows(appUsers, rcData);

  // 3. Carregar (upsert preservando colunas manuais)
  const stats = {
    range: [_isoDate(startDate), _isoDate(endDate)],
    by_tab: {},
  };
  stats.by_tab[SHEET_TABS.web_desktop] = upsertRows(SHEET_TABS.web_desktop, webDesktopRows);
  stats.by_tab[SHEET_TABS.web_mobile]  = upsertRows(SHEET_TABS.web_mobile,  webMobileRows);
  stats.by_tab[SHEET_TABS.app]         = upsertRows(SHEET_TABS.app,         appRows);

  SpreadsheetApp.flush();
  Logger.log('ETL concluído. Stats: ' + JSON.stringify(stats, null, 2));
  return stats;
}

/** Wrapper amigável pra rodar no editor: runEtlBackfill('2026-05-22', '2026-05-22') */
function runEtlBackfill(startIso, endIso) {
  return runEtlForRange(_dateFromIso(startIso), _dateFromIso(endIso));
}

/** Smoke test de leitura. Retorna {ok, checks, errors}. */
function runSmokeTest() {
  const out = { ok: true, checks: {}, errors: [] };

  try {
    out.checks.ga4_web = _checkGa4(cfg('GA4_WEB_PROPERTY_ID'), 'web');
  } catch (e) {
    out.errors.push('ga4_web: ' + e.message);
    out.checks.ga4_web = { ok: false, error: e.message };
  }

  try {
    out.checks.ga4_app = _checkGa4(cfg('GA4_APP_PROPERTY_ID'), 'app');
  } catch (e) {
    out.errors.push('ga4_app: ' + e.message);
    out.checks.ga4_app = { ok: false, error: e.message };
  }

  try {
    out.checks.sheets = _checkSheets(cfg('SHEETS_DOC_ID'));
  } catch (e) {
    out.errors.push('sheets: ' + e.message);
    out.checks.sheets = { ok: false, error: e.message };
  }

  const rcProject = cfg('REVENUECAT_PROJECT_ID');
  const rcKey     = cfg('REVENUECAT_API_KEY');
  if (rcProject && rcKey) {
    try {
      out.checks.revenuecat = _checkRevenueCat(rcProject, rcKey);
    } catch (e) {
      out.errors.push('revenuecat: ' + e.message);
      out.checks.revenuecat = { ok: false, error: e.message };
    }
  } else {
    out.checks.revenuecat = { ok: null, skipped: 'sem properties (fase 1)' };
  }

  out.ok = out.errors.length === 0;
  Logger.log('smoke-test → ' + JSON.stringify(out, null, 2));
  return out;
}

function _checkGa4(propertyId, label) {
  const resp = AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }],
    dimensions: [{ name: 'date' }],
    metrics:    [{ name: 'totalUsers' }],
    limit: 1,
  }, 'properties/' + propertyId);
  return {
    label: label,
    property: propertyId,
    rows_returned: (resp.rows || []).length,
    ok: true,
  };
}

function _checkSheets(docId) {
  const ss = SpreadsheetApp.openById(docId);
  return {
    doc_id: docId,
    title: ss.getName(),
    tabs: ss.getSheets().map(function (s) { return s.getName(); }),
    ok: true,
  };
}

function _checkRevenueCat(projectId, apiKey) {
  let projectName = null;
  let listingStatus;

  // (1) Tenta listar projetos — opcional. 403 (sem escopo projects:read) é OK.
  const listResp = _rcGet('/v2/projects?limit=50', apiKey);
  if (listResp.code === 200) {
    const data = JSON.parse(listResp.body);
    const projects = data.items || data.data || [];
    let found = null;
    for (let i = 0; i < projects.length; i++) {
      if (projects[i].id === projectId) { found = projects[i]; break; }
    }
    if (!found) {
      const ids = projects.map(function (p) {
        return p.id + ' (' + (p.name || '?') + ')';
      }).join(', ');
      throw new Error('project_id "' + projectId + '" nao esta visivel. ' +
                      'IDs disponiveis: [' + ids + ']');
    }
    projectName = found.name;
    listingStatus = 'ok';
  } else if (listResp.code === 403) {
    listingStatus = 'sem escopo projects:read (ok — nao e necessario pro ETL)';
  } else if (listResp.code === 401) {
    throw new Error('API key invalida: HTTP 401 — ' + listResp.body.slice(0, 200));
  } else {
    throw new Error('Erro inesperado ao listar projetos: HTTP ' + listResp.code +
                    ' — ' + listResp.body.slice(0, 200));
  }

  // (2) Check do endpoint que o ETL realmente usa — este é obrigatorio
  const evResp = _rcGet('/v2/projects/' + encodeURIComponent(projectId) + '/events?limit=1', apiKey);
  if (evResp.code !== 200) {
    throw new Error('Sem acesso a /events do projeto: HTTP ' + evResp.code +
                    ' — ' + evResp.body.slice(0, 200));
  }

  return {
    project_id:    projectId,
    project_name:  projectName || '(nao recuperado — sem escopo projects:read)',
    listing_check: listingStatus,
    events_check:  'ok',
    ok: true,
  };
}

function _rcGet(path, apiKey) {
  const resp = UrlFetchApp.fetch('https://api.revenuecat.com' + path, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
    muteHttpExceptions: true,
  });
  return { code: resp.getResponseCode(), body: resp.getContentText() };
}

// --- Trigger management ------------------------------------------------------

/** Cria o trigger time-driven 06:00 BRT diário. Idempotente. */
function installTrigger() {
  uninstallTriggers();
  ScriptApp.newTrigger('runEtl')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .inTimezone(cfg('TIMEZONE'))
    .create();
  Logger.log('Trigger criado: runEtl diário às 06:00 ' + cfg('TIMEZONE'));
}

/** Remove todos os triggers deste script. */
function uninstallTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });
}

// --- Utility -----------------------------------------------------------------

function _addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

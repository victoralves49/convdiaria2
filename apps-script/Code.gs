// Code.gs
// Entry points do ETL Conversão Diária V2.
//
//   runEtl()         — chamado pelo trigger diário (placeholder na fase 1)
//   runSmokeTest()   — valida acesso GA4 web/app + Sheets (rodar manual)
//   installTrigger() — cria/recria o trigger time-driven 6h BRT
//   uninstallTriggers() — remove todos os triggers deste script

/** Trigger handler diário. Fase 1: só roda o smoke test. Fase 2: ETL real. */
function runEtl() {
  const r = runSmokeTest();
  if (!r.ok) {
    throw new Error('ETL abortado — smoke test falhou: ' + JSON.stringify(r.errors));
  }
  Logger.log('Fase 1 — só smoke test. ETL real será implementado na fase 2.');
}

/** Smoke test de leitura. Retorna {ok, checks, errors}. Use no editor pra validar. */
function runSmokeTest() {
  const out = { ok: true, checks: {}, errors: [] };

  // GA4 web
  try {
    out.checks.ga4_web = _checkGa4(cfg('GA4_WEB_PROPERTY_ID'), 'web');
  } catch (e) {
    out.errors.push('ga4_web: ' + e.message);
    out.checks.ga4_web = { ok: false, error: e.message };
  }

  // GA4 app
  try {
    out.checks.ga4_app = _checkGa4(cfg('GA4_APP_PROPERTY_ID'), 'app');
  } catch (e) {
    out.errors.push('ga4_app: ' + e.message);
    out.checks.ga4_app = { ok: false, error: e.message };
  }

  // Sheets
  try {
    out.checks.sheets = _checkSheets(cfg('SHEETS_DOC_ID'));
  } catch (e) {
    out.errors.push('sheets: ' + e.message);
    out.checks.sheets = { ok: false, error: e.message };
  }

  // RevenueCat — opcional nesta fase
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
  const titles = ss.getSheets().map(function (s) { return s.getName(); });
  return {
    doc_id: docId,
    title: ss.getName(),
    tabs: titles,
    ok: true,
  };
}

function _checkRevenueCat(projectId, apiKey) {
  const r = UrlFetchApp.fetch(
    'https://api.revenuecat.com/v2/projects/' + encodeURIComponent(projectId),
    {
      method: 'get',
      headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
      muteHttpExceptions: true,
    }
  );
  const code = r.getResponseCode();
  if (code !== 200) throw new Error('HTTP ' + code + ': ' + r.getContentText().slice(0, 200));
  return { project_id: projectId, status_code: code, ok: true };
}

// --- Trigger management ------------------------------------------------------

/** Cria o trigger time-driven 06:00-07:00 BRT diário. Idempotente. */
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

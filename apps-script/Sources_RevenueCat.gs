// Sources_RevenueCat.gs
// Extração de vendas Android, iOS e renovações via RevenueCat REST v2.
//
// fetchRevenueCat(startDate, endDate)
//   → { 'YYYY-MM-DD': { vendas_android, vendas_ios, renovacoes } }
//
// Implementação: pagina /v2/projects/{id}/events filtrando por type, filtra
// localmente por data (mais robusto a variações de query-string da API).
// Para 3 dias de operação normal, retornam-se ~poucas centenas de eventos
// — folgado em quota e tempo.
//
// Se REVENUECAT_PROJECT_ID ou REVENUECAT_API_KEY não estiverem em Script
// Properties, retorna mapa zerado e loga o skip — nunca falha.

const _RC_API_BASE = 'https://api.revenuecat.com/v2';
const _RC_PAGE_LIMIT = 200;
const _RC_MAX_PAGES  = 200; // hard stop: 200 pages × 200 = 40k events

function fetchRevenueCat(startDate, endDate) {
  // Estrutura zerada pro range completo
  const out = {};
  _forEachDay(startDate, endDate, function (_, iso) {
    out[iso] = { vendas_android: 0, vendas_ios: 0, renovacoes: 0 };
  });

  const projectId = cfg('REVENUECAT_PROJECT_ID');
  const apiKey    = cfg('REVENUECAT_API_KEY');
  if (!projectId || !apiKey) {
    Logger.log('RevenueCat: skipped (sem Script Properties).');
    return out;
  }

  const startMs = startDate.getTime();
  // endDate é inclusivo (último dia até 23:59:59) → soma 1 dia em ms
  const endMs   = _addDays(endDate, 1).getTime();

  const events = _rcFetchAllEvents(projectId, apiKey, startMs, endMs);
  Logger.log('RevenueCat: ' + events.length + ' eventos no range ' +
             _isoDate(startDate) + ' → ' + _isoDate(endDate));

  events.forEach(function (e) {
    const ts = _rcEventTimestamp(e);
    if (!ts || ts < startMs || ts >= endMs) return;

    const iso = _isoDate(new Date(ts));
    const bucket = out[iso];
    if (!bucket) return;

    const type  = (e.type  || '').toUpperCase();
    const store = (e.store || '').toUpperCase();

    if (type === 'INITIAL_PURCHASE') {
      if (store === REVENUECAT_STORE_FILTERS.android)     bucket.vendas_android++;
      else if (store === REVENUECAT_STORE_FILTERS.ios)    bucket.vendas_ios++;
    } else if (type === 'RENEWAL') {
      bucket.renovacoes++;
    }
    // PRODUCT_CHANGE e demais types são ignorados (decisão de escopo).
  });

  return out;
}

/**
 * Lista os projetos visíveis à sua API key — útil pra descobrir o project_id
 * correto quando o smoke test retorna 404.
 *
 *   listRevenueCatProjects()  → loga os projetos com seus IDs e nomes
 */
function listRevenueCatProjects() {
  const apiKey = cfg('REVENUECAT_API_KEY');
  if (!apiKey) throw new Error('Sem REVENUECAT_API_KEY em Script Properties');

  const resp = UrlFetchApp.fetch(_RC_API_BASE + '/projects?limit=50', {
    method: 'get',
    headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
    muteHttpExceptions: true,
  });
  Logger.log('HTTP ' + resp.getResponseCode());
  Logger.log(resp.getContentText());

  if (resp.getResponseCode() !== 200) return;
  const data = JSON.parse(resp.getContentText());
  const items = data.items || data.data || [];
  Logger.log('--- Projetos encontrados (' + items.length + ') ---');
  items.forEach(function (p) {
    Logger.log('  id=' + p.id + '  name=' + p.name);
  });
}

/**
 * Função utilitária pra rodar no editor e inspecionar a estrutura crua de
 * um evento RevenueCat. Use quando algo parecer estranho na agregação.
 *
 *   inspectRevenueCatEvent()  → loga o primeiro evento bruto + estatísticas
 */
function inspectRevenueCatEvent() {
  const projectId = cfg('REVENUECAT_PROJECT_ID');
  const apiKey    = cfg('REVENUECAT_API_KEY');
  if (!projectId || !apiKey) throw new Error('Sem Script Properties pra RevenueCat');

  const url = _RC_API_BASE + '/projects/' + encodeURIComponent(projectId) +
              '/events?limit=3';
  const resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
    muteHttpExceptions: true,
  });
  Logger.log('HTTP ' + resp.getResponseCode());
  Logger.log(resp.getContentText());
}

// =============================================================================
// Internals
// =============================================================================

function _rcFetchAllEvents(projectId, apiKey, startMs, endMs) {
  const headers = {
    Authorization: 'Bearer ' + apiKey,
    Accept: 'application/json',
  };
  const baseUrl = _RC_API_BASE + '/projects/' + encodeURIComponent(projectId) + '/events';

  const all = [];
  let url = baseUrl + '?limit=' + _RC_PAGE_LIMIT +
            '&type=INITIAL_PURCHASE&type=RENEWAL';
  let pages = 0;

  while (url && pages < _RC_MAX_PAGES) {
    const resp = UrlFetchApp.fetch(url, { method: 'get', headers: headers, muteHttpExceptions: true });
    const code = resp.getResponseCode();
    const text = resp.getContentText();
    if (code !== 200) {
      throw new Error('RevenueCat HTTP ' + code + ': ' + text.slice(0, 400));
    }
    const data = JSON.parse(text);
    const items = data.items || data.data || [];
    if (!items.length) break;

    // O mais antigo desta página — se já passou de startMs, podemos parar
    let oldestInPage = Infinity;
    items.forEach(function (e) {
      all.push(e);
      const ts = _rcEventTimestamp(e);
      if (ts && ts < oldestInPage) oldestInPage = ts;
    });

    if (oldestInPage < startMs) break;

    // RevenueCat v2 paginação: pode ser `next_page` (URL completa) ou
    // `next_page_url`. Tentamos ambos pra resiliência.
    url = data.next_page || data.next_page_url || null;
    pages++;
  }

  if (pages >= _RC_MAX_PAGES) {
    Logger.log('RevenueCat: hit MAX_PAGES (' + _RC_MAX_PAGES + ') — paginação interrompida.');
  }
  return all;
}

/** Extrai timestamp (ms) do evento, tolerando diferentes nomes de campo. */
function _rcEventTimestamp(e) {
  if (e.event_timestamp_ms)  return e.event_timestamp_ms;
  if (e.purchased_at_ms)     return e.purchased_at_ms;
  if (e.timestamp_ms)        return e.timestamp_ms;
  if (e.event_timestamp)     return new Date(e.event_timestamp).getTime();
  if (e.purchased_at)        return new Date(e.purchased_at).getTime();
  return 0;
}

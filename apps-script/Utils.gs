// Utils.gs
// Helpers compartilhados entre módulos. Tudo aqui é puro/sem side-effect.

/** Converte Date → 'YYYY-MM-DD'. */
function _isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/** Converte 'YYYYMMDD' (formato retornado pelo GA4) → 'YYYY-MM-DD'. */
function _isoFromGa4Date(yyyymmdd) {
  return yyyymmdd.substr(0, 4) + '-' + yyyymmdd.substr(4, 2) + '-' + yyyymmdd.substr(6, 2);
}

/** Inteiro de dias entre duas datas (b - a). Ignora horas/minutos. */
function _daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((db - da) / MS);
}

/** Converte 'YYYY-MM-DD' → Date local. */
function _dateFromIso(iso) {
  const parts = iso.split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

/** Itera de startDate a endDate inclusive chamando callback(date, isoString). */
function _forEachDay(startDate, endDate, callback) {
  const days = _daysBetween(startDate, endDate) + 1;
  for (let i = 0; i < days; i++) {
    const d = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + i
    );
    callback(d, _isoDate(d));
  }
}

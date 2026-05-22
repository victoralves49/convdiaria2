// Destinations_Sheets.gs
// Upsert no Google Sheets, idempotente e preservando colunas manuais.
//
// upsertRows(tabName, rows, opts)
//   tabName: nome da aba (string).
//   rows:    Array<{date, cells}> vindo do builder.
//   opts:    { dataStartRow: number, dateColumn: number } — defaults 2 e 2.
//
// Para cada row:
//   - Se a data já existe na aba → reescreve as células (preservando os null).
//   - Se não existe → insere linha nova na posição cronologicamente correta.
//
// Em `cells`:
//   - null              → preserva o valor atual da célula (não escreve).
//   - '=fórmula{ROW}…'  → fórmula; '{ROW}' é substituído pelo número real da linha.
//   - outro valor       → escrita literal.

/**
 * @param {string} tabName
 * @param {Array<{date: string, cells: Array}>} rows
 * @param {{dataStartRow?: number, dateColumn?: number}} [opts]
 * @returns {{inserted: number, updated: number, tab: string}}
 */
function upsertRows(tabName, rows, opts) {
  opts = opts || {};
  const dataStartRow = opts.dataStartRow || 2;
  const dateColumn   = opts.dateColumn   || DATE_COLUMN;

  if (!rows || rows.length === 0) {
    return { tab: tabName, inserted: 0, updated: 0 };
  }

  const ss = SpreadsheetApp.openById(cfg('SHEETS_DOC_ID'));
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error('Aba não encontrada: ' + tabName);

  // Ordena por data ascendente — inserções subsequentes ficam consistentes.
  const sortedRows = rows.slice().sort(function (a, b) {
    return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0);
  });

  const dateIndex = _loadDateIndex(sheet, dataStartRow, dateColumn);
  let inserted = 0;
  let updated  = 0;

  sortedRows.forEach(function (row) {
    if (dateIndex[row.date]) {
      _writeRow(sheet, dateIndex[row.date], row.cells);
      updated++;
    } else {
      const insertAt = _findInsertPosition(sheet, dataStartRow, dateColumn, row.date);
      sheet.insertRowBefore(insertAt);
      _writeRow(sheet, insertAt, row.cells);
      _shiftIndex(dateIndex, insertAt);
      dateIndex[row.date] = insertAt;
      inserted++;
    }
  });

  return { tab: tabName, inserted: inserted, updated: updated };
}

// =============================================================================
// Internals
// =============================================================================

/** Lê a coluna de data e retorna { 'YYYY-MM-DD': rowNumber }. */
function _loadDateIndex(sheet, startRow, dateColumn) {
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) return {};
  const numRows = lastRow - startRow + 1;
  const values = sheet.getRange(startRow, dateColumn, numRows, 1).getValues();
  const index = {};
  for (let i = 0; i < values.length; i++) {
    const v = values[i][0];
    if (v instanceof Date) {
      index[_isoDate(v)] = startRow + i;
    }
  }
  return index;
}

/** Primeira linha cuja data é > targetIso. Retorna lastRow+1 se nenhuma. */
function _findInsertPosition(sheet, startRow, dateColumn, targetIso) {
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) return startRow;
  const numRows = lastRow - startRow + 1;
  const values = sheet.getRange(startRow, dateColumn, numRows, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    const v = values[i][0];
    if (v instanceof Date && _isoDate(v) > targetIso) {
      return startRow + i;
    }
  }
  return lastRow + 1;
}

/** Shift +1 em todos os índices >= insertedAt. */
function _shiftIndex(index, insertedAt) {
  Object.keys(index).forEach(function (k) {
    if (index[k] >= insertedAt) index[k]++;
  });
}

/**
 * Escreve as células na linha rowNum.
 *  - null      → preserva valor atual.
 *  - {ROW}     → substituído pelo número da linha.
 *  - Otherwise → escrita literal.
 */
function _writeRow(sheet, rowNum, cells) {
  const numCols = cells.length;
  const range   = sheet.getRange(rowNum, 1, 1, numCols);
  const current = range.getValues()[0];

  const newValues = cells.map(function (cell, i) {
    if (cell === null || cell === undefined) return current[i];
    if (typeof cell === 'string' && cell.indexOf(ROW_PLACEHOLDER) >= 0) {
      return cell.split(ROW_PLACEHOLDER).join(String(rowNum));
    }
    return cell;
  });

  range.setValues([newValues]);
}

// Destinations_Sheets.gs
// Upsert no Google Sheets. A ser implementado na fase 2.
//
// Contrato planejado:
//
//   upsertRows(tabName, rows, opts)
//     opts = { dateColumnIndex: 1, preserveColumns: [3], formulaColumns: [7,8,...] }
//
// Comportamento:
//   - Localiza linha existente pela coluna `Data` (ISO YYYY-MM-DD).
//   - Se existe → sobrescreve as colunas do row, exceto as listadas em
//     `preserveColumns` (e.g. col 4 "Cadastros" nas abas Web). Fórmulas em
//     `formulaColumns` são escritas via setFormula() com refs ajustados pra linha.
//   - Se não existe → insere nova linha em ordem cronológica.
//   - Sempre batch via getRange().setValues() / setFormulas() — não célula por célula.

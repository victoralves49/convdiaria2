// Transformers_Builder.gs
// Consolida fontes em arrays linha-a-linha prontos para upsert no Sheets.
// A ser implementado na fase 2.
//
// Contratos planejados:
//
//   buildWebRows(webDataByDevice, device)
//     → [ [diaSemana, data, users, '', lp, checkout, vendas, '=G2/C2', '=G2/D2', ...] ]
//
//   buildAppRows(appUsers, rcData)
//     → [ [diaSemana, data, users, newUsers, vAndroid, vIos, renovacoes, '=E2+F2+G2', ''] ]
//
// Regras importantes:
//   - Colunas calculadas (Web cols 8-13, 15, 17, 18) saem como STRING de FÓRMULA,
//     com referência relativa à linha (substituir "2" pela linha real no destino).
//   - Coluna Cadastros (col 4) sai como string vazia '' — destino preserva o
//     valor manual existente.
//   - Datas em ISO YYYY-MM-DD internamente; formatação visual fica no Sheets.

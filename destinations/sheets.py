"""Upsert no Google Sheets (gspread).

A ser implementado na fase 2:
    def upsert(tab_name: str, df: pd.DataFrame, *, preserve_cols: list[str] = None): ...

Contrato:
  - Localiza linha pela coluna `Data` (ISO YYYY-MM-DD interno).
  - Se existe → sobrescreve TODAS as colunas do DataFrame, preservando as
    colunas listadas em `preserve_cols` (e.g. "Cadastros" nas abas Web).
  - Se não existe → insere nova linha em ordem cronológica.
  - Sempre batch update (não célula por célula) pra respeitar quota.
"""

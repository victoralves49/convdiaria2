"""Consolida fontes em DataFrames prontos para upsert no Sheets.

A ser implementado na fase 2:
    def build_web(web_data_by_device: dict) -> pd.DataFrame: ...
    def build_app(app_users: dict, rc_data: dict) -> pd.DataFrame: ...

Regras importantes:
  - Colunas calculadas (8-13, 15, 17, 18) saem como FÓRMULAS, não como valores
    pré-computados — o ETL escreve a string da fórmula no Sheets, com referência
    relativa à linha.
  - Coluna Cadastros (col 4) NÃO entra no DataFrame de upsert — é preservada
    pelo destino (sheets.py) ao reescrever a linha.
"""

"""One-shot: cria as 7 abas da planilha de destino com headers e fórmulas.

A ser implementado na fase 2. Vai criar (na ordem):
  1. Total (7 cols, fórmulas híbridas com cutoff 26/05/2026)
  2. Web Total (19 cols, 100% fórmula somando Desktop + Mobile)
  3. Web Desktop (19 cols, headers + fórmulas das colunas calculadas)
  4. Web Mobile (19 cols, idem)
  5. App (9 cols)
  6. Web Legado Agregado (19 cols, aviso vermelho no topo)
  7. Notas Metodológicas (texto fixo)

Rodar UMA vez:
    python -m scripts.setup_sheet
"""

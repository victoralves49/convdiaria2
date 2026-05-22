"""RevenueCat REST API v2 — vendas Android, iOS e renovações.

Desabilitado nesta fase (sem env vars). A ser implementado na fase 2:
    def fetch(start_date: date, end_date: date) -> dict[date, dict[str, int]]:
        '''Retorna {date: {"vendas_android": ..., "vendas_ios": ..., "renovacoes": ...}}.'''

Endpoint: GET https://api.revenuecat.com/v2/projects/{project_id}/events
Filtros: type IN [INITIAL_PURCHASE, RENEWAL], store por venda, date range.
Paginação via `next_page` token.
"""

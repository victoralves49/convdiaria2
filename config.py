"""Constantes estáticas do projeto.

Tudo aqui é pura configuração de domínio (page paths, products, nomes de aba).
Valores que mudam por ambiente ficam em variáveis de ambiente, não aqui.
"""
from __future__ import annotations

# --- GA4 ---------------------------------------------------------------------

PAGE_PATH_FILTERS = {
    "lp":                 {"contains": ["/assine"],        "not_contains": ["checkout"]},
    "checkout":           {"contains": ["/checkout"],      "not_contains": ["/obrigado"]},
    "p1a_dados_pessoais": {"contains": ["dados-pessoais"]},
    "p1a_pagamento":      {"contains": ["/pagamento"]},
    "vendas":             {"contains": ["/obrigado"]},
}

DEVICE_CATEGORIES = ["desktop", "mobile"]

# Métricas GA4 (decisão fechada com o time):
#   - Visitantes Únicos, LP, Checkout, P-1A e Vendas Web usam `totalUsers`
#   - App Novos Usuários usa `firstOpens`
GA4_METRIC_USERS = "totalUsers"
GA4_METRIC_APP_NEW = "firstOpens"

# --- RevenueCat --------------------------------------------------------------

REVENUECAT_PRODUCTS = {
    "android": [
        "i10_oneyear_android:i10-parcelas-12x",
        "i10_oneyear_android:i10-oneyear-android",
        "i10_oneyear_android:i10-rec",
    ],
    "ios": ["AppI10Pro"],
}

REVENUECAT_STORE_FILTERS = {
    "android": "PLAY_STORE",
    "ios":     "APP_STORE",
}

REVENUECAT_EVENT_TYPES = {
    "vendas_novas": ["INITIAL_PURCHASE"],
    "renovacoes":   ["RENEWAL"],
}

# --- Sheets ------------------------------------------------------------------

SHEET_TABS = {
    "total":       "Total",
    "web_total":   "Web Total",
    "web_desktop": "Web Desktop",
    "web_mobile":  "Web Mobile",
    "app":         "App",
    "web_legado":  "Web Legado Agregado",
    "notas":       "Notas Metodológicas",
}

# Ordem de exibição (a planilha será montada nesta ordem pelo setup_sheet.py).
SHEET_TABS_ORDER = [
    "total",
    "web_total",
    "web_desktop",
    "web_mobile",
    "app",
    "web_legado",
    "notas",
]

# --- Comportamento -----------------------------------------------------------

DEFAULT_REPROCESS_DAYS = 3
CUTOFF_DATE = "2026-05-26"
DEFAULT_TIMEZONE = "America/Sao_Paulo"

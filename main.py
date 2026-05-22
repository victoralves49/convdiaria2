"""Entrypoint do ETL — Conversão Diária V2.

Versão atual: smoke test de autenticação. Sem extração, sem transformação.
O objetivo é só provar que a Service Account consegue:
  1. Ler GA4 property web (267511960)
  2. Ler GA4 property app (387307776)
  3. Abrir o Google Sheets de destino
  4. (opcional) Ler RevenueCat se as env vars estiverem setadas

Execução:
    python main.py

Em produção roda como step de um workflow do GitHub Actions agendado em cron
(ver .github/workflows/etl-diario.yml).
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

from google.oauth2 import service_account

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("conversao-diaria")


GA4_SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]
SHEETS_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def _load_credentials(scopes: list[str]):
    """Carrega credenciais da SA. Procura GOOGLE_APPLICATION_CREDENTIALS; cai pra ADC."""
    key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if key_path and os.path.exists(key_path):
        return service_account.Credentials.from_service_account_file(key_path, scopes=scopes)
    import google.auth
    creds, _ = google.auth.default(scopes=scopes)
    return creds


def _check_ga4(property_id: str, label: str) -> dict[str, Any]:
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.analytics.data_v1beta.types import (
        DateRange,
        Dimension,
        Metric,
        RunReportRequest,
    )

    creds = _load_credentials(GA4_SCOPES)
    client = BetaAnalyticsDataClient(credentials=creds)
    req = RunReportRequest(
        property=f"properties/{property_id}",
        date_ranges=[DateRange(start_date="yesterday", end_date="yesterday")],
        dimensions=[Dimension(name="date")],
        metrics=[Metric(name="totalUsers")],
        limit=1,
    )
    resp = client.run_report(req)
    return {
        "label": label,
        "property": property_id,
        "rows_returned": len(resp.rows),
        "ok": True,
    }


def _check_sheets(doc_id: str) -> dict[str, Any]:
    import gspread

    creds = _load_credentials(SHEETS_SCOPES)
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(doc_id)
    titles = [ws.title for ws in sh.worksheets()]
    return {
        "doc_id": doc_id,
        "title": sh.title,
        "tabs": titles,
        "ok": True,
    }


def _check_revenuecat(project_id: str, api_key: str) -> dict[str, Any]:
    import requests

    r = requests.get(
        f"https://api.revenuecat.com/v2/projects/{project_id}",
        headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
        timeout=10,
    )
    r.raise_for_status()
    return {"project_id": project_id, "status_code": r.status_code, "ok": True}


def run_smoke_test() -> tuple[dict[str, Any], int]:
    checks: dict[str, Any] = {}
    errors: list[str] = []

    web_id = os.environ.get("GA4_WEB_PROPERTY_ID")
    app_id = os.environ.get("GA4_APP_PROPERTY_ID")
    sheets_id = os.environ.get("SHEETS_DOC_ID")
    rc_project = os.environ.get("REVENUECAT_PROJECT_ID")
    rc_key = os.environ.get("REVENUECAT_API_KEY")

    if web_id:
        try:
            checks["ga4_web"] = _check_ga4(web_id, "web")
        except Exception as e:
            errors.append(f"ga4_web: {e}")
            checks["ga4_web"] = {"ok": False, "error": str(e)}
    else:
        checks["ga4_web"] = {"ok": False, "error": "GA4_WEB_PROPERTY_ID não setado"}
        errors.append("GA4_WEB_PROPERTY_ID não setado")

    if app_id:
        try:
            checks["ga4_app"] = _check_ga4(app_id, "app")
        except Exception as e:
            errors.append(f"ga4_app: {e}")
            checks["ga4_app"] = {"ok": False, "error": str(e)}
    else:
        checks["ga4_app"] = {"ok": False, "error": "GA4_APP_PROPERTY_ID não setado"}
        errors.append("GA4_APP_PROPERTY_ID não setado")

    if sheets_id:
        try:
            checks["sheets"] = _check_sheets(sheets_id)
        except Exception as e:
            errors.append(f"sheets: {e}")
            checks["sheets"] = {"ok": False, "error": str(e)}
    else:
        checks["sheets"] = {"ok": False, "error": "SHEETS_DOC_ID não setado"}
        errors.append("SHEETS_DOC_ID não setado")

    if rc_project and rc_key:
        try:
            checks["revenuecat"] = _check_revenuecat(rc_project, rc_key)
        except Exception as e:
            errors.append(f"revenuecat: {e}")
            checks["revenuecat"] = {"ok": False, "error": str(e)}
    else:
        checks["revenuecat"] = {"ok": None, "skipped": "sem env vars (fase 1)"}

    status_code = 200 if not errors else 500
    body = {
        "status": "ok" if not errors else "partial",
        "checks": checks,
        "errors": errors,
    }
    log.info("smoke-test result: %s", json.dumps(body, ensure_ascii=False))
    return body, status_code


if __name__ == "__main__":
    body, status = run_smoke_test()
    print(json.dumps(body, indent=2, ensure_ascii=False))
    raise SystemExit(0 if status == 200 else 1)

# Conversão Diária ETL — V2

Pipeline diário que coleta dados de GA4 (web + app) e RevenueCat e escreve em
um Google Sheets estruturado em 7 abas. Roda às 6h BRT no Cloud Scheduler,
reescrevendo a janela D-1 → D-3 para capturar ajustes tardios das fontes.

> Escopo completo e plano de implementação estão na pasta-raiz do projeto
> (`escopo_conversao_diaria_v2.md` e `instrucoes_claude_code.md`).

## Status — Fase 1 (scaffolding)

Esta versão só faz **smoke test de autenticação**. Nada é extraído ou escrito.

- `main.py` autentica GA4 web, GA4 app e Sheets via Service Account; tenta
  RevenueCat se as env vars estiverem setadas.
- Pastas `sources/`, `transformers/`, `destinations/`, `scripts/` têm stubs.

## Rodando localmente

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# editar .env com GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
python main.py
```

Saída esperada (sucesso):
```json
{
  "status": "ok",
  "checks": {
    "ga4_web":   {"ok": true, ...},
    "ga4_app":   {"ok": true, ...},
    "sheets":    {"ok": true, "tabs": [...]},
    "revenuecat":{"ok": null, "skipped": "sem env vars (fase 1)"}
  }
}
```

## Setup de credenciais (uma vez)

1. Criar Service Account no GCP:
   ```bash
   gcloud iam service-accounts create conversao-diaria-etl --display-name="Conversao Diaria ETL"
   gcloud iam service-accounts keys create service-account.json \
     --iam-account=conversao-diaria-etl@[PROJECT].iam.gserviceaccount.com
   ```
2. **GA4 web** (267511960) → Admin → Property Access Management → adicionar
   email da SA com role `Viewer`.
3. **GA4 app** (387307776) → idem.
4. **Sheets** (`1QvP4...`) → Compartilhar → adicionar email da SA com `Editor`.

O `service-account.json` fica fora do repo (`.gitignore`).

## Stack

- Python 3.11
- Cloud Functions Gen 2 (HTTP), região `southamerica-east1`
- Cloud Scheduler `0 6 * * *` America/Sao_Paulo
- Secret Manager para o RevenueCat API key (quando for ativado)

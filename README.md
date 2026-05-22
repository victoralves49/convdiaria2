> ⚠️ **DESCONTINUADO em 22/05/2026.** Esta abordagem (Python + GitHub Actions
> + Service Account) foi abandonada porque o usuário não tem permissão de
> Admin nos GA4 properties para autorizar a SA. Reescrita em Google Apps
> Script vive em [`../apps-script/`](../apps-script/).
>
> Este diretório permanece como referência das decisões de schema e
> estrutura, mas o código aqui não é executado.

---

# Conversão Diária ETL — V2 (Python — descontinuado)

Pipeline diário que coleta dados de GA4 (web + app) e RevenueCat e escreve em
um Google Sheets estruturado em 7 abas. Roda às 6h BRT via GitHub Actions cron,
reescrevendo a janela D-1 → D-3 para capturar ajustes tardios das fontes.

> Escopo completo e plano de implementação estão na pasta-raiz do projeto
> (`escopo_conversao_diaria_v2.md` e `instrucoes_claude_code.md`).

## Stack

- Python 3.11
- GitHub Actions (cron `0 9 * * *` UTC = 06:00 BRT, sem horário de verão)
- GitHub Secrets para credenciais
- Service Account do GCP autorizada nos 2 GA4 properties e na Sheets
  (o GCP project só hospeda a SA — sem billing, sem Cloud Functions)

## Status — Fase 1 (scaffolding)

`main.py` só faz **smoke test de autenticação**. Nada é extraído ou escrito.
Fase 2 implementará as fontes (`sources/`), o builder e o destino (`sheets.py`).

## Rodando localmente

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# editar .env apontando GOOGLE_APPLICATION_CREDENTIALS pro service-account.json
python main.py
```

Saída esperada:
```json
{
  "status": "ok",
  "checks": {
    "ga4_web":   { "ok": true, "rows_returned": 1, ... },
    "ga4_app":   { "ok": true, "rows_returned": 1, ... },
    "sheets":    { "ok": true, "title": "...", "tabs": [...] },
    "revenuecat":{ "ok": null, "skipped": "sem env vars (fase 1)" }
  }
}
```

## Setup inicial (uma vez)

### 1. Criar GCP project e Service Account (sem billing)

No [Google Cloud Console](https://console.cloud.google.com/):

1. **Criar projeto novo** (qualquer nome, ex.: `convdiaria-i10`). Não habilitar billing.
2. **Habilitar APIs** (`APIs e Serviços` → `Biblioteca`):
   - Google Analytics Data API
   - Google Sheets API
   - Google Drive API
3. **Criar Service Account** (`IAM e Administrador` → `Contas de serviço`):
   - Nome: `conversao-diaria-etl`
   - Sem papéis no projeto (não precisa)
4. **Gerar chave JSON**: clicar na SA → aba "Chaves" → `ADD KEY` → JSON.
   Baixa `service-account.json`. **Não commitar** (já está no `.gitignore`).

### 2. Autorizar a SA nas fontes

- **GA4 web** (267511960) → Admin → Property Access Management → adicionar
  email da SA com role `Viewer`.
- **GA4 app** (387307776) → idem.
- **Google Sheets** (`1QvP4QVP0ApZ5XdbDoBUBecM-g2R99pWxyuhyd7AnN_0`) →
  Compartilhar → adicionar email da SA com role `Editor`.

### 3. Configurar GitHub Secrets

Em `Settings → Secrets and variables → Actions → New repository secret`:

| Secret | Valor |
|---|---|
| `GCP_SA_KEY_B64` | Base64 do `service-account.json` (veja abaixo) |
| `GA4_WEB_PROPERTY_ID` | `267511960` |
| `GA4_APP_PROPERTY_ID` | `387307776` |
| `SHEETS_DOC_ID` | `1QvP4QVP0ApZ5XdbDoBUBecM-g2R99pWxyuhyd7AnN_0` |
| `REVENUECAT_PROJECT_ID` | (deixar vazio nesta fase) |
| `REVENUECAT_API_KEY` | (deixar vazio nesta fase) |

**Gerar base64 do JSON** (PowerShell):
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json")) | Set-Clipboard
```
Cola o conteúdo do clipboard no valor do secret `GCP_SA_KEY_B64`.

### 4. Validar

- Vá em `Actions` → `ETL Conversão Diária` → `Run workflow` → executa manualmente.
- Logs ao vivo no UI. Saída do smoke test no step "Run ETL".
- A partir do próximo dia 09:00 UTC roda sozinho.

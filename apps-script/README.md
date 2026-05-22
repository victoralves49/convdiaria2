# Conversão Diária V2 — Apps Script

Pipeline diário em Google Apps Script (V8) que coleta GA4 (web + app) e
RevenueCat e escreve em um Google Sheets estruturado em 7 abas. Trigger
time-driven às 06:00 BRT, janela de reprocessamento D-1 → D-3.

> Por que Apps Script (e não Python + Cloud)?
> Usuário não tem permissão de Admin nos GA4 properties para autorizar uma
> Service Account. Apps Script roda com OAuth do próprio usuário (basta
> Viewer no GA4 — que já temos), elimina GCP project, Cloud Functions,
> Cloud Scheduler, Secret Manager e GitHub Actions. Zero infra externa.

## Status — Fase 1 (scaffolding)

- `Code.gs` — entry points (`runEtl`, `runSmokeTest`, `installTrigger`)
- `Config.gs` — constantes do projeto + leitura de Script Properties
- Stubs: `Sources_GA4.gs`, `Sources_RevenueCat.gs`, `Transformers_Builder.gs`,
  `Destinations_Sheets.gs`, `Scripts_SetupSheet.gs`, `Scripts_Backfill.gs`
- `appsscript.json` — manifest com Advanced Service `AnalyticsData` v1beta e
  scopes mínimos

Nesta fase `runEtl` só chama `runSmokeTest`. Fase 2 implementa as fontes,
builder, destino e o `setupSheetTabs`.

## Caminho rápido — copia-cola (sem clasp)

Recomendado pra começar a testar HOJE.

1. Abre **https://script.google.com/** logado com `victor.alves@investidor10.com.br`
2. **New project** → renomeia pra `Conversão Diária V2`
3. Pra cada arquivo `.gs` desta pasta, no editor:
   - Botão `+` ao lado de "Arquivos" → `Script` → coloca o mesmo nome (sem `.gs`)
   - Cola o conteúdo do arquivo
   - O arquivo padrão `Code.gs` já existe — substitui o conteúdo
4. Pra `appsscript.json`: ⚙️ **Configurações do projeto** → marca
   "Mostrar arquivo de manifesto `appsscript.json` no editor" → volta no
   editor, clica em `appsscript.json` e cola o conteúdo
5. **Salvar tudo** (Ctrl+S)
6. Selecionar a função `runSmokeTest` no dropdown do topo → clicar **Executar**
7. Primeira execução pede autorização — aceita os escopos (GA4, Sheets, etc.)
8. Olha o resultado no painel **Execuções** (`View → Executions`). Deve sair:
   ```
   smoke-test → { "ok": true, "checks": { "ga4_web": {...}, ... } }
   ```
9. Depois que o smoke passar, rodar `installTrigger` uma vez pra criar o
   agendamento diário 06:00.

## Caminho com clasp (versionar via Git)

Se quiser que esta pasta seja a fonte de verdade e dê `clasp push` pra
sincronizar com o Apps Script.

```bash
# uma vez
npm install -g @google/clasp
clasp login    # OAuth na sua conta corporativa

# já com o projeto criado pelo caminho rápido (passos 1-2 acima)
# pega o Script ID em ⚙️ Configurações do projeto → IDs → "Script ID"
clasp clone <SCRIPT_ID> --rootDir .
# isso baixa appsscript.json e Code.gs. Sobrescreva pelos arquivos deste repo.
clasp push
```

Daí em diante: edita aqui, commita no Git, e `clasp push` quando quiser
enviar pro Apps Script.

> `.clasp.json` é gerado pelo `clasp clone` e contém o `scriptId`. Ele
> **pode** ser commitado (é só um pointer pro script — sem credenciais),
> mas mantemos fora do repo via `.gitignore` da pasta raiz pra cada dev
> apontar pro próprio script.

## Configurar IDs (Script Properties)

Os IDs default já estão hardcoded no `Config.gs` (são públicos). Se quiser
sobrescrever sem editar código:

⚙️ **Configurações do projeto** → role até **Propriedades do script** → adicione:

| Propriedade | Valor |
|---|---|
| `GA4_WEB_PROPERTY_ID` | `267511960` (opcional, default no Config) |
| `GA4_APP_PROPERTY_ID` | `387307776` (opcional) |
| `SHEETS_DOC_ID` | `1QvP4QVP0ApZ5XdbDoBUBecM-g2R99pWxyuhyd7AnN_0` (opcional) |
| `REVENUECAT_PROJECT_ID` | (vazio na fase 1) |
| `REVENUECAT_API_KEY` | (vazio na fase 1 — quando ativar, ponha aqui em vez de no código) |

## Pré-requisitos no GA4 / Sheets

Como o script roda com **sua conta**, basta que ela tenha:

- GA4 `267511960`: papel **Viewer** ou superior
- GA4 `387307776`: papel **Viewer** ou superior
- Sheets `1QvP4...`: você precisa ser **Editor** (provavelmente já é)

Se ainda não consegue abrir os dashboards GA4 dos dois properties, peça
acesso de leitura ao admin do GA4 da Investidor10 antes de seguir.

## Limites a respeitar

- Execução máxima: **6 min** (consumer) / 30 min (Workspace). Janela de 3 dias
  é folgada — esperamos <1 min por execução.
- UrlFetch (RevenueCat): 20.000 calls/dia. Folgadíssimo.
- GA4 Data API: 50k req/dia por property. Folgadíssimo.

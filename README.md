# Select AI Analytics

Aplicacion full-stack para consultar esquemas Oracle con Select AI, cargar CSV de prueba y construir agentes nativos con `DBMS_CLOUD_AI_AGENT`. La instalacion se ejecuta siempre sobre el usuario Oracle `APP_AGENT`.

## Docker

El contenedor sirve frontend estatico por `nginx`, backend FastAPI por `uvicorn` y proxy interno en `/api`.

```bash
docker run -d \
  --name app-agent-select-ai \
  -p 8080:80 \
  -v app_agent_select_ai_data:/app/apps/backend/data \
  -v app_agent_select_ai_wallet:/app/apps/backend/wallet \
  -v app_agent_select_ai_keys:/app/apps/backend/keys \
  -v app_agent_select_ai_logs:/app/apps/backend/logs \
  ghcr.io/<owner>/app-agent-select-ai:v0.1.0
```

Luego abre `http://localhost:8080`.

## Wizard

1. Sube el `wallet.zip`.
2. Selecciona el alias del `tnsnames.ora`.
3. Prueba la conexion con el usuario `APP_AGENT`.
4. Ejecuta la instalacion SQL.
5. Sube el `key.pem` OCI.
6. Guarda la credencial `APP_AGENT_OCI_CRED`.
7. Prueba Generative AI y completa el setup.

## Runtime

- `POST /api/data-sources/csv`: carga CSV y registra la tabla.
- `POST /api/data-sources/table-access`: registra una tabla existente con permiso `SELECT`.
- `POST /api/analytics/ask`: genera SQL con Select AI, valida solo lectura, ejecuta y devuelve respuesta, filas y grafico.
- `POST /api/agent-builder/objects`: crea `TOOL`, `TASK`, `AGENT` o `TEAM`.
- `POST /api/agent-builder/run-team`: ejecuta `DBMS_CLOUD_AI_AGENT.RUN_TEAM`.

## Datos ficticios

El script siguiente parsea `.source/decoupling_tables_structures.sql`, omite objetos sin DDL real y genera DDL/CSV consistentes para pruebas:

```powershell
py -3 scripts\generate_source_seed.py --default-rows 365 --fact-rows 2000
```

Salida esperada:

- `apps/backend/data/source_seed/ddl/app_agent_source_tables.sql`
- `apps/backend/data/source_seed/csv/*.csv`

## Desarrollo local

```powershell
.\scripts\dev.ps1
```

- Backend: `http://127.0.0.1:8012/`
- Frontend: `http://localhost:5173/`

Para reinstalar dependencias del frontend:

```powershell
.\scripts\dev.ps1 -InstallFrontendDeps
```

## Verificacion

```powershell
py -3 -m compileall apps\backend\app
npm run build --prefix apps\frontend
```

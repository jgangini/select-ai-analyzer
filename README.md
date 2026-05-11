# Select AI Analytics

Aplicacion full-stack para consultar esquemas Oracle con Select AI, cargar CSV de prueba y generar analitica gobernada sobre el usuario Oracle `APP_AGENT`.

## Docker

El contenedor sirve frontend estatico por `nginx`, backend FastAPI por `uvicorn` y proxy interno en `/api`.

```bash
docker run -d \
  --name select-ai-analyzer \
  -p 8080:80 \
  -v select_ai_analyzer_data:/app/apps/backend/data \
  -v select_ai_analyzer_wallet:/app/apps/backend/wallet \
  -v select_ai_analyzer_keys:/app/apps/backend/keys \
  -v select_ai_analyzer_logs:/app/apps/backend/logs \
  ghcr.io/<owner>/select-ai-analyzer:v0.1.0
```

Luego abre `http://localhost:8080`.

## CloudTechNext

El repo mantiene la misma forma de despliegue que `doc_agent`: `Dockerfile` en la raiz, frontend en `apps/frontend`, backend en `apps/backend`, configuracion nginx en `docker/` y healthcheck en `/api/health`. CloudTechNext puede clonar `https://github.com/jgangini/select-ai-analyzer.git`, construir la imagen desde la raiz y montar los volumenes persistentes de `data`, `wallet`, `keys` y `logs`.

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
- Frontend: `http://localhost:5174/`

Para reinstalar dependencias del frontend:

```powershell
.\scripts\dev.ps1 -InstallFrontendDeps
```

## Verificacion

Primera vez, instala dependencias y ejecuta toda la validacion:

```powershell
.\scripts\check-project.ps1 -InstallDeps
```

Luego, para correr la suite completa:

```powershell
.\scripts\check-project.ps1
```

El script valida la sintaxis del backend, ejecuta `pytest`, valida el import de FastAPI, corre `vitest` del frontend y compila el frontend.

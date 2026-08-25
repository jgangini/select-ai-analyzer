# Select AI Analytics

https://github.com/user-attachments/assets/c7d1c2b8-8063-408b-a00d-a7ec65fd7ed9

Full-stack application for querying Oracle schemas with Select AI, loading test CSV files, and generating governed analytics through the `APP_AGENT` Oracle user.

## Docker

The container serves the static frontend through `nginx`, the FastAPI backend through `uvicorn`, and the internal API proxy under `/api`.

```bash
docker run -d \
  --name select-ai-analyzer \
  -p 8080:80 \
  -v select_ai_analyzer_data:/app/apps/backend/data \
  -v select_ai_analyzer_wallet:/app/apps/backend/wallet \
  -v select_ai_analyzer_keys:/app/apps/backend/keys \
  -v select_ai_analyzer_logs:/app/apps/backend/logs \
  ghcr.io/<owner>/select-ai-analyzer:v1.0.0
```

Then open `http://localhost:8080`.

## CloudTechNext

The repository follows the same deployment shape as `doc_agent`: the `Dockerfile` lives at the repository root, the frontend lives in `apps/frontend`, the backend lives in `apps/backend`, nginx configuration lives in `docker/`, and `/api/health` exposes the health check. CloudTechNext can clone `https://github.com/jgangini/select-ai-analyzer.git`, build the image from the repository root, and mount persistent volumes for `data`, `wallet`, `keys`, and `logs`.

For a new Autonomous Database, Deploy Studio presents **Schemas exposed to Select AI**. It can load `SH_DEMO` (Sales History) and `FLEXCUBE_DEMO` (Core Banking); both are selected by default. Their versioned CSV and metadata package is in [`data/`](data/README.md). Existing-database deployments leave its schemas unchanged.

## Wizard

1. Upload `wallet.zip`.
2. Select the `tnsnames.ora` alias.
3. Test the connection with the `APP_AGENT` user.
4. Run the SQL installation.
5. Upload the OCI `key.pem` file.
6. Save the `APP_AGENT_OCI_CRED` credential.
7. Test Generative AI and complete setup.

## Runtime

- `POST /api/data-sources/csv`: loads a CSV file and registers the table.
- `POST /api/data-sources/table-access`: registers an existing table with `SELECT` access.
- `POST /api/analytics/ask`: generates SQL with Select AI, validates read-only execution, runs the query, and returns the answer, rows, and chart metadata.

## Test Data

The following script parses `.source/decoupling_tables_structures.sql`, skips objects without real DDL, and generates consistent DDL/CSV fixtures for testing:

```powershell
py -3 scripts\generate_source_seed.py --default-rows 365 --fact-rows 2000
```

Expected output:

- `apps/backend/data/source_seed/ddl/app_agent_source_tables.sql`
- `apps/backend/data/source_seed/csv/*.csv`

## Local Development

```powershell
.\scripts\dev.ps1
```

- Backend: `http://127.0.0.1:8012/`
- Frontend: `http://localhost:5174/`

To reinstall frontend dependencies:

```powershell
.\scripts\dev.ps1 -InstallFrontendDeps
```

## Verification

The first run can install dependencies and execute the full validation flow:

```powershell
.\scripts\check-project.ps1 -InstallDeps
```

After that, run the full suite with:

```powershell
.\scripts\check-project.ps1
```

The script validates backend syntax, runs `pytest`, validates the FastAPI import, runs frontend `vitest`, and builds the frontend.

## License

This project is licensed under the [MIT License](LICENSE).

Select AI Analytics is an independent project and is not an official Oracle product. It is not affiliated with, endorsed by, or sponsored by Oracle Corporation. Oracle, OCI, and related marks are trademarks or registered trademarks of Oracle and/or its affiliates. Third-party trademarks, logos, service names, and assets remain the property of their respective owners.

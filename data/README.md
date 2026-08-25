# Demo Data Catalog

This directory is the source of truth for the versioned schemas that Select AI Analyzer can load during a new Autonomous Database deployment. Deploy Studio presents the catalog as **Schemas exposed to Select AI** and defaults to `SH_DEMO` and `FLEXCUBE_DEMO`.

Each demo folder uses the same contract:

- `manifest.json`: dataset identity, schema name, aliases, loader strategy and table list.
- `data/*.json`: table metadata, column metadata, comments, classifications and optional constraints.
- `data/*.csv`: seed rows loaded in batches by `scripts/load_demo_data.py`.

The loader creates the selected schema owners, recreates only their versioned tables, registers every table in `APP_AGENT.data_sources`, and refreshes the Select AI profile. It runs only for a newly created database; selecting an existing Autonomous Database does not alter its schemas.

There is intentionally no versioned `install.sql`. DDL is rendered from JSON metadata at deploy time, while CSV data is loaded with array inserts. This keeps large demos such as `FLEXCUBE_DEMO` out of monolithic SQL files.

Validate the catalog after changing metadata or CSV rows:

```powershell
python scripts/load_demo_data.py --validate
```

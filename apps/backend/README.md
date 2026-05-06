# Backend Select AI Analytics

Estructura canonica del runtime:

- `app/` capa FastAPI, servicios Select AI y wrappers de agentes Oracle.
- `db/bootstrap/sql/` instalacion versionada para el esquema `APP_AGENT`.
- `data/source_seed/` DDL y CSV ficticios generados desde `.source`.

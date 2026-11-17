# Backend Select AI Analytics

Canonical runtime structure:

- `app/`: FastAPI layer, Select AI services, and Oracle agent wrappers.
- `db/bootstrap/sql/`: versioned installation scripts for the `APP_AGENT` schema.
- `.data/`: generated DDL, test CSV files, and JSON sidecars derived from `.source`.

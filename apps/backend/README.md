# Select AI Analyzer backend

FastAPI routes live under app/api and use the Select AI and application services under app. Database installation scripts under [db/bootstrap/sql](db/bootstrap/sql/README.md) initialize the application schema.

For standalone setup, use the [database account script](db/admin/create_app_agent_user.sql) as a starting point for the application schema. Managed deployments create the application user during bootstrap. The [demo data catalog](../../data/README.md) holds the versioned Sales History and Core Banking datasets.

See the [testing guide](../../docs/testing.md) for local backend commands.

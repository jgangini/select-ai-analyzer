# Bootstrap SQL

Canonical location: `apps/backend/db/bootstrap/sql`

This directory is the source of truth for the initial installation executed by the frontend through `/setup/installation`.

## Standard

- Keep each file focused on one schema area.
- The file name defines the execution order.
- Files are grouped by dependency and domain in this order:
  - APP_AGENT groups, users, and configuration
  - registered data sources and columns
  - Select AI profiles
  - analytics runtime history, load jobs, and audit events
  - Select AI and Oracle agent procedures
  - dashboards
- Each file may include:
  - `CREATE TABLE`
  - related indexes
  - `SEQUENCE`
  - `TRIGGER`
  - minimal seed data
- The `--` separator is preserved because it is used by the setup parser.

## Notes

- Keep operational compatibility with the frontend installation flow.
- The only source of truth is `apps/backend/db/bootstrap/sql`.
- Conversation history is stored in `analytics_conversations` and `question_runs`;
  the row data for old chats is rebuilt by re-running the stored SQL.

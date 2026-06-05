import logging

from apps.backend.app.select_ai.constants import APP_SCHEMA, is_app_schema_name
from apps.backend.app.core.tracing import trace
from apps.backend.app.services.bootstrap_support import (
    is_ignorable_bootstrap_sql_error,
    parse_bootstrap_sql_statements,
    resolve_bootstrap_sql_dir,
)

logger = logging.getLogger(__name__)


def no_setup_scripts_result(setup_dir, discovered: list[str]) -> dict:
    return {
        "success": False,
        "discovered": discovered,
        "executed": [],
        "errors": [{"file": str(setup_dir), "error": "No SQL setup scripts found."}],
        "message": f"No setup scripts found in {setup_dir}",
    }


def schema_guard_result(discovered: list[str], connected_user: str) -> dict:
    return {
        "success": False,
        "discovered": discovered,
        "executed": [],
        "errors": [
            {
                "file": "schema_guard",
                "error": f"Expected {APP_SCHEMA} database user or numbered deployment schema, connected as {connected_user}.",
            }
        ],
        "message": f"Installation stopped because the connected schema is not {APP_SCHEMA} or a numbered deployment schema.",
    }


class BootstrapScriptMixin:
    @trace
    def execute_setup_scripts(
        self,
        *,
        wallet_path: str | None = None,
        wallet_password: str | None = None,
        user: str | None = None,
        password: str | None = None,
        dsn: str | None = None,
    ) -> dict:
        conn = self._get_direct_connection(
            wallet_path=wallet_path,
            wallet_password=wallet_password,
            user=user,
            password=password,
            dsn=dsn,
        )
        cursor = conn.cursor()
        setup_dir = resolve_bootstrap_sql_dir()
        sql_files = sorted(setup_dir.glob("*.sql"))
        discovered = [f.name for f in sql_files]
        executed = []
        errors = []
        if not sql_files:
            cursor.close()
            conn.close()
            return no_setup_scripts_result(setup_dir, discovered)

        cursor.execute("SELECT USER FROM DUAL")
        connected_user = str(cursor.fetchone()[0]).upper()
        if not is_app_schema_name(connected_user):
            cursor.close()
            conn.close()
            return schema_guard_result(discovered, connected_user)

        for sql_file in sql_files:
            logger.debug("Executing script: %s", sql_file.name)
            try:
                statements = parse_bootstrap_sql_statements(sql_file.read_text(encoding="utf-8"))
                for clean_stmt in statements:
                    try:
                        preview = clean_stmt[:80].replace("\n", " ")
                        logger.debug("Executing: %s...", preview)
                        cursor.execute(clean_stmt)
                    except Exception as e:
                        if is_ignorable_bootstrap_sql_error(e):
                            logger.warning("Object already exists, skipping")
                        else:
                            logger.error("Statement failed: %s", e)
                            raise
                conn.commit()
                logger.info("Script %s completed successfully", sql_file.name)
                executed.append(sql_file.name)
            except Exception as e:
                conn.rollback()
                logger.error("Script %s failed: %s", sql_file.name, e)
                errors.append({"file": sql_file.name, "error": str(e)})

        cursor.close()
        conn.close()
        success = len(errors) == 0 and len(executed) == len(sql_files)
        return {
            "success": success,
            "discovered": discovered,
            "executed": executed,
            "errors": errors,
            "message": f"{len(executed)}/{len(sql_files)} scripts executed successfully.",
        }

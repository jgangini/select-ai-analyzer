import os
from pathlib import Path

import oracledb

from apps.backend.app.select_ai.constants import DEFAULT_DATA_SCHEMA
from apps.backend.app.services.bootstrap_support import (
    parse_tns_aliases,
    select_preferred_wallet_dsn,
)


REQUIRED_APP_AGENT_PRIVILEGES = (
    "CREATE TABLE",
    "CREATE ANY TABLE",
    "DROP ANY TABLE",
    "INSERT ANY TABLE",
    "SELECT ANY TABLE",
)


def missing_required_privileges(granted_privileges: set[str]) -> list[str]:
    return [privilege for privilege in REQUIRED_APP_AGENT_PRIVILEGES if privilege not in granted_privileges]


class BootstrapDatabaseMixin:
    def test_db_connection(self, wallet_path: str, wallet_password: str, user: str, password: str, dsn: str) -> dict:
        try:
            tnsnames_path = os.path.join(wallet_path, "tnsnames.ora")
            if not os.path.exists(tnsnames_path):
                return {
                    "success": False,
                    "message": f"tnsnames.ora not found in {wallet_path}",
                }
            connection = oracledb.connect(
                user=user,
                password=password,
                dsn=dsn,
                config_dir=wallet_path,
                wallet_location=wallet_path,
                wallet_password=wallet_password,
            )
            cursor = connection.cursor()
            cursor.execute("SELECT USER FROM DUAL")
            db_user = cursor.fetchone()[0]
            if str(db_user).upper() != "APP_AGENT":
                cursor.close()
                connection.close()
                return {
                    "success": False,
                    "message": (
                        "This application must be installed with the APP_AGENT database user "
                        f"to avoid impacting other schemas. Connected user: {db_user}."
                    ),
                }
            cursor.execute("SELECT privilege FROM user_sys_privs")
            granted_privileges = {str(row[0]).upper() for row in cursor.fetchall()}
            missing_privileges = missing_required_privileges(granted_privileges)
            cursor.execute(
                "SELECT COUNT(*) FROM all_users WHERE username = :schema_name",
                schema_name=DEFAULT_DATA_SCHEMA,
            )
            data_schema_row = cursor.fetchone()
            data_schema_exists = bool(data_schema_row and int(data_schema_row[0] or 0) > 0)
            cursor.close()
            connection.close()
            if missing_privileges:
                return {
                    "success": False,
                    "message": (
                        f"User {db_user} is missing required privileges: {', '.join(missing_privileges)}. "
                        "Run the admin APP_AGENT setup script before installing the application."
                    ),
                }
            if not data_schema_exists and "CREATE USER" not in granted_privileges:
                return {
                    "success": False,
                    "message": (
                        f"{DEFAULT_DATA_SCHEMA} does not exist and user {db_user} cannot create it. "
                        "Run the admin APP_AGENT setup script to create the data schema."
                    ),
                }
            return {
                "success": True,
                "message": "Database connection successful",
                "connected_user": db_user,
            }
        except Exception as e:
            error_str = str(e)
            if not (wallet_password or "").strip() and (
                "DPY-6000" in error_str
                or "DPY-4011" in error_str
                or "ORA-12506" in error_str
                or "ORA-12514" in error_str
            ):
                return {
                    "success": False,
                    "message": (
                        "Wallet password is required for this connection. "
                        "Please provide the password used when downloading the wallet."
                    ),
                }
            return {"success": False, "message": f"Connection error: {error_str}"}

    def save_runtime_db_config(
        self,
        *,
        wallet_path: str,
        wallet_password: str,
        user: str,
        password: str,
        dsn: str,
    ) -> None:
        self.db_manager.save_runtime_connection_config(
            wallet_path=wallet_path,
            wallet_password=wallet_password,
            user=user,
            password=password,
            dsn=dsn,
        )
        clear_status_cache = getattr(self, "clear_status_cache", None)
        if callable(clear_status_cache):
            clear_status_cache()

    def list_wallet_dsns(self, wallet_path: str) -> dict:
        try:
            tnsnames_path = Path(wallet_path) / "tnsnames.ora"
            if not tnsnames_path.exists():
                return {
                    "success": False,
                    "message": f"tnsnames.ora not found in {wallet_path}",
                    "dsns": [],
                    "selected_dsn": "",
                }
            aliases = parse_tns_aliases(tnsnames_path.read_text(encoding="utf-8", errors="ignore"))
            if not aliases:
                return {
                    "success": False,
                    "message": "No TNS aliases found in tnsnames.ora",
                    "dsns": [],
                    "selected_dsn": "",
                }
            selected_dsn = select_preferred_wallet_dsn(aliases)
            return {
                "success": True,
                "message": "TNS aliases loaded successfully",
                "dsns": aliases,
                "selected_dsn": selected_dsn,
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error reading tnsnames.ora: {str(e)}",
                "dsns": [],
                "selected_dsn": "",
            }

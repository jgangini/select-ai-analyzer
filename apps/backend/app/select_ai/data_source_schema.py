from __future__ import annotations

from typing import Any

from apps.backend.app.core.select_ai_constants import APP_SCHEMA, DEFAULT_DATA_SCHEMA
from apps.backend.app.select_ai.sql_names import (
    _generated_schema_password,
    _safe_identifier,
    _safe_password_literal,
)


class SelectAIDataSourceSchemaMixin:
    @staticmethod
    def _assert_data_schema(schema_name: str) -> str:
        owner_name = _safe_identifier(schema_name)
        if owner_name == APP_SCHEMA:
            raise ValueError("APP_AGENT is reserved for application tables. Choose or create a separate data schema.")
        if owner_name.startswith(("SYS", "ORDS", "APEX_", "MDSYS", "CTXSYS", "XDB")):
            raise ValueError(f"{owner_name} is not an allowed data schema.")
        return owner_name

    def schema_exists(self, schema_name: str) -> bool:
        owner_name = _safe_identifier(schema_name)
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT COUNT(*) FROM all_users WHERE username = :schema_name",
                schema_name=owner_name,
            )
            row = cursor.fetchone()
            return bool(row and int(row[0] or 0) > 0)
        finally:
            cursor.close()
            conn.close()

    def list_schemas(self) -> list[dict[str, Any]]:
        conn = self._connection()
        cursor = conn.cursor()
        try:
            try:
                cursor.execute(
                    """
                    SELECT username
                    FROM all_users
                    WHERE oracle_maintained = 'N'
                    ORDER BY username
                    """
                )
            except Exception:
                cursor.execute(
                    """
                    SELECT username
                    FROM all_users
                    WHERE username NOT LIKE 'SYS%'
                      AND username NOT LIKE 'APEX\\_%' ESCAPE '\\'
                      AND username NOT IN ('XDB', 'ORDS_METADATA', 'ORDS_PUBLIC_USER', 'MDSYS', 'CTXSYS')
                    ORDER BY username
                    """
                )
            existing_schemas = [str(row[0]).upper() for row in cursor.fetchall()]
            schemas = list(existing_schemas)
            if DEFAULT_DATA_SCHEMA not in schemas:
                schemas.insert(0, DEFAULT_DATA_SCHEMA)
            source_counts: dict[str, int] = {}
            cursor.execute(
                """
                SELECT owner_name, COUNT(*)
                FROM data_sources
                GROUP BY owner_name
                """
            )
            for owner_name, count in cursor.fetchall():
                source_counts[str(owner_name).upper()] = int(count or 0)
            return [
                {
                    "schema_name": schema,
                    "exists": self._schema_name_exists_in_list(schema, existing_schemas),
                    "is_app_schema": schema == APP_SCHEMA,
                    "source_count": source_counts.get(schema, 0),
                }
                for schema in schemas
            ]
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def _schema_name_exists_in_list(schema_name: str, schemas: list[str]) -> bool:
        return schema_name in {schema.upper() for schema in schemas}

    def create_data_schema(self, schema_name: str) -> dict[str, Any]:
        owner_name = self._assert_data_schema(schema_name)
        if self.schema_exists(owner_name):
            return {"schema_name": owner_name, "created": False}
        password = _generated_schema_password()
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                f"CREATE USER {owner_name} IDENTIFIED BY {_safe_password_literal(password)} "
                "DEFAULT TABLESPACE USERS QUOTA UNLIMITED ON USERS"
            )
            conn.commit()
            return {"schema_name": owner_name, "created": True}
        except Exception as exc:
            conn.rollback()
            raise ValueError(
                f"Could not create schema {owner_name}. Run the admin APP_AGENT setup script so the data schema "
                "exists and APP_AGENT has the required upload privileges."
            ) from exc
        finally:
            cursor.close()
            conn.close()

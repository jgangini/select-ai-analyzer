from __future__ import annotations

from typing import Any
import uuid

from apps.backend.app.select_ai.base_service import SelectAIBaseService
from apps.backend.app.select_ai.data_source_catalog import SelectAIDataSourceCatalogMixin
from apps.backend.app.select_ai.data_source_csv import SelectAIDataSourceCsvMixin
from apps.backend.app.select_ai.data_source_metadata import SelectAIDataSourceMetadataMixin
from apps.backend.app.select_ai.data_source_preview import SelectAIDataSourcePreviewMixin
from apps.backend.app.select_ai.data_source_schema import SelectAIDataSourceSchemaMixin
from apps.backend.app.select_ai.sql_names import _qualified_name, _safe_identifier


class SelectAIDataSourceMixin(
    SelectAIDataSourceMetadataMixin,
    SelectAIDataSourceCatalogMixin,
    SelectAIDataSourcePreviewMixin,
    SelectAIDataSourceSchemaMixin,
    SelectAIDataSourceCsvMixin,
):
    def delete_data_source(self, data_source_id: str, *, user_id: int = 0) -> dict[str, Any]:
        conn = self._connection()
        cursor = conn.cursor()
        dropped_table = False
        source: dict[str, Any] | None = None
        try:
            source = self._data_source_from_cursor(cursor, data_source_id)
            owner_name = str(source["owner_name"])
            table_name = str(source["table_name"])
            source_type = str(source["source_type"]).lower()
            if source_type == "csv":
                try:
                    self._drop_table_if_exists(cursor, table_name, owner_name=owner_name)
                    dropped_table = True
                except Exception as exc:
                    conn.rollback()
                    raise ValueError(
                        f"Could not drop managed CSV table {_qualified_name(owner_name, table_name)}. "
                        "Fix APP_AGENT table privileges or drop the table manually before deleting this source."
                    ) from exc
            cursor.execute(
                "DELETE FROM data_sources WHERE data_source_id = :data_source_id",
                data_source_id=str(data_source_id or "").strip(),
            )
            if int(cursor.rowcount or 0) != 1:
                raise ValueError("Data source was not deleted.")
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
        self.refresh_profile(user_id=user_id)
        return {
            "data_source_id": str(data_source_id or "").strip(),
            "owner_name": source["owner_name"] if source else "",
            "table_name": source["table_name"] if source else "",
            "source_type": source["source_type"] if source else "",
            "dropped_table": dropped_table,
        }

    def register_existing_table(
        self,
        *,
        owner: str,
        table_name: str,
        display_name: str | None = None,
        table_comment: str | None = None,
        column_metadata: list[dict[str, Any]] | None = None,
        access_scope: str = "all",
        user_id: int = 0,
    ) -> dict[str, Any]:
        owner_name = _safe_identifier(owner)
        self._assert_data_schema(owner_name)
        table = _safe_identifier(table_name)
        qualified = _qualified_name(owner_name, table)
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(f"SELECT * FROM {qualified} WHERE 1 = 0")
            cursor.execute(
                """
                SELECT column_name, data_type, data_length, nullable, column_id
                FROM all_tab_columns
                WHERE owner = :owner_name AND table_name = :table_name
                ORDER BY column_id
                """,
                owner_name=owner_name,
                table_name=table,
            )
            columns = cursor.fetchall()
            if not columns:
                raise ValueError(f"Table {qualified} was not found or has no visible columns.")
            data_source_id = uuid.uuid4().hex
            metadata_warnings = self._apply_select_ai_metadata(
                cursor,
                owner_name=owner_name,
                table_name=table,
                table_comment=table_comment,
                column_metadata=column_metadata or [],
            )
            cursor.execute(
                "DELETE FROM data_sources WHERE owner_name = :owner_name AND table_name = :table_name",
                owner_name=owner_name,
                table_name=table,
            )
            cursor.execute(
                """
                INSERT INTO data_sources (
                    data_source_id, source_name, source_type, owner_name, table_name,
                    access_scope, status, created_by_user_id
                ) VALUES (
                    :id, :name, 'existing_table', :owner_name, :table_name,
                    :scope, 'active', :user_id
                )
                """,
                id=data_source_id,
                name=display_name or qualified,
                owner_name=owner_name,
                table_name=table,
                scope=access_scope,
                user_id=user_id,
            )
            self._replace_source_columns(cursor, data_source_id, columns, column_metadata or [])
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
        self.refresh_profile(user_id=user_id)
        return {
            "data_source_id": data_source_id,
            "owner_name": owner_name,
            "table_name": table,
            "metadata_warnings": metadata_warnings,
        }


class SelectAIDataSourceService(SelectAIBaseService, SelectAIDataSourceMixin):
    pass

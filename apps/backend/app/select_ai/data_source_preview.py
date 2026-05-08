from __future__ import annotations

from typing import Any

from apps.backend.app.select_ai.sql_names import _qualified_name
from apps.backend.app.select_ai.value_serialization import _json_safe, _read_lob


class SelectAIDataSourcePreviewMixin:
    @staticmethod
    def _data_source_from_cursor(cursor, data_source_id: str) -> dict[str, Any]:
        cursor.execute(
            """
            SELECT ds.data_source_id, ds.source_name, ds.source_type, ds.owner_name, ds.table_name,
                   ds.access_scope, ds.row_count, NVL(cc.column_count, 0) AS column_count,
                   ds.status, ds.created_at
            FROM data_sources ds
            LEFT JOIN (
                SELECT data_source_id, COUNT(*) AS column_count
                FROM source_columns
                GROUP BY data_source_id
            ) cc
                ON cc.data_source_id = ds.data_source_id
            WHERE ds.data_source_id = :data_source_id
            """,
            data_source_id=str(data_source_id or "").strip(),
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError("Data source was not found.")
        columns = [desc[0].lower() for desc in cursor.description or []]
        return {column: _json_safe(value) for column, value in zip(columns, row)}

    @staticmethod
    def _source_column_details(cursor, source: dict[str, Any]) -> list[dict[str, Any]]:
        cursor.execute(
            """
            SELECT sc.column_name,
                   sc.data_type,
                   sc.data_length,
                   sc.nullable_flag,
                   sc.ordinal_position,
                   sc.business_comment,
                   sc.classification,
                   CASE WHEN pk_cols.column_name IS NULL THEN 'N' ELSE 'Y' END AS primary_key_flag
            FROM source_columns sc
            LEFT JOIN (
                SELECT acc.owner, acc.table_name, acc.column_name
                FROM all_constraints ac
                JOIN all_cons_columns acc
                  ON acc.owner = ac.owner
                 AND acc.constraint_name = ac.constraint_name
                 AND acc.table_name = ac.table_name
                WHERE ac.constraint_type = 'P'
            ) pk_cols
              ON pk_cols.owner = :owner_name
             AND pk_cols.table_name = :table_name
             AND pk_cols.column_name = sc.column_name
            WHERE sc.data_source_id = :data_source_id
            ORDER BY sc.ordinal_position
            """,
            owner_name=str(source["owner_name"]).upper(),
            table_name=str(source["table_name"]).upper(),
            data_source_id=source["data_source_id"],
        )
        return [
            {
                "column_name": str(column_name).upper(),
                "data_type": str(data_type or "").upper(),
                "data_length": int(data_length or 0),
                "nullable": str(nullable or "Y")[:1],
                "ordinal_position": int(ordinal_position or 0),
                "comment": str(_read_lob(comment) or ""),
                "classification": str(classification or ""),
                "primary_key": str(primary_key_flag or "N") == "Y",
            }
            for (
                column_name,
                data_type,
                data_length,
                nullable,
                ordinal_position,
                comment,
                classification,
                primary_key_flag,
            ) in cursor.fetchall()
        ]

    def preview_data_source_rows(
        self,
        data_source_id: str,
        *,
        limit: int = 10,
        offset: int = 0,
    ) -> dict[str, Any]:
        safe_limit = max(1, min(int(limit or 10), 100))
        safe_offset = max(0, int(offset or 0))
        conn = self._connection()
        cursor = conn.cursor()
        try:
            source = self._data_source_from_cursor(cursor, data_source_id)
            column_details = self._source_column_details(cursor, source)
            qualified_table = _qualified_name(str(source["owner_name"]), str(source["table_name"]))
            cursor.execute(f"SELECT COUNT(*) FROM {qualified_table}")
            total_row = cursor.fetchone()
            total_rows = int(total_row[0] or 0) if total_row else 0
            cursor.execute(
                f"SELECT * FROM {qualified_table} OFFSET :offset_value ROWS FETCH NEXT :limit_value ROWS ONLY",
                offset_value=safe_offset,
                limit_value=safe_limit,
            )
            columns = [str(desc[0]).upper() for desc in cursor.description or []]
            rows = [
                {column: _json_safe(value) for column, value in zip(columns, row)}
                for row in cursor.fetchall()
            ]
            return {
                "data_source": source,
                "columns": columns,
                "column_details": column_details,
                "rows": rows,
                "row_count": total_rows,
                "limit": safe_limit,
                "offset": safe_offset,
            }
        except Exception as exc:
            if isinstance(exc, ValueError):
                raise
            raise ValueError(f"Could not preview data source rows: {exc}") from exc
        finally:
            cursor.close()
            conn.close()

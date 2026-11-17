from __future__ import annotations

import uuid
from typing import Any

from scripts.source_seed_metadata import metadata_by_column
from scripts.source_seed_values import ColumnMetadata


def replace_data_source(
    cursor,
    table_name: str,
    row_count: int,
    columns: list[ColumnMetadata],
    column_metadata: list[dict[str, Any]],
    *,
    data_schema: str,
) -> str:
    data_source_id = uuid.uuid4().hex
    metadata_by_name = metadata_by_column(column_metadata)
    cursor.execute(
        """
        INSERT INTO data_sources (
            data_source_id, source_name, source_type, owner_name, table_name,
            source_file_name, access_scope, row_count, status, created_by_user_id
        ) VALUES (
            :id, :name, 'csv', :owner_name, :table_name,
            :source_file_name, 'all', :row_count, 'active', 0
        )
        """,
        id=data_source_id,
        name=table_name,
        owner_name=data_schema,
        table_name=table_name,
        source_file_name=f"{table_name}.csv",
        row_count=row_count,
    )
    for column in columns:
        metadata = metadata_by_name.get(column.name, {})
        cursor.execute(
            """
            INSERT INTO source_columns (
                source_column_id, data_source_id, column_name, data_type,
                data_length, nullable_flag, ordinal_position, business_comment, classification
            ) VALUES (
                :source_column_id, :data_source_id, :column_name, :data_type,
                :data_length, :nullable_flag, :ordinal_position, :business_comment, :classification
            )
            """,
            source_column_id=uuid.uuid4().hex,
            data_source_id=data_source_id,
            column_name=column.name,
            data_type=column.data_type,
            data_length=column.data_length,
            nullable_flag=column.nullable,
            ordinal_position=column.ordinal_position,
            business_comment=str(metadata.get("comment") or "").strip()[:1000] or None,
            classification=str(metadata.get("classification") or "").strip()[:100] or None,
        )
    return data_source_id

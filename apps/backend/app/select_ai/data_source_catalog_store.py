from __future__ import annotations


def _select_data_sources(cursor, *, app_schema: str) -> None:
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
        WHERE NOT (ds.owner_name = :app_schema AND ds.source_type = 'csv')
        ORDER BY ds.created_at DESC
        """,
        app_schema=app_schema,
    )


def _select_catalog_owners(cursor, *, app_schema: str) -> None:
    try:
        cursor.execute(
            """
            SELECT t.owner, COUNT(*) AS table_count
            FROM all_tables t
            JOIN all_users u
              ON u.username = t.owner
            WHERE NVL(u.oracle_maintained, 'N') = 'N'
              AND t.owner <> :app_schema
              AND t.table_name NOT LIKE 'BIN$%'
              AND NVL(t.nested, 'NO') = 'NO'
            GROUP BY t.owner
            ORDER BY t.owner
            """,
            app_schema=app_schema,
        )
    except Exception:
        cursor.execute(
            """
            SELECT owner, COUNT(*) AS table_count
            FROM all_tables
            WHERE owner <> :app_schema
              AND owner NOT LIKE 'SYS%'
              AND owner NOT LIKE 'APEX\\_%' ESCAPE '\\'
              AND owner NOT IN ('XDB', 'ORDS_METADATA', 'ORDS_PUBLIC_USER', 'MDSYS', 'CTXSYS')
              AND table_name NOT LIKE 'BIN$%'
            GROUP BY owner
            ORDER BY owner
            """,
            app_schema=app_schema,
        )


def _select_catalog_tables(cursor, *, owner_name: str) -> None:
    cursor.execute(
        """
        SELECT t.owner,
               t.table_name,
               NVL(t.num_rows, 0) AS row_count,
               COUNT(c.column_name) AS column_count,
               tc.comments AS table_comment
        FROM all_tables t
        LEFT JOIN all_tab_columns c
          ON c.owner = t.owner
         AND c.table_name = t.table_name
        LEFT JOIN all_tab_comments tc
          ON tc.owner = t.owner
         AND tc.table_name = t.table_name
         AND tc.table_type = 'TABLE'
        WHERE t.owner = :owner_name
          AND t.table_name NOT LIKE 'BIN$%'
          AND NVL(t.nested, 'NO') = 'NO'
        GROUP BY t.owner, t.table_name, t.num_rows, tc.comments
        ORDER BY t.table_name
        """,
        owner_name=owner_name,
    )


def _assert_catalog_table_selectable(cursor, *, qualified_table: str) -> None:
    cursor.execute(f"SELECT * FROM {qualified_table} WHERE 1 = 0")


def _select_catalog_table_comment(cursor, *, owner_name: str, table_name: str) -> None:
    cursor.execute(
        """
        SELECT comments
        FROM all_tab_comments
        WHERE owner = :owner_name
          AND table_name = :table_name
          AND table_type = 'TABLE'
        """,
        owner_name=owner_name,
        table_name=table_name,
    )


def _select_catalog_columns(cursor, *, owner_name: str, table_name: str) -> None:
    cursor.execute(
        """
        SELECT cols.column_name,
               cols.data_type,
               cols.data_length,
               cols.nullable,
               cols.column_id,
               comments.comments,
               CASE WHEN pk_cols.column_name IS NULL THEN 'N' ELSE 'Y' END AS primary_key_flag
        FROM all_tab_columns cols
        LEFT JOIN all_col_comments comments
          ON comments.owner = cols.owner
         AND comments.table_name = cols.table_name
         AND comments.column_name = cols.column_name
        LEFT JOIN (
            SELECT acc.owner, acc.table_name, acc.column_name
            FROM all_constraints ac
            JOIN all_cons_columns acc
              ON acc.owner = ac.owner
             AND acc.constraint_name = ac.constraint_name
             AND acc.table_name = ac.table_name
            WHERE ac.constraint_type = 'P'
        ) pk_cols
          ON pk_cols.owner = cols.owner
         AND pk_cols.table_name = cols.table_name
         AND pk_cols.column_name = cols.column_name
        WHERE cols.owner = :owner_name
          AND cols.table_name = :table_name
        ORDER BY cols.column_id
        """,
        owner_name=owner_name,
        table_name=table_name,
    )

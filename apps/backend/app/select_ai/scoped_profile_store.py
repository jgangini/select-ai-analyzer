from __future__ import annotations


def _select_registered_source_objects(cursor, *, app_schema: str) -> None:
    cursor.execute(
        """
        SELECT ds.owner_name, ds.table_name, sc.column_name
        FROM data_sources ds
        LEFT JOIN source_columns sc
            ON sc.data_source_id = ds.data_source_id
        WHERE ds.status = 'active'
          AND ds.access_scope = 'all'
          AND ds.owner_name <> :app_schema
        ORDER BY ds.owner_name, ds.table_name, sc.ordinal_position
        """,
        app_schema=app_schema,
    )


def _select_profile_config(cursor) -> None:
    cursor.execute(
        """
        SELECT config_key, config_value
        FROM config
        WHERE config_key IN (
            'genai.model',
            'select_ai.credential_name',
            'oci.region',
            'oci.compartment_id'
        )
        """
    )


def _drop_select_ai_profile(cursor, profile_name: str) -> None:
    cursor.callproc("DBMS_CLOUD_AI.DROP_PROFILE", [profile_name, True])

from __future__ import annotations

import uuid


def assert_connected_schema(cursor, app_schema: str) -> None:
    cursor.execute("SELECT USER FROM DUAL")
    connected_user = str(cursor.fetchone()[0]).upper()
    if connected_user != app_schema:
        raise RuntimeError(f"Seed loader must connect as {app_schema}; connected as {connected_user}.")


def schema_exists(cursor, schema_name: str) -> bool:
    cursor.execute("SELECT COUNT(*) FROM all_users WHERE username = :schema_name", schema_name=schema_name)
    row = cursor.fetchone()
    return bool(row and int(row[0] or 0) > 0)


def grant_if_permitted(cursor, grant_sql: str) -> None:
    try:
        cursor.execute(grant_sql)
    except Exception as exc:
        if "ORA-01031" not in str(exc):
            raise


def ensure_data_schema(cursor, data_schema: str) -> None:
    if schema_exists(cursor, data_schema):
        return
    password = "Ag" + uuid.uuid4().hex[:28]
    cursor.execute(
        f'CREATE USER {data_schema} IDENTIFIED BY "{password}" DEFAULT TABLESPACE USERS QUOTA UNLIMITED ON USERS'
    )
    grant_if_permitted(cursor, f"GRANT CREATE SESSION TO {data_schema}")
    grant_if_permitted(cursor, f"GRANT CREATE TABLE TO {data_schema}")


def drop_table_if_exists(cursor, table_name: str, data_schema: str) -> None:
    try:
        cursor.execute(f"DROP TABLE {data_schema}.{table_name} PURGE")
    except Exception as exc:
        if "ORA-00942" not in str(exc):
            raise

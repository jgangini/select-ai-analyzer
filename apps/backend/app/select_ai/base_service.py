from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Self

from apps.backend.app.core.config import get_settings
from apps.backend.app.core.database import DatabaseManager
from apps.backend.app.select_ai.constants import DEFAULT_PROFILE


class SelectAIBaseService:
    def __init__(self, db_manager: Any) -> None:
        self.db_manager = db_manager

    @classmethod
    def from_runtime(cls) -> Self:
        return cls(DatabaseManager.get_instance(get_settings()))

    @contextmanager
    def _cursor(self):
        conn = self._connection()
        cursor = conn.cursor()
        try:
            yield conn, cursor
        finally:
            cursor.close()
            conn.close()

    def _config_value(self, key: str, default: str = "") -> str:
        if not self.db_manager.table_exists("config"):
            return default
        with self._cursor() as (_, cursor):
            cursor.execute(
                """
                SELECT config_value
                FROM config
                WHERE config_key = :config_key
                """,
                config_key=key,
            )
            row = cursor.fetchone()
            if not row:
                return default
            value = row[0]
            if hasattr(value, "read"):
                value = value.read()
            return "" if value is None else str(value)

    def _profile_name(self) -> str:
        return self._config_value("select_ai.profile_name", DEFAULT_PROFILE).strip() or DEFAULT_PROFILE

    def _connection(self):
        return self.db_manager.get_connection()

    def refresh_profile(self, *, user_id: int = 0) -> None:
        with self._cursor() as (conn, cursor):
            cursor.callproc("SP_SEL_AI_PROFILE", [self._profile_name(), int(user_id)])
            conn.commit()

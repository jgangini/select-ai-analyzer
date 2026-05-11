from datetime import timedelta
import time
from typing import TYPE_CHECKING

from apps.backend.app.core.config import Settings
from apps.backend.app.core.security import create_access_token, verify_password
from apps.backend.app.core.tracing import trace
from apps.backend.app.services.runtime_config_service import ConfigService
from apps.backend.app.services.user_service import fetch_user_info

if TYPE_CHECKING:
    from apps.backend.app.core.database import DatabaseManager


class AuthService:
    """User authentication service."""

    _SESSION_TIMEOUT_CACHE_TTL_SECONDS = 30.0
    _session_timeout_cache: tuple[int, int, float] | None = None

    def __init__(self, db_manager: "DatabaseManager", settings: Settings):
        self.db_manager = db_manager
        self.settings = settings
        self.config_service = ConfigService(db_manager)

    @classmethod
    def clear_session_timeout_cache(cls) -> None:
        cls._session_timeout_cache = None

    def _cached_session_timeout_minutes(self) -> int | None:
        cache = self.__class__._session_timeout_cache
        if cache is None:
            return None
        cache_db_id, timeout_minutes, expires_at = cache
        if cache_db_id == id(self.db_manager) and time.monotonic() < expires_at:
            return timeout_minutes
        self.__class__._session_timeout_cache = None
        return None

    def _remember_session_timeout_minutes(self, timeout_minutes: int) -> None:
        self.__class__._session_timeout_cache = (
            id(self.db_manager),
            timeout_minutes,
            time.monotonic() + self._SESSION_TIMEOUT_CACHE_TTL_SECONDS,
        )

    def _resolve_session_timeout_minutes(self) -> int:
        default_minutes = int(self.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        cached_timeout = self._cached_session_timeout_minutes()
        if cached_timeout is not None:
            return cached_timeout
        try:
            raw_value = self.config_service.get_value("app.session_timeout_minutes", str(default_minutes)).strip()
            resolved = int(raw_value)
            timeout_minutes = max(1, resolved)
        except Exception:
            timeout_minutes = default_minutes
        self._remember_session_timeout_minutes(timeout_minutes)
        return timeout_minutes

    @trace
    def authenticate_user(self, username: str, password: str) -> dict | None:
        conn = self.db_manager.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT u.user_id, u.user_username, u.user_password,
                       u.user_name, u.user_last_name,
                       u.user_group_id, ug.user_group_name
                FROM users u
                JOIN user_group ug ON u.user_group_id = ug.user_group_id
                WHERE u.user_username = :username AND u.user_state = 1
                """,
                username=username,
            )
            row = cursor.fetchone()
            if not row:
                return None
            user_id, user_username, hashed_password, name, last_name, group_id, group_name = row
            if not verify_password(password, hashed_password):
                return None
            cursor.execute(
                """
                UPDATE users SET user_last_login = SYSDATE
                WHERE user_id = :user_id
                """,
                user_id=user_id,
            )
            conn.commit()
            return {
                "user_id": user_id,
                "username": user_username,
                "name": name,
                "last_name": last_name,
                "email": user_username,
                "group_id": group_id,
                "group_name": group_name,
            }
        finally:
            cursor.close()
            conn.close()

    @trace
    def login(self, username: str, password: str) -> dict | None:
        user = self.authenticate_user(username, password)
        if not user:
            return None
        session_timeout_minutes = self._resolve_session_timeout_minutes()
        access_token = create_access_token(
            data={"sub": user["username"], "user_id": user["user_id"]},
            settings=self.settings,
            expires_delta=timedelta(minutes=session_timeout_minutes),
        )
        return {"access_token": access_token, "token_type": "bearer", "user": user}

    def get_current_user_info(self, user_id: int) -> dict | None:
        return fetch_user_info(self.db_manager, user_id)

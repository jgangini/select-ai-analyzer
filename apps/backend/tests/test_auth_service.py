from types import SimpleNamespace

import pytest

from apps.backend.app.services.auth_service import AuthService


class StubConfigService:
    def __init__(self, value=None, error: Exception | None = None) -> None:
        self.value = value
        self.error = error
        self.calls = 0

    def get_value(self, key: str, default: str = "") -> str:
        self.calls += 1
        if self.error is not None:
            raise self.error
        return str(self.value if self.value is not None else default)


def auth_service_with_config(value=None, error: Exception | None = None) -> AuthService:
    service = AuthService(db_manager=object(), settings=SimpleNamespace(ACCESS_TOKEN_EXPIRE_MINUTES=30))
    service.config_service = StubConfigService(value=value, error=error)
    return service


@pytest.fixture(autouse=True)
def clear_auth_caches():
    AuthService.clear_session_timeout_cache()
    yield
    AuthService.clear_session_timeout_cache()


def test_resolve_session_timeout_uses_configured_value() -> None:
    assert auth_service_with_config("45")._resolve_session_timeout_minutes() == 45


def test_resolve_session_timeout_enforces_minimum_one_minute() -> None:
    assert auth_service_with_config("0")._resolve_session_timeout_minutes() == 1
    assert auth_service_with_config("-20")._resolve_session_timeout_minutes() == 1


def test_resolve_session_timeout_falls_back_to_settings_on_invalid_config() -> None:
    assert auth_service_with_config("not-a-number")._resolve_session_timeout_minutes() == 30
    assert auth_service_with_config(error=RuntimeError("config unavailable"))._resolve_session_timeout_minutes() == 30


def test_resolve_session_timeout_caches_configured_value() -> None:
    service = auth_service_with_config("45")
    config_service = service.config_service

    assert service._resolve_session_timeout_minutes() == 45
    assert service._resolve_session_timeout_minutes() == 45
    assert config_service.calls == 1

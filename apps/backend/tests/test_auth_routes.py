import inspect

from apps.backend.app.api.routes import auth


def test_auth_routes_are_sync_to_isolate_blocking_database_work() -> None:
    assert not inspect.iscoroutinefunction(auth.login)
    assert not inspect.iscoroutinefunction(auth.get_current_user_info)
    assert not inspect.iscoroutinefunction(auth.logout)

from apps.backend.app.select_ai import dashboards


def test_dashboard_service_from_runtime_uses_database_manager_instance(monkeypatch) -> None:
    settings = object()
    db_manager = object()

    class FakeDatabaseManager:
        @staticmethod
        def get_instance(received_settings):
            assert received_settings is settings
            return db_manager

    monkeypatch.setattr(dashboards, "get_settings", lambda: settings)
    monkeypatch.setattr(dashboards, "DatabaseManager", FakeDatabaseManager)

    service = dashboards.DashboardService.from_runtime()

    assert service.db_manager is db_manager

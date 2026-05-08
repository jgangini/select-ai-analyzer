from __future__ import annotations

from typing import Any

from apps.backend.app.core.config import get_settings
from apps.backend.app.core.database import DatabaseManager
from apps.backend.app.select_ai.dashboard_item_mutations import DashboardItemMutationMixin
from apps.backend.app.select_ai.dashboard_mutations import DashboardMutationMixin
from apps.backend.app.select_ai.dashboard_queries import DashboardQueryMixin
from apps.backend.app.select_ai.dashboard_schema import DashboardSchemaMixin


class DashboardService(
    DashboardSchemaMixin,
    DashboardQueryMixin,
    DashboardMutationMixin,
    DashboardItemMutationMixin,
):
    def __init__(self, db_manager: Any) -> None:
        self.db_manager = db_manager

    @classmethod
    def from_runtime(cls):
        return cls(DatabaseManager.get_instance(get_settings()))

    def _connection(self):
        return self.db_manager.get_connection()

import json

import pytest

from apps.backend.app.select_ai.dashboards import DashboardService


class MutationCursor:
    def __init__(self, *, fetchone_results: list[list[object] | None] | None = None) -> None:
        self.fetchone_results = list(fetchone_results or [])
        self.executed: list[tuple[str, dict[str, object]]] = []
        self.insert_params: list[dict[str, object]] = []
        self.closed = False
        self.rowcount = 1

    def execute(self, statement: str, params: dict[str, object] | None = None, **kwargs: object) -> None:
        bound_params = dict(params or kwargs)
        self.executed.append((statement, bound_params))
        if "INSERT INTO analytics_dashboard_items" in statement:
            self.insert_params.append(bound_params)

    def fetchone(self) -> list[object] | None:
        return self.fetchone_results.pop(0) if self.fetchone_results else None

    def fetchall(self) -> list[list[object]]:
        return []

    def close(self) -> None:
        self.closed = True


class MutationConnection:
    def __init__(self, cursor: MutationCursor) -> None:
        self._cursor = cursor
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def cursor(self) -> MutationCursor:
        return self._cursor

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True

    def close(self) -> None:
        self.closed = True


class MutationDbManager:
    def __init__(self, connection: MutationConnection) -> None:
        self.connection = connection

    def get_connection(self) -> MutationConnection:
        return self.connection


def make_service(cursor: MutationCursor) -> DashboardService:
    service = DashboardService(MutationDbManager(MutationConnection(cursor)))
    service.ensure_tables = lambda: None
    service.get_dashboard = lambda **kwargs: {"dashboard_id": kwargs["dashboard_id"], "user_id": kwargs["user_id"]}
    return service


def test_add_dashboard_items_inserts_normalized_visualization() -> None:
    cursor = MutationCursor(fetchone_results=[["dash_1"], [2]])
    service = make_service(cursor)

    result = service.add_dashboard_items(
        dashboard_id=" dash_1 ",
        user_id=7,
        items=[
            {
                "run_id": "run_123",
                "title": "Branch balance",
                "question": "Show balances by branch",
                "sql": "SELECT branch_id, balance FROM demo;",
                "chart_spec": {"type": "bar", "x": "branch_id", "y": "balance"},
                "layout": {"x": 0, "y": 1},
            }
        ],
    )

    assert result == {"dashboard_id": "dash_1", "user_id": 7}
    assert cursor.insert_params
    insert_params = cursor.insert_params[0]
    assert insert_params["dashboard_id"] == "dash_1"
    assert insert_params["item_order"] == 3
    assert insert_params["generated_sql"] == "SELECT branch_id, balance FROM demo"
    assert json.loads(str(insert_params["chart_spec_json"])) == {"type": "bar", "x": "branch_id", "y": "balance"}
    assert json.loads(str(insert_params["layout_json"])) == {"x": 0, "y": 1}


def test_add_dashboard_items_rejects_empty_dashboard_id_or_items() -> None:
    service = make_service(MutationCursor())

    with pytest.raises(ValueError, match="dashboard_id is required"):
        service.add_dashboard_items(dashboard_id="", items=[{"sql": "SELECT 1 FROM dual"}])
    with pytest.raises(ValueError, match="At least one visualization"):
        service.add_dashboard_items(dashboard_id="dash_1", items=[])


def test_update_dashboard_item_rejects_invalid_layout_before_opening_connection() -> None:
    service = make_service(MutationCursor())

    with pytest.raises(ValueError, match="layout must be a JSON object"):
        service.update_dashboard_item(dashboard_id="dash_1", dashboard_item_id="item_1", layout=[])


def test_reorder_dashboard_items_rejects_duplicate_items_before_opening_connection() -> None:
    service = make_service(MutationCursor())

    with pytest.raises(ValueError, match="duplicate items"):
        service.reorder_dashboard_items(dashboard_id="dash_1", dashboard_item_ids=["item_1", "item_1"])

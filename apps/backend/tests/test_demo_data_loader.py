import io
import unittest
from contextlib import ExitStack, redirect_stdout
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import Mock, call, patch

from scripts import load_demo_data

from scripts.load_demo_data import (
    _render_create_table,
    demo_entries,
    selected_demo_entries,
    table_metadata,
    validate_demo_assets,
)


class DemoDataLoaderTests(unittest.TestCase):
    def test_versioned_demo_catalog_contains_sales_and_core_banking(self) -> None:
        entries = demo_entries()

        self.assertEqual(set(entries), {"SH_DEMO", "FLEXCUBE_DEMO"})
        self.assertEqual(len(table_metadata(entries["SH_DEMO"])), 8)
        self.assertEqual(len(table_metadata(entries["FLEXCUBE_DEMO"])), 59)

    def test_demo_selection_is_explicit_and_rejects_unknown_or_duplicate_schemas(self) -> None:
        self.assertEqual(
            [entry.schema for entry in selected_demo_entries("SH_DEMO,FLEXCUBE_DEMO")],
            ["SH_DEMO", "FLEXCUBE_DEMO"],
        )
        with self.assertRaisesRegex(ValueError, "Unsupported demo schema"):
            selected_demo_entries("UNKNOWN")
        with self.assertRaisesRegex(ValueError, "must not contain duplicates"):
            selected_demo_entries("SH_DEMO,SH_DEMO")

    def test_sales_demo_ddl_preserves_primary_and_foreign_keys(self) -> None:
        entry = demo_entries()["SH_DEMO"]
        costs = next(table for _path, table in table_metadata(entry) if table["table_name"] == "COSTS")

        ddl = _render_create_table(entry, costs)

        self.assertIn('CREATE TABLE "SH_DEMO"."COSTS"', ddl)
        self.assertIn('PRIMARY KEY ("PROD_ID", "TIME_ID")', ddl)
        self.assertIn('FOREIGN KEY ("PROD_ID") REFERENCES "SH_DEMO"."PRODUCTS" ("PROD_ID")', ddl)

    def test_demo_assets_validate_without_a_database_connection(self) -> None:
        validation = validate_demo_assets()

        self.assertTrue(any(message.startswith("SH_DEMO: 8 tables") for message in validation))
        self.assertTrue(any(message.startswith("FLEXCUBE_DEMO: 59 tables") for message in validation))


    def test_admin_proxy_cleanup_revokes_only_permissions_added_by_this_run(self) -> None:
        cursor = Mock()
        cursor.fetchone.side_effect = [(1,), None]
        cursor.fetchall.return_value = [("CREATE TABLE",)]

        with self.assertRaisesRegex(RuntimeError, "load failed"):
            with ExitStack() as cleanup:
                load_demo_data._enable_demo_proxy(cursor, "SH_DEMO", cleanup)
                raise RuntimeError("load failed")

        self.assertEqual(cursor.execute.call_args_list, [
            call("SELECT 1 FROM dba_users WHERE username = :owner", owner="SH_DEMO"),
            call(
                "SELECT privilege FROM dba_sys_privs WHERE grantee = :owner AND privilege IN ('CREATE SESSION', 'CREATE TABLE')",
                owner="SH_DEMO",
            ),
            call('GRANT CREATE SESSION TO "SH_DEMO"'),
            call("SELECT 1 FROM proxy_users WHERE proxy = 'ADMIN' AND client = :owner", owner="SH_DEMO"),
            call('ALTER USER "SH_DEMO" GRANT CONNECT THROUGH ADMIN WITH NO ROLES'),
            call('ALTER USER "SH_DEMO" REVOKE CONNECT THROUGH ADMIN'),
            call('REVOKE CREATE SESSION FROM "SH_DEMO"'),
        ])

    def test_admin_proxy_preserves_existing_grants(self) -> None:
        cursor = Mock()
        cursor.fetchone.side_effect = [(1,), (1,)]
        cursor.fetchall.return_value = [("CREATE SESSION",), ("CREATE TABLE",)]

        with ExitStack() as cleanup:
            load_demo_data._enable_demo_proxy(cursor, "SH_DEMO", cleanup)

        statements = [args[0] for args, _ in cursor.execute.call_args_list]
        self.assertFalse(any(statement.startswith(("GRANT", "REVOKE", "ALTER USER")) for statement in statements))

    def test_managed_seed_reuses_populated_fixture_and_grants_before_row_load(self) -> None:
        entry = demo_entries()["SH_DEMO"]
        metadata = table_metadata(entry)[:3]
        cursor = Mock()
        cursor.fetchall.return_value = [("COUNTRIES",), ("UNRELATED",)]
        with (
            patch.object(load_demo_data, "_session_user", return_value="SH_DEMO"),
            patch.object(load_demo_data, "_existing_demo_rows_match", return_value=True),
            patch.object(load_demo_data, "apply_metadata", return_value=[]),
        ):
            counts, warnings = load_demo_data._seed_as_demo_owner(cursor, entry, metadata, "APP_AGENT_123")

        self.assertEqual(set(counts), {"COUNTRIES", "CHANNELS", "PRODUCTS"})
        self.assertEqual(warnings, [])
        statements = [args[0] for method, args, _ in cursor.mock_calls if method in {"execute", "executemany"}]
        self.assertEqual(statements[0], "SELECT table_name FROM user_tables")
        self.assertEqual(statements[1], 'GRANT SELECT ON "SH_DEMO"."COUNTRIES" TO "APP_AGENT_123"')
        self.assertTrue(statements[2].startswith('CREATE TABLE "SH_DEMO"."CHANNELS"'))
        self.assertEqual(statements[3], 'GRANT SELECT ON "SH_DEMO"."CHANNELS" TO "APP_AGENT_123"')
        self.assertTrue(statements[4].startswith('CREATE TABLE "SH_DEMO"."PRODUCTS"'))
        self.assertEqual(statements[5], 'GRANT SELECT ON "SH_DEMO"."PRODUCTS" TO "APP_AGENT_123"')
        self.assertTrue(statements[6].startswith('INSERT INTO "SH_DEMO"."CHANNELS"'))
        self.assertTrue(statements[7].startswith('INSERT INTO "SH_DEMO"."PRODUCTS"'))
        self.assertEqual(len(statements), 8)

    def test_existing_fixture_rows_must_match_without_modifying_existing_data(self) -> None:
        cursor = Mock()
        cursor.description = [("ITEM_ID",), ("ITEM_CODE",), ("ISSUED",)]
        qualified_table = '"SH_DEMO"."ITEMS"'
        names = ["ITEM_ID", "ITEM_CODE", "ISSUED"]
        data_types = ["NUMBER(22,3)", "CHAR(3)", "DATE"]
        expected = [[Decimal("1234.012"), "X", date(2026, 1, 1)]]
        cursor.fetchone.side_effect = [(Decimal("1234.012"), "X  ", datetime(2026, 1, 1)), None]

        self.assertTrue(load_demo_data._existing_demo_rows_match(cursor, qualified_table, names, data_types, expected))
        cursor.execute.assert_called_once_with(f"SELECT * FROM {qualified_table}", fetch_decimals=True)

        cursor.fetchone.side_effect = [(Decimal("1234.012"), "Y  ", datetime(2026, 1, 1))]
        with self.assertRaisesRegex(RuntimeError, "differs from the packaged demo"):
            load_demo_data._existing_demo_rows_match(cursor, qualified_table, names, data_types, expected)
        cursor.executemany.assert_not_called()

    def test_existing_source_registration_preserves_its_id_on_retry(self) -> None:
        entry = demo_entries()["SH_DEMO"]
        _, table = table_metadata(entry)[0]
        cursor = Mock()
        cursor.fetchone.return_value = ("csv", "COUNTRIES.csv", "all", "active", 0, 9)
        with patch.object(load_demo_data, "replace_data_source") as register:
            load_demo_data._register_managed_demo(cursor, entry, table, 9)
            register.assert_not_called()

        cursor.fetchone.return_value = ("existing_table", None, "private", "active", 5, 9)
        with self.assertRaisesRegex(RuntimeError, "Existing source registration"):
            load_demo_data._register_managed_demo(cursor, entry, table, 9)

    def test_managed_cli_reads_password_from_stdin_without_altering_it(self) -> None:
        password = " fake-test-value+ "
        with (
            patch.object(load_demo_data.sys, "argv", ["load_demo_data.py", "--schemas", "SH_DEMO", "--admin-password-stdin"]),
            patch.object(load_demo_data.sys, "stdin", io.StringIO(password)),
            patch.object(load_demo_data, "load_managed_demo_schemas", return_value=[]) as execute,
            redirect_stdout(io.StringIO()) as output,
        ):
            self.assertEqual(load_demo_data.main(), 0)

        execute.assert_called_once_with("SH_DEMO", password)
        self.assertEqual(output.getvalue(), "DEMO_SCHEMAS_LOADED=0\n")

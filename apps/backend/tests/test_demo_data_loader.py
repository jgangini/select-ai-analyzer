import unittest

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

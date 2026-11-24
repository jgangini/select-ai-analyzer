import io
import json
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import check_deployed_demos


ROOT = Path(__file__).resolve().parents[1]


class DeployStudioContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.contract = json.loads((ROOT / "terraform" / "deploy-studio.json").read_text(encoding="utf-8"))

    def test_contract_identity_and_terraform_path(self) -> None:
        self.assertEqual(self.contract["schema_version"], 2)
        self.assertEqual(self.contract["project_id"], "select-ai-analyzer")
        self.assertEqual(self.contract["execution_source"], "oci_resource_manager")
        terraform_path = ROOT / self.contract["terraform"]["path"]
        self.assertTrue(terraform_path.is_dir())
        self.assertTrue(any(terraform_path.glob("*.tf")))
        self.assertNotIn("source_ref", {field["name"] for field in self.contract["form"]["fields"]})

    def test_secrets_and_outputs_are_safe(self) -> None:
        password_fields = [field for field in self.contract["form"]["fields"] if field["type"] == "password"]
        self.assertTrue(password_fields)
        self.assertTrue(all(field.get("secret") is True for field in password_fields))
        self.assertEqual(
            self.contract["form"]["email_access_fields"],
            ["application_username", "autonomous_database_developer_password"],
        )
        schema_field = next(field for field in self.contract["form"]["fields"] if field["name"] == "select_ai_grant_schemas")
        self.assertTrue(schema_field["multiple"])
        self.assertEqual(schema_field["default"], "SH_DEMO,FLEXCUBE_DEMO")
        self.assertEqual(schema_field["group"], "application_vm")
        self.assertEqual(schema_field["span"], 1)
        field_names = [field["name"] for field in self.contract["form"]["fields"]]
        password_index = field_names.index("autonomous_database_developer_password")
        self.assertEqual(field_names[password_index + 1], "select_ai_grant_schemas")
        self.assertEqual(
            [option["value"] for option in schema_field["options"]],
            ["SH_DEMO", "FLEXCUBE_DEMO"],
        )
        forbidden = ("password", "secret", "private_key", "key_pem", "config")
        self.assertFalse(any(token in output.lower() for output in self.contract["outputs"] for token in forbidden))
        self.assertFalse(self.contract["terraform"]["package_oci_credentials"])
        hook = self.contract["post_apply"]
        self.assertTrue(hook["requires_oci_credentials"])
        self.assertTrue((ROOT / hook["entrypoint"]).is_file())
        self.assertEqual(set(hook["secret_inputs"]), {field["name"] for field in password_fields})
        self.assertTrue({"instance_id", "objectstorage_namespace"} <= set(self.contract["outputs"]))

    def test_default_resource_names_derive_from_deployment_suffix(self) -> None:
        naming = (ROOT / "terraform" / "naming.tf").read_text(encoding="utf-8")
        for legacy_override in ("bucket_name", "adb_db_name", "adb_display_name", "vcn_display_name", "instance_display_name"):
            self.assertIn(f'var.{legacy_override} != ""', naming)
        self.assertGreaterEqual(naming.count("var.deployment_suffix"), 5)

    def test_database_inventory_uses_generated_wallet_and_regional_models(self) -> None:
        form = self.contract["form"]
        fields = {field["name"]: field for field in form["fields"]}
        controls = {item["name"] for group in form["groups"] for item in group["items"] if item["kind"] == "control"}
        self.assertEqual(self.contract["capabilities"]["existing_database_wallet"], "oci_generated")
        self.assertNotIn("database_wallet", controls)
        database = fields["existing_autonomous_database_ocid"]
        self.assertEqual(database["options_source"], "oci_available_autonomous_databases")
        self.assertEqual(database["visible_when"], {"field": "autonomous_database_mode", "equals": "existing"})
        self.assertEqual(fields["select_ai_grant_schemas"]["visible_when"]["equals"], "new")
        self.assertEqual(fields["select_ai_model"]["options_source"], "oci_genai_chat_models")
        self.assertEqual(fields["select_ai_model"]["default"], "xai.grok-4.7")
        self.assertEqual(fields["autonomous_database_version"]["default"], "26ai:LH")
        self.assertEqual(self.contract["run_steps"][-1]["key"], "complete")

    def test_vm_bootstrap_uses_the_selected_revision_and_private_setup(self) -> None:
        terraform = (ROOT / "terraform" / "c_oci_core_instance.tf").read_text(encoding="utf-8")
        userdata = (ROOT / "terraform" / "templatefile" / "user_data.sh").read_text(encoding="utf-8")
        bootstrap = (ROOT / "terraform" / "templatefile" / "configure_app.sh").read_text(encoding="utf-8")
        self.assertRegex(terraform, r"source_commit_sha\s*=\s*var\.source_commit_sha")
        self.assertIn('fetch --depth=1 origin "$SOURCE_COMMIT_SHA"', userdata)
        self.assertIn('checkout --detach FETCH_HEAD', userdata)
        self.assertIn('ANALYZER_MANAGED_SETUP=1', userdata)
        self.assertNotIn(".oci/", terraform)
        self.assertNotIn("configure_app.sh", terraform)
        self.assertIn("CTN_ANALYZER_HOST_KEY", userdata)
        self.assertIn("payload.json", userdata)
        self.assertLess(bootstrap.index('"/auth/login"'), bootstrap.index("/app/scripts/check_deployed_demos.py"))
        self.assertLess(bootstrap.index("/app/scripts/check_deployed_demos.py"), bootstrap.index("sudo touch /var/local/select-ai-analyzer-setup.done"))
        self.assertIn("if selected_demos:", bootstrap)
        self.assertIn("if demo_check.returncode:", bootstrap)

    def test_email_links_the_vm_without_sending_database_passwords(self) -> None:
        email = self.contract["email"]
        self.assertEqual([service["title"] for service in email["services"]], ["Autonomous Database", "Application VM"])
        rows = [field for service in email["services"] for field in service["fields"]]
        self.assertEqual({field["input"] for field in rows if "input" in field}, {"application_username", "autonomous_database_developer_password"})
        self.assertIn({"label": "Access URL", "output": "application_url", "link": True}, rows)
        self.assertNotIn("connection-summary.txt", email["attachments"])

    def test_declares_all_deploy_studio_artifacts(self) -> None:
        self.assertEqual(
            set(self.contract["artifacts"]),
            {"adb_wallet.zip", "ssh-private-key.pem"},
        )


class DemoVerificationTests(unittest.TestCase):
    def response(self, schema, rows):
        table, _ = check_deployed_demos.DEMO_QUERIES[schema]
        return {
            "sql": f'SELECT * FROM "{schema}"."{table}"',
            "rows": rows,
            "agent_trace": [{"stage": "select_ai.scope_profile", "objects": [{"owner": schema, "name": table}]}],
            "conversation_id": "demo-check-123",
        }

    def run_check(self, schemas, responses):
        payload = json.dumps({"token": "synthetic.token", "schemas": schemas})
        stdout = io.StringIO()
        stderr = io.StringIO()
        with (
            patch("sys.stdin", io.StringIO(payload)),
            patch("sys.stdout", stdout),
            patch("sys.stderr", stderr),
            patch.object(check_deployed_demos, "request_json", side_effect=responses) as request,
        ):
            status = check_deployed_demos.main()
        return status, request.call_args_list, stdout.getvalue(), stderr.getvalue()

    def test_queries_every_selected_demo_and_removes_probe_conversations(self):
        sales = self.response("SH_DEMO", [{"PROD_ID": 10, "TOTAL": 4797}, *[{"PROD_ID": n, "TOTAL": 1} for n in range(4)]])
        bank = self.response("FLEXCUBE_DEMO", [{"CCY": code, "N": count} for code, count in
                                              {"BRL": 456, "EUR": 456, "PEN": 456, "USD": 457}.items()])
        status, calls, stdout, stderr = self.run_check(["SH_DEMO", "FLEXCUBE_DEMO"], [sales, {}, bank, {}])
        self.assertEqual(status, 0)
        self.assertEqual([call.args[0] for call in calls], ["POST", "DELETE", "POST", "DELETE"])
        self.assertIn("SH_DEMO.SALES", calls[0].args[3]["question"])
        self.assertIn("FLEXCUBE_DEMO.FLEX_ACTB_ACCBAL_HISTORY", calls[2].args[3]["question"])
        self.assertIn("FLEXCUBE_DEMO Select AI query verified.", stdout)
        self.assertNotIn("synthetic.token", stdout + stderr)

    def test_wrong_fixture_totals_fail_even_with_http_success(self):
        bank = self.response("FLEXCUBE_DEMO", [{"CCY": code, "N": 456} for code in ("BRL", "EUR", "PEN", "USD")])
        status, calls, stdout, stderr = self.run_check(["FLEXCUBE_DEMO"], [bank, {}])
        self.assertEqual(status, 1)
        self.assertEqual(calls[1].args[0], "DELETE")
        self.assertEqual(stdout, "")
        self.assertIn("FLEXCUBE_DEMO query verification failed", stderr)

    def test_inference_error_fails_check_and_preserves_redacted_reason(self):
        error = check_deployed_demos.DemoCheckError("Analytics returned HTTP 400 (ORA-20400)")
        status, calls, stdout, stderr = self.run_check(["FLEXCUBE_DEMO"], [error])
        self.assertEqual(status, 1)
        self.assertEqual(len(calls), 1)
        self.assertEqual(stdout, "")
        self.assertIn("FLEXCUBE_DEMO query verification failed: Analytics returned HTTP 400 (ORA-20400)", stderr)

    def test_no_demos_makes_no_analytics_calls(self):
        self.assertEqual(self.run_check([], []), (0, [], "", ""))


if __name__ == "__main__":
    unittest.main()

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class DeployStudioContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.contract = json.loads((ROOT / "deploy-studio.json").read_text(encoding="utf-8"))

    def test_contract_identity_and_terraform_path(self) -> None:
        self.assertEqual(self.contract["schema_version"], 1)
        self.assertEqual(self.contract["project_id"], "select-ai-analyzer")
        terraform_path = ROOT / self.contract["terraform"]["path"]
        self.assertTrue(terraform_path.is_dir())
        self.assertTrue(any(terraform_path.glob("*.tf")))
        self.assertNotIn("source_ref", {field["name"] for field in self.contract["form"]["fields"]})

    def test_secrets_and_outputs_are_safe(self) -> None:
        password_fields = [field for field in self.contract["form"]["fields"] if field["type"] == "password"]
        self.assertTrue(password_fields)
        self.assertTrue(all(field.get("secret") is True for field in password_fields))
        forbidden = ("password", "secret", "private_key", "key_pem", "config")
        self.assertFalse(any(token in output.lower() for output in self.contract["outputs"] for token in forbidden))
        self.assertIsNone(self.contract["post_apply"])

    def test_default_resource_names_derive_from_deployment_suffix(self) -> None:
        naming = (ROOT / "infra" / "terraform" / "naming.tf").read_text(encoding="utf-8")
        for legacy_override in ("bucket_name", "adb_db_name", "adb_display_name", "vcn_display_name", "instance_display_name"):
            self.assertIn(f'var.{legacy_override} != ""', naming)
        self.assertGreaterEqual(naming.count("var.deployment_suffix"), 5)

    def test_declares_all_deploy_studio_artifacts(self) -> None:
        self.assertEqual(
            set(self.contract["artifacts"]),
            {"adb_wallet.zip", "ssh-private-key.pem", "connection-summary.txt"},
        )


if __name__ == "__main__":
    unittest.main()

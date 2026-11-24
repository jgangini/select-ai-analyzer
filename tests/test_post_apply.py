import base64
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from subprocess import CompletedProcess
from types import SimpleNamespace
from unittest.mock import Mock, call, patch

from deploy.hooks import post_apply


class PostApplyTests(unittest.TestCase):
    def test_host_identity_and_atomic_sftp_payload(self):
        key = b"synthetic SSH host public key identity"
        marker = b"CTN_ANALYZER_HOST_KEY " + base64.b64encode(key)
        pin = base64.b64encode(hashlib.sha256(key).digest()).decode()
        self.assertEqual(post_apply.host_pins(marker + b"\n" + marker + b"\r\n"), [pin])
        with self.assertRaises(post_apply.BootstrapError):
            post_apply.host_pins(b"no public identity")
        with patch.object(post_apply.subprocess, "run") as run:
            post_apply.transfer("192.0.2.10", Path("synthetic.pem"), pin, "payload.part", b"fixture")
        command = run.call_args.args[0]
        self.assertEqual(command[command.index("--hostpubsha256") + 1], pin)
        self.assertEqual(command[command.index("--upload-file") + 1], "-")
        self.assertEqual(run.call_args.kwargs["input"], b"fixture")
        self.assertFalse(any("fixture" in arg for arg in command))
        self.assertIn("-chmod 0600 /home/opc/ctn-bootstrap/payload.part", command)
        self.assertIn("-rename /home/opc/ctn-bootstrap/payload.part /home/opc/ctn-bootstrap/payload.json", command)

    def test_console_history_response_uses_raw_sdk_bytes_and_cleans_up(self):
        host_key = b"synthetic SSH host public key for console verification"
        history = b"CTN_ANALYZER_HOST_KEY " + base64.b64encode(host_key) + b"\n"
        pin = base64.b64encode(hashlib.sha256(host_key).digest()).decode()
        client = Mock()
        client.create_instance_console_connection.return_value.data.id = "console-fixture"
        client.get_instance_console_connection.return_value.data.lifecycle_state = "ACTIVE"
        client.capture_console_history.return_value.data.id = "history-fixture"
        client.get_console_history.return_value.data.lifecycle_state = "SUCCEEDED"
        def read_history(history_id, *, offset, length):
            self.assertEqual((history_id, offset), ("history-fixture", 0))
            self.assertGreaterEqual(length, 1024 * 1024)
            return SimpleNamespace(data=history)

        client.get_console_history_content.side_effect = read_history

        with patch.object(post_apply.oci.pagination, "list_call_get_all_results", return_value=SimpleNamespace(data=[])):
            pins = post_apply.authenticated_host_pins(client, "compartment-fixture", "instance-fixture", "public-fixture")

        self.assertEqual(pins, [pin])
        client.delete_console_history.assert_called_once_with("history-fixture")
        client.delete_instance_console_connection.assert_called_once_with("console-fixture")

    def test_host_mismatch_cannot_upload(self):
        refusal = CompletedProcess([], 60, b"", b"")
        with patch.object(post_apply, "transfer", return_value=refusal) as transfer:
            with self.assertRaisesRegex(post_apply.BootstrapError, "did not match"):
                post_apply.provision("192.0.2.10", Path("fixture"), ["incorrect"], b"private")
        transfer.assert_called_once_with("192.0.2.10", Path("fixture"), "incorrect", "status.json")

    def test_delivers_once_and_waits_for_login_status(self):
        attempts = [
            CompletedProcess([], 60, b"", b""),
            CompletedProcess([], 78, b"", b""),
            CompletedProcess([], 0, b"", b""),
            CompletedProcess([], 0, b'{"state":"succeeded"}', b""),
        ]
        host, key = "192.0.2.10", Path("fixture")
        with patch.object(post_apply, "transfer", side_effect=attempts) as transfer:
            post_apply.provision(host, key, ["incorrect", "verified"], b"private")
        self.assertEqual(transfer.call_args_list, [
            call(host, key, "incorrect", "status.json"),
            call(host, key, "verified", "status.json"),
            call(host, key, "verified", "payload.part", b"private"),
            call(host, key, "verified", "status.json"),
        ])
        with patch.object(post_apply, "transfer", return_value=attempts[-1]) as transfer:
            post_apply.provision(host, key, ["verified"], b"private")
        transfer.assert_called_once_with(host, key, "verified", "status.json")

    def test_matches_stack_and_vm_to_the_deployment(self):
        instance_id = "ocid1.instance.oc1.ord.fixture"
        context = {
            "deployment_id": "dep_fixture",
            "compartment": {"id": "ocid1.compartment.oc1..fixture"},
            "terraform_outputs": {"instance_id": instance_id, "application_url": "http://192.0.2.10"},
        }
        stack = SimpleNamespace(id="stack-fixture", freeform_tags={
            "project": "cloudtechnext-launchpad", "catalog_item": "select-ai-analyzer", "deployment": "dep_fixture",
        })
        vm = {"id": instance_id, "public_ip": "192.0.2.10"}
        key = {"private_key_pem": "test key", "public_key_openssh": "test public key"}
        state = {"resources": [
            {"mode": "managed", "type": "oci_core_instance", "name": "linux_instance", "instances": [{"attributes": vm}]},
            {"mode": "managed", "type": "tls_private_key", "name": "instance_ssh", "instances": [{"attributes": key}]},
        ]}
        client = Mock()
        client.get_stack_tf_state.return_value.data.content = json.dumps(state).encode()
        with patch.object(post_apply.oci.pagination, "list_call_get_all_results", return_value=SimpleNamespace(data=[stack])):
            self.assertEqual(
                post_apply.deployment_vm(client, context), (instance_id, "192.0.2.10", "test key", "test public key")
            )
            client.get_stack_tf_state.assert_called_once_with("stack-fixture")
            context["terraform_outputs"]["application_url"] = "http://192.0.2.11"
            with self.assertRaisesRegex(post_apply.BootstrapError, "does not match"):
                post_apply.deployment_vm(client, context)

    def test_existing_database_skips_demo_schemas(self):
        context = {
            "region": "us-chicago-1",
            "compartment": {"id": "compartment-fixture"},
            "terraform_outputs": {"objectstorage_namespace": "n", "bucket_name": "bucket-fixture"},
            "inputs": {"autonomous_database_mode": "new", "select_ai_grant_schemas": "SH_DEMO",
                       "application_username": "fixture", "select_ai_model": "model-fixture"},
        }
        passwords = dict.fromkeys(post_apply.SECRET_FIELDS.values(), "synthetic-password")
        with tempfile.TemporaryDirectory() as directory:
            files = [Path(directory) / name for name in ("config", "key.pem", "wallet.zip")]
            for path in files:
                path.write_bytes(b"synthetic")
            created = json.loads(post_apply.bootstrap_payload(context, passwords, *files))
            self.assertEqual(created["inputs"]["DEMO_SCHEMAS"], "SH_DEMO")
            self.assertEqual(created["inputs"]["GENERATIVE_MODEL"], "model-fixture")
            self.assertEqual(base64.b64decode(created["wallet_b64"]), b"synthetic")
            context["inputs"]["autonomous_database_mode"] = "existing"
            del context["inputs"]["select_ai_grant_schemas"]
            reused = json.loads(post_apply.bootstrap_payload(context, passwords, *files))
            self.assertEqual(reused["inputs"]["DEMO_SCHEMAS"], "")

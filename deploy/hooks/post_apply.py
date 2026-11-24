from __future__ import annotations

import base64
import binascii
import hashlib
import ipaddress
import json
import os
import re
import secrets
import subprocess
import tempfile
import time
from contextlib import suppress
from pathlib import Path
from urllib.parse import urlsplit

import oci
from oci.core.models import CaptureConsoleHistoryDetails, CreateInstanceConsoleConnectionDetails

INBOX = "/home/opc/ctn-bootstrap"
HOST_MARKER = re.compile(rb"(?m)^CTN_ANALYZER_HOST_KEY ([A-Za-z0-9+/=]{40,4096})[ \t\r]*$")
SECRET_FIELDS = {
    "ADB_ADMIN_PASSWORD": "autonomous_database_admin_password",
    "ADB_WALLET_PASSWORD": "autonomous_database_wallet_password",
    "APPLICATION_PASSWORD": "autonomous_database_developer_password",
}


class BootstrapError(RuntimeError):
    pass


def root_resource(state, kind, name):
    matches = [
        resource["instances"][0]["attributes"]
        for resource in state["resources"]
        if resource.get("mode") == "managed" and not resource.get("module")
        and resource.get("type") == kind and resource.get("name") == name
        and len(resource.get("instances", [])) == 1
    ]
    if len(matches) != 1:
        raise BootstrapError("The deployment state did not identify a unique VM and SSH key.")
    return matches[0]


def deployment_vm(client, context):
    outputs = context["terraform_outputs"]
    stacks = oci.pagination.list_call_get_all_results(
        client.list_stacks, compartment_id=context["compartment"]["id"], lifecycle_state="ACTIVE"
    ).data
    expected = {"project": "cloudtechnext-launchpad", "catalog_item": "select-ai-analyzer",
                "deployment": context["deployment_id"]}
    matches = [
        stack for stack in stacks
        if all((stack.freeform_tags or {}).get(k) == v for k, v in expected.items())
    ]
    if len(matches) != 1:
        raise BootstrapError("Resource Manager did not identify a unique stack for this deployment.")
    state = json.loads(client.get_stack_tf_state(matches[0].id).data.content)
    vm = root_resource(state, "oci_core_instance", "linux_instance")
    key = root_resource(state, "tls_private_key", "instance_ssh")
    host = str(ipaddress.IPv4Address(vm["public_ip"]))
    instance_id = outputs["instance_id"]
    if (not instance_id.startswith("ocid1.instance.") or instance_id != vm["id"]
            or urlsplit(outputs["application_url"]).hostname != host):
        raise BootstrapError("The Resource Manager state does not match this deployment's VM outputs.")
    return instance_id, host, key["private_key_pem"], key["public_key_openssh"]


def wait_for_state(fetch, identifier, success, pending, timeout):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status = fetch(identifier).data.lifecycle_state
        if status == success:
            return
        if status not in pending:
            break
        time.sleep(3)
    raise BootstrapError("OCI could not complete the console verification for this VM.")


def host_pins(history):
    pins = []
    for encoded in HOST_MARKER.findall(history):
        try:
            key = base64.b64decode(encoded, validate=True)
        except binascii.Error:
            continue
        pin = base64.b64encode(hashlib.sha256(key).digest()).decode("ascii")
        if pin not in pins:
            pins.append(pin)
    if not pins or len(pins) > 8:
        raise BootstrapError("OCI console did not provide a valid SSH host identity for this VM.")
    return pins


def authenticated_host_pins(client, compartment, instance_id, client_public_key):
    connections = oci.pagination.list_call_get_all_results(
        client.list_instance_console_connections, compartment, instance_id=instance_id
    ).data
    existing = next((c for c in connections if c.lifecycle_state in {"ACTIVE", "CREATING"}), None)
    owned_connection = None
    history_id = None
    try:
        if existing is None:
            existing = client.create_instance_console_connection(CreateInstanceConsoleConnectionDetails(
                instance_id=instance_id, public_key=client_public_key.strip(),
            )).data
            owned_connection = existing.id
        wait_for_state(client.get_instance_console_connection, existing.id, "ACTIVE", {"CREATING"}, 90)
        capture = client.capture_console_history(CaptureConsoleHistoryDetails(
            instance_id=instance_id, display_name="Select AI Analyzer host verification",
        )).data
        history_id = capture.id
        wait_for_state(client.get_console_history, history_id, "SUCCEEDED", {"REQUESTED", "GETTING-HISTORY"}, 90)
        return host_pins(client.get_console_history_content(history_id).data.content)
    finally:
        if history_id:
            with suppress(oci.exceptions.ServiceError):
                client.delete_console_history(history_id)
        if owned_connection:
            with suppress(oci.exceptions.ServiceError):
                client.delete_instance_console_connection(owned_connection)


def transfer(host, key_path, pin, name, payload=None):
    command = [
        "curl", "--disable", "--silent", "--show-error", "--noproxy", "*", "--proto", "=sftp", "--connect-timeout", "10",
        "--max-time", "30", "--user", "opc:", "--key", str(key_path), "--hostpubsha256", pin,
    ]
    if payload is not None:
        command += [
            "--upload-file", "-", "--quote", f"-chmod 0600 {INBOX}/payload.part",
            "--quote", f"-rename {INBOX}/payload.part {INBOX}/payload.json",
        ]
    command.append(f"sftp://{host}{INBOX}/{name}")
    return subprocess.run(command, input=payload, capture_output=True, timeout=35, check=False)


def status(result):
    if result.returncode != 0:
        return None
    value = json.loads(result.stdout)
    if not isinstance(value, dict) or value.get("state") not in {"succeeded", "failed"}:
        raise BootstrapError("The VM returned an invalid bootstrap status.")
    return value["state"]


def provision(host, key_path, pins, payload):
    for pin in pins:
        receipt = transfer(host, key_path, pin, "status.json")
        if receipt.returncode in {0, 78}:
            break
        if receipt.returncode != 60:
            # libcurl builds can report host verification as a protocol failure.
            if receipt.returncode != 79 or b"sha256" not in receipt.stderr.lower():
                raise BootstrapError("Could not connect to the VM with the deployment SSH key.")
    else:
        raise BootstrapError("The SSH host did not match the identity verified through OCI.")
    existing = status(receipt)
    if existing == "succeeded":
        return
    if existing == "failed":
        raise BootstrapError("VM setup already failed; inspect its select-ai-analyzer-bootstrap journal.")
    result = transfer(host, key_path, pin, "payload.part", payload)
    if result.returncode:
        raise BootstrapError("Verified SFTP could not deliver the private application setup payload.")
    deadline = time.monotonic() + 1200
    while time.monotonic() < deadline:
        receipt = transfer(host, key_path, pin, "status.json")
        state = status(receipt)
        if state == "succeeded":
            return
        if state == "failed":
            raise BootstrapError("VM setup failed; inspect its select-ai-analyzer-bootstrap journal.")
        if receipt.returncode not in {7, 28, 78}:
            raise BootstrapError("Could not read application setup status over verified SFTP.")
        time.sleep(5)
    raise BootstrapError("Timed out waiting for the VM to verify application login.")


def bootstrap_payload(context, private_inputs, config_path, key_path, wallet_path):
    inputs = context["inputs"]
    outputs = context["terraform_outputs"]
    demo_schemas = ""
    if inputs["autonomous_database_mode"] == "new":
        demos = inputs["select_ai_grant_schemas"].split(",")
        if len(demos) != len(set(demos)) or not set(demos) <= {"SH_DEMO", "FLEXCUBE_DEMO"}:
            raise BootstrapError("The requested demo schemas are invalid.")
        demo_schemas = ",".join(demos)
    return json.dumps({
        "config": config_path.read_text(encoding="utf-8"),
        "key": key_path.read_text(encoding="utf-8"),
        "wallet_b64": base64.b64encode(wallet_path.read_bytes()).decode("ascii"),
        "region": context["region"],
        "compartment_id": context["compartment"]["id"],
        "namespace": outputs["objectstorage_namespace"],
        "bucket_name": outputs["bucket_name"],
        "inputs": {
            **{target: private_inputs[source] for target, source in SECRET_FIELDS.items()},
            "APP_AGENT_PASSWORD": f"Aa1{secrets.token_hex(11)}",
            "APPLICATION_USERNAME": inputs["application_username"],
            "DEMO_SCHEMAS": demo_schemas,
            "GENERATIVE_MODEL": inputs["select_ai_model"],
        },
    }, separators=(",", ":")).encode("utf-8")


def run(environment):
    config_path = Path(environment["DEPLOY_STUDIO_OCI_CONFIG"])
    key_path = Path(environment["DEPLOY_STUDIO_OCI_KEY"])
    wallet_path = Path(environment["DEPLOY_STUDIO_ADB_WALLET"])
    context = json.loads(Path(environment["DEPLOY_STUDIO_CONTEXT"]).read_text(encoding="utf-8"))
    private_inputs = json.loads(Path(environment["DEPLOY_STUDIO_SECRETS"]).read_text(encoding="utf-8"))["inputs"]
    config = oci.config.from_file(str(config_path))
    config.update(key_file=str(key_path), region=context["region"])
    instance_id, host, client_key, public_key = deployment_vm(oci.resource_manager.ResourceManagerClient(config), context)
    pins = authenticated_host_pins(oci.core.ComputeClient(config), context["compartment"]["id"], instance_id, public_key)
    payload = bootstrap_payload(context, private_inputs, config_path, key_path, wallet_path)
    with tempfile.TemporaryDirectory(prefix="analyzer-sftp-") as directory:
        client_key_path = Path(directory) / "identity.pem"
        client_key_path.write_text(client_key, encoding="ascii")
        client_key_path.chmod(0o600)
        provision(host, client_key_path, pins, payload)


def main():
    output = Path(os.environ["DEPLOY_STUDIO_OUTPUT"])
    try:
        run(os.environ)
        level, message, exit_code = "success", "Select AI Analyzer setup and application login verified.", 0
    except BootstrapError as exc:
        level, message, exit_code = "error", str(exc), 1
    except oci.exceptions.ServiceError as exc:
        level, message, exit_code = "error", f"OCI rejected VM bootstrap access (HTTP {int(exc.status)}). Check Resource Manager and console permissions.", 1
    except (OSError, KeyError, ValueError, subprocess.SubprocessError, oci.exceptions.InvalidConfig):
        level, message, exit_code = "error", "The application bootstrap inputs or verified transport could not be read.", 1
    output.write_text(json.dumps({"events": [{"level": level, "message": message}]}), encoding="utf-8")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())

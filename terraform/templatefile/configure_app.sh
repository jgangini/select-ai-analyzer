#!/bin/bash
set -euo pipefail

BOOTSTRAP_DIR="/home/opc/ctn-bootstrap"
RUNTIME_DIR="/opt/cloudtechnext/select-ai-analyzer/runtime"
WALLET_DIR="$RUNTIME_DIR/wallet"
KEYS_DIR="$RUNTIME_DIR/keys"
DATA_DIR="$RUNTIME_DIR/data"
LOGS_DIR="$RUNTIME_DIR/logs"

umask 077
PAYLOAD="$BOOTSTRAP_DIR/payload.json"
STATUS="$BOOTSTRAP_DIR/status.json"

finish() {
  local exit_code="$?"
  trap - EXIT
  rm -f -- "$PAYLOAD"
  local state=failed
  if [ "$exit_code" -eq 0 ]; then
    state=succeeded
  fi
  local status_tmp
  status_tmp=$(mktemp "$BOOTSTRAP_DIR/status.XXXXXXXX")
  printf '{"state":"%s"}\n' "$state" >"$status_tmp"
  mv -f -- "$status_tmp" "$STATUS"
  exit "$exit_code"
}
trap finish EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
rm -f -- "$STATUS"

sudo mkdir -p "$WALLET_DIR" "$KEYS_DIR" "$DATA_DIR" "$LOGS_DIR"
sudo chown -R opc:opc "$RUNTIME_DIR"
chmod 700 "$WALLET_DIR" "$KEYS_DIR"
sudo rm -f /var/local/select-ai-analyzer-setup.done

python3 - <<'PY'
import base64
import configparser
import io
import json
import os
import re
import stat
import subprocess
import time
import zipfile
from pathlib import Path

bootstrap_dir = Path("/home/opc/ctn-bootstrap")
runtime_dir = Path("/opt/cloudtechnext/select-ai-analyzer/runtime")
wallet_dir = runtime_dir / "wallet"
api_base = "http://127.0.0.1:8012/api"
app_name = "select-ai-analyzer"

payload_path = bootstrap_dir / "payload.json"
fd = os.open(payload_path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
with os.fdopen(fd, encoding="utf-8") as stream:
    metadata = os.fstat(stream.fileno())
    if (
        not stat.S_ISREG(metadata.st_mode)
        or metadata.st_uid != os.getuid()
        or stat.S_IMODE(metadata.st_mode) != 0o600
        or metadata.st_size > 2 * 1024 * 1024
    ):
        raise RuntimeError("Bootstrap payload must be a private, regular file")
    payload_path.unlink()
    payload = json.load(stream)

required_strings = ("config", "key", "wallet_b64", "region", "compartment_id", "namespace", "bucket_name")
if not isinstance(payload, dict) or any(not isinstance(payload.get(field), str) for field in required_strings):
    raise RuntimeError("Bootstrap payload has invalid connection fields")
secrets = payload.get("inputs")
required_inputs = (
    "ADB_ADMIN_PASSWORD", "ADB_WALLET_PASSWORD", "APP_AGENT_PASSWORD",
    "APPLICATION_USERNAME", "APPLICATION_PASSWORD", "DEMO_SCHEMAS", "GENERATIVE_MODEL",
)
if not isinstance(secrets, dict) or any(not isinstance(secrets.get(field), str) for field in required_inputs):
    raise RuntimeError("Bootstrap payload has invalid application inputs")

config = configparser.ConfigParser(interpolation=None)
config.read_string(payload["config"])
oci_config = config.defaults()
runtime_key = runtime_dir / "keys" / "key.pem"
key_fd = os.open(runtime_key, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
with os.fdopen(key_fd, "w", encoding="utf-8") as stream:
    os.fchmod(stream.fileno(), 0o600)
    stream.write(payload["key"])

wallet_bytes = base64.b64decode(payload["wallet_b64"], validate=True)
with zipfile.ZipFile(io.BytesIO(wallet_bytes)) as archive:
    archive.extractall(wallet_dir)


def docker_exec(arguments, body, timeout):
    return subprocess.run(
        ["sudo", "docker", "exec", "-i", app_name, *arguments],
        input=body,
        capture_output=True,
        timeout=timeout,
    )


def oracle_error_codes(output):
    codes = dict.fromkeys(re.findall(rb"\b(?:ORA|DPI|DPY)-[0-9]{4,5}\b", output))
    return ", ".join(code.decode("ascii") for code in codes)


def request_json(method, path, payload=None, attempts=1, timeout=120):
    command = [
        "curl", "--disable", "--silent", "--show-error", "--fail-with-body",
        "--max-time", str(timeout), "--request", method, "--write-out", "\n%{http_code}",
    ]
    body = b""
    if payload is not None:
        command.extend(["--header", "Content-Type: application/json", "--data-binary", "@-"])
        body = json.dumps(payload).encode("utf-8")
    command.append(f"{api_base}{path}")

    for attempt in range(attempts):
        try:
            result = docker_exec(command, body, timeout + 10)
        except subprocess.TimeoutExpired:
            last_error = "private API request timed out"
        else:
            response, _, status = result.stdout.rpartition(b"\n")
            if result.returncode == 0:
                try:
                    data = json.loads(response) if response else {}
                    if isinstance(data, dict):
                        return data
                except ValueError:
                    pass
                last_error = "private API returned invalid JSON"
            else:
                last_error = f"curl exit status {result.returncode}"
                if status.isdigit() and status != b"000":
                    last_error += f", HTTP {status.decode('ascii')}"
                codes = oracle_error_codes(response)
                if codes:
                    last_error += f", {codes}"
        if attempt + 1 < attempts:
            time.sleep(5)
    raise RuntimeError(f"{method} {path} failed: {last_error}")


def create_app_agent_user(dsn: str) -> str:
    script = r'''
import json
import sys

import oracledb

inputs = json.load(sys.stdin)
app_agent_password = inputs["APP_AGENT_PASSWORD"]
if any(ch in app_agent_password for ch in ['"', "\n", "\r"]):
    raise ValueError("APP_AGENT password contains unsupported characters for Oracle quoted password DDL")

def next_app_agent_username(cursor):
    cursor.execute("""
        SELECT USERNAME
          FROM ALL_USERS
         WHERE USERNAME = 'APP_AGENT'
            OR REGEXP_LIKE(USERNAME, '^APP_AGENT_[0-9]+$')
    """)
    existing_users = {row[0] for row in cursor.fetchall()}
    if "APP_AGENT" not in existing_users:
        return "APP_AGENT"
    for index in range(1, 100):
        candidate = f"APP_AGENT_{index}"
        if candidate not in existing_users:
            return candidate
    raise RuntimeError("No available APP_AGENT schema suffix found")

connection = oracledb.connect(
    user="ADMIN",
    password=inputs["ADB_ADMIN_PASSWORD"],
    dsn=inputs["ADB_DSN"],
    config_dir="/app/apps/backend/wallet",
    wallet_location="/app/apps/backend/wallet",
    wallet_password=inputs["ADB_WALLET_PASSWORD"],
)
cursor = connection.cursor()
try:
    app_agent_user = next_app_agent_username(cursor)
    cursor.execute(
        f'CREATE USER {app_agent_user} IDENTIFIED BY "{app_agent_password}" DEFAULT TABLESPACE USERS QUOTA UNLIMITED ON USERS'
    )
    for statement in [
        f"GRANT CREATE SESSION TO {app_agent_user}",
        f"GRANT CREATE TABLE TO {app_agent_user}",
        f"GRANT CREATE VIEW TO {app_agent_user}",
        f"GRANT CREATE PROCEDURE TO {app_agent_user}",
        f"GRANT CREATE SEQUENCE TO {app_agent_user}",
        f"GRANT CREATE TRIGGER TO {app_agent_user}",
        f"GRANT CREATE SYNONYM TO {app_agent_user}",
        f"GRANT CREATE DATABASE LINK TO {app_agent_user}",
        f"GRANT CREATE USER TO {app_agent_user}",
        f"GRANT DROP USER TO {app_agent_user}",
        f"GRANT CREATE ANY TABLE TO {app_agent_user}",
        f"GRANT DROP ANY TABLE TO {app_agent_user}",
        f"GRANT INSERT ANY TABLE TO {app_agent_user}",
        f"GRANT SELECT ANY TABLE TO {app_agent_user}",
        f"GRANT EXECUTE ON DBMS_VECTOR TO {app_agent_user}",
        f"GRANT EXECUTE ON DBMS_CLOUD TO {app_agent_user}",
        f"GRANT EXECUTE ON DBMS_CLOUD_PIPELINE TO {app_agent_user}",
        f"GRANT EXECUTE ON DBMS_CLOUD_AI TO {app_agent_user}",
        f"GRANT EXECUTE ON DBMS_CLOUD_AI_AGENT TO {app_agent_user}",
    ]:
        cursor.execute(statement)
    connection.commit()
    print(app_agent_user)
finally:
    cursor.close()
    connection.close()
'''
    payload = {
        "ADB_ADMIN_PASSWORD": secrets["ADB_ADMIN_PASSWORD"],
        "ADB_WALLET_PASSWORD": secrets["ADB_WALLET_PASSWORD"],
        "APP_AGENT_PASSWORD": secrets["APP_AGENT_PASSWORD"],
        "ADB_DSN": dsn,
    }
    result = docker_exec(["python", "-c", script], json.dumps(payload).encode("utf-8"), 120)
    if result.returncode:
        codes = oracle_error_codes(result.stderr)
        detail = f": {codes}" if codes else ""
        raise RuntimeError(f"APP_AGENT creation failed{detail}")
    username = result.stdout.decode("utf-8").strip()
    if not re.fullmatch(r"APP_AGENT(?:_[1-9][0-9]?)?", username):
        raise RuntimeError("APP_AGENT creation returned an unexpected schema name")
    return username


request_json("GET", "/health", attempts=120, timeout=5)

dsn_result = request_json("POST", "/setup/list-wallet-dsns", {"wallet_path": "__SERVER_DEFAULT_WALLET__"}, attempts=6)
dsn = dsn_result.get("selected_dsn") or (dsn_result.get("dsns") or [""])[0]
if not dsn:
    raise RuntimeError("No wallet DSN alias was detected from tnsnames.ora")

app_agent_user = create_app_agent_user(dsn)

db_payload = {
    "wallet_path": "__SERVER_DEFAULT_WALLET__",
    "wallet_password": secrets["ADB_WALLET_PASSWORD"],
    "user": app_agent_user,
    "password": secrets["APP_AGENT_PASSWORD"],
    "dsn": dsn,
}
request_json("POST", "/setup/test-db", db_payload, attempts=12)
request_json("POST", "/setup/save-db-runtime", db_payload, attempts=3)
request_json(
    "POST",
    "/setup/installation",
    {
        "admin_email": secrets["APPLICATION_USERNAME"],
        "admin_password": secrets["APPLICATION_PASSWORD"],
        "wallet_path": "__SERVER_DEFAULT_WALLET__",
        "wallet_password": secrets["ADB_WALLET_PASSWORD"],
        "user": app_agent_user,
        "password": secrets["APP_AGENT_PASSWORD"],
        "dsn": dsn,
    },
    attempts=3,
)

oci_payload = {
    "compartment_id": payload["compartment_id"],
    "user": oci_config.get("user", ""),
    "fingerprint": oci_config.get("fingerprint", ""),
    "tenancy": oci_config.get("tenancy", ""),
    "region": payload["region"],
    "key_file": "/app/apps/backend/keys/key.pem",
    "namespace": payload["namespace"],
    "bucket_name": payload["bucket_name"],
}
request_json("POST", "/setup/test-oci", oci_payload, attempts=6)
request_json("POST", "/setup/save-oci-config", oci_payload, attempts=3)
request_json(
    "POST",
    "/setup/test-object-storage",
    {"namespace": payload["namespace"], "bucket_name": payload["bucket_name"]},
    attempts=6,
)

genai_payload = {
    "inference_url": f"https://inference.generativeai.{oci_payload['region']}.oci.oraclecloud.com",
    "generative_model": secrets["GENERATIVE_MODEL"],
}
request_json("POST", "/setup/test-generative-ai", genai_payload, attempts=3)
request_json("POST", "/setup/save-generative-ai-config", genai_payload, attempts=3)
request_json("POST", "/setup/complete", attempts=3)

demo_schemas = secrets.get("DEMO_SCHEMAS", "")
if demo_schemas:
    demo_load = docker_exec(
        ["python", "/app/scripts/load_demo_data.py", "--schemas", demo_schemas, "--admin-password-stdin"],
        secrets["ADB_ADMIN_PASSWORD"].encode("utf-8"),
        timeout=None,
    )
    if demo_load.returncode:
        codes = oracle_error_codes(demo_load.stderr)
        detail = f": {codes}" if codes else ""
        raise RuntimeError(f"Demo data load failed{detail}")
    print(demo_load.stdout.decode("utf-8").rstrip())

setup_status = request_json("GET", "/setup/check")
if setup_status.get("completed") is not True:
    raise RuntimeError("Select AI Analyzer did not report completed setup")

login = request_json(
    "POST",
    "/auth/login",
    {"username": secrets["APPLICATION_USERNAME"], "password": secrets["APPLICATION_PASSWORD"]},
    attempts=3,
)
if not login.get("access_token"):
    raise RuntimeError("Select AI Analyzer login did not return an access token")

summary = {
    "application_url": "http://[PUBLIC-IP]",
    "login_user": secrets["APPLICATION_USERNAME"],
    "database_user": app_agent_user,
    "wallet_dsn": dsn,
    "bucket_name": payload["bucket_name"],
    "namespace": payload["namespace"],
    "demo_schemas": [schema for schema in demo_schemas.split(",") if schema],
    "setup": "automated",
    "login_verified": True,
}
(bootstrap_dir / "automation-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
PY

cat >/home/opc/startup_info.txt <<'INFO'
Select AI Analyzer is ready.

Application URL: http://[PUBLIC-IP]
SSH user: opc
Container: select-ai-analyzer
Setup flow: automated by CloudTechNext after Resource Manager Apply.
Persistent runtime: /opt/cloudtechnext/select-ai-analyzer/runtime

Useful commands:
  docker ps
  docker logs select-ai-analyzer
  sudo journalctl -u docker --no-pager
INFO

chown opc:opc /home/opc/startup_info.txt
sudo mkdir -p /var/local
sudo touch /var/local/select-ai-analyzer-setup.done
sudo chown opc:opc /var/local/select-ai-analyzer-setup.done
cat /home/opc/startup_info.txt

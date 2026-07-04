#!/bin/bash
set -euo pipefail

BOOTSTRAP_DIR="/home/opc/ctn-bootstrap"
APP_NAME="select-ai-analyzer"
RUNTIME_DIR="/opt/cloudtechnext/select-ai-analyzer/runtime"
WALLET_DIR="$RUNTIME_DIR/wallet"
KEYS_DIR="$RUNTIME_DIR/keys"
DATA_DIR="$RUNTIME_DIR/data"
LOGS_DIR="$RUNTIME_DIR/logs"
APP_URL="http://127.0.0.1"

mkdir -p "$BOOTSTRAP_DIR"
sudo mkdir -p "$WALLET_DIR" "$KEYS_DIR" "$DATA_DIR" "$LOGS_DIR"
sudo chown -R opc:opc "$RUNTIME_DIR"
chmod 700 "$BOOTSTRAP_DIR" "$KEYS_DIR"

cat >"$BOOTSTRAP_DIR/adb_wallet.b64" <<'CTN_WALLET'
${adb_wallet_b64}
CTN_WALLET

cat >"$BOOTSTRAP_DIR/secrets.env" <<'CTN_SECRETS'
ADB_ADMIN_PASSWORD=${adb_admin_password}
ADB_WALLET_PASSWORD=${adb_wallet_password}
APP_AGENT_PASSWORD=${app_agent_password}
APPLICATION_USERNAME=${application_username}
APPLICATION_PASSWORD=${application_password}
CTN_SECRETS
chmod 600 "$BOOTSTRAP_DIR/secrets.env"

cp "$BOOTSTRAP_DIR/key.pem" "$KEYS_DIR/key.pem"
cp "$BOOTSTRAP_DIR/config" "$KEYS_DIR/source-config"
chmod 600 "$KEYS_DIR/key.pem" "$KEYS_DIR/source-config"

python3 - <<'PY'
import base64
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

bootstrap_dir = Path("/home/opc/ctn-bootstrap")
runtime_dir = Path("/opt/cloudtechnext/select-ai-analyzer/runtime")
wallet_dir = runtime_dir / "wallet"
keys_dir = runtime_dir / "keys"
api_base = "http://127.0.0.1/api"
app_name = "select-ai-analyzer"

wallet_bytes = base64.b64decode((bootstrap_dir / "adb_wallet.b64").read_text(encoding="utf-8").strip())
wallet_zip = bootstrap_dir / "adb_wallet.zip"
wallet_zip.write_bytes(wallet_bytes)
with zipfile.ZipFile(wallet_zip, "r") as archive:
    archive.extractall(wallet_dir)

secrets = {}
for line in (bootstrap_dir / "secrets.env").read_text(encoding="utf-8").splitlines():
    if not line.strip() or "=" not in line:
        continue
    key, value = line.split("=", 1)
    secrets[key.strip()] = value.strip()

oci_config = {}
for line in (keys_dir / "source-config").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or line.startswith("[") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    oci_config[key.strip()] = value.strip()

def request_json(method, path, payload=None, attempts=1):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"} if payload is not None else {}
    last_error = None
    for _ in range(attempts):
        request = urllib.request.Request(f"{api_base}{path}", data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            last_error = f"{exc.code}: {exc.read().decode('utf-8', errors='replace')}"
        except Exception as exc:
            last_error = str(exc)
        time.sleep(5)
    raise RuntimeError(f"{method} {path} failed: {last_error}")

def wait_for_api() -> None:
    for _ in range(120):
        try:
            request_json("GET", "/health")
            return
        except Exception:
            time.sleep(5)
    raise TimeoutError("Select AI Analyzer API did not become healthy in time")

def create_app_agent_user(dsn: str) -> str:
    script = r'''
import os
import oracledb

app_agent_password = os.environ["APP_AGENT_PASSWORD"]
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
    password=os.environ["ADB_ADMIN_PASSWORD"],
    dsn=os.environ["ADB_DSN"],
    config_dir="/app/apps/backend/wallet",
    wallet_location="/app/apps/backend/wallet",
    wallet_password=os.environ["ADB_WALLET_PASSWORD"],
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
    result = subprocess.run(
        [
            "sudo",
            "docker",
            "exec",
            "-i",
            "-e",
            f"ADB_ADMIN_PASSWORD={secrets['ADB_ADMIN_PASSWORD']}",
            "-e",
            f"ADB_WALLET_PASSWORD={secrets['ADB_WALLET_PASSWORD']}",
            "-e",
            f"APP_AGENT_PASSWORD={secrets['APP_AGENT_PASSWORD']}",
            "-e",
            f"ADB_DSN={dsn}",
            app_name,
            "python",
            "-",
        ],
        input=script,
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout.strip().splitlines()[-1]

wait_for_api()

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
    "compartment_id": "${compartment_ocid}",
    "user": oci_config.get("user", ""),
    "fingerprint": oci_config.get("fingerprint", ""),
    "tenancy": oci_config.get("tenancy", ""),
    "region": oci_config.get("region") or "${region}",
    "key_file": "/app/apps/backend/keys/key.pem",
    "namespace": "${objectstorage_namespace}",
    "bucket_name": "${bucket_name}",
}
request_json("POST", "/setup/test-oci", oci_payload, attempts=6)
request_json("POST", "/setup/save-oci-config", oci_payload, attempts=3)
request_json(
    "POST",
    "/setup/test-object-storage",
    {"namespace": "${objectstorage_namespace}", "bucket_name": "${bucket_name}"},
    attempts=6,
)
request_json("POST", "/setup/save-oci-config", oci_payload, attempts=3)

genai_payload = {
    "inference_url": f"https://inference.generativeai.{oci_payload['region']}.oci.oraclecloud.com",
    "generative_model": "google.gemini-2.5-flash",
}
request_json("POST", "/setup/test-generative-ai", genai_payload, attempts=3)
request_json("POST", "/setup/save-generative-ai-config", genai_payload, attempts=3)
request_json("POST", "/setup/complete", attempts=3)

summary = {
    "application_url": "http://[PUBLIC-IP]",
    "login_user": secrets["APPLICATION_USERNAME"],
    "database_user": app_agent_user,
    "wallet_dsn": dsn,
    "bucket_name": "${bucket_name}",
    "namespace": "${objectstorage_namespace}",
    "setup": "automated",
}
(bootstrap_dir / "automation-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
PY

cat >/home/opc/startup_info.txt <<'INFO'
Select AI Analyzer is ready.

Application URL: http://[PUBLIC-IP]
Application login user: ${application_username}
SSH user: opc
Container: select-ai-analyzer
Setup flow: automated by CloudTechNext during Resource Manager apply.
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

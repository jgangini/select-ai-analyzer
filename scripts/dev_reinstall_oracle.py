from __future__ import annotations

import argparse
import configparser
import os
from pathlib import Path
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from apps.backend.app.core.config import get_settings
from apps.backend.app.core.database import DatabaseManager
from apps.backend.app.services.bootstrap_service import SetupService
from scripts.load_source_seed import load_source_seed


APP_SCHEMA = "APP_AGENT"
DATA_SCHEMA = "APP_AGENT_DATA"
DEFAULT_PROFILE = "APP_AGENT_ANALYTICS"
DEFAULT_ADMIN_EMAIL = "joel.ganggini@oracle.com"
DEFAULT_GENERATIVE_MODEL = "google.gemini-2.5-flash"
DEFAULT_INFERENCE_URL = "https://inference.generativeai.us-chicago-1.oci.oraclecloud.com"


def _rows_as_config(cursor) -> dict[str, str]:
    try:
        cursor.execute(
            """
            SELECT config_key, DBMS_LOB.SUBSTR(config_value, 4000, 1)
            FROM config
            WHERE config_key IN (
                'oci.compartment_id',
                'oci.user',
                'oci.fingerprint',
                'oci.tenancy',
                'oci.region',
                'oci.key_file',
                'oci.namespace',
                'oci.bucket_name',
                'genai.inference_url',
                'genai.model'
            )
            """
        )
        return {str(key): str(value or "").strip() for key, value in cursor.fetchall()}
    except Exception:
        return {}


def _capture_runtime_config(db_manager: DatabaseManager) -> dict[str, str]:
    conn = db_manager.get_connection()
    cursor = conn.cursor()
    try:
        return _rows_as_config(cursor)
    finally:
        cursor.close()
        conn.close()


def _non_empty_values(values: dict[str, str]) -> dict[str, str]:
    return {key: value for key, value in values.items() if str(value or "").strip()}


def _local_oci_config(settings) -> dict[str, str]:
    config_path = settings.oci_config_file
    if not config_path.exists():
        return {}

    parser = configparser.ConfigParser()
    parser.read(config_path, encoding="utf-8")
    if "DEFAULT" not in parser:
        return {}

    profile = parser["DEFAULT"]
    key_file = profile.get("key_file", "").strip()
    if key_file and not Path(key_file).is_absolute():
        key_file = str((config_path.parent / key_file).resolve())
    return _non_empty_values(
        {
            "oci.user": profile.get("user", "").strip(),
            "oci.fingerprint": profile.get("fingerprint", "").strip(),
            "oci.tenancy": profile.get("tenancy", "").strip(),
            "oci.region": profile.get("region", "").strip(),
            "oci.key_file": key_file,
        }
    )


def _env_runtime_config() -> dict[str, str]:
    return _non_empty_values(
        {
            "oci.compartment_id": os.environ.get("OCI_COMPARTMENT_ID", ""),
            "oci.namespace": os.environ.get("OCI_NAMESPACE", ""),
            "oci.bucket_name": os.environ.get("OCI_BUCKET_NAME", ""),
            "genai.inference_url": os.environ.get("GENAI_INFERENCE_URL", ""),
            "genai.model": os.environ.get("GENAI_MODEL", ""),
        }
    )


def _runtime_config_with_fallbacks(db_manager: DatabaseManager, settings) -> dict[str, str]:
    merged = _local_oci_config(settings)
    merged.update(_non_empty_values(_capture_runtime_config(db_manager)))
    merged.update(_env_runtime_config())
    return merged


def _drop_retired_select_ai_artifacts(cursor, profile_names: list[str]) -> None:
    """Best-effort cleanup for artifacts from the retired orchestration flow."""
    for profile_name in profile_names:
        cursor.execute(
            """
            DECLARE
                l_profile VARCHAR2(128) := :profile_name;
                l_agent_pkg VARCHAR2(128) := 'DBMS_CLOUD_AI_' || 'AGENT';
                l_pipeline_pkg VARCHAR2(128) := 'DBMS_CLOUD_' || 'PIPELINE';
            BEGIN
                BEGIN
                    EXECUTE IMMEDIATE 'BEGIN ' || l_agent_pkg || '.DROP_TEAM(team_name => :name, force => TRUE); END;'
                        USING l_profile || '_TEAM';
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
                BEGIN
                    EXECUTE IMMEDIATE 'BEGIN ' || l_agent_pkg || '.DROP_AGENT(agent_name => :name, force => TRUE); END;'
                        USING l_profile || '_AGENT';
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
                BEGIN
                    EXECUTE IMMEDIATE 'BEGIN ' || l_agent_pkg || '.DROP_TASK(task_name => :name, force => TRUE); END;'
                        USING l_profile || '_ANSWER_TASK';
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
                BEGIN
                    EXECUTE IMMEDIATE 'BEGIN ' || l_agent_pkg || '.DROP_TASK(task_name => :name, force => TRUE); END;'
                        USING l_profile || '_CHART_TASK';
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
                BEGIN
                    EXECUTE IMMEDIATE 'BEGIN ' || l_agent_pkg || '.DROP_TOOL(tool_name => :name, force => TRUE); END;'
                        USING l_profile || '_SQL_TOOL';
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
                BEGIN
                    EXECUTE IMMEDIATE 'BEGIN ' || l_pipeline_pkg || '.STOP_PIPELINE(pipeline_name => :name, force => TRUE); END;'
                        USING l_profile || '_OBJECT_LIST_' || 'VECINDEX$VECPIPELINE';
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
                BEGIN
                    EXECUTE IMMEDIATE 'BEGIN ' || l_pipeline_pkg || '.DROP_PIPELINE(pipeline_name => :name, force => TRUE); END;'
                        USING l_profile || '_OBJECT_LIST_' || 'VECINDEX$VECPIPELINE';
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
            END;
            """,
            profile_name=profile_name,
        )


def _drop_select_ai_profiles(cursor, profile_names: list[str]) -> None:
    for profile_name in profile_names:
        cursor.execute(
            """
            DECLARE
                l_profile VARCHAR2(128) := :profile_name;
            BEGIN
                BEGIN
                    DBMS_CLOUD_AI.DROP_PROFILE(profile_name => l_profile, force => TRUE);
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
            END;
            """,
            profile_name=profile_name,
        )


def _existing_profiles(cursor) -> list[str]:
    profile_names = {DEFAULT_PROFILE}
    try:
        cursor.execute("SELECT profile_name FROM select_ai_profiles")
        profile_names.update(str(row[0]) for row in cursor.fetchall() if row and row[0])
    except Exception:
        pass
    return sorted(profile_names)


def _drop_data_schema(cursor) -> None:
    cursor.execute("SELECT COUNT(*) FROM all_users WHERE username = :schema_name", schema_name=DATA_SCHEMA)
    if int(cursor.fetchone()[0] or 0) > 0:
        cursor.execute(f"DROP USER {DATA_SCHEMA} CASCADE")


def _object_names(cursor, object_type: str) -> list[str]:
    cursor.execute(
        """
        SELECT object_name
        FROM user_objects
        WHERE object_type = :object_type
          AND object_name NOT LIKE 'BIN$%'
          AND object_name NOT LIKE 'VECTOR$%'
          AND object_name NOT LIKE 'SYS_%'
          AND object_name NOT LIKE 'DR$%'
        ORDER BY object_name
        """,
        object_type=object_type,
    )
    return [str(row[0]) for row in cursor.fetchall()]


def _is_ignorable_drop_error(exc: Exception) -> bool:
    message = str(exc)
    return any(code in message for code in ("ORA-00942", "ORA-04043", "ORA-01418"))


def _drop_current_schema_objects(cursor) -> dict[str, int]:
    drop_plan = [
        ("VIEW", "DROP VIEW {name}"),
        ("MATERIALIZED VIEW", "DROP MATERIALIZED VIEW {name}"),
        ("TABLE", "DROP TABLE {name} CASCADE CONSTRAINTS PURGE"),
        ("SEQUENCE", "DROP SEQUENCE {name}"),
        ("TRIGGER", "DROP TRIGGER {name}"),
        ("PROCEDURE", "DROP PROCEDURE {name}"),
        ("FUNCTION", "DROP FUNCTION {name}"),
        ("PACKAGE", "DROP PACKAGE {name}"),
        ("TYPE", "DROP TYPE {name} FORCE"),
    ]
    dropped: dict[str, int] = {}
    for object_type, template in drop_plan:
        names = _object_names(cursor, object_type)
        drop_count = 0
        for name in names:
            try:
                cursor.execute(template.format(name=name))
                drop_count += 1
            except Exception as exc:
                if _is_ignorable_drop_error(exc):
                    continue
                raise
        dropped[object_type] = drop_count
    return dropped


def clean_schema(db_manager: DatabaseManager) -> dict[str, Any]:
    conn = db_manager.get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT USER FROM DUAL")
        connected_user = str(cursor.fetchone()[0]).upper()
        if connected_user != APP_SCHEMA:
            raise RuntimeError(f"Refusing to reset schema {connected_user}; expected {APP_SCHEMA}.")

        profile_names = _existing_profiles(cursor)
        _drop_retired_select_ai_artifacts(cursor, profile_names)
        _drop_select_ai_profiles(cursor, profile_names)
        _drop_data_schema(cursor)
        dropped = _drop_current_schema_objects(cursor)
        conn.commit()
        return {"profiles": len(profile_names), "objects": dropped}
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()
        db_manager.close_pool()


def _oci_config_from_saved(saved: dict[str, str]) -> dict[str, str]:
    return {
        "compartment_id": saved.get("oci.compartment_id", ""),
        "user": saved.get("oci.user", ""),
        "fingerprint": saved.get("oci.fingerprint", ""),
        "tenancy": saved.get("oci.tenancy", ""),
        "region": saved.get("oci.region", ""),
        "key_file": saved.get("oci.key_file", ""),
        "namespace": saved.get("oci.namespace", ""),
        "bucket_name": saved.get("oci.bucket_name", "app_agent"),
    }


def _missing_oci_values(config: dict[str, str]) -> list[str]:
    required = ("compartment_id", "user", "fingerprint", "tenancy", "region", "key_file")
    return [key for key in required if not str(config.get(key) or "").strip()]


def _refresh_default_profile(db_manager: DatabaseManager) -> dict[str, str | bool]:
    conn = db_manager.get_connection()
    cursor = conn.cursor()
    try:
        cursor.callproc("SP_SEL_AI_PROFILE", [DEFAULT_PROFILE, 0])
        conn.commit()
        return {"success": True, "error": ""}
    except Exception as exc:
        conn.rollback()
        return {"success": False, "error": str(exc).splitlines()[0][:500]}
    finally:
        cursor.close()
        conn.close()


def reinstall(
    *,
    admin_email: str,
    admin_password: str,
    source_path: Path,
    csv_dir: Path,
    batch_size: int,
    skip_seed: bool,
) -> dict[str, Any]:
    if not admin_password:
        raise RuntimeError("Admin password is required. Pass --admin-password or set APP_ADMIN_PASSWORD.")

    settings = get_settings()
    db_manager = DatabaseManager.get_instance(settings)
    saved_config = _runtime_config_with_fallbacks(db_manager, settings)
    clean_result = clean_schema(db_manager)

    service = SetupService(db_manager)
    install_result = service.execute_setup_scripts()
    if not install_result.get("success"):
        raise RuntimeError(f"Bootstrap failed: {install_result.get('errors')}")

    service.create_admin_user(admin_email, admin_password)

    oci_config = _oci_config_from_saved(saved_config)
    missing_oci = _missing_oci_values(oci_config)
    if not missing_oci:
        service.save_oci_config(oci_config)
    else:
        print(f"OCI_CONFIG_SKIPPED_MISSING={','.join(missing_oci)}")

    generative_model = saved_config.get("genai.model") or DEFAULT_GENERATIVE_MODEL
    inference_url = saved_config.get("genai.inference_url") or DEFAULT_INFERENCE_URL
    service.save_generative_ai_config(
        {
            "inference_url": inference_url,
            "generative_model": generative_model,
        }
    )
    service.complete_setup()

    seed_result = None
    profile_refresh = {"success": False, "error": "seed skipped"}
    if not skip_seed:
        seed_result = load_source_seed(
            source_path=source_path,
            csv_dir=csv_dir,
            batch_size=batch_size,
            refresh_profile=False,
            require_metadata=True,
            apply_metadata_ddl=False,
        )
        profile_refresh = _refresh_default_profile(db_manager) if not missing_oci else {
            "success": False,
            "error": "OCI config incomplete",
        }

    return {
        "clean": clean_result,
        "install": {
            "executed": install_result.get("executed", []),
            "message": install_result.get("message", ""),
        },
        "oci_configured": not missing_oci,
        "genai_model": generative_model,
        "seed": seed_result,
        "profile_refresh": profile_refresh,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Development-only reset of APP_AGENT runtime schema.")
    parser.add_argument("--admin-email", default=os.environ.get("APP_ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL))
    parser.add_argument("--admin-password", default=os.environ.get("APP_ADMIN_PASSWORD", ""))
    parser.add_argument("--source", type=Path, default=ROOT / ".source" / "decoupling_tables_structures.sql")
    parser.add_argument("--csv-dir", type=Path, default=ROOT / ".data" / "csv")
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--skip-seed", action="store_true")
    args = parser.parse_args()

    result = reinstall(
        admin_email=args.admin_email,
        admin_password=args.admin_password,
        source_path=args.source,
        csv_dir=args.csv_dir,
        batch_size=args.batch_size,
        skip_seed=args.skip_seed,
    )
    print(f"CLEANED_PROFILES={result['clean']['profiles']}")
    for object_type, count in result["clean"]["objects"].items():
        if count:
            print(f"DROPPED_{object_type.replace(' ', '_')}={count}")
    print(f"BOOTSTRAP={result['install']['message']}")
    print(f"OCI_CONFIGURED={result['oci_configured']}")
    print(f"GENAI_MODEL={result['genai_model']}")
    if result["seed"]:
        print(f"TABLES_LOADED={result['seed']['tables_loaded']}")
        print(f"ROWS_LOADED={result['seed']['rows_loaded']}")
    print(f"PROFILE_REFRESHED={result['profile_refresh']['success']}")
    if not result["profile_refresh"]["success"]:
        print(f"PROFILE_REFRESH_ERROR={result['profile_refresh']['error']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

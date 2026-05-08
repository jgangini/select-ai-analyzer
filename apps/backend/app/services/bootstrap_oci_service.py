import logging

from apps.backend.app.services.bootstrap_oci_checks import BootstrapOciChecksMixin
from apps.backend.app.services.bootstrap_support import (
    normalize_oci_config_value,
    normalize_oci_config_rows,
    read_private_key_for_db_credential,
    resolve_oci_key_file_path,
    write_oci_cli_config_file,
)

logger = logging.getLogger(__name__)


class BootstrapOciMixin(BootstrapOciChecksMixin):
    @staticmethod
    def _upsert_config_items(cursor, config_items: list[tuple[str, object, str]]) -> None:
        for key, value, category in config_items:
            cursor.execute(
                """
                MERGE INTO config sc
                USING DUAL ON (sc.config_key = :key)
                WHEN MATCHED THEN
                    UPDATE SET sc.config_value = :value, sc.config_updated = SYSDATE
                WHEN NOT MATCHED THEN
                    INSERT (config_key, config_value, config_type, config_category)
                    VALUES (:key, :value, 'string', :category)
                """,
                key=key,
                value=value,
                category=category,
            )

    def _save_config_items(self, config_items: list[tuple[str, object, str]], error_context: str) -> None:
        conn = self._get_direct_connection()
        cursor = conn.cursor()
        try:
            self._upsert_config_items(cursor, config_items)
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error("%s: %s", error_context, e)
            raise RuntimeError(f"{error_context}: {e}") from e
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def _oci_file_values(config: dict) -> dict[str, str]:
        return {
            "user": normalize_oci_config_value(config.get("user", "")),
            "fingerprint": normalize_oci_config_value(config.get("fingerprint", "")),
            "tenancy": normalize_oci_config_value(config.get("tenancy", "")),
            "region": normalize_oci_config_value(config.get("region", "")),
            "key_file": resolve_oci_key_file_path(normalize_oci_config_value(config.get("key_file", ""))),
        }

    def _sync_select_ai_credential(self, *, config_values: dict[str, str], compartment_id: str) -> None:
        credential_name = "APP_AGENT_OCI_CRED"
        private_key = read_private_key_for_db_credential(config_values["key_file"])
        conn = self._get_direct_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                DECLARE
                    jo JSON_OBJECT_T;
                BEGIN
                    BEGIN
                        DBMS_VECTOR.DROP_CREDENTIAL(credential_name => :credential_name);
                    EXCEPTION
                        WHEN OTHERS THEN
                            IF SQLCODE = -4043 OR INSTR(LOWER(SQLERRM), 'not exist') > 0 THEN
                                NULL;
                            ELSE
                                RAISE;
                            END IF;
                    END;

                    jo := JSON_OBJECT_T();
                    jo.put('compartment_ocid', :compartment_id);
                    jo.put('user_ocid', :user_ocid);
                    jo.put('tenancy_ocid', :tenancy_ocid);
                    jo.put('private_key', :private_key);
                    jo.put('fingerprint', :fingerprint);
                    DBMS_VECTOR.CREATE_CREDENTIAL(
                        credential_name => :credential_name,
                        params => JSON(jo.to_string)
                    );
                END;
                """,
                credential_name=credential_name,
                compartment_id=compartment_id,
                user_ocid=config_values["user"],
                tenancy_ocid=config_values["tenancy"],
                private_key=private_key,
                fingerprint=config_values["fingerprint"],
            )
            cursor.execute(
                """
                MERGE INTO config c
                USING DUAL ON (c.config_key = 'select_ai.credential_name')
                WHEN MATCHED THEN
                    UPDATE SET c.config_value = :credential_name, c.config_updated = SYSDATE
                WHEN NOT MATCHED THEN
                    INSERT (config_key, config_value, config_type, config_category, config_description)
                    VALUES ('select_ai.credential_name', :credential_name, 'string', 'select_ai', 'DBMS_VECTOR credential used by Select AI')
                """,
                credential_name=credential_name,
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def _load_saved_oci_config_values(self) -> dict[str, str]:
        conn = self._get_direct_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT config_key, config_value
                FROM config
                WHERE config_key IN (
                    'oci.user',
                    'oci.fingerprint',
                    'oci.tenancy',
                    'oci.region',
                    'oci.key_file',
                    'oci.compartment_id'
                )
                """
            )
            values = normalize_oci_config_rows(cursor.fetchall())
            if values.get("key_file"):
                values["key_file"] = resolve_oci_key_file_path(values["key_file"])
            return values
        finally:
            cursor.close()
            conn.close()

    def save_oci_config(self, config: dict) -> bool:
        config_items = [
            ("oci.compartment_id", config.get("compartment_id", ""), "oci"),
            ("oci.user", config.get("user", ""), "oci"),
            ("oci.fingerprint", config.get("fingerprint", ""), "oci"),
            ("oci.tenancy", config.get("tenancy", ""), "oci"),
            ("oci.region", config.get("region", ""), "oci"),
            ("oci.key_file", config.get("key_file", ""), "oci"),
            ("oci.namespace", config.get("namespace", ""), "oci"),
            ("oci.bucket_name", config.get("bucket_name", ""), "oci"),
            ("select_ai.profile_name", "APP_AGENT_ANALYTICS", "select_ai"),
            ("select_ai.credential_name", "APP_AGENT_OCI_CRED", "select_ai"),
        ]
        self._save_config_items(config_items, "Error saving OCI config")
        oci_file_values = self._oci_file_values(config)
        try:
            write_oci_cli_config_file(self.db_manager, config_values=oci_file_values)
            self._sync_select_ai_credential(
                config_values=oci_file_values,
                compartment_id=normalize_oci_config_value(config.get("compartment_id", "")),
            )
        except Exception as file_error:
            logger.error("OCI config was saved in DB but credential synchronization failed: %s", file_error)
            raise RuntimeError(
                f"Error saving OCI config: OCI config saved, but Select AI credential synchronization failed: {file_error}"
            ) from file_error
        return True

    def save_generative_ai_config(self, config: dict) -> bool:
        self._save_config_items(
            [
                ("genai.inference_url", config.get("inference_url", ""), "genai"),
                ("genai.model", config.get("generative_model", ""), "genai"),
            ],
            "Error saving Generative AI config",
        )
        return True

    def complete_setup(self) -> bool:
        conn = self._get_direct_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                UPDATE config
                SET config_value = 'true', config_updated = SYSDATE
                WHERE config_key = 'wizard.completed'
                """
            )
            conn.commit()
            try:
                oci_config_values = self._load_saved_oci_config_values()
                if oci_config_values:
                    write_oci_cli_config_file(self.db_manager, config_values=oci_config_values)
            except Exception as file_error:
                logger.error("Could not generate keys/config during complete_setup: %s", file_error)
                raise RuntimeError(f"Could not generate OCI config file during setup completion: {file_error}") from file_error
            return True
        except Exception as e:
            conn.rollback()
            logger.error("Error completing setup: %s", e)
            raise RuntimeError(f"Error completing setup: {e}") from e
        finally:
            cursor.close()
            conn.close()

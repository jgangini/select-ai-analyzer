import logging

import oci
from oci.generative_ai import GenerativeAiClient
from oci.object_storage import ObjectStorageClient

from apps.backend.app.services.bootstrap_support import (
    _failure_result,
    _generative_model_options,
    _inference_test_url,
    _missing_saved_config_result,
    _probe_inference_endpoint,
    _read_key_file_content,
    _success_result,
    build_oci_client_config,
    missing_required_oci_config_keys,
    normalize_oci_config_value,
    normalize_oci_config_rows,
    read_private_key_for_db_credential,
    resolve_oci_key_file_path,
    write_oci_cli_config_file,
)

logger = logging.getLogger(__name__)


class BootstrapOciMixin:
    def _load_saved_oci_client_context(self) -> tuple[dict[str, str], dict[str, str], list[str]]:
        config_values = self._load_saved_oci_config_values()
        missing = missing_required_oci_config_keys(config_values)
        if missing:
            return config_values, {}, missing
        key_content = _read_key_file_content(config_values["key_file"])
        return config_values, build_oci_client_config(config_values, key_content=key_content), []

    def test_oci_connection(self, config: dict) -> dict:
        try:
            key_content = _read_key_file_content(config["key_file"])
            oci_config = {
                "user": config["user"],
                "key_content": key_content,
                "fingerprint": config["fingerprint"],
                "tenancy": config["tenancy"],
                "region": config["region"],
            }
            identity_client = oci.identity.IdentityClient(oci_config)
            compartment = identity_client.get_compartment(config["compartment_id"])
            return _success_result(
                f"Successful connection to compartment: {compartment.data.name}",
                compartment_name=compartment.data.name,
            )
        except Exception as e:
            return _failure_result(f"OCI connection error: {str(e)}")

    def test_object_storage(self, namespace: str, bucket_name: str) -> dict:
        try:
            logger.debug("test_object_storage: namespace=%s, bucket=%s", namespace, bucket_name)
            if not namespace or not bucket_name:
                return _failure_result("Namespace and bucket name are required")
            oci_config_data, oci_config, missing = self._load_saved_oci_client_context()
            if missing:
                return _missing_saved_config_result("Please save API Key configuration first.", missing)
            compartment_id = oci_config_data["compartment_id"]
            os_client = ObjectStorageClient(oci_config)
            try:
                os_client.get_namespace()
            except Exception as e:
                return _failure_result(f"Invalid namespace: {str(e)}")
            try:
                bucket = os_client.get_bucket(namespace, bucket_name)
                if bucket.data.compartment_id != compartment_id:
                    return _failure_result(
                        f"Bucket '{bucket_name}' exists but is not in the configured compartment"
                    )
            except Exception as e:
                error_str = str(e)
                if "NotAuthorizedOrNotFound" in error_str or "404" in error_str:
                    return _failure_result(
                        f"Bucket '{bucket_name}' not found or not accessible in the specified compartment"
                    )
                return _failure_result(f"Error accessing bucket: {error_str}")
            return _success_result(f"Successful connection to bucket: {bucket_name} in compartment")
        except Exception as e:
            logger.exception("test_object_storage failed: %s", e)
            return _failure_result(f"Error validating Object Storage: {str(e)}")

    def list_genai_models(self) -> dict:
        try:
            oci_config_data, oci_config, missing = self._load_saved_oci_client_context()
            if missing:
                return _missing_saved_config_result(
                    "Save API Key configuration first.",
                    missing,
                    generative_models=[],
                )
            compartment_id = oci_config_data["compartment_id"]
            genai_client = GenerativeAiClient(oci_config)
            generative_models = []
            try:
                gen_resp = genai_client.list_models(
                    compartment_id=compartment_id,
                    capability=["TEXT_GENERATION", "TEXT_SUMMARIZATION"],
                    lifecycle_state="ACTIVE",
                    limit=100,
                )
                generative_models = _generative_model_options(gen_resp)
            except Exception as e:
                logger.warning("list_models TEXT_GENERATION failed: %s", e)
            return _success_result(generative_models=generative_models)
        except Exception as e:
            logger.exception("list_genai_models failed: %s", e)
            return _failure_result(str(e), generative_models=[])

    def test_generative_ai(self, inference_url: str, generative_model: str) -> dict:
        try:
            test_url = _inference_test_url(inference_url)
            if not test_url:
                return _failure_result("Inference URL is required")
            endpoint_error = _probe_inference_endpoint(test_url)
            if endpoint_error:
                return _failure_result(f"Inference endpoint unreachable: {endpoint_error}")
            if not generative_model or not generative_model.strip():
                return _failure_result("Generative AI model name is required")
            return _success_result("Generative AI configuration validated successfully. Inference endpoint is reachable.")
        except Exception as e:
            logger.exception("test_generative_ai failed: %s", e)
            return _failure_result(f"Error validating Generative AI: {str(e)}")

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

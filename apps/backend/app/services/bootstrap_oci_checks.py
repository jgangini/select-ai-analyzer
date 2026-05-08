from __future__ import annotations

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
)

logger = logging.getLogger(__name__)


class BootstrapOciChecksMixin:
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

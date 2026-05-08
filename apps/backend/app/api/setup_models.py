from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class DBTestRequest(BaseModel):
    wallet_path: str | None = ""
    wallet_password: str | None = ""
    user: str
    password: str
    dsn: str


class DBRuntimeConfigRequest(BaseModel):
    wallet_path: str
    wallet_password: str
    user: str
    password: str
    dsn: str


class WalletDSNRequest(BaseModel):
    wallet_path: str | None = ""


class OCIConfigRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    compartment_id: str | None = ""
    user: str | None = ""
    fingerprint: str | None = ""
    tenancy: str | None = ""
    region: str | None = ""
    key_file: str | None = ""
    namespace: str | None = ""
    bucket_name: str | None = "app_agent"
    bucket_input: str | None = ""
    bucket_output: str | None = ""
    selected_project: str | None = ""


class AdminPasswordRequest(BaseModel):
    password: str


class SetupRequest(BaseModel):
    admin_email: str
    admin_password: str
    wallet_path: str
    wallet_password: str
    user: str
    password: str
    dsn: str


class ObjectStorageTestRequest(BaseModel):
    namespace: str
    bucket_name: str


class GenerativeAIConfigRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    inference_url: str | None = ""
    generative_model: str | None = ""

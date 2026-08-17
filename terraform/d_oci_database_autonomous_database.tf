############################################
# Autonomous AI Database and wallet
############################################

locals {
  uses_existing_autonomous_database      = var.autonomous_database_mode == "existing"
  uploaded_autonomous_database_wallet    = "${path.module}/.oci/adb_wallet.zip"
  uses_uploaded_existing_database_wallet = local.uses_existing_autonomous_database && fileexists(local.uploaded_autonomous_database_wallet)
  autonomous_database_id                 = local.uses_existing_autonomous_database ? var.existing_autonomous_database_ocid : oci_database_autonomous_database.ora26ai[0].id
  autonomous_database_db_name            = local.uses_existing_autonomous_database ? data.oci_database_autonomous_database.existing_adb[0].db_name : oci_database_autonomous_database.ora26ai[0].db_name
  generated_autonomous_database_wallet   = local.uses_uploaded_existing_database_wallet ? "" : oci_database_autonomous_database_wallet.adb_wallet[0].content
  autonomous_database_wallet_b64         = local.uses_uploaded_existing_database_wallet ? filebase64(local.uploaded_autonomous_database_wallet) : local.generated_autonomous_database_wallet
}

data "oci_database_autonomous_database" "existing_adb" {
  count = local.uses_existing_autonomous_database ? 1 : 0

  autonomous_database_id = var.existing_autonomous_database_ocid
}

resource "oci_database_autonomous_database" "ora26ai" {
  count = local.uses_existing_autonomous_database ? 0 : 1

  admin_password = var.autonomous_database_admin_password
  compartment_id = var.compartment_ocid
  db_name        = local.adb_db_name

  compute_count            = var._oci_autonomous_database.compute_count
  compute_model            = "ECPU"
  data_storage_size_in_tbs = var._oci_autonomous_database.data_storage_size_in_tbs
  db_version               = var.autonomous_database_version
  db_workload              = var.autonomous_database_workload
  display_name             = local.adb_display_name
  is_auto_scaling_enabled  = var._oci_autonomous_database.is_auto_scaling_enabled
  is_dev_tier              = false
}

resource "oci_database_autonomous_database_wallet" "adb_wallet" {
  count = local.uses_uploaded_existing_database_wallet ? 0 : 1

  autonomous_database_id = local.autonomous_database_id
  password               = var.autonomous_database_wallet_password

  base64_encode_content = true
}

resource "oci_objectstorage_object" "adb_wallet_zip" {
  bucket    = oci_objectstorage_bucket.bucket.name
  content   = local.autonomous_database_wallet_b64
  namespace = var.objectstorage_namespace
  object    = "adb_wallet.zip"

  depends_on = [
    oci_database_autonomous_database_wallet.adb_wallet,
    oci_objectstorage_bucket.bucket,
  ]
}

mock_provider "oci" {
  mock_data "oci_identity_availability_domains" {
    defaults = {
      availability_domains = [{ name = "test-ad" }]
    }
  }

  mock_data "oci_core_images" {
    defaults = {
      images = [{ id = "ocid1.image.oc1.iad.synthetic" }]
    }
  }
}

mock_provider "null" {}
mock_provider "tls" {}

variables {
  tenancy_ocid                        = "ocid1.tenancy.oc1..synthetic"
  compartment_ocid                    = "ocid1.compartment.oc1..synthetic"
  objectstorage_namespace             = "testnamespace"
  region                              = "us-chicago-1"
  autonomous_database_admin_password  = "SyntheticDbPass42"
  autonomous_database_wallet_password = "SyntheticWallet42"
  source_commit_sha                   = "0123456789abcdef0123456789abcdef01234567"
}

run "new_lakehouse_provisions_database" {
  command = plan

  assert {
    condition     = length(oci_database_autonomous_database.ora26ai) == 1
    error_message = "A new database must provision one ADB."
  }

  assert {
    condition     = oci_database_autonomous_database.ora26ai[0].db_workload == "LH"
    error_message = "The default workload must be Lakehouse (LH)."
  }
}

run "existing_database_generates_wallet" {
  command = plan

  variables {
    autonomous_database_mode          = "existing"
    existing_autonomous_database_ocid = "ocid1.autonomousdatabase.oc1.ord.synthetic"
  }

  assert {
    condition     = length(oci_database_autonomous_database.ora26ai) == 0 && length(oci_database_autonomous_database_wallet.adb_wallet) == 1
    error_message = "Reuse must preserve the database and generate its wallet."
  }

  assert {
    condition     = local.autonomous_database_id == var.existing_autonomous_database_ocid
    error_message = "Reuse must use the selected database OCID."
  }
}

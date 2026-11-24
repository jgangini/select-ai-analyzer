output "application_url" {
  description = "Select AI Analyzer public URL."
  value       = "http://${oci_core_instance.linux_instance.public_ip}"
}

output "ssh_user" {
  description = "SSH user for the compute instance."
  value       = "opc"
}

output "adb_db_name" {
  description = "Autonomous Database name used by Select AI Analyzer."
  value       = local.autonomous_database_db_name
}

output "autonomous_database_id" {
  description = "Autonomous Database OCID used by Select AI Analyzer."
  value       = local.autonomous_database_id
}

output "bucket_name" {
  description = "Object Storage bucket created for Select AI Analyzer."
  value       = oci_objectstorage_bucket.bucket.name
}

output "instance_id" {
  description = "Compute instance OCID for Deploy Studio bootstrap."
  value       = oci_core_instance.linux_instance.id
}

output "objectstorage_namespace" {
  description = "Object Storage namespace for Deploy Studio bootstrap."
  value       = var.objectstorage_namespace
}

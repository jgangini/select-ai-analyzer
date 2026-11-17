locals {
  bucket_name           = var.bucket_name != "" ? var.bucket_name : "buk-select-ai-${var.deployment_suffix}"
  adb_db_name           = var.adb_db_name != "" ? var.adb_db_name : substr("selai${var.deployment_suffix}", 0, 14)
  adb_display_name      = var.adb_display_name != "" ? var.adb_display_name : "selectai26ai-${var.deployment_suffix}"
  vcn_display_name      = var.vcn_display_name != "" ? var.vcn_display_name : "vcn-select-ai-${var.deployment_suffix}"
  instance_display_name = var.instance_display_name != "" ? var.instance_display_name : "select-ai-${var.deployment_suffix}"
}

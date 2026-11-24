############################################
# Compute host for Select AI Analyzer
############################################

resource "tls_private_key" "instance_ssh" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

data "oci_core_images" "oracle_linux" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Oracle Linux"
  operating_system_version = "9"
  shape                    = var._oci_instance.shape.name
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

resource "oci_core_instance" "linux_instance" {
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  compartment_id      = var.compartment_ocid
  shape               = var._oci_instance.shape.name
  display_name        = local.instance_display_name

  lifecycle {
    ignore_changes = [
      source_details[0].source_id,
    ]
  }

  source_details {
    source_id   = data.oci_core_images.oracle_linux.images[0].id
    source_type = "image"
  }

  shape_config {
    memory_in_gbs = var._oci_instance.shape.memory_in_gbs
    ocpus         = var._oci_instance.shape.ocpus
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.subnet.id
    assign_public_ip = true
  }

  metadata = {
    ssh_authorized_keys = tls_private_key.instance_ssh.public_key_openssh
    user_data = base64encode(templatefile("${path.module}/templatefile/user_data.sh", {
      source_repo_url   = var.source_repo_url
      source_ref        = var.source_ref
      source_commit_sha = var.source_commit_sha
    }))
  }
}

resource "null_resource" "wait_for_userdata" {
  depends_on = [oci_core_instance.linux_instance]

  triggers = {
    instance_id = oci_core_instance.linux_instance.id
  }

  connection {
    type        = "ssh"
    host        = oci_core_instance.linux_instance.public_ip
    user        = "opc"
    private_key = tls_private_key.instance_ssh.private_key_pem
    timeout     = "40m"
  }

  provisioner "remote-exec" {
    inline = [
      <<-EOT
      for attempt in $(seq 1 480); do
        if [ -f /var/local/userdata.done ]; then
          exit 0
        fi

        status="$(sudo cloud-init status --long 2>/dev/null || true)"
        if echo "$status" | grep -q "status: error"; then
          printf '%s\n' "cloud-init failed before /var/local/userdata.done was created."
          printf '%s\n' "$status"
          sudo tail -n 200 /var/log/cloud-init-output.log || true
          exit 1
        fi
        sleep 5
      done

      printf '%s\n' "Timed out waiting for /var/local/userdata.done."
      sudo tail -n 200 /var/log/cloud-init-output.log || true
      exit 1
      EOT
      ,
      "cat /home/opc/startup_info.txt | sed 's/\\[PUBLIC-IP\\]/${oci_core_instance.linux_instance.public_ip}/g'",
    ]
  }
}

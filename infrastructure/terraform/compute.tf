# terraform import oci_core_instance.nexora_platform ocid1.instance.oc1.eu-frankfurt-1.antheljtiuaqkdqc7voujgrfy5y4nm5pqi7luw4dqlvatsewe35tiqikgxna
#
# Runs every app in infrastructure/docker/docker-compose.prod.yml (NEXORA)
# plus the separate Vigilo and NeuraWall stacks — see each project's own
# deploy/compose file. Ampere A1.Flex at 4 OCPU / 24GB is the full size of
# this tenancy's free-tier Ampere allocation; there is no room left to grow
# this instance without either moving to a paid shape or freeing up
# capacity elsewhere in the tenancy.
resource "oci_core_instance" "nexora_platform" {
  compartment_id      = local.compartment_ocid
  availability_domain = "mzPB:EU-FRANKFURT-1-AD-2"
  fault_domain        = "FAULT-DOMAIN-2"
  display_name        = "nexora-platform"
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = 4
    memory_in_gbs = 24
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.nexora.id
    assign_public_ip = true
    hostname_label   = "nexora-platform"
  }

  # OCI reassigns a newer image OCID whenever Oracle publishes an update
  # under the same display name; the lifecycle block below tells
  # Terraform to ignore that drift rather than try to rebuild the
  # instance from a fresh image on every plan.
  source_details {
    source_type             = "image"
    source_id               = "ocid1.image.oc1.eu-frankfurt-1.aaaaaaaat4icenckfpjly34j7juxsucpjycgqbpfzr364gzxihipaaayqjrq" # Oracle-Linux-9.8-aarch64-2026.09.18-0
    boot_volume_size_in_gbs = 80
  }

  metadata = {
    ssh_authorized_keys = var.ssh_authorized_key
  }

  lifecycle {
    ignore_changes = [
      source_details[0].source_id,
      metadata,
    ]
  }
}

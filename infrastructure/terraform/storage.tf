# The off-site backup path: bucket, lifecycle expiry, and the two IAM pieces that let the host
# (and only the host) write into it. All three were created by hand in the OCI Console on
# 2026-09-26; this file describes them so a rebuilt tenancy gets the same, least-privilege setup.
# Import once before ever applying (then `terraform plan` must show no changes):
#
#   terraform import oci_objectstorage_bucket.backups n/<namespace>/b/nexora-backups
#   terraform import oci_identity_policy.backups <policy OCID of "nexora-backups">
#   terraform import oci_identity_dynamic_group.backup_host <OCID of dynamic group "nexora-backup-host">
#
# Why the policy is this narrow: the host may create and inspect objects in this one bucket, and
# nothing else. It cannot delete, overwrite or list other buckets, so a compromised host cannot wipe
# the off-site copies. Consequence worth knowing: multipart upload is NOT allowed, which is why
# infrastructure/deployment/backup-all.sh uploads with --no-multipart (above ~128 MiB the OCI CLI
# otherwise uploads in parts and OCI answers with a misleading BucketNotFound).

data "oci_objectstorage_namespace" "this" {
  compartment_id = local.compartment_ocid
}

resource "oci_objectstorage_bucket" "backups" {
  compartment_id = local.compartment_ocid
  namespace      = data.oci_objectstorage_namespace.this.namespace
  name           = "nexora-backups"
  access_type    = "NoPublicAccess"
  storage_tier   = "Standard"
  versioning     = "Disabled"
}

# Expiry lives here, not on the host (see the comment on the policy below). Needs the Object
# Storage service principal to be allowed to manage object-family, which the policy grants.
resource "oci_objectstorage_object_lifecycle_policy" "backups" {
  namespace = data.oci_objectstorage_namespace.this.namespace
  bucket    = oci_objectstorage_bucket.backups.name

  rules {
    name        = "expire-platform-backups"
    action      = "DELETE"
    is_enabled  = true
    time_amount = var.backup_retention_days
    time_unit   = "DAYS"
    target      = "objects"

    object_name_filter {
      inclusion_prefixes = ["platform/"]
    }
  }
}

# The instance, identified by its OCID, so the dynamic group matches exactly this host. After a
# rebuild the new instance has a new OCID: this rule must follow it, otherwise uploads fail
# silently with BucketNotFound. That is why the OCID comes from the managed resource, not text.
resource "oci_identity_dynamic_group" "backup_host" {
  compartment_id = local.compartment_ocid
  name           = "nexora-backup-host"
  description    = "The nexora-platform instance, for instance-principal backup uploads"
  matching_rule  = "instance.id = '${oci_core_instance.nexora_platform.id}'"
}

resource "oci_identity_policy" "backups" {
  compartment_id = local.compartment_ocid
  name           = "nexora-backups"
  description    = "backups"

  statements = [
    "Allow dynamic-group nexora-backup-host to read buckets in tenancy where target.bucket.name = 'nexora-backups'",
    "Allow dynamic-group nexora-backup-host to manage objects in tenancy where all {target.bucket.name = 'nexora-backups', any {request.permission = 'OBJECT_CREATE', request.permission = 'OBJECT_INSPECT'}}",
    "Allow service objectstorage-eu-frankfurt-1 to manage object-family in tenancy",
  ]
}

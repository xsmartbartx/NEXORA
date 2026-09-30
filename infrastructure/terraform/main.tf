provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

# Everything lives in the root (tenancy) compartment — no sub-compartments
# have been created. `compartment_ocid` below is just `var.tenancy_ocid`
# under a clearer local name for the resources that follow.
locals {
  compartment_ocid = var.tenancy_ocid
}

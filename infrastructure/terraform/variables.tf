variable "tenancy_ocid" {
  description = "OCI tenancy OCID. Also the compartment every resource below lives in (root compartment — no sub-compartments exist yet)."
  type        = string
}

variable "user_ocid" {
  description = "OCID of the OCI user Terraform authenticates as."
  type        = string
}

variable "fingerprint" {
  description = "Fingerprint of the API signing key registered to user_ocid."
  type        = string
}

variable "private_key_path" {
  description = "Path to the API signing key's private key (PEM)."
  type        = string
}

variable "region" {
  description = "OCI region."
  type        = string
  default     = "eu-frankfurt-1"
}

variable "ssh_authorized_key" {
  description = "Public SSH key installed on the instance for the opc user."
  type        = string
}

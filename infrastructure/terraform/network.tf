# terraform import oci_core_vcn.nexora ocid1.vcn.oc1.eu-frankfurt-1.amaaaaaaiuaqkdqaczqwgk3w7vapgk37dmz4xgnyrlvxktunp7u3b6rjmcia
resource "oci_core_vcn" "nexora" {
  compartment_id = local.compartment_ocid
  display_name   = "vcn-20260920-1902"
  cidr_blocks    = ["10.0.0.0/16"]
  dns_label      = "vcn09201908"
}

# terraform import oci_core_internet_gateway.nexora ocid1.internetgateway.oc1.eu-frankfurt-1.aaaaaaaamwbe3xzfq5v4zl3ks3lu5rlodmgd4vnofxli46g7nu544gm6eluq
resource "oci_core_internet_gateway" "nexora" {
  compartment_id = local.compartment_ocid
  vcn_id         = oci_core_vcn.nexora.id
  display_name   = "Internet Gateway vcn-20260920-1902"
  enabled        = true
}

# terraform import oci_core_route_table.nexora ocid1.routetable.oc1.eu-frankfurt-1.aaaaaaaa6ek55fergwrpmo6x5jpbs35puofg3xtrjtyll64iwnngqbgviyta
resource "oci_core_route_table" "nexora" {
  compartment_id = local.compartment_ocid
  vcn_id         = oci_core_vcn.nexora.id

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.nexora.id
  }
}

# terraform import oci_core_security_list.nexora ocid1.securitylist.oc1.eu-frankfurt-1.aaaaaaaaxpfdwpqqq3xedwhflswlavzfpmjsgo2jutlrj7qxkke35cwuzi3a
#
# Open to the whole internet: SSH (22), HTTP (80 — Let's Encrypt's
# http-01 challenge and the redirect to HTTPS), HTTPS (443). Nothing else
# is exposed; every app port (Postgres, Redis, the Next.js apps
# themselves) is only reachable from inside the VCN, behind Caddy.
resource "oci_core_security_list" "nexora" {
  compartment_id = local.compartment_ocid
  vcn_id         = oci_core_vcn.nexora.id

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
    stateless   = false
  }

  ingress_security_rules {
    source    = "0.0.0.0/0"
    protocol  = "6" # tcp
    stateless = false
    tcp_options {
      min = 22
      max = 22
    }
  }

  ingress_security_rules {
    source    = "0.0.0.0/0"
    protocol  = "1" # icmp
    stateless = false
    icmp_options {
      type = 3
      code = 4
    }
  }

  ingress_security_rules {
    source    = "10.0.0.0/16"
    protocol  = "1" # icmp
    stateless = false
    icmp_options {
      type = 3
    }
  }

  ingress_security_rules {
    description = "HTTP for Caddy/Let's Encrypt"
    source      = "0.0.0.0/0"
    protocol    = "6" # tcp
    stateless   = false
    tcp_options {
      min = 80
      max = 80
    }
  }

  ingress_security_rules {
    description = "HTTPS for Caddy"
    source      = "0.0.0.0/0"
    protocol    = "6" # tcp
    stateless   = false
    tcp_options {
      min = 443
      max = 443
    }
  }
}

# terraform import oci_core_subnet.nexora ocid1.subnet.oc1.eu-frankfurt-1.aaaaaaaajmf275b4i5pmlsutoffgqyxg7kgddkwnek7haxzeu3jjhofml2oa
resource "oci_core_subnet" "nexora" {
  compartment_id             = local.compartment_ocid
  vcn_id                     = oci_core_vcn.nexora.id
  cidr_block                 = "10.0.0.0/24"
  dns_label                  = "subnet09201908"
  route_table_id             = oci_core_route_table.nexora.id
  security_list_ids          = [oci_core_security_list.nexora.id]
  prohibit_public_ip_on_vnic = false
}

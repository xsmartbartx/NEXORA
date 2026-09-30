output "public_ip" {
  description = "Current public IP of nexora-platform. DNS (Cloudflare/Squarespace) must point here."
  value       = oci_core_instance.nexora_platform.public_ip
}

output "private_ip" {
  value = oci_core_instance.nexora_platform.private_ip
}

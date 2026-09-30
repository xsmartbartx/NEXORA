# Terraform for `nexora-platform`

Makes the production OCI server (`nexora-platform`, the one host running
NEXORA, Vigilo and NeuraWall) reproducible as code, instead of only existing
as whatever's currently clicked together in the OCI Console. This does not
change how you deploy application code — that's still
`infrastructure/deployment/deploy.sh`. This only covers the OCI resources
themselves: the VCN, subnet, security list, internet gateway, route table and
the compute instance.

## Setup

1. Copy `terraform.tfvars.example` to `terraform.tfvars` and fill in your own
   values (tenancy/user OCIDs, API key fingerprint, region). **Never commit
   `terraform.tfvars`** — it's already in `.gitignore`.
2. An OCI API signing key is required (separate from the SSH key used to
   reach the server) — see Oracle's
   [API key docs](https://docs.oracle.com/iaas/Content/API/Concepts/apisigningkey.htm).
   Console → Profile → My profile → Tokens and keys → Add API key.
3. `terraform init`

## This describes existing infrastructure — it does not create it

The resources below already exist and were created by hand through the OCI
Console. Run `terraform import` once per resource (see each resource's
comment in `main.tf` for its exact import command) before ever running
`terraform apply`. After importing everything, `terraform plan` should show
**no changes** — if it doesn't, the `.tf` files have drifted from reality and
need fixing, not the live server.

Applying a change (e.g. editing a security rule in `network.tf`, then
`terraform apply`) does modify the real, running production server. Treat it
with the same care as any other production change.

## State

State is local (`terraform.tfstate`, gitignored) — there's one operator and
one environment, so a remote backend (S3, Terraform Cloud) is unneeded
complexity for now. Back up `terraform.tfstate` somewhere outside git if you
want to survive a wiped laptop; losing it doesn't affect the live server, it
just means re-importing everything to manage it with Terraform again.

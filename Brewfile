# Developer toolchain for this repo (macOS): `brew bundle`, then `npm run doctor`
# to confirm everything resolved. See docs/development.md.
#
# Deliberately absent: awscli (hosting is Oracle Cloud, Terraform targets
# oracle/oci), kubectl (no Kubernetes), Python/FastAPI (Vigilo and NeuraWall
# are separate repos; nothing here is Python).

tap "hashicorp/tap"

# Runtime and source control
brew "git"
brew "gh"
brew "node@22" # CI and the Docker image build on Node 22

# Infrastructure (infrastructure/terraform, infrastructure/docker)
brew "hashicorp/tap/terraform"
brew "oci-cli"
cask "docker-desktop"

# Command-line utilities
brew "jq"
brew "openssl@3"
brew "libpq" # psql; keg-only, add $(brew --prefix libpq)/bin to PATH
brew "redis" # redis-cli

# GUI clients
cask "dbeaver-community" # Postgres admin
cask "postman" # API testing; Insomnia (cask "insomnia") imports the same collection

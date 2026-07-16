# Platform Feasibility

The implementation plan was checked against current primary platform documentation before application work began.

## MCP and client hosts

- The MCP service uses Streamable HTTP.
- OAuth discovery includes RFC 9728 Protected Resource Metadata.
- Authorization uses PKCE S256 and validates the requested resource/audience.
- Claude supports remote HTTP MCP servers with OAuth and discovers Protected Resource Metadata. Codex and Claude still require a release compatibility matrix because host packaging differs.

## Neon PostgreSQL

- Neon pooled connections use PgBouncer transaction mode.
- Session advisory locks are therefore excluded from pooled mutation paths.
- Household mutations use transaction-scoped advisory locks on one checked-out connection and transaction.
- Migrations and session-dependent administrative work use the direct Neon URL.
- The Neon connector is not connected in the local environment. Integration proof uses ephemeral local PostgreSQL and leaves an explicit external staging checkpoint for Neon before release.

## DigitalOcean storage

- DigitalOcean Block Storage volumes persist independently from a Droplet.
- A volume can move only among Droplets in the same datacenter.
- Deployment and failover must remap and validate the mount at `/data/households` before the service accepts writes.
- Readiness fails when the path is missing, read-only, mounted from the wrong filesystem, or unexpectedly empty after provisioning.

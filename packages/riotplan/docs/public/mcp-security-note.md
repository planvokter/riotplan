# MCP Directory-Control Hardening

RiotPlan MCP now treats plan storage/search location as server-managed only.

## Threat model

- **Path injection:** clients previously could attempt to pass custom directory-like arguments (`directory`, `path`, `root`, `planDirectory`) to influence where plans were created or searched.
- **Workspace escape:** allowing client-controlled roots can let requests traverse outside the intended server plan root.
- **Cross-project data exposure:** broad or redirected search roots can reveal plans from unrelated projects/workspaces.

## Hardening behavior

- Public plan creation/listing tools no longer expose directory override parameters in tool descriptors.
- Runtime validation rejects blocked arguments with:
  - `E_INVALID_ARGUMENT: directory is server-managed and cannot be provided by client`
- Blocked attempts are logged as warnings without including user-supplied path values.
- Directory resolution uses only trusted server-owned context/config defaults.

## Cloud mode note

When cloud mode is enabled, storage location is still server-managed:

- Clients cannot pass bucket or directory overrides in MCP tool arguments.
- Bucket selection comes from trusted server configuration/environment.
- RiotPlan keeps local mode as default; cloud mode is explicit opt-in.

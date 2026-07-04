# Local Codex Policy for select-ai-analyzer

This file supplements the global `~/.codex/AGENTS.md`.

Keep this file repo-specific. Do not duplicate universal rules that already live in the global policy.

## Project Identity

- Purpose: Select AI analytics application and its OCI Resource Manager deployment package.
- Technical audience: OCI solution engineers and Deploy Studio maintainers.
- Primary surfaces: `apps`, `infra/terraform`, and `deploy-studio.json`.

## Repo Operating Defaults

- Preferred validation commands: existing project checks, contract unittest, Terraform fmt/init/validate, and architecture wrappers.
- Preferred search and inspection tools: Graphify report, then Semble; literal `rg` only for exhaustive references.
- Default runtime or environment assumptions: Deploy Studio supplies ephemeral OCI credentials, generated APP_AGENT credentials and deployment names.

## Local Validation Policy

- Required checks beyond global Graphify and Sentrux: validate `deploy-studio.json` and Terraform without real credentials.
- Safe shortcuts for docs-only work:
- Release, deploy, or approval gates: never tag or publish a release unless application and Terraform CI pass.

## Repo-Specific Friction

- Sensitive paths or fragile areas: `infra/terraform/templatefile` installs the application and configures Autonomous Database.
- Credentials, external systems, or approval boundaries: `.oci`, PEM, wallet and state files are local-only; OCI APPLY requires explicit authorization.
- Noisy, slow, or expensive commands to avoid by default:

## Continuous Improvement Triggers

- Promote a repeated friction to this local file after 2 recurrences in the same repo.
- Promote a repeated manual sequence to a script or skill after 3 recurrences or when it is safety-critical.
- Promote a rule to the global policy only when it is cross-repo or clearly universal.
- Review `.codex/improvement-log.md` before large tasks and record only meaningful signal after non-trivial work.

## Future Delegation Hooks

- Candidate explorer roles:
- Candidate reviewer roles:
- Candidate repo-specific skills or MCPs:

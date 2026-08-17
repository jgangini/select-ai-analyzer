# Select AI Analyzer Terraform Package

This Resource Manager package creates the OCI resources and fully configures the published Select AI Analyzer container.

Runtime model:

- CloudTechNext validates OCI credentials and creates the Resource Manager stack.
- Terraform provisions VCN, subnet, security list, Autonomous AI Database 26ai or 19c, Object Storage bucket and one Oracle Linux VM.
- The VM installs Docker, clones `https://github.com/jgangini/select-ai-analyzer`, builds the container locally and starts it on port 80 with persistent runtime directories.
- The installer keeps OCI SVG assets deterministic before `docker build` if the published repository cut does not contain them yet.
- CloudTechNext automation creates the `APP_AGENT` database user, injects the generated wallet, OCI API key, Object Storage bucket, Generative AI settings and SQL bootstrap through the application's setup API during Resource Manager apply.

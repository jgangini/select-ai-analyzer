<p align="center">
  <img src="docs/assets/select-ai-analyzer-mascot.png" alt="Owl analyst pointing to the tallest bar in a chart" width="224">
</p>

<h3 align="center">Select AI Analyzer</h3>

<p align="center">Ask questions about Oracle data in plain language and inspect the SQL, results, and charts in one workspace.</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-165D63?style=flat-square" alt="MIT license"></a>
  <a href="https://github.com/jgangini/select-ai-analyzer/releases"><img src="https://img.shields.io/github/v/release/jgangini/select-ai-analyzer?style=flat-square" alt="Published release"></a>
</p>

<p align="center"><strong>Technologies</strong></p>

<p align="center">
  <a href="terraform/README.md"><img src="https://img.shields.io/badge/OCI-Select%20AI-C94032?style=flat-square" alt="OCI Select AI"></a>
  <a href="apps/backend/README.md"><img src="https://img.shields.io/badge/API-FastAPI-147D71?style=flat-square" alt="FastAPI backend"></a>
  <a href="apps/frontend/README.md"><img src="https://img.shields.io/badge/UI-React-21506E?style=flat-square" alt="React frontend"></a>
  <a href="terraform/README.md"><img src="https://img.shields.io/badge/Infrastructure-Terraform-6551A5?style=flat-square" alt="Terraform infrastructure"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="docs/tutorial.md">Tutorial</a> ·
  <a href="docs/architecture.md">Architecture</a> ·
  <a href="docs/testing.md">Testing</a>
</p>

## Quick start

With Docker running, build the image and start the local setup wizard.

```sh
docker build -t select-ai-analyzer:local .
docker run --rm --name select-ai-analyzer \
  -p 127.0.0.1:8080:80 \
  -v analyzer-data:/app/apps/backend/data \
  -v analyzer-wallet:/app/apps/backend/wallet \
  -v analyzer-keys:/app/apps/backend/keys \
  -v analyzer-logs:/app/apps/backend/logs \
  select-ai-analyzer:local
```

Open [localhost:8080](http://localhost:8080). The wizard needs an Autonomous Database wallet, an application database user, and OCI access to Generative AI. The named Docker volumes retain the configuration across container restarts. For a managed lab, choose a version with a v2 manifest from the [published releases](https://github.com/jgangini/select-ai-analyzer/releases) and follow the [OCI deployment guide](terraform/README.md).

In Analytics, ask a question about a registered Oracle table or CSV-backed source. The app generates SQL through Select AI, validates it as read-only, and returns the rows and available chart data.

Select AI Analyzer is an independent project. Oracle, OCI, and related marks belong to their respective owners.

## Documentation

- [Architecture](docs/architecture.md) explains the application and OCI boundaries.
- [Use Select AI Analyzer](docs/tutorial.md) follows a Sales History question from the answer to a saved dashboard.
- [OCI deployment](terraform/README.md) explains provisioning and application access.
- [Testing](docs/testing.md) covers local checks, mock plans, and live acceptance.
- [Demo data](data/README.md) describes Sales History and Core Banking.
- [Demo video](docs/media/oci-select-analyzer-ai-ora26ai-git.mp4) shows the analytics workflow.

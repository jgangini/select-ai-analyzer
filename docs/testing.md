# Testing

Use Python 3.11, Node.js 22, PowerShell, and Terraform 1.9 or later. These checks use local fixtures and mock providers. They do not require OCI credentials.

```powershell
.\scripts\check-project.ps1 -InstallDeps
py -3 -m unittest discover -s tests -v
py -3 scripts\load_demo_data.py --validate
terraform -chdir=terraform fmt -check -recursive
terraform -chdir=terraform init -backend=false -lockfile=readonly
terraform -chdir=terraform validate
terraform -chdir=terraform test
```

The project check compiles and tests the Python backend, imports the FastAPI app, tests the React frontend, and builds its production assets. The Terraform mock tests check that new Lakehouse mode plans a database. Existing mode plans a wallet for the chosen OCID and leaves the database outside Terraform management. The hook tests verify that SFTP pins the VM host key, that the payload stays out of the command line, and that existing databases skip demo selection.

For an image smoke test, build and run the Docker image using the [quick start](../README.md#quick-start). Check /api/health for process health and /api/setup/check for installation status. An empty container should report incomplete setup. Running the image with ANALYZER_MANAGED_SETUP=1 exposes only the setup status route through Nginx and is intended for the automated OCI installer.

Before testing a published release, verify that Deploy Studio resolves its manifest from the intended tag and commit. A live acceptance run should confirm the Terraform plan, VM startup, completed setup, user login, and a Sales History query. It requires a test tenancy and incurs OCI usage. See the [tutorial](tutorial.md).

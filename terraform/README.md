# OCI Resource Manager deployment

The [Deploy Studio v2 manifest](deploy-studio.json) declares the OCI credentials, region, compartment, database mode, chat model, and application login fields.

Resource Manager provisions an Oracle Linux 9 VM, VCN, public subnet, internet gateway, security list, private Object Storage bucket, and database wallet. Terraform provisions Autonomous AI Database in **Create new** mode. In **Use existing** mode, it resolves the chosen database OCID and generates a wallet using OCI. The form does not require a wallet upload. New databases offer Lakehouse (LH) and Transaction Processing (OLTP) profiles. [OCI workload names](https://docs.oracle.com/en-us/iaas/tools/terraform-provider-oci/latest/docs/r/database_autonomous_database.html)

Deploy Studio resolves the release to `source_commit_sha`. Cloud-init fetches that commit, installs Docker, and waits for the application container. After Apply, a Deploy Studio hook verifies the VM's SSH host key through OCI console history and sends the database wallet and setup inputs over SFTP. Deploy Studio selects xai.grok-4.7 when the region offers an exact match. The installer verifies application login and runs a Select AI Analytics query for every selected demo before reporting success. For a new database, the installer loads only the selected demos. It creates and populates tables as their demo schema owners and gives the application schema read access to those tables for Select AI. The installer removes any temporary proxy access and privileges it granted for the load. Existing databases skip demo loading.

For new databases, **Settings > Questions** starts with questions for the selected demos. Saving a custom or empty library preserves that choice on subsequent demo loads.

The Resource Manager package excludes the OCI config and signing key. The application retains a private copy of the signing key on the VM for OCI requests. The deploying identity also needs permission to read the Resource Manager stack state and create and read OCI instance console connections and console history. A standalone Terraform Apply provisions infrastructure and starts the container. Deploy Studio runs the application setup hook. See the [mock Terraform checks](../docs/testing.md).

## Deploy a Sales History lab

Use [Deploy Studio](https://cloudtechnext.net/#deploy), a [release](https://github.com/jgangini/select-ai-analyzer/releases) with a v2 deployment manifest, and a test OCI compartment in a region with an available OCI Generative AI chat model.

1. Select **Select AI Analyzer** and the release. Attach your **OCI config** and **API private key**, then confirm the region and compartment.
2. In **Autonomous AI Database**, choose **Create new** and **Lakehouse · 26ai**. Enter ADMIN and wallet passwords.
3. Select a **Generative AI chat model**. Set the application username and password. Under **Schemas exposed to Select AI**, choose **Sales History (SH_DEMO)**.
4. Select **Validate** and **Deploy**. Follow Terraform and application setup in **Jobs**. When the job succeeds, the access email provides the application URL and access attachments.
5. The OCI lab serves HTTP. To sign in through an SSH tunnel, use the VM host from the access URL and the SSH key from the access package.

   ```sh
   ssh -N -L 8080:127.0.0.1:80 -i /path/to/ssh-private-key.pem opc@VM_PUBLIC_IP
   ```

6. Open [localhost:8080](http://localhost:8080) while the tunnel runs. Sign in and follow the [Sales History tutorial](../docs/tutorial.md).

## Reuse a database

Select **Use existing** and pick a compatible database in the selected region. Use the existing ADMIN password for database setup. Choose a new password for the wallet that OCI generates for this deployment. The deploying identity needs permission to list the database and generate its wallet. The VM needs a network route to the database endpoint.

The installer skips demo data and creates a privileged application schema. Use an isolated database for this lab. After setup, read `/api/config/status` through the SSH tunnel to find the generated database username under `select_ai.schema`. Use that username when reviewing grants. Register approved tables from **Data Source**. The Terraform plan should contain no new Autonomous AI Database resource.

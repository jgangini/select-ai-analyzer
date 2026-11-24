# OCI Resource Manager deployment

The [Deploy Studio v2 manifest](deploy-studio.json) declares the OCI credentials, region, compartment, database mode, chat model, and application login fields.

Resource Manager provisions an Oracle Linux 9 VM, VCN, public subnet, internet gateway, security list, private Object Storage bucket, and database wallet. Terraform provisions Autonomous AI Database in **Create new** mode. In **Use existing** mode, it resolves the chosen database OCID and generates a wallet using OCI. The form does not require a wallet upload. New databases offer Lakehouse (LH) and Transaction Processing (OLTP) profiles. [OCI workload names](https://docs.oracle.com/en-us/iaas/tools/terraform-provider-oci/latest/docs/r/database_autonomous_database.html)

Deploy Studio resolves the release to `source_commit_sha`. Cloud-init fetches that commit, installs Docker, and waits for the application container. After Apply, a Deploy Studio hook verifies the VM's SSH host key through OCI console history and sends the database wallet and setup inputs over SFTP. The installer verifies application login before reporting success. New databases can load the chosen demo schemas. Existing databases skip demo loading.

The Resource Manager package excludes the OCI config and signing key. The application retains a private copy of the signing key on the VM for OCI requests. The deploying identity also needs permission to read the Resource Manager stack state and create and read OCI instance console connections and console history. A standalone Terraform Apply provisions infrastructure and starts the container. Deploy Studio runs the application setup hook. See [access and validation](../docs/tutorial.md) and [mock Terraform checks](../docs/testing.md).

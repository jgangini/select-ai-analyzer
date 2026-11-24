# Deploy Select AI Analyzer and query Sales History

Use [Deploy Studio](https://cloudtechnext.net/#deploy), a release that declares the Deploy Studio v2 contract, and an OCI account authorized to create the lab resources. The selected region must have an available OCI Generative AI chat model. Use a test compartment and demo data.

1. Select **Select AI Analyzer** and a compatible release.
2. Attach your **OCI config** and **API private key**. Confirm the region and choose the compartment.
3. Under **Autonomous AI Database**, choose **Create new** and **Lakehouse · 26ai**. Enter the database ADMIN and wallet passwords.
4. Select a **Generative AI chat model** from the list. Set the application username and password. Under **Schemas exposed to Select AI**, select **Sales History (SH_DEMO)**.
5. Select **Validate** and **Deploy**. Monitor the Terraform and application setup stages in Jobs. A successful run includes the application access email and available attachments.
6. For the HTTP lab image, use the SSH key from the access package to reach the application through a tunnel. Choose the VM host from the email's access URL and run the following command with the appropriate local key path.

   ```sh
   ssh -N -L 8080:127.0.0.1:80 -i /path/to/ssh-private-key.pem opc@VM_PUBLIC_IP
   ```

7. Open [localhost:8080](http://localhost:8080) while the tunnel runs. Sign in with the application username and password. Open **Analytics** and ask “Show the 10 products with the highest total sales.” Inspect the generated SQL and confirm that the results come from Sales History.

## Reuse a database

Select **Use existing**, then choose an available database in the selected region. Enter its ADMIN password and a password for the wallet that OCI generates. The OCI identity needs permission to list the database and generate its wallet. The VM needs a network route to the database endpoint.

The installer skips demo data in this mode. After setup, query http://localhost:8080/api/config/status through the SSH tunnel to find the generated database username under select_ai.schema. Use that database username when reviewing privileges and register the intended tables from **Data Sources**. The application installer uses a privileged schema. Deploy Studio verifies the VM identity over OCI console history before sending its private setup inputs. The OCI identity needs access to Resource Manager stack state and permission to manage instance console connections and console history. Use an isolated database for this lab. Review the Terraform plan to confirm it contains no new Autonomous AI Database resource.

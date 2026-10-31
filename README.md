# SmartDeploy
Self-healing microservices platform on Azure.
3 services · GitHub Actions CI · DockerACR · AKS · ArgoCD GitOps · Prometheus · Azure Logic Apps auto-rollback

## Local service console

Start all three backend services in separate PowerShell terminals:

```powershell
npm --prefix product-catalog start
```

```powershell
$env:PORT=3001; npm --prefix order-service start
```

```powershell
$env:PORT=3002; npm --prefix notification-service start
```

Then start the React dashboard:

```powershell
cd ui
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). The dashboard connects to Product Catalog on port 3000, Order Service on port 3001, and Notification Service on port 3002.

Run the backend tests with:

```powershell
npm --prefix product-catalog test
npm --prefix order-service test
npm --prefix notification-service test
```

## Test Kubernetes deployment and rollback without Azure

This tests the Helm release and Kubernetes rollout locally. It does not test Azure, ACR, Argo CD, or the GitHub-triggered Logic App workflow. Start Docker Desktop and wait for its engine to be ready; install `k3d`, `kubectl`, and Helm first.

Create a local registry and cluster once:

```powershell
k3d registry create smartdeploy.localhost --port 5001
k3d cluster create smartdeploy-local --registry-use k3d-smartdeploy.localhost:5001
kubectl config use-context k3d-smartdeploy-local
kubectl get nodes
```

Build and push a working Product Catalog image, then get its registry digest:

```powershell
docker build -t localhost:5001/product-catalog:good .\product-catalog
docker push localhost:5001/product-catalog:good

$headers = @{
  Accept = "application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json"
}
$goodDigest = (Invoke-WebRequest "http://localhost:5001/v2/product-catalog/manifests/good" -Headers $headers).Headers["Docker-Content-Digest"]
if ($goodDigest -notmatch '^sha256:[0-9a-f]{64}$') { throw "Could not read the local image digest." }
```

Deploy the working image, then deliberately attempt an upgrade to a valid-shaped but nonexistent digest. The upgrade is expected to fail with an image-pull error:

```powershell
helm upgrade --install product-catalog .\helm `
  --namespace dev --create-namespace `
  --values .\helm\values-product-catalog-dev.yaml `
  --set-string image.repository=k3d-smartdeploy.localhost:5001/product-catalog `
  --set-string image.digest=$goodDigest `
  --wait --timeout 120s

$missingDigest = "sha256:" + ("0" * 64)
helm upgrade product-catalog .\helm `
  --namespace dev `
  --values .\helm\values-product-catalog-dev.yaml `
  --set-string image.repository=k3d-smartdeploy.localhost:5001/product-catalog `
  --set-string image.digest=$missingDigest `
  --wait --timeout 45s
if ($LASTEXITCODE -eq 0) { throw "The deliberately invalid image digest unexpectedly deployed." }
```

Roll back to the successful first Helm revision and verify the deployment:

```powershell
helm history product-catalog --namespace dev
helm rollback product-catalog 1 --namespace dev --wait --timeout 120s
kubectl rollout status deployment/product-catalog --namespace dev --timeout=120s
kubectl get deployment product-catalog --namespace dev `
  -o jsonpath="{.spec.template.spec.containers[0].image}"
```

The final image should end in `@$goodDigest`. Check `kubectl config current-context` before running Kubernetes commands so you do not target another cluster.

## DevSecOps release flow

- Pull requests run the three service test/lint jobs, build the React UI, scan source/dependencies/secrets/IaC with Trivy, and lint all nine service/environment Helm configurations.
- A push to `dev` builds and scans all three backend images before pushing commit-tagged images only when the repository variable `AZURE_DEPLOY_ENABLED` is set to `true`. CI then resolves each registry digest and commits only those immutable digests to the dev Helm values; Argo CD deploys those exact digests. Leave it unset or set it to `false` while Azure is unavailable; the test, scan, and chart validation jobs still run.
- Use **Actions → Promote verified images → Run workflow** to create a promotion pull request for staging or production. This copies the dev digests; it does not rebuild images. Configure GitHub Environments named `staging` and `production` with required reviewers and protect both branches with PR reviews and required CI checks. Merge the PR to let Argo CD deploy.
- Critical high-error-rate alerts are validated by the Logic App and dispatched to the GitOps rollback workflow. Dev is rolled back directly in Git; staging and production get a narrowly scoped rollback PR, subject to normal branch review. Argo CD performs the rollback after that change is merged.

The dev release uses GitHub OIDC; after Azure is available, set the repository variable `AZURE_DEPLOY_ENABLED=true` and configure repository variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID`, plus an Azure federated credential for `repo:Chaima-Jlassi/SmartDeploy:environment:dev`. Grant that identity `AcrPush` on `smartdeployacr` only. The GitHub Actions token must be allowed to commit image digest updates to `dev` for releases and dev rollbacks; promotion and staging/production rollback changes use pull requests. Allow the token to create those branches and pull requests, and require review/CI checks before merging into `staging` and `main`.

Dependency audits currently fail the pipeline on high or critical npm advisories; moderate findings may remain and should be reviewed during dependency updates.

Deploy the Logic App from `automation/logicapp.bicep` and provide its `githubToken` secure parameter through an approved secret-injected deployment process. Use a fine-grained GitHub token scoped to this repository with Contents: write permission. Then regenerate the Logic App request-trigger callback URL and provision it into the Kubernetes `logicapp-webhook` Secret as described below. Do not store either token or callback URL in Git.

## Rotate the Logic App webhook secret

The Alertmanager configuration references a Kubernetes Secret named `logicapp-webhook` in the `monitoring` namespace. Never commit the Logic App callback URL to Git or pass it as a command-line argument.

1. In Azure, regenerate or replace the Logic App HTTP Request trigger callback URL. Disable the old callback URL and confirm it is no longer accepted.
2. From a PowerShell session authenticated to the intended AKS cluster, run:

   ```powershell
   .\automation\set-logicapp-webhook-secret.ps1
   ```

   Paste the new URL into the secure prompt. The script applies it to the `monitoring` namespace without printing or writing the URL to a file.
3. Confirm the Secret exists without displaying its value:

   ```powershell
   kubectl describe secret logicapp-webhook --namespace monitoring
   ```

The cluster must have the `monitoring` namespace and the Alertmanager configuration deployed. Kubernetes Secrets are base64-encoded, not encrypted by default; enable AKS encryption at rest and restrict RBAC access to this Secret.

AKS workload identity is enabled. The kubelet identity is scoped only to ACR image pulls; do not grant it Key Vault secret access. Configure a dedicated workload identity and federated service account before any workload needs Key Vault secrets.

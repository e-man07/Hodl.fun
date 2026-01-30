# Phase 3: Container Infrastructure

## Objective
Set up GKE Autopilot cluster and Artifact Registry for container deployment.

## Prerequisites
- Phase 1 completed (VPC, IAM)

## Duration: 1-2 days

---

## 3.1 Artifact Registry

### Create Repository

```hcl
# terraform/artifact-registry.tf

resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = "hodlfun"
  description   = "Hodl.fun container images"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-minimum-versions"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }
}

output "artifact_registry_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
}
```

---

## 3.2 GKE Autopilot Cluster

### Cluster Configuration

```hcl
# terraform/gke.tf

resource "google_container_cluster" "main" {
  name     = "hodlfun-cluster"
  location = var.region

  # Enable Autopilot
  enable_autopilot = true

  # Network configuration
  network    = google_compute_network.main.name
  subnetwork = google_compute_subnetwork.private.name

  ip_allocation_policy {
    cluster_secondary_range_name  = "gke-pods"
    services_secondary_range_name = "gke-services"
  }

  # Private cluster
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0"  # Restrict in production
      display_name = "All networks"
    }
  }

  # Release channel
  release_channel {
    channel = "REGULAR"
  }

  # Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Logging & Monitoring
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
    managed_prometheus {
      enabled = true
    }
  }

  # Maintenance window
  maintenance_policy {
    recurring_window {
      start_time = "2024-01-01T04:00:00Z"
      end_time   = "2024-01-01T08:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SU"
    }
  }

  # DNS
  dns_config {
    cluster_dns        = "CLOUD_DNS"
    cluster_dns_scope  = "CLUSTER_SCOPE"
  }

  deletion_protection = var.environment == "production"
}
```

---

## 3.3 Kubernetes Namespace & Service Account

### Namespace Configuration

```yaml
# k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: hodlfun
  labels:
    app: hodlfun
---
# k8s/base/service-account.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: backend
  namespace: hodlfun
  annotations:
    iam.gke.io/gcp-service-account: hodlfun-backend@PROJECT_ID.iam.gserviceaccount.com
```

### Resource Quotas

```yaml
# k8s/base/resource-quota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: hodlfun
spec:
  hard:
    requests.cpu: "20"
    requests.memory: "40Gi"
    limits.cpu: "40"
    limits.memory: "80Gi"
    pods: "50"
```

---

## 3.4 ConfigMaps

### Base ConfigMap

```yaml
# k8s/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
  namespace: hodlfun
data:
  NODE_ENV: "production"
  PORT: "3000"
  WS_PORT: "3001"
  INDEXER_PORT: "3002"
  WORKER_PORT: "3003"

  # Chain configuration
  CHAIN_ID: "42101"
  RPC_URL: "https://evm.rpc-testnet-donut-node1.push.org/"

  # Contract addresses
  CORE_ADDRESS: "0x592F8f0abbB9a3d3c425980Ac0263363C8405b03"
  FACTORY_ADDRESS: "0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8"
  FEE_VAULT_ADDRESS: "0xbe2fd9b720d1d7fac7208523376d2a3332019928"
  WPUSH_ADDRESS: "0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7"

  # Indexer settings
  INDEXER_POLL_INTERVAL: "5000"
  INDEXER_BATCH_SIZE: "100"

  # Cache TTL (seconds)
  CACHE_TTL_TOKEN: "10"
  CACHE_TTL_PRICE: "5"
  CACHE_TTL_LEADERBOARD: "30"
```

### External Secrets (via Secret Manager)

```yaml
# k8s/base/external-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
  namespace: hodlfun
type: Opaque
# Note: In production, use External Secrets Operator or similar
# to sync from GCP Secret Manager
stringData:
  DATABASE_URL: "PLACEHOLDER"
  REDIS_URL: "PLACEHOLDER"
  JWT_SECRET: "PLACEHOLDER"
  JWT_REFRESH_SECRET: "PLACEHOLDER"
```

---

## 3.5 Kustomize Structure

### Base Kustomization

```yaml
# k8s/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: hodlfun

resources:
  - namespace.yaml
  - service-account.yaml
  - resource-quota.yaml
  - configmap.yaml
  - api/
  - websocket/
  - indexer/
  - worker/

commonLabels:
  app.kubernetes.io/part-of: hodlfun
```

### Staging Overlay

```yaml
# k8s/overlays/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: hodlfun

resources:
  - ../../base

namePrefix: staging-

patches:
  - path: replicas-patch.yaml
  - path: configmap-patch.yaml

images:
  - name: backend
    newName: us-central1-docker.pkg.dev/PROJECT_ID/hodlfun/backend
    newTag: staging
```

### Production Overlay

```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: hodlfun

resources:
  - ../../base

namePrefix: prod-

patches:
  - path: replicas-patch.yaml
  - path: configmap-patch.yaml

images:
  - name: backend
    newName: us-central1-docker.pkg.dev/PROJECT_ID/hodlfun/backend
    newTag: latest
```

---

## 3.6 Verification Checklist

### Artifact Registry
- [ ] Repository created
- [ ] Docker authentication configured
- [ ] Test push successful

### GKE Cluster
- [ ] Cluster created and running
- [ ] kubectl access working
- [ ] Workload Identity enabled
- [ ] Private cluster with NAT

### Kubernetes
- [ ] Namespace created
- [ ] Service account bound to GCP SA
- [ ] ConfigMaps applied
- [ ] Resource quotas set

## Manual Verification Commands

```bash
# Get cluster credentials
gcloud container clusters get-credentials hodlfun-cluster --region us-central1

# Check cluster status
kubectl get nodes

# Check namespace
kubectl get ns hodlfun

# Authenticate to Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Test image push
docker pull nginx:alpine
docker tag nginx:alpine us-central1-docker.pkg.dev/PROJECT_ID/hodlfun/test:latest
docker push us-central1-docker.pkg.dev/PROJECT_ID/hodlfun/test:latest

# Apply base configuration
kubectl apply -k k8s/base/

# Verify resources
kubectl get all -n hodlfun
```

## Next Phase
Proceed to **Phase 4: Core Backend** to scaffold the NestJS application.

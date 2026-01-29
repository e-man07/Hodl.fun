# Phase 1: GCP Foundation

## Objective
Set up the foundational GCP infrastructure including networking, IAM, and secrets management.

## Prerequisites
- GCP Project created
- Billing enabled
- `gcloud` CLI installed and authenticated

## Duration: 2-3 days

---

## 1.1 VPC Network Setup

### Create VPC with Private Subnets

```hcl
# terraform/network.tf

resource "google_compute_network" "main" {
  name                    = "hodlfun-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id
}

resource "google_compute_subnetwork" "private" {
  name          = "hodlfun-private-subnet"
  ip_cidr_range = "10.0.0.0/20"
  region        = var.region
  network       = google_compute_network.main.id

  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "gke-pods"
    ip_cidr_range = "10.4.0.0/14"
  }

  secondary_ip_range {
    range_name    = "gke-services"
    ip_cidr_range = "10.8.0.0/20"
  }
}
```

### Private Service Access (for Cloud SQL & Memorystore)

```hcl
resource "google_compute_global_address" "private_ip_range" {
  name          = "private-ip-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}
```

### Cloud NAT (for outbound internet from private pods)

```hcl
resource "google_compute_router" "router" {
  name    = "hodlfun-router"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "hodlfun-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}
```

---

## 1.2 IAM & Service Accounts

### Service Accounts

```hcl
# terraform/iam.tf

# GKE Node Service Account
resource "google_service_account" "gke_nodes" {
  account_id   = "gke-nodes"
  display_name = "GKE Node Service Account"
}

# Backend Application Service Account
resource "google_service_account" "backend" {
  account_id   = "hodlfun-backend"
  display_name = "Hodl.fun Backend Service Account"
}

# CI/CD Service Account (for GitHub Actions)
resource "google_service_account" "cicd" {
  account_id   = "hodlfun-cicd"
  display_name = "Hodl.fun CI/CD Service Account"
}
```

### IAM Bindings

```hcl
# GKE nodes need these roles
resource "google_project_iam_member" "gke_nodes_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/artifactregistry.reader",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

# Backend service account needs these
resource "google_project_iam_member" "backend_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/storage.objectViewer",
    "roles/storage.objectCreator",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.backend.email}"
}

# CI/CD service account
resource "google_project_iam_member" "cicd_roles" {
  for_each = toset([
    "roles/container.developer",
    "roles/artifactregistry.writer",
    "roles/cloudbuild.builds.builder",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cicd.email}"
}
```

### Workload Identity (for GKE pods)

```hcl
# Allow Kubernetes service account to impersonate GCP service account
resource "google_service_account_iam_member" "workload_identity" {
  service_account_id = google_service_account.backend.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[hodlfun/backend]"
}
```

---

## 1.3 Secret Manager

### Create Secrets

```hcl
# terraform/secrets.tf

resource "google_secret_manager_secret" "database_url" {
  secret_id = "database-url"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "redis_url" {
  secret_id = "redis-url"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "jwt_refresh_secret" {
  secret_id = "jwt-refresh-secret"

  replication {
    auto {}
  }
}

# Generate and store JWT secrets
resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt_secret.result
}
```

---

## 1.4 Enable Required APIs

```hcl
# terraform/apis.tf

resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "container.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "servicenetworking.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "storage.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}
```

---

## 1.5 Variables & Outputs

### Variables

```hcl
# terraform/variables.tf

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment (staging, production)"
  type        = string
  default     = "staging"
}
```

### Outputs

```hcl
# terraform/outputs.tf

output "vpc_id" {
  value = google_compute_network.main.id
}

output "subnet_id" {
  value = google_compute_subnetwork.private.id
}

output "backend_service_account_email" {
  value = google_service_account.backend.email
}
```

---

## Verification Checklist

- [ ] VPC created with private subnet
- [ ] Private Service Access enabled
- [ ] Cloud NAT configured
- [ ] Service accounts created with minimal permissions
- [ ] Workload Identity binding configured
- [ ] Secrets created in Secret Manager
- [ ] All required APIs enabled

## Manual Verification Commands

```bash
# List VPC networks
gcloud compute networks list

# List service accounts
gcloud iam service-accounts list

# List secrets
gcloud secrets list

# Test Private Service Access
gcloud services vpc-peerings list --network=hodlfun-vpc
```

## Next Phase
Proceed to **Phase 2: Data Layer** to set up Cloud SQL and Memorystore.

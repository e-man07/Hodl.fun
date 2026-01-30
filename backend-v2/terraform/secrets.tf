# JWT Secret
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "hodlfun-${var.environment}-jwt-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt_secret.result
}

# JWT Refresh Secret
resource "random_password" "jwt_refresh_secret" {
  length  = 64
  special = true
}

resource "google_secret_manager_secret" "jwt_refresh_secret" {
  secret_id = "hodlfun-${var.environment}-jwt-refresh-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "jwt_refresh_secret" {
  secret      = google_secret_manager_secret.jwt_refresh_secret.id
  secret_data = random_password.jwt_refresh_secret.result
}

# Placeholder secrets for external services
resource "google_secret_manager_secret" "rpc_url" {
  secret_id = "hodlfun-${var.environment}-rpc-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "rpc_url" {
  secret      = google_secret_manager_secret.rpc_url.id
  secret_data = "https://evm.rpc-testnet-donut-node1.push.org/"
}

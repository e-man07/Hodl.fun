output "vpc_name" {
  description = "VPC network name"
  value       = google_compute_network.main.name
}

output "gke_cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.main.name
}

output "gke_cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = google_container_cluster.main.endpoint
  sensitive   = true
}

output "cloudsql_instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.main.name
}

output "cloudsql_private_ip" {
  description = "Cloud SQL private IP address"
  value       = google_sql_database_instance.main.private_ip_address
  sensitive   = true
}

output "redis_host" {
  description = "Redis host"
  value       = google_redis_instance.main.host
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = google_redis_instance.main.port
}

output "workload_service_account" {
  description = "Workload service account email"
  value       = google_service_account.workload.email
}

output "secret_names" {
  description = "Secret Manager secret names"
  value = {
    database_url       = google_secret_manager_secret.db_url.secret_id
    redis_url          = google_secret_manager_secret.redis_url.secret_id
    jwt_secret         = google_secret_manager_secret.jwt_secret.secret_id
    jwt_refresh_secret = google_secret_manager_secret.jwt_refresh_secret.secret_id
  }
}

import type { Alert, AlertType } from '@/types';
import { apiClient } from './client';

export interface CreateAlertRequest {
  tokenAddress: string;
  alertType: AlertType;
  targetPrice?: string;
}

export interface UpdateAlertRequest {
  alertType?: AlertType;
  targetPrice?: string;
  isActive?: boolean;
}

/**
 * Create a new price alert (requires auth)
 */
export async function createAlert(data: CreateAlertRequest): Promise<Alert> {
  return apiClient.post<Alert>('alerts', {
    json: data,
  });
}

/**
 * Get user's alerts (requires auth)
 */
export async function getAlerts(): Promise<Alert[]> {
  return apiClient.get<Alert[]>('alerts');
}

/**
 * Get single alert (requires auth)
 */
export async function getAlert(id: string): Promise<Alert> {
  return apiClient.get<Alert>(`alerts/${id}`);
}

/**
 * Update an alert (requires auth)
 */
export async function updateAlert(id: string, data: UpdateAlertRequest): Promise<Alert> {
  return apiClient.put<Alert>(`alerts/${id}`, {
    json: data,
  });
}

/**
 * Delete an alert (requires auth)
 */
export async function deleteAlert(id: string): Promise<void> {
  await apiClient.delete<void>(`alerts/${id}`);
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/queries/keys';
import {
  createAlert,
  updateAlert,
  deleteAlert,
  type CreateAlertRequest,
  type UpdateAlertRequest,
} from '@/lib/api/alerts';

/**
 * Mutation to create a new alert
 */
export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAlertRequest) => createAlert(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.alerts.all,
      });
    },
  });
}

/**
 * Mutation to update an alert
 */
export function useUpdateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAlertRequest }) =>
      updateAlert(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.alerts.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.alerts.detail(id),
      });
    },
  });
}

/**
 * Mutation to delete an alert
 */
export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.alerts.all,
      });
    },
  });
}

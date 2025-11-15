// IPFS API endpoints

import apiClient from './client';
import { ApiResponse, IPFSUploadResponse } from './types';

/**
 * Upload image to IPFS
 */
export async function uploadImage(
  file: File,
  name?: string
): Promise<ApiResponse<IPFSUploadResponse>> {
  const formData = new FormData();
  formData.append('file', file);
  if (name) {
    formData.append('name', name);
  }

  return apiClient.post('/ipfs/upload-image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

/**
 * Upload metadata to IPFS
 */
export async function uploadMetadata(metadata: {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  social?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
}): Promise<ApiResponse<IPFSUploadResponse>> {
  return apiClient.post('/ipfs/upload-metadata', metadata);
}

/**
 * Get metadata from IPFS (cached)
 */
export async function getMetadata(hash: string): Promise<ApiResponse<Record<string, unknown>>> {
  return apiClient.get(`/ipfs/${hash}`);
}

import request from "@/lib/request"
import type {
  CoreInfo,
  CoreInfoTreeResponse,
  UpdateCoreInfoPayload,
} from "@/types/api"

export const coreInfoService = {
  getByDocument: (documentId: string): Promise<CoreInfoTreeResponse> =>
    request.get(`/api/v1/core-info/document/${documentId}`),

  get: (coreInfoId: string): Promise<CoreInfo> =>
    request.get(`/api/v1/core-info/${coreInfoId}`),

  update: (coreInfoId: string, payload: UpdateCoreInfoPayload): Promise<CoreInfo> =>
    request.put(`/api/v1/core-info/${coreInfoId}`, payload),

  delete: (coreInfoId: string): Promise<void> =>
    request.delete(`/api/v1/core-info/${coreInfoId}`),

  lock: (coreInfoId: string): Promise<CoreInfo> =>
    request.post(`/api/v1/core-info/${coreInfoId}/lock`),

  unlock: (coreInfoId: string): Promise<CoreInfo> =>
    request.post(`/api/v1/core-info/${coreInfoId}/unlock`),

  reorder: (documentId: string, payload: { parent_id: string | null; ordered_ids: string[] }): Promise<void> =>
    request.post(`/api/v1/core-info/documents/${documentId}/reorder`, payload),
}

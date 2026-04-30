import request from "@/lib/request"
import type {
  Summary,
  SummaryListResponse,
  UpdateSummaryPayload,
} from "@/types/api"

export const summaryService = {
  getByDocument: (documentId: string): Promise<SummaryListResponse> =>
    request.get(`/api/v1/documents/${documentId}/summaries`),

  get: (summaryId: string): Promise<Summary> =>
    request.get(`/api/v1/summaries/${summaryId}`),

  create: (documentId: string): Promise<Summary> =>
    request.post(`/api/v1/documents/${documentId}/summaries`),

  update: (summaryId: string, payload: UpdateSummaryPayload): Promise<Summary> =>
    request.put(`/api/v1/summaries/${summaryId}`, payload),

  delete: (summaryId: string): Promise<void> =>
    request.delete(`/api/v1/summaries/${summaryId}`),

  insertAfter: (summaryId: string): Promise<Summary> =>
    request.post(`/api/v1/summaries/${summaryId}/insert-after`),

  applyAI: (summaryId: string): Promise<Summary> =>
    request.post(`/api/v1/summaries/${summaryId}/ai/apply`),

  reorder: (documentId: string, orderedIds: string[]): Promise<void> =>
    request.post(`/api/v1/documents/${documentId}/summaries/reorder`, { ordered_ids: orderedIds }),
}

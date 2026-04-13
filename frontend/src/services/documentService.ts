import request from "@/lib/request"
import type {
  DocumentListItem,
  DocumentListResponse,
  DocumentDetail,
  CreateDocumentPayload,
  UpdateDocumentPayload,
} from "@/types/api"

export const documentService = {
  list: (params?: { page?: number; page_size?: number }): Promise<DocumentListResponse> =>
    request.get("/api/v1/documents", { params }),

  get: (documentId: string): Promise<DocumentDetail> =>
    request.get(`/api/v1/documents/${documentId}`),

  create: (payload: CreateDocumentPayload): Promise<DocumentListItem> =>
    request.post("/api/v1/documents", payload),

  update: (documentId: string, payload: UpdateDocumentPayload): Promise<DocumentListItem> =>
    request.put(`/api/v1/documents/${documentId}`, payload),

  delete: (documentId: string): Promise<void> =>
    request.delete(`/api/v1/documents/${documentId}`),

  applyCoreInfoTemplate: (documentId: string): Promise<{ message: string; items: unknown[] }> =>
    request.post(`/api/v1/documents/${documentId}/apply-core-info-template`),

  applySummaryTemplate: (documentId: string): Promise<{ message: string; items: unknown[] }> =>
    request.post(`/api/v1/documents/${documentId}/apply-summary-template`),

  applyStructureTemplate: (documentId: string): Promise<{ message: string; items: unknown[] }> =>
    request.post(`/api/v1/documents/${documentId}/apply-structure-template`),
}

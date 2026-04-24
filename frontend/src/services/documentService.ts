import request, { fetchStream, getAuthHeaders } from "@/lib/request"
import type {
  DocumentExportFormat,
  DocumentListItem,
  DocumentListResponse,
  DocumentDetail,
  DocumentSnapshot,
  DocumentSnapshotListResponse,
  CreateDocumentPayload,
  TemplateDetail,
  TemplateInfoResponse,
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

  getSnapshots: (documentId: string): Promise<DocumentSnapshotListResponse> =>
    request.get(`/api/v1/documents/${documentId}/snapshots`),

  createSnapshot: (documentId: string): Promise<DocumentSnapshot> =>
    request.post(`/api/v1/documents/${documentId}/snapshots`),

  restoreSnapshot: (documentId: string, snapshotId: string): Promise<void> =>
    request.post(`/api/v1/documents/${documentId}/snapshots/${snapshotId}/restore`),

  getTemplateInfo: (documentId: string): Promise<TemplateInfoResponse> =>
    request.get(`/api/v1/documents/${documentId}/template-info`),

  exportTemplate: (documentId: string, payload?: { display_name?: string }): Promise<TemplateDetail> =>
    request.post(
      `/api/v1/documents/${documentId}/export-template`,
      payload?.display_name ? { display_name: payload.display_name } : {}
    ),

  syncTemplate: (documentId: string): Promise<TemplateDetail> =>
    request.post(`/api/v1/documents/${documentId}/sync-template`),

  exportFile: async (documentId: string, format: DocumentExportFormat): Promise<Blob> => {
    // 返回二进制文件，不走 axios 响应拦截器，使用 fetchStream
    const response = await fetchStream(`/api/v1/documents/${documentId}/export/${format}`)

    const contentType = response.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      const errorBody = await response.json().catch(() => null)
      throw new Error(errorBody?.message || "导出失败")
    }

    if (!response.ok) {
      throw new Error("导出失败")
    }

    return response.blob()
  },

  applyCoreInfoTemplate: (documentId: string): Promise<{ message: string; items: unknown[] }> =>
    request.post(`/api/v1/documents/${documentId}/apply-core-info-template`),

  // AI 总结模式可能耗时较长，使用 fetchStream 绕过 axios 30s timeout
  applySummaryTemplate: async (documentId: string): Promise<{ message: string; items: unknown[] }> => {
    const res = await fetchStream(`/api/v1/documents/${documentId}/apply-summary-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    const data = await res.json()
    if (data.code !== 200) throw new Error(data.message || "应用摘要模板失败")
    return data.data
  },

  applyStructureTemplate: async (documentId: string): Promise<{ message: string; items: unknown[] }> => {
    const res = await fetchStream(`/api/v1/documents/${documentId}/apply-structure-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    const data = await res.json()
    if (data.code !== 200) throw new Error(data.message || "应用章节结构模板失败")
    return data.data
  },
}

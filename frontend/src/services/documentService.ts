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

  applySummaryTemplate: async (documentId: string): Promise<{ message: string; items: unknown[] }> => {
    // AI 总结模式可能耗时较长，使用原生 fetch 避免 axios timeout
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const res = await fetch(`/api/v1/documents/${documentId}/apply-summary-template`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    const data = await res.json()
    if (data.code !== 200) throw new Error(data.message || "应用摘要模板失败")
    return data.data
  },

  applyStructureTemplate: async (documentId: string): Promise<{ message: string; items: unknown[] }> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const res = await fetch(`/api/v1/documents/${documentId}/apply-structure-template`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    const data = await res.json()
    if (data.code !== 200) throw new Error(data.message || "应用章节结构模板失败")
    return data.data
  },
}

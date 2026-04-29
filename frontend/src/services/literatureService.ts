import request, { fetchStream } from "@/lib/request"
import type {
  Literature,
  LiteratureListResponse,
  UpdateLiteraturePayload,
  UploadLiteraturePayload,
  ParagraphLiteratureUploadPayload,
} from "@/types/api"

export const literatureService = {
  list: (scope?: "public" | "private"): Promise<LiteratureListResponse> =>
    request.get("/api/v1/literature", { params: scope ? { scope } : undefined }),

  get: (literatureId: string): Promise<Literature> =>
    request.get(`/api/v1/literature/${literatureId}`),

  upload: async (payload: UploadLiteraturePayload): Promise<Literature> => {
    const form = new FormData()
    form.append("file", payload.file)
    if (payload.title) form.append("title", payload.title)
    if (payload.authors) form.append("authors", payload.authors)
    if (payload.journal) form.append("journal", payload.journal)
    if (payload.doi) form.append("doi", payload.doi)
    if (payload.impact_factor != null) form.append("impact_factor", String(payload.impact_factor))
    return request.post("/api/v1/literature", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },

  update: (literatureId: string, payload: UpdateLiteraturePayload): Promise<Literature> =>
    request.put(`/api/v1/literature/${literatureId}`, payload),

  delete: (literatureId: string): Promise<void> =>
    request.delete(`/api/v1/literature/${literatureId}`),

  retry: (literatureId: string): Promise<Literature> =>
    request.post(`/api/v1/literature/${literatureId}/retry`),

  // 模板绑定
  listByTemplate: (templateId: string): Promise<LiteratureListResponse> =>
    request.get(`/api/v1/templates/${templateId}/literature`),

  bind: (templateId: string, literatureId: string): Promise<void> =>
    request.post(`/api/v1/templates/${templateId}/literature/${literatureId}`),

  unbind: (templateId: string, literatureId: string): Promise<void> =>
    request.delete(`/api/v1/templates/${templateId}/literature/${literatureId}`),

  // 段落文献管理
  uploadToParagraph: async (
    paragraphId: string,
    payload: ParagraphLiteratureUploadPayload
  ): Promise<Literature> => {
    const form = new FormData()
    form.append("file", payload.file)
    if (payload.title) form.append("title", payload.title)
    if (payload.authors) form.append("authors", payload.authors)
    if (payload.journal) form.append("journal", payload.journal)
    if (payload.doi) form.append("doi", payload.doi)
    if (payload.impact_factor != null) form.append("impact_factor", String(payload.impact_factor))
    return request.post(`/api/v1/paragraphs/${paragraphId}/literature/upload`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },

  bindToParagraph: (paragraphId: string, literatureId: string): Promise<void> =>
    request.post(`/api/v1/paragraphs/${paragraphId}/literature/${literatureId}`),

  unbindFromParagraph: (paragraphId: string, literatureId: string): Promise<void> =>
    request.delete(`/api/v1/paragraphs/${paragraphId}/literature/${literatureId}`),
}

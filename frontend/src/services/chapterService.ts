import request from "@/lib/request"
import type {
  ChapterTreeResponse,
  Chapter,
  UpdateChapterPayload,
  FullContentResponse,
} from "@/types/api"

export const chapterService = {
  getTree: (documentId: string): Promise<ChapterTreeResponse> =>
    request.get(`/api/v1/chapters/document/${documentId}/tree`),

  getDetail: (chapterId: string): Promise<Chapter> =>
    request.get(`/api/v1/chapters/${chapterId}`),

  getFullContent: (documentId: string): Promise<FullContentResponse> =>
    request.get(`/api/v1/documents/${documentId}/full-content`),

  create: (documentId: string): Promise<Chapter> =>
    request.post(`/api/v1/chapters/${documentId}`),

  createSub: (documentId: string, parentId: string): Promise<Chapter> =>
    request.post(`/api/v1/chapters/${documentId}/sub/${parentId}`),

  insertAfter: (documentId: string, afterChapterId: string): Promise<Chapter> =>
    request.post(`/api/v1/chapters/${documentId}/insert-after/${afterChapterId}`),

  update: (chapterId: string, payload: UpdateChapterPayload): Promise<Chapter> =>
    request.put(`/api/v1/chapters/${chapterId}`, payload),

  delete: (chapterId: string): Promise<void> =>
    request.delete(`/api/v1/chapters/${chapterId}`),

  reorder: (documentId: string, payload: { parent_id: string | null; ordered_ids: string[] }): Promise<void> =>
    request.post(`/api/v1/chapters/${documentId}/reorder`, payload),
}

import request from "@/lib/request"
import type {
  Paragraph,
  ParagraphListResponse,
  CreateParagraphPayload,
  UpdateParagraphPayload,
} from "@/types/api"

export const paragraphService = {
  getByChapter: (chapterId: string): Promise<ParagraphListResponse> =>
    request.get(`/api/v1/chapters/${chapterId}/paragraphs`),

  get: (paragraphId: string): Promise<Paragraph> =>
    request.get(`/api/v1/paragraphs/${paragraphId}`),

  create: (chapterId: string, payload: CreateParagraphPayload): Promise<Paragraph> =>
    request.post(`/api/v1/chapters/${chapterId}/paragraphs`, payload),

  insertAfter: (paragraphId: string, payload: CreateParagraphPayload): Promise<Paragraph> =>
    request.post(`/api/v1/paragraphs/${paragraphId}/insert-after`, payload),

  update: (paragraphId: string, payload: UpdateParagraphPayload): Promise<Paragraph> =>
    request.put(`/api/v1/paragraphs/${paragraphId}`, payload),

  delete: (paragraphId: string): Promise<void> =>
    request.delete(`/api/v1/paragraphs/${paragraphId}`),

  applyAI: (paragraphId: string): Promise<Paragraph> =>
    request.post(`/api/v1/paragraphs/${paragraphId}/ai/apply`),
}

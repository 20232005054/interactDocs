import request from "@/lib/request"
import type {
  Template,
  TemplateDetail,
  TemplateListResponse,
  TemplateListParams,
  CreateTemplatePayload,
  UpdateTemplatePayload,
  CoreInfoTemplate,
  CoreInfoTemplateListResponse,
  CreateCoreInfoTemplatePayload,
  UpdateCoreInfoTemplatePayload,
  CoreInfoTemplateReorderPayload,
  SummaryTemplate,
  SummaryTemplateListResponse,
  CreateSummaryTemplatePayload,
  UpdateSummaryTemplatePayload,
  StructureTemplate,
  StructureTemplateTreeResponse,
  CreateStructureTemplatePayload,
  UpdateStructureTemplatePayload,
  StructureTemplateReorderPayload,
} from "@/types/api"

// ============================================================
// 模板主表
// ============================================================
export const templateService = {
  list: (params?: TemplateListParams): Promise<TemplateListResponse> =>
    request.get("/api/v1/templates", { params }),

  get: (templateId: string): Promise<TemplateDetail> =>
    request.get(`/api/v1/templates/${templateId}`),

  create: (payload: CreateTemplatePayload): Promise<TemplateDetail> =>
    request.post("/api/v1/templates", {
      purpose: payload.purpose,
      display_name: payload.display_name,
      content: payload.content ?? {},
      template_type: payload.template_type ?? 1,
    }),

  update: (templateId: string, payload: UpdateTemplatePayload): Promise<Template> =>
    request.put(`/api/v1/templates/${templateId}`, payload),

  delete: (templateId: string): Promise<void> =>
    request.delete(`/api/v1/templates/${templateId}`),

  rollback: (templateId: string): Promise<Template> =>
    request.post(`/api/v1/templates/rollback/${templateId}`),

  getPurposes: (templateType = 1): Promise<{ purposes: string[] }> =>
    request.get("/api/v1/templates/purposes/list", { params: { template_type: templateType } }),
}

// ============================================================
// 核心信息模板
// ============================================================
export const coreInfoTemplateService = {
  getByTemplate: (templateId: string): Promise<CoreInfoTemplateListResponse> =>
    request.get(`/api/v1/core-info-templates/template/${templateId}`),

  getById: (coreTemplateId: string): Promise<CoreInfoTemplate> =>
    request.get(`/api/v1/core-info-templates/${coreTemplateId}`),

  create: (payload: CreateCoreInfoTemplatePayload): Promise<CoreInfoTemplate> =>
    request.post("/api/v1/core-info-templates", payload),

  insertAfter: (templateId: string, payload: {
    after_id: string
    field_name: string
    field_type?: string
    default_value?: string | null
    options?: string[] | null
    is_required?: boolean
  }): Promise<CoreInfoTemplate> =>
    request.post(`/api/v1/core-info-templates/template/${templateId}/insert-after`, payload),

  update: (coreTemplateId: string, payload: UpdateCoreInfoTemplatePayload): Promise<CoreInfoTemplate> =>
    request.put(`/api/v1/core-info-templates/${coreTemplateId}`, payload),

  delete: (coreTemplateId: string): Promise<void> =>
    request.delete(`/api/v1/core-info-templates/${coreTemplateId}`),

  reorder: (templateId: string, payload: CoreInfoTemplateReorderPayload): Promise<void> =>
    request.post(`/api/v1/core-info-templates/template/${templateId}/reorder`, payload),
}

// ============================================================
// 摘要模板
// ============================================================
export const summaryTemplateService = {
  getByTemplate: (templateId: string): Promise<SummaryTemplateListResponse> =>
    request.get(`/api/v1/summary-templates/template/${templateId}`),

  getById: (summaryTemplateId: string): Promise<SummaryTemplate> =>
    request.get(`/api/v1/summary-templates/${summaryTemplateId}`),

  create: (payload: CreateSummaryTemplatePayload): Promise<SummaryTemplate> =>
    request.post("/api/v1/summary-templates", payload),

  insertAfter: (templateId: string, payload: {
    after_id: string
    title: string
    generation_mode?: number
    content_template?: string | null
    sources?: unknown[] | null
    default_prompt?: string | null
    custom_prompt?: string | null
  }): Promise<SummaryTemplate> =>
    request.post(`/api/v1/summary-templates/template/${templateId}/insert-after`, payload),

  update: (summaryTemplateId: string, payload: UpdateSummaryTemplatePayload): Promise<SummaryTemplate> =>
    request.put(`/api/v1/summary-templates/${summaryTemplateId}`, payload),

  delete: (summaryTemplateId: string): Promise<void> =>
    request.delete(`/api/v1/summary-templates/${summaryTemplateId}`),

  reorder: (templateId: string, payload: { ordered_ids: string[] }): Promise<void> =>
    request.post(`/api/v1/summary-templates/template/${templateId}/reorder`, payload),
}

// ============================================================
// 章节结构模板
// ============================================================
export const structureTemplateService = {
  getByTemplate: (templateId: string): Promise<StructureTemplateTreeResponse> =>
    request.get(`/api/v1/structure-templates/template/${templateId}/tree`),

  getById: (structureTemplateId: string): Promise<StructureTemplate> =>
    request.get(`/api/v1/structure-templates/${structureTemplateId}`),

  create: (payload: CreateStructureTemplatePayload): Promise<StructureTemplate> =>
    request.post("/api/v1/structure-templates", payload),

  insertAfter: (templateId: string, payload: {
    after_id: string
    title: string
    level: number
    generation_mode?: number
    content_template?: string | null
    sources?: unknown[] | null
    default_prompt?: string | null
    custom_prompt?: string | null
  }): Promise<StructureTemplate> =>
    request.post(`/api/v1/structure-templates/template/${templateId}/insert-after`, payload),

  update: (structureTemplateId: string, payload: UpdateStructureTemplatePayload): Promise<StructureTemplate> =>
    request.put(`/api/v1/structure-templates/${structureTemplateId}`, payload),

  delete: (structureTemplateId: string): Promise<void> =>
    request.delete(`/api/v1/structure-templates/${structureTemplateId}`),

  reorder: (templateId: string, payload: StructureTemplateReorderPayload): Promise<void> =>
    request.post(`/api/v1/structure-templates/template/${templateId}/reorder`, payload),
}

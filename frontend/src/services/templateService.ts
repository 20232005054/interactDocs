import request, { fetchStream } from "@/lib/request"
import type {
  Template,
  TemplateDetail,
  TemplateDependenciesResponse,
  TemplateListResponse,
  TemplateListParams,
  TemplateSimpleListResponse,
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
  LiteratureListResponse,
} from "@/types/api"

// ============================================================
// 模板主表
// ============================================================
export const templateService = {
  list: (params?: TemplateListParams): Promise<TemplateListResponse> =>
    request.get("/api/v1/templates", { params }),

  get: (templateId: string): Promise<TemplateDetail> =>
    request.get(`/api/v1/templates/${templateId}`),

  getDependencies: (templateId: string): Promise<TemplateDependenciesResponse> =>
    request.get(`/api/v1/templates/${templateId}/dependencies`),

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

  getByPurpose: (
    purpose: string,
    params?: { template_type?: number; is_system?: boolean; is_active?: boolean }
  ): Promise<TemplateSimpleListResponse> => {
    const templateType = params?.template_type ?? (
      params?.is_system === undefined ? undefined : (params.is_system ? 1 : 2)
    )
    return request.get(`/api/v1/templates/by-purpose/${encodeURIComponent(purpose)}`, {
      params: { template_type: templateType, is_active: params?.is_active },
    })
  },

  getPurposes: (templateTypeOrIsSystem: number | boolean = 1): Promise<{ purposes: string[] }> => {
    const templateType = typeof templateTypeOrIsSystem === "boolean"
      ? (templateTypeOrIsSystem ? 1 : 2)
      : templateTypeOrIsSystem
    return request.get("/api/v1/templates/purposes/list", { params: { template_type: templateType } })
  },

  import: (file: File, asSystem = false): Promise<TemplateDetail> => {
    const form = new FormData()
    form.append("file", file)
    return request.post(`/api/v1/templates/import?as_system=${asSystem}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },

  exportJson: async (templateId: string, displayName: string): Promise<void> => {
    const res = await fetchStream(`/api/v1/templates/${templateId}/export`)
    if (!res.ok) throw new Error("导出失败")
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${displayName}.json`
    a.click()
    URL.revokeObjectURL(url)
  },

  getLiterature: (templateId: string): Promise<LiteratureListResponse> =>
    request.get(`/api/v1/templates/${templateId}/literature`),
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

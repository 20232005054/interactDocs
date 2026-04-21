"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import TemplateStepper, { type StepKey, type Step } from "@/components/template/TemplateStepper"
import BasicInfoStep from "@/components/template/BasicInfoStep"
import CoreInfoTemplateStep from "@/components/template/CoreInfoTemplateStep"
import SummaryTemplateStep from "@/components/template/SummaryTemplateStep"
import StructureTemplateStep from "@/components/template/StructureTemplateStep"
import { templateService, coreInfoTemplateService, summaryTemplateService, structureTemplateService } from "@/services/templateService"
import type { TemplateDependenciesResponse, TemplateDependencyRef, TemplateDetail } from "@/types/api"

interface TemplateEditorContainerProps {
  templateId?: string  // undefined = 新建
}

function uniqueRefs(refs: TemplateDependencyRef[]): TemplateDependencyRef[] {
  const map = new Map<string, TemplateDependencyRef>()
  for (const ref of refs) {
    map.set(`${ref.type}:${ref.field_key}`, ref)
  }
  return Array.from(map.values())
}

export default function TemplateEditorContainer({ templateId }: TemplateEditorContainerProps) {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState<StepKey>("basic")
  const [template, setTemplate] = useState<TemplateDetail | null>(null)
  const [loading, setLoading] = useState(!!templateId)
  const [error, setError] = useState<string | null>(null)
  const [dependencies, setDependencies] = useState<TemplateDependenciesResponse | null>(null)
  const [dependenciesLoading, setDependenciesLoading] = useState(false)
  const [dependenciesError, setDependenciesError] = useState<string | null>(null)

  // 各步骤填充状态
  const [coreInfoCount, setCoreInfoCount] = useState(0)
  const [summaryCount, setSummaryCount] = useState(0)
  const [structureCount, setStructureCount] = useState(0)

  // 加载模板基础信息
  const loadTemplate = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const t = await templateService.get(id)
      setTemplate(t)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDependencies = useCallback(async (id: string) => {
    setDependenciesLoading(true)
    setDependenciesError(null)
    try {
      const data = await templateService.getDependencies(id)
      setDependencies(data)
    } catch (err: unknown) {
      setDependenciesError(err instanceof Error ? err.message : "依赖关系加载失败")
    } finally {
      setDependenciesLoading(false)
    }
  }, [])

  // 加载子模板数量（用于管道填充判断）
  const loadSubCounts = useCallback(async (id: string) => {
    try {
      const [coreRes, summaryRes, structureRes] = await Promise.all([
        coreInfoTemplateService.getByTemplate(id),
        summaryTemplateService.getByTemplate(id),
        structureTemplateService.getByTemplate(id),
      ])
      setCoreInfoCount(coreRes.items?.length ?? 0)
      setSummaryCount(summaryRes.items?.length ?? 0)
      // structure 返回树，展开计数
      const countTree = (nodes: typeof structureRes.tree): number =>
        nodes.reduce((acc, n) => acc + 1 + countTree(n.children ?? []), 0)
      setStructureCount(countTree(structureRes.tree ?? []))
    } catch {
      // 子模板加载失败不影响主流程
    }
  }, [])

  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId)
      loadSubCounts(templateId)
    }
  }, [templateId, loadTemplate, loadSubCounts])

  useEffect(() => {
    if (!templateId) return
    loadDependencies(templateId)
  }, [loadDependencies, templateId])

  const basicFilled = !!(template?.display_name && template?.purpose)
  const dependencySummary = useMemo(() => {
    if (!dependencies) return null
    const upstream = uniqueRefs([
      ...dependencies.summary_templates.flatMap((item) => item.references),
      ...dependencies.structure_templates.flatMap((item) => item.references),
    ])
    const downstream = uniqueRefs([
      ...dependencies.core_info_templates.flatMap((item) => item.referenced_by),
      ...dependencies.summary_templates.flatMap((item) => item.referenced_by),
    ])
    return { upstream, downstream }
  }, [dependencies])

  const steps: Step[] = [
    { key: "basic", label: "基础信息", filled: basicFilled },
    { key: "core-info", label: "核心信息模板", filled: coreInfoCount > 0 },
    { key: "summary", label: "摘要模板", filled: summaryCount > 0 },
    { key: "structure", label: "章节结构", filled: structureCount > 0 },
  ]

  // 基础信息保存后回调
  const handleBasicSaved = (saved: TemplateDetail) => {
    setTemplate(saved)
    void loadDependencies(saved.template_id)
    // 新建成功后跳转到编辑路由，并切换到下一步
    if (!templateId) {
      router.replace(`/admin/templates/${saved.template_id}`)
    }
    setActiveStep("core-info")
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-16 bg-muted/40 rounded-xl animate-pulse" />
        <div className="h-64 bg-muted/40 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 返回 */}
      <button
        onClick={() => router.push("/admin/templates")}
        className="self-start text-sm text-muted-foreground hover:text-foreground transition flex items-center gap-1"
      >
        ← 返回列表
      </button>

      {/* 标题 */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {templateId ? `编辑模板：${template?.display_name ?? ""}` : "新建模板"}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {templateId ? "修改模板的各项配置" : "按步骤完成模板配置，可随时跳转"}
        </p>
        {template && (
          <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{`引用来源 ${dependencySummary?.upstream.length ?? 0}`}</span>
              <span>{`被引用 ${dependencySummary?.downstream.length ?? 0}`}</span>
              {dependenciesLoading && <span>加载中...</span>}
              {!dependenciesLoading && (
                <button
                  type="button"
                  onClick={() => void loadDependencies(template.template_id)}
                  className="text-xs text-primary hover:underline"
                >
                  刷新
                </button>
              )}
            </div>

            {!dependenciesLoading && dependenciesError && (
              <p className="mt-1 text-xs text-destructive">{dependenciesError}</p>
            )}

            {!dependenciesLoading && !dependenciesError && dependencySummary && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                {dependencySummary.upstream.slice(0, 6).map((ref) => (
                  <span
                    key={`up-${ref.type}-${ref.field_key}`}
                    className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700"
                    title={`来源: ${ref.type}/${ref.field_key}`}
                  >
                    {`引:${ref.label || ref.field_key}`}
                  </span>
                ))}
                {dependencySummary.downstream.slice(0, 6).map((ref) => (
                  <span
                    key={`down-${ref.type}-${ref.field_key}`}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700"
                    title={`被引用: ${ref.type}/${ref.field_key}`}
                  >
                    {`被引:${ref.label || ref.field_key}`}
                  </span>
                ))}
                {dependencySummary.upstream.length + dependencySummary.downstream.length > 12 && (
                  <span className="text-muted-foreground">
                    {`+${dependencySummary.upstream.length + dependencySummary.downstream.length - 12} 条`}
                  </span>
                )}
                {dependencySummary.upstream.length === 0 && dependencySummary.downstream.length === 0 && (
                  <span className="text-muted-foreground">暂无引用关系</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stepper */}
      <div className="bg-card border border-border rounded-xl p-4">
        <TemplateStepper
          steps={steps}
          activeStep={activeStep}
          onStepClick={(key) => {
            // 新建模式下，基础信息未保存前不允许跳转其他步骤
            if (!templateId && !template && key !== "basic") return
            setActiveStep(key)
          }}
        />
      </div>

      {/* 步骤内容 */}
      <div className="bg-card border border-border rounded-xl p-6">
        {activeStep === "basic" && (
          <BasicInfoStep
            templateId={templateId ?? null}
            initialData={template}
            onSaved={handleBasicSaved}
          />
        )}
        {activeStep === "core-info" && template && (
          <CoreInfoTemplateStep
            templateId={template.template_id}
            onCountChange={setCoreInfoCount}
            dependencyItems={dependencies?.core_info_templates ?? []}
          />
        )}
        {activeStep === "summary" && template && (
          <SummaryTemplateStep
            templateId={template.template_id}
            onCountChange={setSummaryCount}
            dependencyItems={dependencies?.summary_templates ?? []}
          />
        )}
        {activeStep === "structure" && template && (
          <StructureTemplateStep
            templateId={template.template_id}
            onCountChange={setStructureCount}
            dependencyItems={dependencies?.structure_templates ?? []}
          />
        )}
        {(activeStep !== "basic") && !template && (
          <p className="text-sm text-muted-foreground">请先完成基础信息填写</p>
        )}
      </div>
    </div>
  )
}

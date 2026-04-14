"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import TemplateStepper, { type StepKey, type Step } from "@/components/template/TemplateStepper"
import BasicInfoStep from "@/components/template/BasicInfoStep"
import CoreInfoTemplateStep from "@/components/template/CoreInfoTemplateStep"
import SummaryTemplateStep from "@/components/template/SummaryTemplateStep"
import StructureTemplateStep from "@/components/template/StructureTemplateStep"
import { templateService, coreInfoTemplateService, summaryTemplateService, structureTemplateService } from "@/services/templateService"
import type { TemplateDetail } from "@/types/api"

interface TemplateEditorContainerProps {
  templateId?: string  // undefined = 新建
}

export default function TemplateEditorContainer({ templateId }: TemplateEditorContainerProps) {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState<StepKey>("basic")
  const [template, setTemplate] = useState<TemplateDetail | null>(null)
  const [loading, setLoading] = useState(!!templateId)
  const [error, setError] = useState<string | null>(null)

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

  const basicFilled = !!(template?.display_name && template?.purpose)

  const steps: Step[] = [
    { key: "basic", label: "基础信息", filled: basicFilled },
    { key: "core-info", label: "核心信息模板", filled: coreInfoCount > 0 },
    { key: "summary", label: "摘要模板", filled: summaryCount > 0 },
    { key: "structure", label: "章节结构", filled: structureCount > 0 },
  ]

  // 基础信息保存后回调
  const handleBasicSaved = (saved: TemplateDetail) => {
    setTemplate(saved)
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
          />
        )}
        {activeStep === "summary" && template && (
          <SummaryTemplateStep
            templateId={template.template_id}
            onCountChange={setSummaryCount}
          />
        )}
        {activeStep === "structure" && template && (
          <StructureTemplateStep
            templateId={template.template_id}
            onCountChange={setStructureCount}
          />
        )}
        {(activeStep !== "basic") && !template && (
          <p className="text-sm text-muted-foreground">请先完成基础信息填写</p>
        )}
      </div>
    </div>
  )
}

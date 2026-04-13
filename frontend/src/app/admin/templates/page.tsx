import TemplateListContainer from "@/containers/TemplateListContainer"

export default function AdminTemplatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">模板管理</h2>
        <p className="text-sm text-muted-foreground">管理系统模板及用户模板</p>
      </div>
      <TemplateListContainer />
    </div>
  )
}

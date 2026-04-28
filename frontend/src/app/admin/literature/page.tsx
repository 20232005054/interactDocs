import LiteratureContainer from "@/containers/LiteratureContainer"

export default function AdminLiteraturePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-1 text-xl font-semibold text-foreground">文献管理</h2>
        <p className="text-sm text-muted-foreground">管理公共文献知识库，上传 PDF 后系统自动解析、向量化并补全元数据</p>
      </div>
      <LiteratureContainer />
    </div>
  )
}

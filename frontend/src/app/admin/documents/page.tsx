import AdminDocumentsContainer from "@/containers/AdminDocumentsContainer"

export default function AdminDocumentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-1 text-xl font-semibold text-foreground">文档管理</h2>
        <p className="text-sm text-muted-foreground">查看全站文档、进入详情并执行删除操作</p>
      </div>
      <AdminDocumentsContainer />
    </div>
  )
}

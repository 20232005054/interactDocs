import AdminOverviewContainer from "@/containers/AdminOverviewContainer"

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">总览</h2>
        <p className="text-sm text-muted-foreground">系统运行数据一览</p>
      </div>
      <AdminOverviewContainer />
    </div>
  )
}

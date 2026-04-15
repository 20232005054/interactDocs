import AdminUsersContainer from "@/containers/AdminUsersContainer"

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-1 text-xl font-semibold text-foreground">用户管理</h2>
        <p className="text-sm text-muted-foreground">查看用户列表、调整角色和删除账号</p>
      </div>
      <AdminUsersContainer />
    </div>
  )
}

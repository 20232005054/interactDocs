import request from "@/lib/request"
import type {
  StatsOverview,
  AdminUserListResponse,
  DocumentListResponse,
  User,
  UserRole,
} from "@/types/api"

export const adminService = {
  // 统计总览
  getStats: (): Promise<StatsOverview> =>
    request.get("/api/v1/admin/stats/overview"),

  // 用户管理
  listUsers: (page = 1, pageSize = 20): Promise<AdminUserListResponse> =>
    request.get("/api/v1/admin/users", { params: { page, page_size: pageSize } }),

  updateUserRole: (userId: string, role: UserRole): Promise<User> =>
    request.put(`/api/v1/admin/users/${userId}/role`, { role }),

  deleteUser: (userId: string): Promise<void> =>
    request.delete(`/api/v1/admin/users/${userId}`),

  // 文档管理
  listDocuments: (page = 1, pageSize = 20): Promise<DocumentListResponse> =>
    request.get("/api/v1/admin/documents", { params: { page, page_size: pageSize } }),

  deleteDocument: (documentId: string): Promise<void> =>
    request.delete(`/api/v1/admin/documents/${documentId}`),
}

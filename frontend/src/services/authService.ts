import request from "@/lib/request"
import type { Token, User, LoginPayload, RegisterPayload } from "@/types/api"

export const authService = {
  login: (payload: LoginPayload): Promise<Token> =>
    request.post("/api/v1/auth/login", payload),

  register: (payload: RegisterPayload): Promise<Token> =>
    request.post("/api/v1/auth/register", payload),

  getMe: (): Promise<User> =>
    request.get("/api/v1/auth/me"),
}

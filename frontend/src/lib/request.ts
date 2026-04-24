import axios from "axios"

const request = axios.create({
  baseURL: "",
  timeout: 30000,
})

// 请求拦截器：从 localStorage 注入 token
request.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// 响应拦截器：统一处理业务错误
request.interceptors.response.use(
  (response) => {
    const data = response.data
    if (data.code !== 200) {
      // 401 清除 token 并跳转登录页
      if (data.code === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("token")
          window.location.href = "/login"
        }
      }
      return Promise.reject(new Error(data.message || "请求失败"))
    }
    return data.data
  },
  (error) => {
    const message = error.response?.data?.message || error.message || "网络错误"
    return Promise.reject(new Error(message))
  }
)

export default request

// ----------------------------------------------------------------
// fetchStream：专用于 SSE / 流式 / 长耗时场景（axios timeout 不适用）
// 统一注入 token，调用方无需手动读 localStorage
// ----------------------------------------------------------------
function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("token") : null
}

export function getAuthHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface FetchStreamOptions extends Omit<RequestInit, "headers"> {
  headers?: HeadersInit
}

/**
 * 发起原生 fetch 请求，自动注入 Authorization header。
 * 适用于 SSE、流式输出、超时较长的接口（绕过 axios 30s timeout）。
 */
export async function fetchStream(url: string, options: FetchStreamOptions = {}): Promise<Response> {
  const { headers: extraHeaders, ...rest } = options
  const response = await fetch(url, {
    ...rest,
    headers: {
      ...getAuthHeaders(),
      ...extraHeaders,
    },
  })
  return response
}

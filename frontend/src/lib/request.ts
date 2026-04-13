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

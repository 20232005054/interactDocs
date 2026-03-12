/**
 * 处理API错误
 * @param error 错误对象
 * @param defaultMessage 默认错误信息
 * @returns 错误信息字符串
 */
export const handleApiError = (error: any, defaultMessage: string): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return defaultMessage;
};

/**
 * 构建API请求选项
 * @param method 请求方法
 * @param data 请求数据
 * @returns 请求选项
 */
export const buildRequestOptions = (method: string, data?: any): RequestInit => {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  return options;
};

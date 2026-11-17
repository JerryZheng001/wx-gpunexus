export interface FieldError { field: string; message: string }
export class ApiError extends Error {
  constructor(message: string, public status = 0, public code = '', public fieldErrors: FieldError[] = []) {
    super(message)
    this.name = 'ApiError'
  }
}
export interface HttpRequest {
  url: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  timeout: number
  header: Record<string, string>
  data?: unknown
}
export type Transport = (request: HttpRequest) => Promise<{ statusCode: number; data: unknown }>
export const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

export interface HttpOptions {
  getToken?: () => string
  authViaProxy?: boolean
}
export function unwrapApiResponse(response: { statusCode: number; data: unknown }): unknown {
  const body = object(response.data)
  const errors = body.fieldErrors ?? body.field_errors
  const fields = Array.isArray(errors) ? errors.flatMap((error) => {
    const value = object(error)
    return typeof value.field === 'string' && typeof value.message === 'string'
      ? [{ field: value.field, message: value.message }] : []
  }) : []
  if (response.statusCode < 200 || response.statusCode >= 300 || body.success !== true) {
    const fallback = response.statusCode === 401 ? '请先登录或更新登录凭证'
      : response.statusCode === 403 ? '当前账号没有访问资格'
        : response.statusCode === 404 ? '请求的接口或信息不存在'
          : response.statusCode === 409 ? '信息已变更，请刷新后重试' : '请求失败，请稍后重试'
    throw new ApiError(typeof body.message === 'string' && body.message.trim() ? body.message : fallback,
      response.statusCode, typeof body.code === 'string' ? body.code : '', fields)
  }
  return body.data
}
export function createHttpClient(baseUrl: string, transport: Transport, options: HttpOptions = {}) {
  const base = baseUrl.trim().replace(/\/+$/, '')
  const request = async (method: HttpRequest['method'], path: string,
    query: Record<string, string | number | undefined> = {}, data?: unknown, authenticated = false): Promise<unknown> => {
      if (!base || !/^https?:\/\/[^/\s?#]+(?:\/[^?#]*)?$/.test(base))
        throw new ApiError('请先配置有效的 API 服务地址', 0, 'API_NOT_CONFIGURED')
      const params = Object.entries(query).filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')
      const header: Record<string, string> = { Accept: 'application/json' }
      if (authenticated) {
        const token = options.getToken?.().trim().replace(/^Bearer\s+/i, '') || ''
        if (token) header.Authorization = `Bearer ${token}`
        else if (!options.authViaProxy) throw new ApiError('请先登录或配置测试凭证', 401, 'AUTH_REQUIRED')
      }
      if (data !== undefined) header['Content-Type'] = 'application/json'
      let response: Awaited<ReturnType<Transport>>
      try {
        response = await transport({ url: `${base}${path}${params ? `?${params}` : ''}`, method,
          timeout: 15000, header, ...(data === undefined ? {} : { data }) })
      } catch (error) {
        // wx.request rejects with { errMsg }, whereas browsers usually throw Error.
        // Classify known failures without exposing URLs, headers, or credentials.
        const message = error instanceof Error ? error.message : object(error).errMsg
        if (typeof message === 'string') {
          if (/url not in domain list|not in.*domain list|合法域名/i.test(message))
            throw new ApiError('请求被微信合法域名校验拦截，请在开发者工具的本地设置中关闭域名校验后重新编译', 0, 'DOMAIN_NOT_ALLOWED')
          if (/timeout|timed out/i.test(message))
            throw new ApiError('接口请求超时，请稍后重试', 0, 'NETWORK_TIMEOUT')
          if (/ssl|certificate|cert_|证书/i.test(message))
            throw new ApiError('HTTPS 连接失败，请检查测试服务的证书和网络', 0, 'TLS_ERROR')
        }
        throw new ApiError('网络连接失败，请检查网络后重试', 0, 'NETWORK_ERROR')
      }
      return unwrapApiResponse(response)
  }
  return {
    get: (path: string, query?: Record<string, string | number | undefined>, authenticated = false) => request('GET', path, query, undefined, authenticated),
    post: (path: string, data?: unknown, query?: Record<string, string | number | undefined>) => request('POST', path, query, data, true),
    patch: (path: string, data: unknown, query?: Record<string, string | number | undefined>) => request('PATCH', path, query, data, true),
    delete: (path: string, query?: Record<string, string | number | undefined>, data?: unknown) => request('DELETE', path, query, data, true),
  }
}

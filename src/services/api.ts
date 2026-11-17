import Taro from '@tarojs/taro'
import { ApiError, createHttpClient, object, unwrapApiResponse } from './http-core'
import { createListingApi } from './listing-api'
import { createProviderApi } from './provider-api'
import { tokenScope } from './auth-scope'
import { createFavoritesApi } from './favorites-api'
import { createListingFavorites } from './listing-favorites'

export const apiBaseUrl = (process.env.TARO_APP_API_BASE_URL || '').trim().replace(/\/+$/, '')
export const marketApiEnabled = Boolean(apiBaseUrl)
// H5's development server proxies /api to avoid the test site's missing CORS.
const authViaProxy = marketApiEnabled && process.env.TARO_ENV === 'h5' && process.env.NODE_ENV === 'development'
const requestBase = authViaProxy
  ? window.location.origin : apiBaseUrl
export function getAccessToken() {
  try {
    const token: unknown = Taro.getStorageSync('suanlishi:access-token')
    if (typeof token === 'string' && token.trim()) return token.trim()
  } catch { /* No stored login yet. */ }
  return process.env.TARO_APP_DEV_ACCESS_TOKEN || ''
}
export const getAuthScope = () => getAccessToken() ? tokenScope(getAccessToken()) : process.env.TARO_APP_DEV_AUTH_SCOPE || 'anonymous'
const http = createHttpClient(requestBase,
  async (request) => {
    const response = await Taro.request<unknown>(request)
    return { statusCode: response.statusCode, data: response.data }
  }, { getToken: getAccessToken, authViaProxy })
export const listingApi = createListingApi(http)
export const providerApi = createProviderApi(http)
export const favoritesApi = createFavoritesApi(http)
export const listingFavorites = createListingFavorites(favoritesApi, getAuthScope)
export async function uploadListingImage(filePath: string): Promise<string> {
  const token = getAccessToken().replace(/^Bearer\s+/i, '')
  if (!token && !authViaProxy) throw new ApiError('请先登录或配置测试凭证', 401, 'AUTH_REQUIRED')
  const response = await Taro.uploadFile({ url: `${requestBase}/api/banking/provider/listings/images`, filePath,
    name: 'file', header: token ? { Authorization: `Bearer ${token}` } : {}, timeout: 30000 })
  let body: unknown
  try { body = JSON.parse(response.data) } catch { throw new ApiError('图片上传响应异常，请重试', response.statusCode) }
  const data = object(unwrapApiResponse({ statusCode: response.statusCode, data: body }))
  if (typeof data.url !== 'string' || !/^https?:\/\/[^/\s]+/i.test(data.url)) throw new ApiError('图片上传未返回有效地址')
  return data.url
}

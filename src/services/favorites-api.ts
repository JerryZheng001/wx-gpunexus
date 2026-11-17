import { ApiError, object, type createHttpClient } from './http-core'
import { apiListingTypes, parseMarketPage, type ApiListingType, type MarketCard } from './listing-api'

export interface ListingFavoriteTarget {
  targetType: 'listings'
  targetId: string
  biz: ApiListingType
}
export interface ListingFavorite extends ListingFavoriteTarget {
  id: number
  createdAt: string
  available: boolean
  content: MarketCard | null
}
export interface ListingFavoritesPage { items: ListingFavorite[]; total: number; page: number; size: number }
export const favoriteKey = (target: ListingFavoriteTarget) => `${target.targetType}:${target.biz}:${target.targetId}`
const invalid = () => new ApiError('收藏数据格式异常，请刷新重试', 0, 'INVALID_RESPONSE')
export function listingFavoriteTarget(type: ApiListingType, id: string): ListingFavoriteTarget {
  // IDs stay decimal strings; sale/lease/demand may share the same numeric ID.
  if (!apiListingTypes.includes(type) || !/^[1-9]\d*$/.test(id) || id.length > 128) throw invalid()
  return { targetType: 'listings', targetId: id, biz: type }
}
export function parseListingFavoritesPage(input: unknown): ListingFavoritesPage {
  const data = object(input)
  if (!Array.isArray(data.listings) || !Number.isSafeInteger(data.total) || Number(data.total) < 0 ||
    !Number.isSafeInteger(data.page) || Number(data.page) < 1 || !Number.isSafeInteger(data.size) ||
    Number(data.size) < 1 || Number(data.size) > 30) throw invalid()
  const items = data.listings.map((input): ListingFavorite => {
    const value = object(input)
    if (value.targetType !== 'listings' || typeof value.targetId !== 'string' ||
      !Number.isSafeInteger(value.id) || Number(value.id) <= 0 || typeof value.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(value.createdAt)) || typeof value.available !== 'boolean') throw invalid()
    const target = listingFavoriteTarget(value.biz as ApiListingType, value.targetId)
    let content: MarketCard | null = null
    if (value.available) {
      content = parseMarketPage({ items: [value.content], total: 1, page: 1, pageSize: 1 }).items[0]
      if (content.type !== target.biz || String(content.id) !== target.targetId) throw invalid()
    } else if (value.content !== null) throw invalid()
    return { ...target, id: Number(value.id), createdAt: value.createdAt, available: value.available, content }
  })
  return { items, total: Number(data.total), page: Number(data.page), size: Number(data.size) }
}
export function createFavoritesApi(http: ReturnType<typeof createHttpClient>) {
  const path = '/api/market-mp/favorites'
  const body = (target: ListingFavoriteTarget) => listingFavoriteTarget(target.biz, target.targetId)
  return {
    async list(page = 1, size = 20) {
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(size) || size < 1 || size > 30) throw invalid()
      const result = parseListingFavoritesPage(await http.get(path, { type: 'listings', page, size }, true))
      if (result.page !== page || result.size !== size) throw invalid()
      return result
    },
    add: async (target: ListingFavoriteTarget) => { await http.post(path, body(target)) },
    remove: async (target: ListingFavoriteTarget) => { await http.delete(path, undefined, body(target)) },
  }
}

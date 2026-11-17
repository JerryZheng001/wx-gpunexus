import { apiConditionLabels, apiListingTypes, apiTypeLabels, marketKey, marketPrice, marketUnit,
  type ApiListingType, type MarketCard, type MarketQuery } from '../services/listing-api'

export interface PageShare { title: string; path: string; imageUrl?: string }
export type MarketShareFilters = Pick<MarketQuery, 'keyword' | 'type' | 'condition' | 'sort' | 'order'>
const image = (urls: string[] = []) => urls.find((url) => /^https?:\/\/[^/\s]+/i.test(url))
export function listingShare(type: ApiListingType, id: number,
  info?: Pick<MarketCard, 'title' | 'images'>, quote?: MarketCard): PageShare {
  const price = quote && (quote.priceMin !== null || quote.priceMax !== null || quote.budgetMin !== null || quote.budgetMax !== null)
    ? `${marketPrice(quote)}${marketUnit(quote)}` : ''
  const title = `[${apiTypeLabels[type]}] ${info?.title.trim() || '算力市供需信息'}${price ? ` · ${price}` : ''}`
  return { title, path: `/pages/goods/index?id=${encodeURIComponent(marketKey(type, id))}&type=${type}`,
    ...(image(info?.images) ? { imageUrl: image(info?.images) } : {}) }
}
export function normalizeMarketShareFilters(value: Record<string, unknown>): MarketShareFilters {
  return {
    ...(typeof value.keyword === 'string' && value.keyword.trim() ? { keyword: value.keyword.trim() } : {}),
    ...(apiListingTypes.includes(value.type as ApiListingType) ? { type: value.type as ApiListingType } : {}),
    ...(typeof value.condition === 'string' && Object.prototype.hasOwnProperty.call(apiConditionLabels, value.condition)
      ? { condition: value.condition as MarketQuery['condition'] } : {}),
    ...(value.sort === 'price' || value.sort === 'published_at' ? { sort: value.sort } : {}),
    ...(value.order === 'asc' || value.order === 'desc' ? { order: value.order } : {}),
  }
}
export function marketShare(filters: MarketShareFilters = {}): PageShare {
  const clean = normalizeMarketShareFilters(filters as Record<string, unknown>)
  const label = clean.type ? apiTypeLabels[clean.type] : 'GPU 售卖、租赁与需求'
  return { title: `${clean.keyword ? `${clean.keyword} · ` : ''}${label} · 算力市供需市场`,
    path: `/pages/mall/index${Object.keys(clean).length ? `?market=${encodeURIComponent(JSON.stringify(clean))}` : ''}` }
}
export function readMarketShareFilters(value: unknown): MarketShareFilters {
  if (typeof value !== 'string') return {}
  try {
    // H5 may already decode the query; native launch options may still be encoded.
    let parsed: unknown
    try { parsed = JSON.parse(value) } catch { parsed = JSON.parse(decodeURIComponent(value)) }
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? normalizeMarketShareFilters(parsed as Record<string, unknown>) : {}
  } catch { return {} }
}
export function timelineShare(share: PageShare) {
  return { title: share.title, query: share.path.split('?')[1] || '', ...(share.imageUrl ? { imageUrl: share.imageUrl } : {}) }
}
export function browserShareUrl(share: PageShare, pageUrl: string) {
  return `${pageUrl.split('#')[0].split('?')[0]}#${share.path}`
}

import type { Listing, ListingType, PublishDraft, Quote } from '../types'
import { billingCycles, conditions, deliveries, durations, productCategories, regions } from '../constants/publish'

export const listingTypes = {
  sell: { label: '售卖', color: 'orange' },
  rent: { label: '租赁', color: 'blue' },
  demand: { label: '需求', color: 'green' },
} as const
export const statuses = { show: '已上架', audit: '审核中', off: '已下架' } as const
export const emptyDraft: PublishDraft = {
  type: 'sell',
  city: '',
  province: '',
  name: '',
  model: '',
  price: '',
  maxPrice: '',
  originalPrice: '',
  billing: '包月',
  quantity: '',
  duration: '长期有效',
  expiryDate: '',
  delivery: '现货（24 小时内）',
  condition: '全新',
  customCondition: '',
  category: 'GPU服务器',
  contact: '',
  description: '',
  images: [],
}
export const money = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 })
export const signed = (value: number) => `${value > 0 ? '+' : ''}${money(value)}`
export const percent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
export const listingPrice = (item: Listing) =>
  `${money(item.price)}${item.maxPrice && item.maxPrice !== item.price ? `–${money(item.maxPrice)}` : ''}`
export const isServer = (category: Listing['category']) =>
  category === '整机' || category === 'GPU服务器' || category === '通用服务器'
export const homeQuotePool = (quotes: Quote[], followed: string[], followOnly: boolean) =>
  followOnly ? followed.flatMap((id) => quotes.filter((quote) => quote.id === id))
    : [...quotes].sort((a, b) => b.percent - a.percent).slice(0, 3)
export const normalizeSearch = (value: string) => value.replace(/\s+/g, '').toLowerCase()
export function filterListings(
  items: Listing[],
  options: {
    keyword?: string
    type?: ListingType | 'all'
    verified?: boolean
    condition?: string
    sort?: string
    category?: string
  } = {},
) {
  const keyword = normalizeSearch(options.keyword || '')
  const filtered = items.filter(
    (item) =>
      (!keyword ||
        normalizeSearch(`${item.name} ${item.model || ''} ${item.extra} ${item.city} ${item.description}`).includes(
          keyword,
        )) &&
      (!options.type || options.type === 'all' || item.type === options.type) &&
      (!options.verified || item.verified) &&
      (!options.condition ||
        options.condition === '全部成色' ||
        normalizeSearch(item.condition).includes(normalizeSearch(options.condition))) &&
      (!options.category || item.category === options.category),
  )
  return [...filtered].sort((a, b) =>
    options.sort === 'priceAsc'
      ? a.price - b.price
      : options.sort === 'priceDesc'
        ? b.price - a.price
        : Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )
}
export function parsePrice(value: string): number {
  const text = value.trim()
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)
    ? Number(text.replace(/,/g, '')) : NaN
}
export function parseQuantity(value: string): number {
  const match = value.trim().match(/^(\d+)\s*(?:张|台|套|件)?$/)
  return match ? Number(match[1]) : NaN
}
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export function draftExpiry(draft: PublishDraft, now = new Date()): string | undefined {
  if (draft.type === 'rent' || draft.duration === '长期有效') return undefined
  if (draft.duration === '自定义') {
    const [year, month, day] = draft.expiryDate.split('-').map(Number)
    const date = new Date(year, month - 1, day, 23, 59, 59)
    return Number.isFinite(date.getTime()) && localDate(date) === draft.expiryDate
      ? date.toISOString() : undefined
  }
  const days = parseInt(draft.duration)
  return Number.isFinite(days) ? new Date(now.getTime() + days * 86400000).toISOString() : undefined
}
export function validateDraft(draft: PublishDraft, now = new Date()): string | undefined {
  if (!draft.city.trim()) return '请填写交易城市'
  if (!draft.name.trim()) return draft.type === 'sell' ? '请填写商品名称' : '请填写产品名称'
  if (!draft.model.trim()) return '请填写型号'
  const price = parsePrice(draft.price)
  if (!Number.isFinite(price) || price <= 0)
    return '请输入大于 0 的有效价格'
  if (draft.type !== 'rent' && draft.maxPrice.trim() &&
    (!Number.isFinite(parsePrice(draft.maxPrice)) || parsePrice(draft.maxPrice) < price))
    return '最高价须不低于最低价'
  if (draft.type === 'rent' && draft.originalPrice.trim() &&
    (!Number.isFinite(parsePrice(draft.originalPrice)) || parsePrice(draft.originalPrice) < price))
    return '原价须不低于现价'
  if (!productCategories.includes(draft.category)) return '请选择商品分类'
  if (!deliveries.includes(draft.delivery)) return '请选择交付周期'
  if (draft.type === 'rent' && !billingCycles.includes(draft.billing)) return '请选择计费方式'
  if (!Number.isSafeInteger(parseQuantity(draft.quantity)) || parseQuantity(draft.quantity) <= 0)
    return '请输入有效的正整数数量'
  if (draft.type !== 'demand' && !conditions.includes(draft.condition)) return '请选择成色'
  if (draft.type !== 'demand' && draft.condition === '自定义' && !draft.customCondition.trim())
    return '请填写自定义成色'
  if (draft.type !== 'rent') {
    if (!durations.includes(draft.duration)) return '请选择信息有效期'
    if (draft.duration === '自定义' && (!draftExpiry(draft, now) || draft.expiryDate < localDate(now)))
      return '请选择今天或之后的有效截止日期'
  }
  if (!draft.contact.trim()) return '请填写联系方式'
  if (draft.images.length > 9) return '最多可上传 9 张图片'
  return undefined
}
// Keep v1 drafts readable after upgrading the form, without clearing local data.
export function restoreDraft(value: Partial<Omit<PublishDraft, 'category'>> & { category?: Listing['category'] }): PublishDraft {
  const city = value.city || ''
  const province = value.province || Object.keys(regions).find((key) =>
    regions[key].some((name) => name === city || name.replace(/市$/, '') === city)) || ''
  const condition = value.condition === '99新' ? '99 新' : value.condition || '全新'
  return {
    ...emptyDraft, ...value,
    name: value.name ?? value.model ?? '',
    province,
    city: regions[province]?.find((name) => name === city || name.replace(/市$/, '') === city) || city,
    category: productCategories.includes(value.category as PublishDraft['category'])
      ? value.category as PublishDraft['category'] : 'GPU服务器',
    condition: conditions.includes(condition) ? condition : '自定义',
    customCondition: conditions.includes(condition) ? value.customCondition || '' : condition,
    // Older drafts supported 1/3 days; retain them as custom dates.
    duration: value.duration && !durations.includes(value.duration) ? '自定义' : value.duration || '长期有效',
    expiryDate: value.expiryDate || (value.duration && !durations.includes(value.duration)
      ? localDate(new Date(Date.now() + (parseInt(value.duration) || 7) * 86400000)) : ''),
    images: [...(value.images || [])],
  }
}
export function draftFromListing(item: Listing): PublishDraft {
  return restoreDraft({
    editId: item.id,
    type: item.type,
    city: item.city,
    province: item.province,
    name: item.name,
    model: item.model || item.name,
    price: String(item.price),
    maxPrice: item.maxPrice === undefined ? '' : String(item.maxPrice),
    originalPrice: item.originalPrice === undefined ? '' : String(item.originalPrice),
    billing: item.billing || '包月',
    quantity: item.quantityText || String(item.quantity),
    duration: item.duration || (item.expiresAt ? '自定义' : '长期有效'),
    expiryDate: item.expiresAt ? localDate(new Date(item.expiresAt)) : '',
    delivery: item.delivery || emptyDraft.delivery,
    contact: item.contact || '',
    condition: item.condition,
    category: item.category,
    description: item.description,
    images: item.images || [],
  })
}
// Deterministic chart samples, so switching pages does not invent fresh price moves.
export function chartSamples(base: number, volatility: number, seed: string, count = 30) {
  let state = [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 37)
  let value = base - volatility * 1.7
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
  const result = Array.from({ length: count }, (_, i) => {
    const open = value
    value = Math.max(base * 0.1, value + (random() - 0.42) * volatility)
    return {
      label: String(i + 1).padStart(2, '0'),
      open,
      close: value,
      low: Math.min(open, value) - random() * volatility * 0.4,
      high: Math.max(open, value) + random() * volatility * 0.4,
    }
  })
  const offset = base - result[result.length - 1].close
  return result.map((point) => ({
    ...point,
    open: point.open + offset,
    close: point.close + offset,
    low: point.low + offset,
    high: point.high + offset,
  }))
}

import { ApiError, object, type createHttpClient } from './http-core'

export type ApiListingType = 'sale' | 'lease' | 'demand'
export type ApiCondition = 'new' | 'like_new_99' | 'like_new_95' | 'used_90' | 'open_box' | 'custom'
export interface MarketQuery {
  type?: ApiListingType
  keyword?: string
  condition?: ApiCondition
  sort?: 'published_at' | 'price'
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}
export interface MarketCard {
  id: number
  type: ApiListingType
  title: string
  images: string[]
  category: string
  gpuModel: string
  summary: string
  priceMin: string | null
  priceMax: string | null
  budgetMin: string | null
  budgetMax: string | null
  currency: string
  priceUnit: string
  demandMode: string
}
export interface MarketPage { items: MarketCard[]; total: number; page: number; pageSize: number }
export const apiListingTypes = ['sale', 'lease', 'demand'] as const
export const apiTypeLabels = { sale: '售卖', lease: '租赁', demand: '需求' } as const
export const apiConditionLabels: Record<ApiCondition, string> = {
  new: '全新', like_new_99: '99 新', like_new_95: '95 新', used_90: '9 成新', open_box: '拆机良品', custom: '自定义',
}
const contractError = () => new ApiError('服务返回的数据格式异常，请稍后重试', 0, 'INVALID_RESPONSE')
const text = (value: unknown) => typeof value === 'string' ? value : ''
const decimal = (value: unknown) => value === null || (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value))
const images = (value: unknown) => Array.isArray(value)
  ? value.filter((url): url is string => typeof url === 'string' && /^https?:\/\/[^/\s]+/i.test(url)) : []
export function parseMarketPage(input: unknown): MarketPage {
  const data = object(input)
  if (!Array.isArray(data.items) || !Number.isSafeInteger(data.total) || Number(data.total) < 0 ||
    !Number.isSafeInteger(data.page) || Number(data.page) < 1 || !Number.isSafeInteger(data.pageSize) ||
    Number(data.pageSize) < 1 || Number(data.pageSize) > 100) throw contractError()
  const items = data.items.map((input): MarketCard => {
    const card = object(input)
    if (!Number.isSafeInteger(card.id) || Number(card.id) <= 0 || !apiListingTypes.includes(card.type as ApiListingType) ||
      typeof card.title !== 'string' || !Array.isArray(card.images) ||
      !['category', 'gpuModel', 'summary', 'currency', 'priceUnit', 'demandMode'].every((key) => typeof card[key] === 'string') ||
      ![card.priceMin, card.priceMax, card.budgetMin, card.budgetMax].every(decimal)) throw contractError()
    // Only copy the documented public fields. Never persist an entire backend DTO.
    return { id: Number(card.id), type: card.type as ApiListingType, title: card.title,
      images: images(card.images), category: text(card.category), gpuModel: text(card.gpuModel), summary: text(card.summary),
      priceMin: card.priceMin as string | null, priceMax: card.priceMax as string | null,
      budgetMin: card.budgetMin as string | null, budgetMax: card.budgetMax as string | null,
      currency: text(card.currency), priceUnit: text(card.priceUnit), demandMode: text(card.demandMode) }
  })
  return { items, total: Number(data.total), page: Number(data.page), pageSize: Number(data.pageSize) }
}
export const marketKey = (type: ApiListingType, id: number) => `remote:${type}:${id}`
export function parseMarketKey(key = ''): { type: ApiListingType; id: number } | undefined {
  try { key = decodeURIComponent(key) } catch { return undefined }
  const match = key.match(/^remote:(sale|lease|demand):([1-9]\d*)$/)
  if (!match || !Number.isSafeInteger(Number(match[2]))) return undefined
  return { type: match[1] as ApiListingType, id: Number(match[2]) }
}
export const formatDecimal = (value: string) => {
  const [integer, fraction] = value.split('.')
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`)
}
const normalizeDecimal = (value: string) => value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value
export function marketPrice(card: MarketCard): string {
  const min = card.type === 'demand' ? card.budgetMin : card.priceMin
  const max = card.type === 'demand' ? card.budgetMax : card.priceMax
  if (min === null && max === null) return card.type === 'demand' ? '预算未提供' : '价格未提供'
  const prefix = card.currency === 'CNY' ? '¥' : card.currency ? `${card.currency} ` : ''
  const amount = min !== null && max !== null ? formatDecimal(min) +
    (normalizeDecimal(min) === normalizeDecimal(max) ? '' : `–${formatDecimal(max)}`)
    : min !== null ? `${formatDecimal(min)} 起` : `最高 ${formatDecimal(max!)}`
  return `${prefix}${amount}`
}
export const marketUnit = (card: MarketCard) => card.type === 'lease'
  ? ({ hour: '/小时', day: '/天', week: '/周', month: '/月' }[card.priceUnit] || card.priceUnit && `/${card.priceUnit}`) : ''

// Public detail DTOs differ by type and never use the provider's payload wrapper.
export interface PublicListing {
  title: string
  category: string
  gpuModel: string
  description: string
  images: string[]
  demandMode: string
  budgetMin: string | null
  budgetMax: string | null
  currency: string
  quotation?: Pick<MarketCard, 'priceMin' | 'priceMax' | 'priceUnit' | 'currency'>
  originalPrice?: string
  deliveryCycle: string
  quantity?: number
  location: string
  expiresAt: string | null
  supplierName: string
  specifications: Array<{ label: string; value: string }>
  priceNote: string
  warranty: string
  support: string
}
export function parsePublicListing(input: unknown, type: ApiListingType): PublicListing {
  const payload = object(input)
  const product = type === 'sale' ? object(payload.product) : payload
  const titleValue = type === 'sale' ? product.name : payload.title
  if (typeof titleValue !== 'string') throw contractError()
  const title = titleValue || `未命名${apiTypeLabels[type]}信息`
  if (type === 'demand' && (!decimal(payload.budgetMin) || !decimal(payload.budgetMax))) throw contractError()
  // The deployed legacy lease DTO uses numeric snake_case prices, unlike M04
  // cards. Convert only these legacy fields for display, never the M04 strings.
  const legacyAmount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? String(value) : typeof value === 'string' && decimal(value) ? value : null
  const leasePrice = payload.trade_mode === 'hourly' ? legacyAmount(payload.price_per_hour) : legacyAmount(payload.package_price)
  const quotation = type === 'sale' && decimal(product.priceMin) && decimal(product.priceMax)
    ? { priceMin: product.priceMin as string | null, priceMax: product.priceMax as string | null, priceUnit: '', currency: text(product.currency) }
    : type === 'lease' && (payload.trade_mode === 'hourly' || payload.trade_mode === 'package')
    ? { priceMin: leasePrice, priceMax: leasePrice, priceUnit: payload.trade_mode === 'hourly' ? 'hour' : text(payload.package_period), currency: text(payload.currency) }
    : undefined
  const supplier = object(payload.supplier)
  const location = type === 'demand' ? object(supplier.location) : {}
  const specs = type === 'sale' ? object(product.specifications) : {}
  const specifications = type === 'lease' ? [
    ['GPU 数量', payload.gpu_count, ''], ['显存', payload.gpu_vram_gb, ' GB'], ['每 GPU 内存', payload.memory_per_gpu_gb, ' GB'],
    ['每 GPU vCPU', payload.vcpu_per_gpu, ''], ['系统盘', payload.system_disk_gb, ' GB'], ['数据盘', payload.data_disk_gb, ' GB'],
  ].flatMap(([label, value, unit]) => typeof value === 'number' && value > 0 ? [{ label: String(label), value: `${value}${unit}` }] : [])
    : Object.entries(specs).flatMap(([label, value]) => typeof value === 'string' || typeof value === 'number'
      ? [{ label, value: String(value) }] : [])
  const originalPrice = type === 'lease' ? legacyAmount(payload.trade_mode === 'hourly'
    ? payload.original_price_per_hour : payload.original_package_price) : null
  return { title, category: text(product.category), gpuModel: type === 'sale'
    ? text(object(product.specifications).gpu_model) : text(payload.gpuModel) || text(payload.gpu_model),
  description: text(product.description), images: images(product.images), demandMode: text(payload.demandMode),
  budgetMin: type === 'demand' ? payload.budgetMin as string | null : null,
  budgetMax: type === 'demand' ? payload.budgetMax as string | null : null, currency: text(payload.currency), quotation,
  originalPrice: originalPrice !== null && Number(originalPrice) > 0 ? originalPrice : undefined,
  deliveryCycle: type === 'lease' ? text(payload.delivery_cycle) : type === 'sale' ? text(product.deliveryCycle) : text(payload.deliveryCycle),
  quantity: type === 'demand' && Number.isSafeInteger(object(payload.product).quantity) && Number(object(payload.product).quantity) > 0
    ? Number(object(payload.product).quantity) : undefined,
  location: type === 'demand' ? [...new Set([text(location.provinceName), text(location.cityName)].filter(Boolean))].join(' · ')
    : type === 'lease' ? text(payload.region_name) : '',
  expiresAt: type === 'demand' && typeof payload.expiresAt === 'string' ? payload.expiresAt : null,
  supplierName: type === 'sale' ? text(supplier.name) : '', specifications,
  priceNote: type === 'sale' ? text(product.priceNote) : '', warranty: type === 'sale' ? text(product.warranty) : '',
  support: type === 'sale' ? text(product.support) : '' }
}
export function createListingApi(http: ReturnType<typeof createHttpClient>) {
  return {
    async getMarket(query: MarketQuery = {}): Promise<MarketPage> {
      const data = await http.get('/api/banking/market/listings', {
        ...query, keyword: query.keyword?.trim() || undefined,
        page: query.page ?? 1, pageSize: query.pageSize ?? 20,
      })
      return parseMarketPage(data)
    },
    async getPublicDetail(type: ApiListingType, id: number): Promise<PublicListing> {
      if (!apiListingTypes.includes(type) || !Number.isSafeInteger(id) || id <= 0) throw contractError()
      return parsePublicListing(await http.get(`/api/banking/listings/${id}`, { type }), type)
    },
  }
}

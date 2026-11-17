import { ApiError, object, type createHttpClient } from './http-core'
import { apiListingTypes, type ApiListingType } from './listing-api'

export type ReviewStatus = 'draft' | 'pending_review' | 'rejected' | 'published' | 'on_sale' | 'off_shelf' | 'approved'
export interface ProviderListing {
  id: number
  type: ApiListingType
  providerUserId: number
  reviewStatus: ReviewStatus
  reviewRemark: string
  expiresAt: string | null
  offShelfRequestStatus: string
  payload: Record<string, unknown>
}
export interface ProviderPage { list: ProviderListing[]; total: number; page: number; pageSize: number }
export type ProviderAction = 'submit' | 'resubmit' | 'withdraw' | 'off-shelf-request'
export const reviewStatusLabels: Record<ReviewStatus, string> = {
  draft: '草稿', pending_review: '审核中', rejected: '审核未通过', published: '已上架', on_sale: '已上架',
  off_shelf: '已下架', approved: '审核通过',
}
const invalid = () => new ApiError('本人发布数据格式异常，请刷新重试', 0, 'INVALID_RESPONSE')
const text = (input: unknown) => typeof input === 'string' ? input : ''
export function parseProviderListing(input: unknown, type: ApiListingType): ProviderListing {
  const value = object(input)
  if (!Number.isSafeInteger(value.id) || Number(value.id) <= 0 || value.type !== type ||
    !Number.isSafeInteger(value.providerUserId) || Number(value.providerUserId) <= 0 ||
    typeof value.reviewStatus !== 'string' || !Object.prototype.hasOwnProperty.call(reviewStatusLabels, value.reviewStatus) ||
    !value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)) throw invalid()
  return { id: Number(value.id), type, providerUserId: Number(value.providerUserId), reviewStatus: value.reviewStatus as ReviewStatus,
    reviewRemark: text(value.reviewRemark), expiresAt: typeof value.expiresAt === 'string' ? value.expiresAt : null,
    offShelfRequestStatus: text(value.offShelfRequestStatus), payload: object(value.payload) }
}
export function parseProviderPage(input: unknown, type: ApiListingType): ProviderPage {
  const data = object(input), size = data.pageSize ?? data.page_size
  if (!Array.isArray(data.list) || !Number.isSafeInteger(data.total) || Number(data.total) < 0 ||
    !Number.isSafeInteger(data.page) || Number(data.page) < 1 || !Number.isSafeInteger(size) || Number(size) < 1) throw invalid()
  return { list: data.list.map((item) => parseProviderListing(item, type)), total: Number(data.total), page: Number(data.page), pageSize: Number(size) }
}
export function providerActions(item: ProviderListing): Array<ProviderAction | 'edit' | 'delete'> {
  if (item.reviewStatus === 'draft') return ['edit', 'submit', 'delete']
  if (item.reviewStatus === 'rejected') return ['edit', 'resubmit', 'delete']
  if (item.reviewStatus === 'off_shelf') return ['edit', 'resubmit']
  if (item.reviewStatus === 'pending_review') return item.type === 'lease' ? [] : ['withdraw']
  if (item.reviewStatus === 'published' || item.reviewStatus === 'on_sale')
    return item.offShelfRequestStatus === 'pending' ? [] : ['off-shelf-request']
  return []
}
export const providerTitle = (item: ProviderListing) => text(item.type === 'sale' ? object(item.payload.product).name : item.payload.title) || '未命名信息'
const productKeys = ['name', 'slug', 'category', 'specifications', 'priceMin', 'priceMax', 'currency', 'priceNote', 'deliveryCycle',
  'deliveryNote', 'description', 'detailContent', 'images', 'thumbnail', 'stock', 'warranty', 'support', 'features', 'quantity', 'validity', 'condition', 'conditionNote']
const supplierKeys = ['name', 'slug', 'description', 'logo', 'website', 'contactEmail', 'contactPhone', 'address', 'businessLicense',
  'certifications', 'contactGeneric', 'location']
const leaseKeys = ['title', 'category', 'gpu_model', 'gpu_count', 'gpu_vram_gb', 'vcpu_per_gpu', 'cpu_model', 'memory_per_gpu_gb',
  'system_disk_gb', 'data_disk_gb', 'data_disk_expandable_gb', 'gpu_driver_version', 'cuda_version', 'trade_mode', 'package_period',
  'price_per_hour', 'original_price_per_hour', 'package_price', 'original_package_price', 'delivery_cycle', 'description', 'detail_content',
  'images', 'tags', 'thumbnail', 'stock', 'region', 'datacenter', 'available_until', 'condition', 'conditionNote']
const demandKeys = ['demandMode', 'title', 'category', 'gpuModel', 'budgetMin', 'budgetMax', 'currency', 'deliveryCycle', 'description', 'images']
export function normalizeLeasePayload(input: Record<string, unknown>): Record<string, unknown> {
  const value = { ...input }
  const names: Record<string, string> = { tradeMode: 'trade_mode', pricePerHour: 'price_per_hour', packagePrice: 'package_price',
    packagePeriod: 'package_period', originalPricePerHour: 'original_price_per_hour', originalPackagePrice: 'original_package_price',
    gpuModel: 'gpu_model', gpuCount: 'gpu_count', gpuVramGb: 'gpu_vram_gb', vcpuPerGpu: 'vcpu_per_gpu', cpuModel: 'cpu_model',
    memoryPerGpu: 'memory_per_gpu_gb', systemDiskGb: 'system_disk_gb', dataDiskGb: 'data_disk_gb',
    dataDiskExpandableGb: 'data_disk_expandable_gb', gpuDriverVersion: 'gpu_driver_version', cudaVersion: 'cuda_version',
    deliveryCycle: 'delivery_cycle', detailContent: 'detail_content', availableUntil: 'available_until' }
  for (const [camel, snake] of Object.entries(names)) if (value[snake] === undefined && value[camel] !== undefined) value[snake] = value[camel]
  return value
}
const pick = (source: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys
  .filter((key) => source[key] !== undefined && source[key] !== null).map((key) => [key, source[key]]))
// Sale PATCH is a full update: preserve existing editable fields and explicitly
// omit server metadata. Region names are read-only even inside a private DTO.
export function editablePayload(item: ProviderListing): Record<string, unknown> {
  const payload = item.type === 'lease' ? normalizeLeasePayload(item.payload) : item.payload
  const product = pick(object(payload.product), item.type === 'sale' ? productKeys : ['quantity', 'validity'])
  const supplier = pick(object(payload.supplier), item.type === 'sale' ? supplierKeys : ['contactGeneric', 'location'])
  if (supplier.location !== undefined) supplier.location = pick(object(supplier.location), ['provinceCode', 'cityCode'])
  return { ...pick(payload, item.type === 'lease' ? leaseKeys : item.type === 'demand' ? demandKeys : []), product, supplier }
}
export function createProviderApi(http: ReturnType<typeof createHttpClient>) {
  const path = (type: ApiListingType, id: number) => {
    if (!apiListingTypes.includes(type) || !Number.isSafeInteger(id) || id <= 0) throw invalid()
    return `/api/banking/provider/listings/${id}`
  }
  return {
    async list(type: ApiListingType, page = 1, pageSize = 20, status?: ReviewStatus) {
      return parseProviderPage(await http.get('/api/banking/provider/listings',
        { type, page, pageSize, page_size: pageSize, status }, true), type)
    },
    async detail(type: ApiListingType, id: number) {
      return parseProviderListing(await http.get(path(type, id), { type }, true), type)
    },
    async create(type: ApiListingType, payload: Record<string, unknown>) {
      if (!apiListingTypes.includes(type)) throw invalid()
      const created = parseProviderListing(await http.post('/api/banking/provider/listings', { ...payload, type }), type)
      if (created.reviewStatus !== 'draft') throw invalid()
      return created
    },
    async edit(item: ProviderListing, fields: Record<string, unknown>) {
      if (!providerActions(item).includes('edit')) throw new ApiError('当前状态不可编辑，请刷新后重试', 403)
      return parseProviderListing(await http.patch(path(item.type, item.id), fields, { type: item.type }), item.type)
    },
    async action(item: ProviderListing, action: ProviderAction, reason?: string) {
      if (!providerActions(item).includes(action)) throw new ApiError('当前状态不支持此操作，请刷新后重试', 409)
      if (action === 'off-shelf-request' && !reason?.trim()) throw new ApiError('请填写下架原因', 400)
      const body = action === 'off-shelf-request' ? { reason: reason!.trim() } : undefined
      return parseProviderListing(await http.post(`${path(item.type, item.id)}/${action}`, body, { type: item.type }), item.type)
    },
    async remove(item: ProviderListing) {
      if (!providerActions(item).includes('delete')) throw new ApiError('仅草稿或审核未通过的信息可以删除', 403)
      await http.delete(path(item.type, item.id), { type: item.type })
    },
  }
}

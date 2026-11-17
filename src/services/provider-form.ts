import { ApiError, object } from './http-core'
import { apiConditionLabels, type ApiCondition, type ApiListingType } from './listing-api'
import { editablePayload, normalizeLeasePayload, type ProviderListing } from './provider-api'
import { isMarketLocation, type MarketLocation } from '../constants/market-regions'

export interface ProviderForm {
  type: ApiListingType
  title: string
  category: string
  model: string
  supplierName: string
  contactPhone: string
  contactEmail: string
  quantity: string
  gpuCount: string
  price: string
  maxPrice: string
  originalPrice: string
  billing: 'hour' | 'day' | 'week' | 'month'
  delivery: string
  description: string
  contact: string
  condition: ApiCondition | ''
  conditionNote: string
  demandMode: 'purchase' | 'lease'
  images: string[]
  validityMode: 'unlimited' | 'days' | 'date'
  validityDays: string
  validityUntil: string
  location?: MarketLocation
}
export const emptyProviderForm: ProviderForm = {
  type: 'sale', title: '', category: '', model: '', supplierName: '', contactPhone: '', contactEmail: '', quantity: '', gpuCount: '', price: '', maxPrice: '',
  originalPrice: '', billing: 'month', delivery: '', description: '', contact: '', condition: '', conditionNote: '',
  demandMode: 'purchase', images: [], validityMode: 'unlimited', validityDays: '30', validityUntil: '',
}
const str = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : ''
export function restoreProviderForm(input: unknown): ProviderForm {
  const value = object(input)
  const fields = Object.fromEntries(Object.keys(emptyProviderForm).filter((key) =>
    typeof value[key] === typeof emptyProviderForm[key as keyof ProviderForm]).map((key) => [key, value[key]]))
  const location = object(value.location)
  return { ...emptyProviderForm, ...fields, images: Array.isArray(value.images)
    ? value.images.filter((url): url is string => typeof url === 'string') : [],
    location: typeof location.provinceCode === 'string' && /^\d{6}$/.test(location.provinceCode) &&
      typeof location.cityCode === 'string' && /^(?:\d{6})?$/.test(location.cityCode)
      ? { provinceCode: location.provinceCode, cityCode: location.cityCode } : undefined }
}
export function formFromProvider(item: ProviderListing): ProviderForm {
  const data = item.type === 'lease' ? normalizeLeasePayload(item.payload) : item.payload
  const product = object(data.product), supplier = object(data.supplier)
  const fields = item.type === 'sale' ? product : data
  const validity = object(product.validity), location = object(supplier.location)
  const hourly = data.trade_mode === 'hourly'
  const condition = str(item.type === 'sale' ? product.condition : data.condition)
  return { ...emptyProviderForm, type: item.type, title: str(item.type === 'sale' ? product.name : data.title),
    category: str(fields.category), model: str(item.type === 'sale' ? object(product.specifications).gpu_model
      : item.type === 'lease' ? data.gpu_model : data.gpuModel), supplierName: str(supplier.name),
    contactPhone: str(supplier.contactPhone), contactEmail: str(supplier.contactEmail), quantity: str(product.quantity),
    gpuCount: str(data.gpu_count), price: str(item.type === 'sale' ? product.priceMin : item.type === 'demand' ? data.budgetMin
      : hourly ? data.price_per_hour : data.package_price), maxPrice: str(item.type === 'sale' ? product.priceMax : item.type === 'demand' ? data.budgetMax : ''),
    originalPrice: item.type === 'lease' ? str(hourly ? data.original_price_per_hour : data.original_package_price) : '',
    billing: item.type === 'lease' && !hourly ? (['day', 'week', 'month'].includes(str(data.package_period)) ? data.package_period as 'day' | 'week' | 'month' : 'month') : 'hour',
    delivery: str(item.type === 'lease' ? data.delivery_cycle : fields.deliveryCycle), description: str(fields.description),
    contact: str(supplier.contactGeneric), condition: Object.prototype.hasOwnProperty.call(apiConditionLabels, condition) ? condition as ApiCondition : '',
    conditionNote: str(item.type === 'sale' ? product.conditionNote : data.conditionNote),
    demandMode: data.demandMode === 'lease' ? 'lease' : 'purchase',
    images: Array.isArray(fields.images) ? fields.images.filter((value): value is string => typeof value === 'string') : [],
    validityMode: validity.mode === 'days' || validity.mode === 'date' ? validity.mode : 'unlimited',
    validityDays: str(validity.days) || '30', validityUntil: str(validity.until),
    location: typeof location.provinceCode === 'string' && typeof location.cityCode === 'string'
      ? { provinceCode: location.provinceCode, cityCode: location.cityCode } : undefined }
}
const fail = (message: string): never => { throw new ApiError(message, 400, 'FORM_INVALID') }
const positiveDecimal = (value: string) => /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value) && /[1-9]/.test(value)
const cents = (value: string) => { const [whole, part = ''] = value.split('.'); return BigInt(whole) * 100n + BigInt(part.padEnd(2, '0')) }
const boundedText = (value: string, limit: number, name: string) => {
  const result = value.trim()
  if (!result || [...result].length > limit) fail(`请填写不超过 ${limit} 个字的${name}`)
  return result
}
export function providerFormPayload(form: ProviderForm, existing?: ProviderListing): Record<string, unknown> {
  if (existing && existing.type !== form.type) fail('编辑时不能更改信息类型')
  const base = existing ? editablePayload(existing) : {}
  const product = { ...object(base.product) }, supplier = { ...object(base.supplier) }
  const title = boundedText(form.title, form.type === 'sale' ? 128 : 60, '信息名称')
  const category = boundedText(form.category, 64, '商品分类')
  const delivery = boundedText(form.delivery, 50, '交付周期')
  if (!positiveDecimal(form.price) || form.maxPrice && !positiveDecimal(form.maxPrice)) fail('请输入正数价格，最多两位小数')
  const max = form.maxPrice || form.price
  if (cents(max) < cents(form.price)) fail('最高价须不低于最低价')
  if (form.type === 'demand' && cents(max) > 999999999999999999n) fail('预算超出允许范围')
  if (!/^\d+$/.test(form.quantity) || Number(form.quantity) < 1 || Number(form.quantity) > 1000000) fail('商品数量须为 1 至 1000000 的整数')
  product.quantity = Number(form.quantity)
  const contact = form.contact.trim()
  if (contact) supplier.contactGeneric = boundedText(contact, 128, '联系方式')
  else if (form.type !== 'sale') fail('请填写联系方式')
  if (form.type === 'demand' && !form.location) fail('请选择交易地区')
  if (form.location) {
    const original = object(object(existing?.payload.supplier).location)
    // Preserve unchanged server-owned codes if the server uses a newer dictionary.
    const unchanged = existing && /^\d{6}$/.test(form.location.provinceCode) && /^\d{6}$/.test(form.location.cityCode) &&
      original.provinceCode === form.location.provinceCode && original.cityCode === form.location.cityCode
    if (!isMarketLocation(form.location) && !unchanged) fail(form.location.cityCode ? '请选择有效的省份和城市' : '请选择交易城市')
    supplier.location = { provinceCode: form.location.provinceCode, cityCode: form.location.cityCode }
  }
  if (form.validityMode === 'days') {
    if (![7, 15, 30, 60, 90].includes(Number(form.validityDays))) fail('请选择有效天数')
    product.validity = { mode: 'days', days: Number(form.validityDays) }
  } else if (form.validityMode === 'date') {
    const until = form.validityUntil
    const date = new Date(`${until}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== until) fail('请选择有效的截止日期')
    if (until < new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)) fail('截止日期不能早于今天')
    product.validity = { mode: 'date', until }
  } else product.validity = { mode: 'unlimited' }
  if (form.images.length > 9 || !form.images.every((url) => /^https?:\/\/[^/\s]+/i.test(url))) fail('请先完成商品图片上传')
  if (form.type !== 'sale' && [...form.description.trim()].length > 200) fail('描述最多 200 个字')
  if (form.type !== 'demand') {
    const target = form.type === 'sale' ? product : base
    if (form.condition) {
      if (!Object.prototype.hasOwnProperty.call(apiConditionLabels, form.condition)) fail('请选择有效成色')
      target.condition = form.condition
    }
    // The API rejects even an empty note unless the condition is custom.
    if (form.condition === 'custom') target.conditionNote = boundedText(form.conditionNote, 100, '成色说明')
    else delete target.conditionNote
  }
  if (form.type === 'sale') {
    supplier.name = boundedText(form.supplierName, 128, '供应商名称')
    supplier.contactPhone = form.contactPhone.trim()
    supplier.contactEmail = form.contactEmail.trim()
    if (!supplier.contactPhone && !supplier.contactEmail) fail('售卖信息必须填写联系电话或邮箱，通用联系方式不能替代')
    const specifications = { ...object(product.specifications) }
    if (form.model.trim()) specifications.gpu_model = form.model.trim()
    if (!Object.keys(specifications).length) fail('请填写 GPU 型号')
    Object.assign(product, { name: title, category, specifications, priceMin: form.price, priceMax: max,
      currency: str(product.currency) || 'CNY', deliveryCycle: delivery, description: form.description.trim(), images: [...form.images] })
    return { product, supplier }
  }
  if (form.type === 'demand') return { ...base, title, category, demandMode: form.demandMode,
    gpuModel: boundedText(form.model, 100, '型号'), budgetMin: form.price, budgetMax: max, currency: 'CNY', deliveryCycle: delivery,
    description: form.description.trim(), images: [...form.images], product, supplier }
  if (!['gpu-server', 'general_server'].includes(category)) fail('请选择 GPU 服务器或通用服务器')
  if (!Number.isFinite(Number(form.price)) || Number(form.price) > Number.MAX_SAFE_INTEGER / 100) fail('租赁价格超出允许精度')
  if (!/^\d+$/.test(form.gpuCount) || Number(form.gpuCount) <= 0 || !Number.isSafeInteger(Number(form.gpuCount))) fail('请填写每台设备的 GPU 数量')
  if (form.originalPrice && (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(form.originalPrice) ||
    cents(form.originalPrice) > 0n && cents(form.originalPrice) < cents(form.price))) fail('原价须不低于现价，或留空 / 填 0')
  const priceFields = form.billing === 'hour' ? { trade_mode: 'hourly', price_per_hour: Number(form.price),
    original_price_per_hour: Number(form.originalPrice || 0) } : { trade_mode: 'package', package_period: form.billing,
    package_price: Number(form.price), original_package_price: Number(form.originalPrice || 0) }
  // Lease PATCH cannot safely switch billing modes or clear old numeric fields.
  if (existing && form.billing !== formFromProvider(existing).billing) fail('编辑暂不支持切换计费方式，请新建信息')
  if (existing && !form.description.trim() && formFromProvider(existing).description) fail('当前租赁接口暂不支持清空描述')
  if (existing && (!form.originalPrice || cents(form.originalPrice) === 0n) && Number(formFromProvider(existing).originalPrice) > 0)
    fail('当前租赁接口暂不支持清空原价')
  delete base.price_per_hour; delete base.original_price_per_hour
  delete base.package_price; delete base.original_package_price; delete base.package_period
  return { ...base, ...priceFields, title, category, gpu_model: boundedText(form.model, 100, '型号'), gpu_count: Number(form.gpuCount),
    delivery_cycle: delivery, description: form.description.trim(), images: [...form.images], product, supplier }
}

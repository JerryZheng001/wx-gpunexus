import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, createHttpClient, object, type HttpRequest } from '../src/services/http-core'
import { createProviderApi, editablePayload, normalizeLeasePayload, parseProviderListing, parseProviderPage, providerActions,
  type ProviderListing, type ReviewStatus } from '../src/services/provider-api'
import { emptyProviderForm, formFromProvider, providerFormPayload } from '../src/services/provider-form'
import { createAndSubmit, type PendingDraft } from '../src/services/provider-draft'
import { apiConditionLabels, type ApiCondition } from '../src/services/listing-api'

const record = (patch: Partial<ProviderListing> = {}): ProviderListing => ({ id: 42, type: 'sale', providerUserId: 183,
  reviewStatus: 'draft', reviewRemark: '', expiresAt: null, offShelfRequestStatus: '', payload: {}, ...patch })
const reply = (data: unknown) => ({ statusCode: 200, data: { success: true, message: '', data } })
const sale = { ...emptyProviderForm, title: 'RTX 4090', category: 'GPU单卡', model: 'RTX 4090', supplierName: '测试供应商',
  contactPhone: '13800138000', contact: 'demo-wechat', quantity: '2', price: '12000.00', delivery: '一周内' }

test('私有请求 Bearer 鉴权，公开请求不附 Token，缺少登录时不发私有请求', async () => {
  const calls: HttpRequest[] = []
  const http = createHttpClient('https://example.test', async (request) => { calls.push(request); return reply({}) },
    { getToken: () => 'Bearer temporary-test-token' })
  await http.get('/api/public')
  assert.equal(calls[0].header.Authorization, undefined)
  await http.get('/api/banking/provider/listings', {}, true)
  assert.equal(calls[1].header.Authorization, 'Bearer temporary-test-token')
  let count = 0
  const anonymous = createHttpClient('https://example.test', async () => { count++; return reply({}) })
  await assert.rejects(anonymous.post('/api/private', {}), (error) => error instanceof ApiError && error.code === 'AUTH_REQUIRED')
  assert.equal(count, 0)
  const proxy = createHttpClient('https://example.test', async (request) => { calls.push(request); return reply({}) }, { authViaProxy: true })
  await proxy.get('/api/private', {}, true)
  assert.equal(calls[2].header.Authorization, undefined)
})

test('本人分页兼容 pageSize/page_size，始终显式传类型，不拿本页长度当总数', async () => {
  const data = { list: [record()], page: 2, page_size: 3, total: 10 }
  assert.equal(parseProviderPage(data, 'sale').total, 10)
  assert.equal(parseProviderPage(data, 'sale').pageSize, 3)
  assert.equal(parseProviderPage({ ...data, pageSize: 4 }, 'sale').pageSize, 4)
  const calls: HttpRequest[] = []
  const api = createProviderApi(createHttpClient('https://example.test', async (request) => { calls.push(request); return reply(data) }, { getToken: () => 'test' }))
  await api.list('sale', 2, 3, 'draft')
  const params = new URL(calls[0].url).searchParams
  assert.equal(params.get('type'), 'sale')
  assert.equal(params.get('pageSize'), '3')
  assert.equal(params.get('page_size'), '3')
  assert.equal(params.get('status'), 'draft')
  assert.throws(() => parseProviderListing({ ...record(), type: 'lease' }, 'sale'), ApiError)
})

test('发布者状态矩阵不开放管理员上架、租赁撤回、续期或下架记录删除', () => {
  const expected: Record<ReviewStatus, string[]> = { draft: ['edit', 'submit', 'delete'], pending_review: ['withdraw'],
    rejected: ['edit', 'resubmit', 'delete'], published: ['off-shelf-request'], on_sale: ['off-shelf-request'],
    off_shelf: ['edit', 'resubmit'], approved: [] }
  for (const [reviewStatus, actions] of Object.entries(expected))
    assert.deepEqual(providerActions(record({ reviewStatus: reviewStatus as ReviewStatus })), actions)
  assert.deepEqual(providerActions(record({ type: 'lease', reviewStatus: 'pending_review' })), [])
  assert.deepEqual(providerActions(record({ reviewStatus: 'published', offShelfRequestStatus: 'pending' })), [])
})

test('创建草稿、提交审核、编辑和删除使用准确方法；无体 POST 不发送伪 JSON', async () => {
  const calls: HttpRequest[] = []
  const api = createProviderApi(createHttpClient('https://example.test', async (request) => { calls.push(request); return reply(record()) }, { getToken: () => 'test' }))
  await api.create('sale', { type: 'demand', product: { name: 'test' } })
  assert.equal(calls[0].method, 'POST')
  assert.equal(object(calls[0].data).type, 'sale')
  assert.equal(calls[0].header['Content-Type'], 'application/json')
  await api.action(record(), 'submit')
  assert.equal(new URL(calls[1].url).pathname, '/api/banking/provider/listings/42/submit')
  assert.equal(new URL(calls[1].url).searchParams.get('type'), 'sale')
  assert.equal(calls[1].data, undefined)
  assert.equal(calls[1].header['Content-Type'], undefined)
  await api.edit(record(), { product: { quantity: 2 } })
  assert.equal(calls[2].method, 'PATCH')
  await api.remove(record())
  assert.equal(calls[3].method, 'DELETE')
  const before = calls.length
  await assert.rejects(api.remove(record({ reviewStatus: 'off_shelf' })), ApiError)
  await assert.rejects(api.action(record({ type: 'lease', reviewStatus: 'pending_review' }), 'withdraw'), ApiError)
  assert.equal(calls.length, before)
})

test('下架申请必须给原因，申请后仍保持上架，不伪造本地状态', async () => {
  const calls: HttpRequest[] = []
  const published = record({ reviewStatus: 'published' })
  const api = createProviderApi(createHttpClient('https://example.test', async (request) => {
    calls.push(request); return reply({ ...published, offShelfRequestStatus: 'pending' })
  }, { getToken: () => 'test' }))
  await assert.rejects(api.action(published, 'off-shelf-request', ' '), /下架原因/)
  const result = await api.action(published, 'off-shelf-request', '  需求已满足  ')
  assert.deepEqual(calls[0].data, { reason: '需求已满足' })
  assert.equal(result.reviewStatus, 'published')
  assert.equal(result.offShelfRequestStatus, 'pending')
})

test('售卖编辑保留原有可编辑字段，剔除 ID、审核、认证和只读地区名称', () => {
  const item = record({ payload: { product: { name: 'old', id: 'private', published: true, specifications: { gpu: 'H100' },
    quantity: null, warranty: '1 年', support: '24h', currency: 'USD', detailContent: '<p>原说明</p>' },
  supplier: { name: '供应商', id: 'private', verified: true, contactPhone: '13800138000',
    location: { provinceCode: '130000', cityCode: '130100', provinceName: '河北省', cityName: '石家庄市' } }, reviewerId: 1 } })
  const fields = editablePayload(item)
  assert.equal(object(fields.product).id, undefined)
  assert.equal(object(fields.product).quantity, undefined)
  assert.equal(object(fields.supplier).verified, undefined)
  assert.deepEqual(object(fields.supplier).location, { provinceCode: '130000', cityCode: '130100' })
  const form = { ...formFromProvider(item), ...sale, model: '' }
  const body = providerFormPayload(form, item)
  assert.deepEqual(object(body.product).specifications, { gpu: 'H100' })
  assert.equal(object(body.product).currency, 'USD')
  assert.equal(object(body.product).detailContent, '<p>原说明</p>')
})

test('新版售卖电话/邮箱至少一个，通用联系方式不能替代，不能伪造供应商名称', () => {
  assert.throws(() => providerFormPayload({ ...sale, contactPhone: '', contactEmail: '', contact: 'wechat' }), /电话或邮箱/)
  assert.throws(() => providerFormPayload({ ...sale, supplierName: '' }), /供应商名称/)
  const body = providerFormPayload({ ...sale, contactPhone: '', contactEmail: 'seller@example.com' })
  assert.equal(object(body.supplier).contactEmail, 'seller@example.com')
  assert.equal(object(body.product).priceMax, '12000.00')
})

test('售卖和租赁仅自定义成色携带说明，新建和编辑均剔除普通成色的空值或旧说明', () => {
  const conditions: Array<ApiCondition | ''> = ['', ...Object.keys(apiConditionLabels) as ApiCondition[]]
  for (const type of ['sale', 'lease'] as const) {
    const form = { ...sale, type, category: 'gpu-server', gpuCount: '8' }
    const payload = providerFormPayload(form)
    for (const condition of conditions) {
      for (const conditionNote of ['', '  有轻微划痕  ']) {
        for (const savedCondition of ['', 'new', 'custom']) {
          const saved = { condition: savedCondition, conditionNote: savedCondition === 'custom' ? '旧说明' : '' }
          const item = record({ type, payload: { ...payload,
            ...(type === 'sale' ? { product: { ...object(payload.product), ...saved } } : saved) } })
          for (const existing of [undefined, item]) {
            const build = () => providerFormPayload({ ...form, condition, conditionNote }, existing)
            if (condition === 'custom' && !conditionNote.trim()) {
              assert.throws(build, /成色说明/)
              continue
            }
            const body = build(), target = type === 'sale' ? object(body.product) : body
            if (condition) assert.equal(target.condition, condition)
            if (condition === 'custom') assert.equal(target.conditionNote, '有轻微划痕')
            else assert.equal(Object.prototype.hasOwnProperty.call(target, 'conditionNote'), false, `${type}/${condition || '未选成色'} 不应携带说明`)
          }
        }
      }
    }
  }
})

test('租赁私有 camelCase 转创建 snake_case，商品数量与 GPU 数量分开，内存字段不丢失', () => {
  const item = record({ type: 'lease', payload: { title: 'A100 服务器', category: 'gpu-server', gpuModel: 'A100', gpuCount: 8,
    tradeMode: 'package', packagePeriod: 'month', packagePrice: 48000, originalPackagePrice: 50000, deliveryCycle: '一周内',
    memoryPerGpu: 64, assetId: null, product: { quantity: 2 }, supplier: { contactGeneric: 'wechat' } } })
  const form = formFromProvider(item)
  assert.equal(form.quantity, '2')
  assert.equal(form.gpuCount, '8')
  assert.equal(form.price, '48000')
  assert.equal(form.billing, 'month')
  const body = providerFormPayload(form, item)
  assert.equal(body.package_price, 48000)
  assert.equal(body.memory_per_gpu_gb, 64)
  assert.equal(body.gpu_count, 8)
  assert.equal(object(body.product).quantity, 2)
  assert.equal(body.assetId, undefined)
  assert.equal(body.packagePrice, undefined)
  assert.equal(normalizeLeasePayload({ gpuCount: 8, gpu_count: 4 }).gpu_count, 4)
  assert.throws(() => providerFormPayload({ ...form, category: '其他' }, item), /服务器/)
  assert.throws(() => providerFormPayload({ ...form, billing: 'hour' }, item), /切换计费方式/)
  const zeroOriginal = { ...item, payload: { ...item.payload, originalPackagePrice: 0 } }
  assert.equal(providerFormPayload(formFromProvider(zeroOriginal), zeroOriginal).original_package_price, 0)
  assert.throws(() => providerFormPayload({ ...form, originalPrice: '0' }, item), /清空原价/)
})

test('需求预算保持精度，地区不猜编码，有效期不伪造 expiresAt', () => {
  const demand = { ...sale, type: 'demand' as const, price: '9999999999999999.99', maxPrice: '9999999999999999.99' }
  assert.throws(() => providerFormPayload(demand), /交易地区/)
  const body = providerFormPayload({ ...demand, location: { provinceCode: '130000', cityCode: '130100' }, validityMode: 'days', validityDays: '30' })
  assert.equal(body.budgetMin, '9999999999999999.99')
  assert.equal(body.expiresAt, undefined)
  assert.deepEqual(object(body.product).validity, { mode: 'days', days: 30 })
  assert.throws(() => providerFormPayload({ ...demand, price: '1e3' }), /正数价格/)
  assert.throws(() => providerFormPayload({ ...sale, validityMode: 'date', validityUntil: 'invalid' }), /截止日期/)
  assert.throws(() => providerFormPayload({ ...sale, validityMode: 'date', validityUntil: '2030-02-30' }), /截止日期/)
})

test('提交审核失败保留草稿 ID，下次继续提交不会重复创建', async () => {
  let pending: PendingDraft | undefined
  let creates = 0, submits = 0
  const storage = { read: () => pending, write: (value: PendingDraft) => { pending = value } }
  const api = { create: async () => { creates++; return { id: 42, type: 'sale' as const } },
    submit: async () => { if (++submits === 1) throw new ApiError('offline', 0, 'NETWORK_ERROR') } }
  await assert.rejects(createAndSubmit('sale', {}, storage, api), /offline/)
  assert.deepEqual(pending, { type: 'sale', id: 42, uncertain: false })
  await createAndSubmit('sale', {}, storage, api)
  assert.equal(creates, 1)
  assert.equal(submits, 2)
})

test('创建超时或 500 标记结果不确定，禁止自动重试，明确 400 后允许修正重试', async () => {
  for (const status of [0, 500, 400]) {
    let pending: PendingDraft | undefined, creates = 0
    const storage = { read: () => pending, write: (value: PendingDraft) => { pending = value } }
    const api = { create: async () => { creates++; throw new ApiError('failed', status) }, submit: async () => undefined }
    await assert.rejects(createAndSubmit('sale', {}, storage, api))
    assert.equal(pending?.uncertain, status !== 400)
    await assert.rejects(createAndSubmit('sale', {}, storage, api))
    assert.equal(creates, status === 400 ? 2 : 1)
  }
})

test('本地保护记录保存失败时不创建，创建成功但 ID 写入失败时保持不确定标记', async () => {
  let calls = 0
  await assert.rejects(createAndSubmit('sale', {}, { read: () => undefined, write: () => { throw new Error('storage full') } },
    { create: async () => { calls++; return { type: 'sale', id: 42 } }, submit: async () => undefined }), /storage full/)
  assert.equal(calls, 0)
  let pending: PendingDraft | undefined
  await assert.rejects(createAndSubmit('sale', {}, { read: () => pending, write: (value) => {
    if (value.id) throw new Error('storage full'); pending = value
  } }, { create: async () => ({ type: 'sale', id: 42 }), submit: async () => { throw new Error('must not submit') } }), /storage full/)
  assert.equal(pending?.uncertain, true)
})

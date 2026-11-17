import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { ApiError, createHttpClient, type HttpRequest, type Transport } from '../src/services/http-core'
import { createListingApi, formatDecimal, marketKey, marketPrice, marketUnit, parseMarketKey, parseMarketPage,
  parsePublicListing, type MarketCard, type MarketPage } from '../src/services/listing-api'
import { createMarketFeed } from '../src/services/market-feed'

const card: MarketCard = { id: 42, type: 'sale', title: '4090', images: [], category: 'GPU单卡', gpuModel: '', summary: '',
  priceMin: '12000.00', priceMax: '13000.00', budgetMin: null, budgetMax: null, currency: 'CNY', priceUnit: '', demandMode: '' }
const page = (items = [card], number = 1, total = items.length): MarketPage => ({ items, page: number, pageSize: 20, total })
const response = (data: unknown) => ({ statusCode: 200, data: { success: true, message: '', data } })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('市场请求转换查询参数：保留字面搜索、正确分页，不发送空筛选或旧类型', async () => {
  let request!: HttpRequest
  const api = createListingApi(createHttpClient('https://example.test/', async (input) => {
    request = input
    return response(page())
  }))
  await api.getMarket({ type: 'lease', keyword: '  RTX 4090%_  ', condition: 'open_box', sort: 'price', order: 'asc', page: 2 })
  const url = new URL(request.url)
  assert.equal(url.pathname, '/api/banking/market/listings')
  assert.deepEqual(Object.fromEntries(url.searchParams), { type: 'lease', keyword: 'RTX 4090%_', condition: 'open_box', sort: 'price', order: 'asc', page: '2', pageSize: '20' })
  assert.equal(request.method, 'GET')
  assert.equal(request.timeout, 15000)
  await api.getMarket({ keyword: '  ' })
  assert.equal(new URL(request.url).searchParams.has('keyword'), false)
  assert.equal(new URL(request.url).searchParams.has('type'), false)
})

test('同号的三类信息在路由、收藏、足迹中保持不同身份，拒绝损失精度的 ID', () => {
  const keys = ['sale', 'lease', 'demand'].map((type) => marketKey(type as MarketCard['type'], 42))
  assert.equal(new Set(keys).size, 3)
  assert.deepEqual(parseMarketKey(keys[1]), { type: 'lease', id: 42 })
  assert.deepEqual(parseMarketKey(encodeURIComponent(keys[1])), { type: 'lease', id: 42 })
  assert.equal(parseMarketKey('%invalid'), undefined)
  for (const key of ['42', 'remote:sell:42', 'remote:lease:0', 'remote:sale:01', 'remote:sale:9007199254740993'])
    assert.equal(parseMarketKey(key), undefined)
})

test('金额不经过浮点转换，保留零值、小数、大额及未知币种，不把缺失金额显示为零或面议', () => {
  assert.equal(marketPrice({ ...card, priceMin: '9999999999999999.99', priceMax: '9999999999999999.99' }), '¥9,999,999,999,999,999.99')
  assert.equal(marketPrice({ ...card, priceMin: '0.00', priceMax: '0.00' }), '¥0.00')
  assert.equal(marketPrice({ ...card, priceMin: null, priceMax: null }), '价格未提供')
  assert.equal(marketPrice({ ...card, type: 'demand', budgetMin: '12.50', budgetMax: '12.5' }), '¥12.50')
  assert.equal(marketPrice({ ...card, currency: 'USD' }), 'USD 12,000.00–13,000.00')
  assert.equal(marketPrice({ ...card, currency: '' }), '12,000.00–13,000.00')
  assert.equal(marketUnit({ ...card, type: 'lease', priceUnit: 'hour' }), '/小时')
  assert.equal(marketUnit({ ...card, priceUnit: 'hour' }), '')
  assert.equal(formatDecimal('10000.123456'), '10,000.123456')
})

test('列表只保留约定的公开字段，非法响应不会被当作空列表成功', () => {
  const data = parseMarketPage(page([{ ...card, contactGeneric: 'private' } as MarketCard]))
  assert.equal('contactGeneric' in data.items[0], false)
  assert.deepEqual(parseMarketPage(page([])).items, [])
  for (const bad of [{}, { items: [] }, page([{ ...card, priceMin: 12 as unknown as string }]), page([{ ...card, id: 0 }])])
    assert.throws(() => parseMarketPage(bad), (error) => error instanceof ApiError && error.code === 'INVALID_RESPONSE')
})

test('检查 HTTP 状态及 success，兼容两种字段错误，网络失败不回退演示数据', async () => {
  for (const name of ['fieldErrors', 'field_errors']) {
    const http = createHttpClient('https://example.test', async () => ({ statusCode: 400,
      data: { success: false, code: 'VALIDATION_ERROR', message: '参数错误', [name]: [{ field: 'sort', message: '非法排序' }] } }))
    await assert.rejects(http.get('/api/test'), (error) => error instanceof ApiError && error.status === 400 &&
      error.code === 'VALIDATION_ERROR' && error.fieldErrors[0].field === 'sort')
  }
  for (const statusCode of [200, 401, 403, 404, 409, 500]) {
    const http = createHttpClient('https://example.test', async () => ({ statusCode, data: { success: false } }))
    await assert.rejects(http.get('/api/test'), ApiError)
  }
  await assert.rejects(createHttpClient('https://example.test', async () => { throw new Error('timeout') }).get('/api/test'),
    (error) => error instanceof ApiError && error.code === 'NETWORK_TIMEOUT')
  await assert.rejects(createHttpClient('', async () => response(page())).get('/api/test'),
    (error) => error instanceof ApiError && error.code === 'API_NOT_CONFIGURED')
})

test('微信请求失败区分域名、证书和超时，错误提示不回显请求或凭证', async () => {
  for (const [errMsg, code] of [
    ['request:fail url not in domain list', 'DOMAIN_NOT_ALLOWED'],
    ['request:fail ssl hand shake error', 'TLS_ERROR'],
    ['request:fail timeout', 'NETWORK_TIMEOUT'],
    ['request:fail offline', 'NETWORK_ERROR'],
  ]) {
    const http = createHttpClient('https://example.test', async () => { throw { errMsg: `${errMsg} secret-value` } })
    await assert.rejects(http.get('/api/test'), (error) => error instanceof ApiError &&
      error.code === code && !error.message.includes('secret-value') && !error.message.includes('example.test'))
  }
})

test('详情始终显式传 type，旧租赁响应只取公开白名单，需求金额保持字符串', async () => {
  const requests: string[] = []
  const http = createHttpClient('https://example.test', async (request) => {
    requests.push(request.url)
    return response({ title: '', trade_mode: 'hourly', price_per_hour: 15.5, images: [],
      category: 'gpu-server', reviewer_id: 103, review_remark: 'private', contactGeneric: 'private', provider_user_id: 202 })
  })
  const detail = await createListingApi(http).getPublicDetail('lease', 1)
  assert.equal(new URL(requests[0]).searchParams.get('type'), 'lease')
  assert.equal(detail.title, '未命名租赁信息')
  assert.equal(detail.quotation?.priceMin, '15.5')
  assert.equal(detail.quotation?.currency, '')
  for (const key of ['reviewer_id', 'review_remark', 'contactGeneric', 'provider_user_id']) assert.equal(key in detail, false)
  const demand = parsePublicListing({ title: '求租', budgetMin: '9999999999999999.99', budgetMax: '9999999999999999.99',
    currency: 'CNY', supplier: { contactGeneric: 'private' } }, 'demand')
  assert.equal(demand.budgetMin, '9999999999999999.99')
  assert.equal('supplier' in demand, false)
  assert.throws(() => parsePublicListing({}, 'sale'), ApiError)
})

test('切换筛选后忽略过时结果及错误，不覆盖新列表或新请求的加载状态', async () => {
  const old = deferred<MarketPage>(), current = deferred<MarketPage>()
  let count = 0
  const feed = createMarketFeed(() => ++count === 1 ? old.promise : current.promise)
  feed.reset({ keyword: 'old' })
  const first = feed.refresh()
  feed.reset({ keyword: 'new' })
  const second = feed.refresh()
  old.reject(new Error('obsolete'))
  await first
  assert.equal(feed.getSnapshot().loading, true)
  assert.equal(feed.getSnapshot().error, '')
  current.resolve(page([{ ...card, title: 'new' }]))
  await second
  assert.equal(feed.getSnapshot().items[0].title, 'new')
})

test('分页使用后端 total，去重按 type+id，失败重试原页且不重复加载', async () => {
  const calls: number[] = []
  let fail = true
  const feed = createMarketFeed(async (query) => {
    calls.push(query.page!)
    if (query.page === 1) return page([card, { ...card, type: 'lease' }], 1, 21)
    if (fail) { fail = false; throw new Error('offline') }
    return page([card, { ...card, id: 43 }], 2, 21)
  })
  feed.reset({})
  await feed.refresh()
  assert.equal(feed.getSnapshot().total, 21)
  assert.equal(feed.getSnapshot().hasMore, true)
  await feed.next()
  assert.equal(feed.getSnapshot().items.length, 2)
  assert.equal(feed.getSnapshot().page, 1)
  await feed.retry()
  assert.equal(feed.getSnapshot().items.length, 3)
  assert.equal(feed.getSnapshot().hasMore, false)
  await feed.next()
  assert.deepEqual(calls, [1, 2, 2])
})

test('真实 TCP HTTP 验证 URL、分页契约和 HTTP 200 业务失败', async () => {
  const urls: string[] = []
  const server = createServer((request, reply) => {
    urls.push(request.url!)
    reply.setHeader('Content-Type', 'application/json')
    reply.end(JSON.stringify(request.url?.includes('keyword=fail') ? { success: false, message: '业务失败' }
      : { success: true, data: page() }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const transport: Transport = async (request) => {
      const result = await fetch(request.url, { headers: request.header, signal: AbortSignal.timeout(request.timeout) })
      return { statusCode: result.status, data: await result.json() }
    }
    const api = createListingApi(createHttpClient(`http://127.0.0.1:${address.port}`, transport))
    assert.equal((await api.getMarket({ type: 'demand', keyword: '%_' })).total, 1)
    assert.equal(new URL(urls[0], 'http://localhost').searchParams.get('keyword'), '%_')
    await assert.rejects(api.getMarket({ keyword: 'fail' }), /业务失败/)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('首屏刷新失败后重试第一页，不错误地继续翻页', async () => {
  const calls: number[] = []
  let fail = false
  const feed = createMarketFeed(async (query) => {
    calls.push(query.page!)
    if (fail) { fail = false; throw new Error('offline') }
    return page([card], query.page, 40)
  })
  feed.reset({})
  await feed.refresh()
  fail = true
  await feed.refresh()
  await feed.retry()
  assert.deepEqual(calls, [1, 1, 1])
})

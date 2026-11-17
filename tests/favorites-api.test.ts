import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, createHttpClient, type HttpRequest } from '../src/services/http-core'
import { createFavoritesApi, favoriteKey, listingFavoriteTarget, parseListingFavoritesPage,
  type ListingFavorite, type ListingFavoritesPage } from '../src/services/favorites-api'
import { createListingFavorites } from '../src/services/listing-favorites'

const target = listingFavoriteTarget('sale', '5')
const item = (id = '5', biz = target.biz): ListingFavorite => ({ ...listingFavoriteTarget(biz, id),
  id: Number(id), createdAt: '2026-11-17T08:00:00Z', available: false, content: null })
const page = (items: ListingFavorite[] = [], total = items.length, current = 1, size = 20): ListingFavoritesPage =>
  ({ items, total, page: current, size })
const deferred = <T>() => {
  let resolve!: (value: T) => void, reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('市场收藏请求带鉴权，分类分页使用 type/page/size，DELETE 携带 JSON 请求体', async () => {
  const calls: HttpRequest[] = []
  const api = createFavoritesApi(createHttpClient('https://example.test', async (request) => {
    calls.push(request)
    return { statusCode: 200, data: request.method === 'GET'
      ? { success: true, data: { news: [], 'gpu-market': [], listings: [item()], total: 1, page: 1, size: 20 } }
      : { success: true } }
  }, { getToken: () => 'test-token' }))
  const result = await api.list()
  assert.equal(result.items[0].available, false)
  assert.deepEqual(Object.fromEntries(new URL(calls[0].url).searchParams), { type: 'listings', page: '1', size: '20' })
  for (const biz of ['sale', 'lease', 'demand'] as const) {
    await api.add(listingFavoriteTarget(biz, '5'))
    await api.remove(listingFavoriteTarget(biz, '5'))
  }
  for (const [index, request] of calls.entries()) {
    assert.equal(new URL(request.url).pathname, '/api/market-mp/favorites')
    assert.equal(request.header.Authorization, 'Bearer test-token')
    if (index) {
      assert.equal(request.method, index % 2 ? 'POST' : 'DELETE')
      assert.equal(request.header['Content-Type'], 'application/json')
      assert.equal(new URL(request.url).search, '')
      assert.deepEqual(request.data, { targetType: 'listings', targetId: '5', biz: ['sale', 'lease', 'demand'][Math.floor((index - 1) / 2)] })
    }
  }
  assert.notEqual(favoriteKey(target), favoriteKey(listingFavoriteTarget('lease', '5')))
})

test('收藏拒绝非法 ID/分页，无登录不发送请求，HTTP 200 业务失败也抛错', async () => {
  for (const id of ['0', '01', '-1', '1,2', ' 1', '1e3', '1'.repeat(129)])
    assert.throws(() => listingFavoriteTarget('sale', id))
  assert.equal(listingFavoriteTarget('sale', '99999999999999999999').targetId, '99999999999999999999')
  let calls = 0
  const api = createFavoritesApi(createHttpClient('https://example.test', async () => {
    calls++; return { statusCode: 200, data: { success: false, code: 'UNAVAILABLE', message: '服务不可用' } }
  }))
  await assert.rejects(api.list(), (error) => error instanceof ApiError && error.status === 401)
  await assert.rejects(api.add(target), ApiError)
  assert.equal(calls, 0)
  const loggedIn = createFavoritesApi(createHttpClient('https://example.test', async () => {
    calls++; return { statusCode: 200, data: { success: false, code: 'UNAVAILABLE', message: '服务不可用' } }
  }, { getToken: () => 'test' }))
  await assert.rejects(loggedIn.list(0), ApiError)
  await assert.rejects(loggedIn.list(1, 31), ApiError)
  assert.equal(calls, 0)
  await assert.rejects(loggedIn.remove(target), /服务不可用/)
  assert.equal(calls, 1)
})

test('收藏卡片保持金额字符串和类型身份；失效记录保留，异常响应不当成空收藏', () => {
  const content = { id: 5, type: 'sale', title: 'H100', images: [], category: 'GPU', gpuModel: '', summary: '',
    priceMin: '9999999999999999.99', priceMax: null, budgetMin: null, budgetMax: null,
    currency: 'CNY', priceUnit: '', demandMode: '' }
  const input = { listings: [{ ...item(), available: true, content }, item('6')], total: 2, page: 1, size: 20 }
  const result = parseListingFavoritesPage(input)
  assert.equal(result.items[0].content?.priceMin, '9999999999999999.99')
  assert.equal(result.items[1].content, null)
  assert.throws(() => parseListingFavoritesPage({ ...input, total: '2' }), ApiError)
  assert.throws(() => parseListingFavoritesPage({ ...input, listings: null }), ApiError)
  assert.throws(() => parseListingFavoritesPage({ ...input, listings: [{ ...item(), content }] }), ApiError)
  assert.throws(() => parseListingFavoritesPage({ ...input, listings: [{ ...item(), available: true, content: { ...content, type: 'lease' } }] }), ApiError)
})

test('收藏统一分页包含失效记录，加载更多失败重试原页，按类型和 ID 去重', async () => {
  const requests: number[] = []
  let fail = true
  const controller = createListingFavorites({ add: async () => {}, remove: async () => {},
    list: async (current = 1) => {
      requests.push(current)
      if (current === 2 && fail) throw new Error('offline')
      return current === 1 ? page([item()], 21) : page([item(), item('5', 'lease')], 21, 2)
    } }, () => 'account')
  await controller.refresh(); await controller.next()
  assert.equal(controller.getSnapshot().error, 'offline')
  assert.equal(controller.getSnapshot().page, 1)
  fail = false; await controller.retry()
  assert.deepEqual(requests, [1, 2, 2])
  assert.equal(controller.getSnapshot().items.length, 2)
  assert.equal(controller.getSnapshot().total, 21)
  assert.equal(controller.getSnapshot().hasMore, false)
})

test('商品在收藏第二页仍显示已收藏，切换时正确取消，同号其他类型不混淆', async () => {
  const requests: number[] = [], removed: unknown[] = []
  const controller = createListingFavorites({ add: async () => { throw new Error('must not add') },
    remove: async (value) => { removed.push(value) }, list: async (current = 1, size = 20) => {
      requests.push(current)
      return page(current === 1 ? [item('5', 'lease')] : [item()], 31, current, size)
    } }, () => 'account')
  assert.equal(await controller.lookup(target), true)
  assert.deepEqual(requests, [1, 2])
  assert.equal(await controller.setFavorite(target), false)
  assert.deepEqual(removed, [target])
})

test('收藏写入防快速连点，失败保持原状态且不自动重试，失效记录可直接删除', async () => {
  const operation = deferred<void>()
  let removes = 0
  const controller = createListingFavorites({ add: async () => {}, remove: async () => { removes++; await operation.promise },
    list: async (_current = 1, size = 20) => page([item()], 1, 1, size) }, () => 'account')
  await controller.refresh()
  const first = controller.setFavorite(target, false)
  assert.equal(await controller.setFavorite(target, false), undefined)
  assert.equal(removes, 1)
  operation.reject(new Error('服务不可用'))
  await assert.rejects(first, /服务不可用/)
  assert.equal(controller.getSnapshot().statuses[favoriteKey(target)], true)
  assert.equal(controller.getSnapshot().items.length, 1)
  assert.deepEqual(controller.getSnapshot().pending, [])
  assert.equal(removes, 1)
})

test('刷新、切换账号和写入后的过时请求不会覆盖收藏状态或统计', async () => {
  let scope = 'A'
  const old = deferred<ListingFavoritesPage>()
  let calls = 0
  const controller = createListingFavorites({ add: async () => {}, remove: async () => {}, list: async (_page = 1, size = 20) => {
    calls++; return calls === 1 ? old.promise : page([], 0, 1, size)
  } }, () => scope)
  const loading = controller.refresh()
  scope = 'B'; await controller.refresh()
  old.resolve(page([item()], 1))
  await loading
  assert.equal(controller.getSnapshot().total, 0)
  assert.deepEqual(controller.getSnapshot().items, [])
  assert.deepEqual(controller.getSnapshot().statuses, {})

  const delayed = deferred<ListingFavoritesPage>()
  let reads = 0
  const writing = createListingFavorites({ add: async () => {}, remove: async () => {}, list: async (_page = 1, size = 20) => {
    reads++; return reads === 1 ? delayed.promise : page([], 0, 1, size)
  } }, () => 'B')
  const checking = writing.lookup(target)
  await writing.setFavorite(target, false)
  delayed.resolve(page([item()], 1, 1, 30))
  assert.equal(await checking, false)
  assert.equal(writing.getSnapshot().statuses[favoriteKey(target)], false)
  assert.equal(writing.getSnapshot().total, 0)
})

test('收藏读取失败保留错误可重试，数量失败不伪装为零收藏', async () => {
  const controller = createListingFavorites({ add: async () => {}, remove: async () => {}, list: async () => { throw new Error('请先登录') } }, () => 'anonymous')
  await controller.refresh()
  assert.equal(controller.getSnapshot().error, '请先登录')
  assert.equal(controller.getSnapshot().page, 0)
  await controller.refreshTotal()
  assert.equal(controller.getSnapshot().total, undefined)
  assert.equal(controller.getSnapshot().totalError, '请先登录')
  await assert.rejects(controller.lookup(target), /请先登录/)
  assert.equal(controller.getSnapshot().statuses[favoriteKey(target)], undefined)
})

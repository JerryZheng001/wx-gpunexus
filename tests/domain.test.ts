import assert from 'node:assert/strict'
import test from 'node:test'
import { articles, listings, quotes, shops } from '../src/services/fixtures'
import { marketService } from '../src/services/market'
import {
  chartSamples,
  draftFromListing,
  emptyDraft,
  draftExpiry,
  filterListings,
  homeQuotePool,
  localDate,
  parsePrice,
  restoreDraft,
  validateDraft,
} from '../src/utils/domain'

test('搜索忽略空格和大小写，并可按城市搜索', () => {
  assert.equal(filterListings(listings, { keyword: 'rTx4090' }).length, 2)
  assert.ok(filterListings(listings, { keyword: '深圳' }).every((item) => item.city === '深圳'))
  assert.equal(filterListings(listings, { keyword: '不存在的型号' }).length, 0)
  const renamed = { ...listings[0], name: '特价服务器', model: 'RTX 4090', condition: '99 新' }
  assert.equal(filterListings([renamed], { keyword: 'rtx4090', condition: '99新' }).length, 1)
})
test('类型、核验、成色筛选可以叠加，排序不修改原数组', () => {
  const original = listings.map((item) => item.id)
  const filtered = filterListings(listings, {
    type: 'sell',
    verified: true,
    condition: '全新',
    sort: 'priceAsc',
  })
  assert.equal(filtered.length, 2)
  assert.ok(filtered[0].price < filtered[1].price)
  assert.deepEqual(
    listings.map((item) => item.id),
    original,
  )
  assert.ok(
    filterListings(listings, { sort: 'priceDesc' }).every(
      (item, i, all) => i === 0 || item.price <= all[i - 1].price,
    ),
  )
})
test('发布拒绝空白、无穷价格和非正整数数量', () => {
  const valid = { ...emptyDraft, city: '深圳', name: '4090 涡轮卡', model: 'RTX 4090', price: '12800', quantity: '8', contact: 'demo-contact' }
  assert.equal(validateDraft(valid), undefined)
  for (const price of ['0', '-10', 'NaN', 'Infinity', '12,80', '1e3'])
    assert.ok(validateDraft({ ...valid, price }))
  for (const quantity of ['0', '-1', '1.5', '1e3', '9007199254740992'])
    assert.ok(validateDraft({ ...valid, quantity }))
  assert.ok(validateDraft({ ...valid, city: '  ' }))
  assert.ok(validateDraft({ ...valid, model: '  ' }))
  assert.ok(validateDraft({ ...valid, name: '  ' }))
  assert.ok(validateDraft({ ...valid, contact: '  ' }))
})
test('编辑保留设备信息与原 ID，提交进入演示审核状态', async () => {
  const item = listings[2]
  const draft = draftFromListing(item)
  assert.equal(draft.editId, item.id)
  assert.equal(draft.type, 'rent')
  assert.equal(draft.category, 'GPU服务器')
  const saved = await marketService.submitListing({ ...draft, name: '更新后的商品名称', model: '更新后的型号', contact: 'demo-contact' })
  assert.equal(saved.id, item.id)
  assert.equal(saved.name, '更新后的商品名称')
  assert.equal(saved.model, '更新后的型号')
  assert.equal(saved.status, 'audit')
  assert.equal(saved.verified, false)
  assert.equal(saved.unit, '/月')
})
test('模拟提交生成不同 ID，图片数组不与草稿共享引用', async () => {
  const draft = {
    ...emptyDraft,
    city: '上海',
    name: 'GPU 服务器',
    model: 'GPU',
    contact: 'demo-contact',
    price: '1',
    quantity: '1',
    images: ['demo-image'],
  }
  const [one, two] = await Promise.all([
    marketService.submitListing(draft),
    marketService.submitListing(draft),
  ])
  assert.notEqual(one.id, two.id)
  draft.images.push('another')
  assert.equal(one.images?.length, 1)
})
test('图表数据稳定、收盘与现价一致，K线高低覆盖开收盘价', () => {
  const quote = quotes[0]
  const one = chartSamples(quote.price, quote.volatility, quote.id)
  const two = chartSamples(quote.price, quote.volatility, quote.id)
  assert.deepEqual(one, two)
  assert.equal(one.length, 30)
  assert.equal(one[one.length - 1].close, quote.price)
  for (const candle of one) {
    assert.ok(candle.low <= Math.min(candle.open, candle.close))
    assert.ok(candle.high >= Math.max(candle.open, candle.close))
  }
  assert.notDeepEqual(one, chartSamples(quote.price, quote.volatility, quote.id + 'week'))
})
test('示例数据的 ID 唯一，商家引用和行情分类完整', () => {
  for (const items of [listings, quotes, articles, shops])
    assert.equal(new Set(items.map((item) => item.id)).size, items.length)
  for (const item of listings) {
    if (item.shop) assert.ok(shops.some((shop) => shop.id === item.shop))
  }
  assert.equal(quotes.filter((item) => item.kind === 'card').length, 10)
  assert.equal(quotes.filter((item) => item.kind === 'machine').length, 10)
})
test('商家模拟申请只包含店名、类型、状态，不保存证件或电话', async () => {
  const application = await marketService.submitMerchant(' 测试店铺 ', 'personal')
  assert.deepEqual(application, { name: '测试店铺', type: 'personal', status: 'pending' })
})

const validDraft = { ...emptyDraft, province: '广东省', city: '深圳市', name: 'GPU 服务器', model: 'H100', price: '100', quantity: '2 台', contact: 'demo-contact' }

test('价格区间、原价校验及格式化金额解析', async () => {
  assert.equal(parsePrice('168,000.50'), 168000.5)
  assert.equal(validateDraft({ ...validDraft, maxPrice: '99' }), '最高价须不低于最低价')
  assert.equal(validateDraft({ ...validDraft, maxPrice: 'Infinity' }), '最高价须不低于最低价')
  assert.equal(validateDraft({ ...validDraft, type: 'rent', originalPrice: '99' }), '原价须不低于现价')
  const item = await marketService.submitListing({ ...validDraft, maxPrice: '200' })
  assert.equal(item.maxPrice, 200)
  assert.equal(item.quantity, 2)
  assert.equal(item.quantityText, '2 台')
  assert.deepEqual(draftFromListing(item), { ...validDraft, editId: item.id, maxPrice: '200' })
  await assert.rejects(marketService.submitListing({ ...validDraft, maxPrice: '10' }), /最高价/)
})

test('租赁四种计费单位正确，隐藏的预算及有效期不会混入提交结果', async () => {
  const expected = { 包日: '/天', 包周: '/周', 包月: '/月', 按量计费: '/小时' } as const
  for (const billing of Object.keys(expected) as Array<keyof typeof expected>) {
    const item = await marketService.submitListing({ ...validDraft, type: 'rent', billing,
      price: '168,000', originalPrice: '188,000', maxPrice: 'bad', duration: '自定义', expiryDate: '2000-01-01' })
    assert.equal(item.unit, expected[billing])
    assert.equal(item.originalPrice, 188000)
    assert.equal(item.maxPrice, undefined)
    assert.equal(item.expiresAt, undefined)
    const restored = draftFromListing(item)
    assert.equal(restored.billing, billing)
    assert.equal(restored.originalPrice, '188000')
  }
})

test('长期有效不会变成七天，自定义截止日期拒绝过去和非法日期', () => {
  const now = new Date(2026, 10, 4, 10)
  assert.equal(draftExpiry(validDraft, now), undefined)
  const preset = draftExpiry({ ...validDraft, duration: '15 天' }, now)
  assert.equal(Date.parse(preset!) - now.getTime(), 15 * 86400000)
  for (const expiryDate of ['', '2026-11-03', '2026-02-30', 'bad'])
    assert.ok(validateDraft({ ...validDraft, duration: '自定义', expiryDate }, now))
  const custom = { ...validDraft, duration: '自定义', expiryDate: '2026-11-04' }
  assert.equal(validateDraft(custom, now), undefined)
  assert.equal(localDate(new Date(draftExpiry(custom, now)!)), '2026-11-04')
  assert.equal(new Date(draftExpiry(custom, now)!).getHours(), 23)
})

test('成色自定义要求说明，需求忽略隐藏成色与租赁原价', async () => {
  assert.equal(validateDraft({ ...validDraft, condition: '自定义' }), '请填写自定义成色')
  const sell = await marketService.submitListing({ ...validDraft, condition: '自定义', customCondition: '8 成新，有轻微划痕' })
  assert.equal(draftFromListing(sell).customCondition, '8 成新，有轻微划痕')
  const demand = await marketService.submitListing({ ...validDraft, type: 'demand', condition: '自定义', originalPrice: 'bad' })
  assert.equal(demand.condition, '不限成色')
  assert.equal(demand.originalPrice, undefined)
  assert.equal(demand.billing, undefined)
})

test('旧版草稿补齐新字段并保留型号、价格、图片及城市', () => {
  const legacy = { city: '深圳', model: 'RTX 4090', price: '12800', category: '单卡' as const, condition: '99新', images: ['saved-image'] }
  const restored = restoreDraft(legacy)
  assert.equal(restored.province, '广东省')
  assert.equal(restored.city, '深圳市')
  assert.equal(restored.name, 'RTX 4090')
  assert.equal(restored.model, legacy.model)
  assert.equal(restored.price, legacy.price)
  assert.equal(restored.condition, '99 新')
  assert.equal(restored.category, 'GPU服务器')
  assert.equal(restored.billing, '包月')
  assert.deepEqual(restored.images, legacy.images)
  assert.notEqual(restored.images, legacy.images)
})

test('首页默认涨幅前三，关注模式依关注顺序展示且不改动原行情', () => {
  const original = quotes.map((item) => item.id)
  const hot = homeQuotePool(quotes, [], false)
  assert.equal(hot.length, 3)
  assert.ok(hot.every((item, i) => i === 0 || item.percent <= hot[i - 1].percent))
  assert.ok(quotes.every((item) => hot.includes(item) || item.percent <= hot[2].percent))
  assert.deepEqual(homeQuotePool(quotes, [quotes[2].id, quotes[0].id], true).map((item) => item.id), [quotes[2].id, quotes[0].id])
  assert.deepEqual(homeQuotePool(quotes, [], true), [])
  assert.deepEqual(quotes.map((item) => item.id), original)
})

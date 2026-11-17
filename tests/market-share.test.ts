import assert from 'node:assert/strict'
import test from 'node:test'
import { browserShareUrl, listingShare, marketShare, readMarketShareFilters, timelineShare } from '../src/utils/market-share'
import { parseMarketKey, type MarketCard } from '../src/services/listing-api'

const card: MarketCard = { id: 5, type: 'sale', title: 'RTX 4090 & H100', images: ['https://example.test/gpu.png'],
  category: 'GPU服务器', gpuModel: 'RTX 4090', summary: '', priceMin: '12000', priceMax: '13000', budgetMin: null,
  budgetMax: null, currency: 'CNY', priceUnit: '', demandMode: '' }

test('同号三类商品分享打开对应详情，标题含类型与报价，封面取商品图片', () => {
  for (const type of ['sale', 'lease', 'demand'] as const) {
    const quote = { ...card, type, ...(type === 'lease' ? { priceUnit: 'month' } : {}),
      ...(type === 'demand' ? { priceMin: null, priceMax: null, budgetMin: '100', budgetMax: '1000' } : {}) }
    const share = listingShare(type, quote.id, quote, quote)
    const params = new URLSearchParams(share.path.split('?')[1])
    assert.deepEqual(parseMarketKey(params.get('id')!), { type, id: 5 })
    assert.equal(params.get('type'), type)
    assert.equal(share.imageUrl, card.images[0])
    assert.ok(share.title.includes('RTX 4090 & H100'))
    assert.ok(share.title.includes(type === 'demand' ? '¥100–1,000' : '¥12,000–13,000'))
    if (type === 'lease') assert.ok(share.title.endsWith('/月'))
    assert.deepEqual(timelineShare(share), { title: share.title, imageUrl: share.imageUrl, query: share.path.split('?')[1] })
  }
})

test('分享冷启动不依赖列表缓存，无图或缺少报价仍能定位商品', () => {
  const share = listingShare('sale', 5)
  assert.equal(share.imageUrl, undefined)
  assert.equal(share.title, '[售卖] 算力市供需信息')
  assert.deepEqual(parseMarketKey(new URLSearchParams(timelineShare(share).query).get('id')!), { type: 'sale', id: 5 })
  assert.equal(listingShare('sale', 5, { title: 'H100', images: ['wxfile://private', 'https://example.test/public.png'] }).imageUrl,
    'https://example.test/public.png')
  assert.equal(listingShare('sale', 5, { title: 'H100', images: [] }).imageUrl, undefined)
  assert.ok(!listingShare('sale', 5, card, { ...card, priceMin: null, priceMax: null }).title.includes('价格未提供'))
})

test('市场分享保留关键词及筛选，中文及保留字符只解码一次，不附分页、凭证和私有字段', () => {
  const filters = { keyword: ' H100 中文 & 50%2F? # / ', type: 'lease' as const, condition: 'new' as const,
    sort: 'price' as const, order: 'asc' as const, page: 3, pageSize: 20, contact: 'private', token: 'secret' }
  const share = marketShare(filters)
  const expected = { keyword: filters.keyword.trim(), type: 'lease', condition: 'new', sort: 'price', order: 'asc' }
  const raw = share.path.split('market=')[1]
  assert.deepEqual(readMarketShareFilters(raw), expected)
  assert.deepEqual(readMarketShareFilters(new URLSearchParams(share.path.split('?')[1]).get('market')), expected)
  assert.deepEqual(readMarketShareFilters(new URLSearchParams(timelineShare(share).query).get('market')), expected)
  assert.ok(!share.path.includes('secret'))
  assert.ok(!share.path.includes('contact'))
  assert.equal(share.imageUrl, undefined)
})

test('非法市场分享筛选安全回退，H5 分享链接保留站点并正确打开详情或筛选列表', () => {
  for (const value of [undefined, '%invalid', '[]', 'null', '1']) assert.deepEqual(readMarketShareFilters(value), {})
  assert.deepEqual(readMarketShareFilters(JSON.stringify({ type: 'wrong', condition: '__proto__', sort: 'bad', order: 'bad' })), {})
  const share = listingShare('sale', 5, card, card)
  assert.equal(browserShareUrl(share, 'https://example.test/app/?temporary=remove#/pages/mall/index'),
    `https://example.test/app/#${share.path}`)
  assert.equal(marketShare().path, '/pages/mall/index')
  assert.equal(timelineShare(marketShare()).query, '')
})

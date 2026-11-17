import assert from 'node:assert/strict'
import test from 'node:test'
import { isMarketLocation, marketCities, marketRegions } from '../src/constants/market-regions'
import { emptyProviderForm, providerFormPayload, restoreProviderForm } from '../src/services/provider-form'
import { object } from '../src/services/http-core'
import type { ProviderListing } from '../src/services/provider-api'

const demand = { ...emptyProviderForm, type: 'demand' as const, title: '求购 A100', category: 'GPU单卡', model: 'A100',
  quantity: '2', price: '100.00', delivery: '一周内', contact: 'test-contact' }

test('内置省市字典编码完整、唯一，直辖市使用相同的六位省市编码', () => {
  assert.equal(marketRegions.length, 33)
  assert.equal(new Set(marketRegions.map((province) => province.code)).size, marketRegions.length)
  for (const province of marketRegions) {
    assert.match(province.code, /^\d{6}$/)
    assert.ok(province.name && province.cities.length)
    assert.equal(new Set(province.cities.map((city) => city.code)).size, province.cities.length)
    for (const city of province.cities) {
      assert.match(city.code, /^\d{6}$/)
      assert.equal(city.code.slice(0, 2), province.code.slice(0, 2))
      assert.ok(city.name)
    }
  }
  for (const code of ['110000', '120000', '310000', '500000']) {
    assert.equal(marketCities(code).length, 1)
    assert.equal(marketCities(code)[0].code, code)
    assert.equal(isMarketLocation({ provinceCode: code, cityCode: code }), true)
  }
  assert.equal(isMarketLocation({ provinceCode: '440000', cityCode: '440300' }), true)
  assert.equal(isMarketLocation({ provinceCode: '130000', cityCode: '130100' }), true)
  assert.equal(isMarketLocation({ provinceCode: '440000', cityCode: '130100' }), false)
  assert.equal(isMarketLocation({ provinceCode: '710000', cityCode: '710000' }), false)
})

test('需求提交必须选择完整省市，仅发送合法编码而不发送只读地区名称', () => {
  assert.throws(() => providerFormPayload(demand), /请选择交易地区/)
  assert.throws(() => providerFormPayload({ ...demand, location: { provinceCode: '440000', cityCode: '' } }), /请选择交易城市/)
  assert.throws(() => providerFormPayload({ ...demand, location: { provinceCode: '440000', cityCode: '130100' } }), /有效的省份和城市/)
  const location = { provinceCode: '440000', cityCode: '440300', provinceName: '广东省', cityName: '深圳市' }
  const body = providerFormPayload({ ...demand, location })
  assert.deepEqual(object(body.supplier).location, { provinceCode: '440000', cityCode: '440300' })
  assert.equal(body.budgetMin, '100.00')
  assert.equal(object(body.product).quantity, 2)
})

test('地区随本机草稿恢复，保留待选城市状态且不会丢失图片或其他填写项', () => {
  const images = ['https://example.test/image.png']
  for (const cityCode of ['', '440300']) {
    const original = { ...demand, location: { provinceCode: '440000', cityCode }, images }
    const restored = restoreProviderForm(JSON.parse(JSON.stringify(original)))
    assert.deepEqual(restored.location, original.location)
    assert.equal(restored.title, original.title)
    assert.deepEqual(restored.images, images)
  }
  assert.equal(restoreProviderForm({}).location, undefined)
  assert.equal(restoreProviderForm({ location: { provinceCode: 440000, cityCode: 440300 } }).location, undefined)
})

test('编辑可保留服务端已有的较新地区编码，用户更改时仍校验省市关系', () => {
  const location = { provinceCode: '440000', cityCode: '449999' }
  const existing: ProviderListing = { id: 42, type: 'demand', providerUserId: 183, reviewStatus: 'draft',
    reviewRemark: '', expiresAt: null, offShelfRequestStatus: '', payload: { supplier: { location } } }
  assert.deepEqual(object(providerFormPayload({ ...demand, location }, existing).supplier).location, location)
  assert.throws(() => providerFormPayload({ ...demand, location: { ...location, cityCode: '130100' } }, existing), /省份和城市/)
})

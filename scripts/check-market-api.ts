import { createHttpClient, ApiError, object } from '../src/services/http-core'
import { createListingApi } from '../src/services/listing-api'
import { createProviderApi } from '../src/services/provider-api'
import { readLocalTestToken } from '../config/local-auth'

// Read-only checks: never creates drafts, uploads images, or changes real data.
const base = (process.env.TARO_APP_API_BASE_URL ?? 'https://test.chengfangtech.com').replace(/\/+$/, '')
const token = readLocalTestToken()
const http = createHttpClient(base, async (request) => {
  const response = await fetch(request.url, { headers: request.header, signal: AbortSignal.timeout(request.timeout) })
  return { statusCode: response.status, data: await response.json() }
}, { getToken: () => token })
const api = createListingApi(http)
const provider = createProviderApi(http)
async function check() {
  console.log(`API: ${base}`)
  let failed = false
  try {
    const result = await api.getMarket({ page: 1, pageSize: 3 })
    console.log(`PASS market/listings: total=${result.total}, items=${result.items.length}`)
    if (result.items.length) {
      const first = result.items[0]
      try {
        await api.getPublicDetail(first.type, first.id)
        console.log(`PASS public detail: type=${first.type}, id=${first.id}`)
      } catch (error) {
        failed = true
        console.log(`FAIL public detail: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
    } else console.log('SKIP public detail: no public listings')
  } catch (error) {
    failed = true
    console.log(`FAIL market/listings: ${error instanceof ApiError ? `HTTP ${error.status} ${error.code} ` : ''}${error instanceof Error ? error.message : 'unknown error'}`)
  }
  try {
    const response = await fetch(`${base}/api/banking/market/listings?sort=invalid`, { signal: AbortSignal.timeout(15000) })
    const body = object(await response.json())
    if (response.status !== 400 || body.success !== false || body.code !== 'VALIDATION_ERROR') {
      failed = true
      console.log(`FAIL list validation: HTTP ${response.status}, expected 400 VALIDATION_ERROR`)
    } else console.log('PASS list validation: 400 VALIDATION_ERROR')
  } catch (error) {
    failed = true
    console.log(`FAIL list validation: ${error instanceof Error ? error.message : 'network error'}`)
  }
  if (token) {
    for (const type of ['sale', 'lease', 'demand'] as const) {
      try {
        const result = await provider.list(type, 1, 1)
        console.log(`PASS provider/${type}: total=${result.total}, pageSize=${result.pageSize}`)
        if (result.list.length) {
          const item = await provider.detail(type, result.list[0].id)
          console.log(`PASS owner detail: type=${item.type}, id=${item.id}, status=${item.reviewStatus}`)
          if (item.reviewStatus === 'published' || item.reviewStatus === 'on_sale') {
            await api.getPublicDetail(type, item.id)
            console.log(`PASS public detail: type=${type}, id=${item.id}`)
          }
        }
      } catch (error) {
        failed = true
        console.log(`FAIL provider/${type}: ${error instanceof ApiError ? `HTTP ${error.status} ` : ''}${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }
  } else console.log('SKIP provider checks: no local test/login token')
  process.exitCode = failed ? 1 : 0
}
void check()

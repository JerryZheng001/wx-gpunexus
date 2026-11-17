import type { MarketPage, MarketQuery, MarketCard } from './listing-api'
import { marketKey } from './listing-api'

export interface FeedState {
  items: MarketCard[]
  total: number
  page: number
  loading: boolean
  error: string
  hasMore: boolean
}
// A filter change invalidates all earlier requests, including pending pagination.
export function createMarketFeed(fetchPage: (query: MarketQuery) => Promise<MarketPage>) {
  let state: FeedState = { items: [], total: 0, page: 0, loading: false, error: '', hasMore: false }
  let query: MarketQuery = {}
  let generation = 0
  let lastAppend = false
  const listeners = new Set<() => void>()
  const update = (patch: Partial<FeedState>) => {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }
  const load = async (append: boolean) => {
    if (state.loading) return
    const current = generation
    const page = append ? state.page + 1 : 1
    lastAppend = append
    update({ loading: true, error: '' })
    try {
      const data = await fetchPage({ ...query, page, pageSize: 20 })
      if (current !== generation) return
      if (data.page !== page || data.pageSize !== 20) throw new Error('服务返回的分页信息异常，请重试')
      const unique = new Map((append ? [...state.items, ...data.items] : data.items)
        .map((card) => [marketKey(card.type, card.id), card]))
      update({ items: [...unique.values()], total: data.total, page, hasMore: page * data.pageSize < data.total })
    } catch (error) {
      if (current === generation) update({ error: error instanceof Error ? error.message : '加载失败，请重试' })
    } finally {
      if (current === generation) update({ loading: false })
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    reset(next: MarketQuery) {
      generation++
      query = next
      update({ items: [], total: 0, page: 0, loading: false, error: '', hasMore: false })
    },
    refresh: () => load(false),
    next: () => state.hasMore ? load(true) : Promise.resolve(),
    retry: () => load(lastAppend),
    cancel: () => { generation++ },
  }
}

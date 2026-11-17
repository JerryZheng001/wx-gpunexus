import { favoriteKey, type ListingFavorite, type ListingFavoriteTarget, type createFavoritesApi } from './favorites-api'
import { apiTypeLabels } from './listing-api'

interface FavoritesState {
  keyword: string
  items: ListingFavorite[]
  statuses: Record<string, boolean>
  pending: string[]
  total: number | undefined
  page: number
  hasMore: boolean
  loading: boolean
  error: string
  totalError: string
}
const empty = (): FavoritesState => ({ keyword: '', items: [], statuses: {}, pending: [], total: undefined,
  page: 0, hasMore: false, loading: false, error: '', totalError: '' })

// Account data lives only in memory. Late responses from a previous account or
// before a successful mutation cannot overwrite the current account's state.
export function createListingFavorites(api: ReturnType<typeof createFavoritesApi>, getScope: () => string) {
  let state = empty(), scope = '', epoch = 0, generation = 0, revision = 0
  let appendFailed = false
  const listeners = new Set<() => void>()
  const update = (patch: Partial<FavoritesState>) => {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }
  const syncScope = () => {
    const next = getScope()
    if (scope === next) return
    scope = next; epoch++; generation++; revision++
    state = empty()
    listeners.forEach((listener) => listener())
  }
  const current = (value: number) => { syncScope(); return value === epoch }
  const load = async (append: boolean) => {
    syncScope()
    if (append && (state.loading || !state.hasMore)) return
    const request = ++generation, account = epoch, version = revision, page = append ? state.page + 1 : 1
    const keyword = state.keyword.toLowerCase(), size = keyword ? 30 : 20
    appendFailed = append
    update({ loading: true, error: '', ...(!append ? { items: [], page: 0, hasMore: false } : {}) })
    try {
      let result = await api.list(page, size)
      if (!current(account) || request !== generation || version !== revision) return
      const fetched = [...result.items]
      // Favorites accepts only type/page/size. Search all documented pages,
      // never send an unsupported keyword or search the public market instead.
      while (keyword && result.page * result.size < result.total) {
        result = await api.list(result.page + 1, size)
        if (!current(account) || request !== generation || version !== revision) return
        fetched.push(...result.items)
      }
      const matches = keyword ? fetched.filter((item) => {
        const card = item.content
        return [card?.title, card?.gpuModel, card?.category, card?.summary, apiTypeLabels[item.biz],
          item.biz, item.targetId, `${item.biz}-${item.targetId}`, item.available ? '' : '信息已失效']
          .some((value) => value?.toLowerCase().includes(keyword))
      }) : fetched
      const items = [...new Map((append ? [...state.items, ...matches] : matches)
        .map((item) => [favoriteKey(item), item])).values()]
      const statuses = { ...state.statuses }
      fetched.forEach((item) => { statuses[favoriteKey(item)] = true })
      update({ items, statuses, total: result.total, totalError: '', page: result.page,
        hasMore: !keyword && result.page * result.size < result.total })
    } catch (error) {
      if (current(account) && request === generation) update({ error: error instanceof Error ? error.message : '收藏加载失败' })
    } finally {
      if (current(account) && request === generation) update({ loading: false })
    }
  }
  const lookup = async (target: ListingFavoriteTarget): Promise<boolean> => {
    syncScope()
    const account = epoch, version = revision, key = favoriteKey(target)
    // The protocol has no status endpoint. Search every page before declaring
    // an item uncollected; only reading page 1 gives incorrect toggle behavior.
    for (let page = 1; ; page++) {
      const result = await api.list(page, 30)
      if (!current(account)) throw new Error('登录状态已变更，请重试')
      if (version !== revision) return state.statuses[key] ?? lookup(target)
      const found = result.items.some((item) => favoriteKey(item) === key)
      if (found || page * result.size >= result.total) {
        update({ statuses: { ...state.statuses, [key]: found }, total: result.total, totalError: '' })
        return found
      }
    }
  }
  const setFavorite = async (target: ListingFavoriteTarget, desired?: boolean) => {
    syncScope()
    const key = favoriteKey(target), account = epoch
    if (state.pending.includes(key)) return undefined
    update({ pending: [...state.pending, key] })
    try {
      const next = desired ?? !(await lookup(target))
      if (!current(account)) throw new Error('登录状态已变更，请重试')
      if (next) await api.add(target)
      else await api.remove(target)
      if (!current(account)) return undefined
      revision++
      update({ statuses: { ...state.statuses, [key]: next } })
      void load(false)
      return next
    } finally {
      if (current(account)) update({ pending: state.pending.filter((value) => value !== key) })
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    syncScope, lookup, setFavorite,
    setSearch(keyword: string) {
      syncScope()
      const trimmed = keyword.trim()
      if (trimmed === state.keyword) return
      generation++
      update({ keyword: trimmed, items: [], page: 0, hasMore: false, loading: false, error: '' })
    },
    refresh: () => load(false), next: () => load(true), retry: () => load(appendFailed),
    async refreshTotal() {
      syncScope()
      const account = epoch, version = revision
      try {
        const result = await api.list(1, 1)
        if (current(account) && version === revision) update({ total: result.total, totalError: '' })
      } catch (error) {
        if (current(account) && version === revision) update({ total: undefined,
          totalError: error instanceof Error ? error.message : '收藏数量加载失败' })
      }
    },
  }
}

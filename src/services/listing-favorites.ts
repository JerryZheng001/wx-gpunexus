import { favoriteKey, type ListingFavorite, type ListingFavoriteTarget, type createFavoritesApi } from './favorites-api'

interface FavoritesState {
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
const empty = (): FavoritesState => ({ items: [], statuses: {}, pending: [], total: undefined,
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
    appendFailed = append
    update({ loading: true, error: '', ...(!append ? { items: [], page: 0, hasMore: false } : {}) })
    try {
      const result = await api.list(page, 20)
      if (!current(account) || request !== generation || version !== revision) return
      const items = [...new Map((append ? [...state.items, ...result.items] : result.items)
        .map((item) => [favoriteKey(item), item])).values()]
      const statuses = { ...state.statuses }
      result.items.forEach((item) => { statuses[favoriteKey(item)] = true })
      update({ items, statuses, total: result.total, totalError: '', page,
        hasMore: page * result.size < result.total })
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

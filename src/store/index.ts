import Taro from '@tarojs/taro'
import { create } from 'zustand'
import { listings } from '../services/fixtures'
import { marketService } from '../services/market'
import type {
  Article,
  Feedback,
  Listing,
  MerchantApplication,
  PublishDraft,
  Quote,
  RecordEntry,
  Shop,
} from '../types'
import { emptyDraft, restoreDraft } from '../utils/domain'

interface Persisted {
  favorites: RecordEntry[]
  history: RecordEntry[]
  followedQuotes: string[]
  followedShops: string[]
  mine: Listing[]
  draft: PublishDraft
  merchant: MerchantApplication | null
  feedbacks: Feedback[]
}
interface Store extends Persisted {
  activeTab: number
  searchKeyword: string
  catalog: Listing[]
  quotes: Quote[]
  articles: Article[]
  shops: Shop[]
  loaded: boolean
  loadError: string
  load: () => Promise<void>
  setTab: (index: number) => void
  setSearch: (value: string) => void
  toggleFavorite: (kind: RecordEntry['kind'], id: string) => void
  visit: (id: string) => void
  removeHistory: (id: string) => void
  toggleQuote: (id: string) => void
  toggleShop: (id: string) => void
  setDraft: (patch: Partial<PublishDraft>) => void
  resetDraft: () => void
  saveListing: (item: Listing) => void
  setListingStatus: (id: string, status: Listing['status']) => void
  renewListing: (id: string) => void
  deleteListing: (id: string) => void
  setMerchant: (value: MerchantApplication) => void
  saveFeedback: (value: Feedback) => void
}
const STORAGE_KEY = 'suanlishi:demo:v1'
const initial: Persisted = {
  favorites: [
    { kind: 'goods', id: '1001', date: '2026-10-22' },
    { kind: 'article', id: '1', date: '2026-10-22' },
  ],
  history: [],
  followedQuotes: ['NVH10080S'],
  followedShops: [],
  mine: [
    { ...listings[0], id: 'demo-pub-1', shop: 'mine', status: 'show' },
    { ...listings[2], id: 'demo-pub-2', shop: 'mine', status: 'show' },
    { ...listings[4], id: 'demo-pub-3', shop: 'mine', status: 'audit' },
    { ...listings[3], id: 'demo-pub-4', shop: 'mine', status: 'off' },
  ],
  draft: { ...emptyDraft, images: [] },
  merchant: null,
  feedbacks: [],
}
function read(): Persisted {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    if (!raw) return initial
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.favorites) || !Array.isArray(parsed.mine)) return initial
    return { ...initial, ...parsed, draft: restoreDraft(parsed.draft || {}) }
  } catch {
    return initial
  }
}
const toggle = (items: string[], id: string) =>
  items.includes(id) ? items.filter((item) => item !== id) : [...items, id]
function recordSnapshot(state: Store, kind: RecordEntry['kind'], id: string): RecordEntry['snapshot'] {
  if (kind === 'article') {
    const article = state.articles.find((item) => item.id === id)
    return article ? { title: article.title, emoji: article.icon } : undefined
  }
  const item = [...state.catalog, ...state.mine].find((listing) => listing.id === id)
  return item ? { title: item.name, emoji: item.emoji, price: item.price, unit: item.unit } : undefined
}
let loading: Promise<void> | undefined
export const useStore = create<Store>((set, get) => ({
  ...read(),
  activeTab: 0,
  searchKeyword: '',
  catalog: [],
  quotes: [],
  articles: [],
  shops: [],
  loaded: false,
  loadError: '',
  load: () => {
    if (get().loaded) return Promise.resolve()
    if (loading) return loading
    set({ loadError: '' })
    loading = Promise.all([
      marketService.getListings(),
      marketService.getQuotes(),
      marketService.getArticles(),
      marketService.getShops(),
    ])
      .then(([catalog, quoteList, articles, shops]) => {
        set({ catalog, quotes: quoteList, articles, shops, loaded: true })
      })
      .catch(() => {
        set({ loadError: '加载失败，请重试' })
      })
      .finally(() => {
        loading = undefined
      })
    return loading
  },
  setTab: (activeTab) => set({ activeTab }),
  setSearch: (searchKeyword) => set({ searchKeyword }),
  toggleFavorite: (kind, id) =>
    set((state) => ({
      favorites: state.favorites.some((item) => item.kind === kind && item.id === id)
        ? state.favorites.filter((item) => !(item.kind === kind && item.id === id))
        : [{ kind, id, date: new Date().toLocaleDateString('sv-SE'), snapshot: recordSnapshot(state, kind, id) }, ...state.favorites],
    })),
  visit: (id) =>
    set((state) => ({
      history: [
        { id, kind: 'goods' as const, date: new Date().toLocaleDateString('sv-SE'), snapshot: recordSnapshot(state, 'goods', id) },
        ...state.history.filter((item) => item.id !== id),
      ].slice(0, 100),
    })),
  removeHistory: (id) =>
    set((state) => ({ history: state.history.filter((item) => item.id !== id) })),
  toggleQuote: (id) => set((state) => ({ followedQuotes: toggle(state.followedQuotes, id) })),
  toggleShop: (id) => set((state) => ({ followedShops: toggle(state.followedShops, id) })),
  setDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  resetDraft: () => set({ draft: { ...emptyDraft, images: [] } }),
  saveListing: (item) =>
    set((state) => ({
      mine: [
        { ...item, shop: 'mine' },
        ...state.mine.filter((existing) => existing.id !== item.id),
      ],
      draft: { ...emptyDraft, images: [] },
    })),
  setListingStatus: (id, status) =>
    set((state) => ({
      mine: state.mine.map((item) => (item.id === id ? { ...item, status } : item)),
    })),
  renewListing: (id) =>
    set((state) => ({
      mine: state.mine.map((item) =>
        item.id === id
          ? { ...item, duration: '30 天', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() }
          : item,
      ),
    })),
  deleteListing: (id) => set((state) => ({ mine: state.mine.filter((item) => item.id !== id) })),
  setMerchant: (merchant) => set({ merchant }),
  saveFeedback: (feedback) =>
    set((state) => ({ feedbacks: [feedback, ...state.feedbacks].slice(0, 50) })),
}))
let previous = ''
useStore.subscribe((state) => {
  const value: Persisted = {
    favorites: state.favorites,
    history: state.history,
    followedQuotes: state.followedQuotes,
    followedShops: state.followedShops,
    mine: state.mine,
    draft: state.draft,
    merchant: state.merchant,
    feedbacks: state.feedbacks,
  }
  const encoded = JSON.stringify(value)
  if (encoded === previous) return
  try {
    Taro.setStorageSync(STORAGE_KEY, encoded)
    previous = encoded
  } catch {
    void Taro.showToast({ title: '本地存储空间不足，本次修改未保存', icon: 'none' })
  }
})

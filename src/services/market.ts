import type {
  Article,
  Feedback,
  Listing,
  MerchantApplication,
  PublishDraft,
  Quote,
  Shop,
} from '../types'
import { articles, listings, quotes, shops } from './fixtures'
import { billingUnits } from '../constants/publish'
import { draftExpiry, isServer, parsePrice, parseQuantity, validateDraft } from '../utils/domain'

export interface MarketService {
  getListings(): Promise<Listing[]>
  getQuotes(): Promise<Quote[]>
  getArticles(): Promise<Article[]>
  getShops(): Promise<Shop[]>
  submitListing(draft: PublishDraft): Promise<Listing>
  submitFeedback(feedback: Omit<Feedback, 'id' | 'createdAt'>): Promise<Feedback>
  submitMerchant(name: string, type: MerchantApplication['type']): Promise<MerchantApplication>
}
let sequence = 0
const id = () => `local-${Date.now()}-${++sequence}`
// Replace this adapter with Taro.request when the server contracts are ready.
export const marketService: MarketService = {
  getListings: async () => listings.map((item) => ({ ...item })),
  getQuotes: async () => quotes.map((item) => ({ ...item })),
  getArticles: async () => articles.map((item) => ({ ...item, paragraphs: [...item.paragraphs] })),
  getShops: async () => shops.map((item) => ({ ...item })),
  submitListing: async (draft) => {
    const error = validateDraft(draft)
    if (error) throw new Error(error)
    const condition = draft.type === 'demand' ? '不限成色'
      : draft.condition === '自定义' ? draft.customCondition.trim() : draft.condition
    return {
      id: draft.editId || id(),
      type: draft.type,
      category: draft.category,
      name: draft.name.trim(),
      model: draft.model.trim(),
      emoji: draft.type === 'demand' ? '📢' : isServer(draft.category) ? '🖥️' : '📦',
      price: parsePrice(draft.price),
      maxPrice: draft.type !== 'rent' && draft.maxPrice.trim() ? parsePrice(draft.maxPrice) : undefined,
      originalPrice: draft.type === 'rent' && draft.originalPrice.trim() ? parsePrice(draft.originalPrice) : undefined,
      billing: draft.type === 'rent' ? draft.billing : undefined,
      quantity: parseQuantity(draft.quantity),
      quantityText: draft.quantity.trim(),
      unit: draft.type === 'rent' ? `/${billingUnits[draft.billing]}` : '',
      city: draft.city.trim(),
      province: draft.province,
      condition,
      extra: `${condition} · ${draft.city.trim()}`,
      delivery: draft.delivery,
      duration: draft.type === 'rent' ? undefined : draft.duration,
      contact: draft.contact.trim(),
      verified: false,
      views: '0',
      createdAt: new Date().toISOString(),
      expiresAt: draftExpiry(draft),
      description: draft.description.trim(),
      images: [...draft.images],
      status: 'audit',
    }
  },
  submitFeedback: async (value) => ({ ...value, id: id(), createdAt: new Date().toISOString() }),
  submitMerchant: async (name, type) => ({ name: name.trim(), type, status: 'pending' }),
}

export type ListingType = 'sell' | 'rent' | 'demand'
export type ListingStatus = 'show' | 'audit' | 'off'
export type ProductCategory = 'GPU服务器' | '通用服务器' | '其他'
export type BillingCycle = '包日' | '包周' | '包月' | '按量计费'
export interface Listing {
  id: string
  type: ListingType
  category: '单卡' | '整机' | ProductCategory
  name: string
  emoji: string
  price: number
  unit: string
  extra: string
  verified: boolean
  views: string
  shop?: string
  city: string
  condition: string
  description: string
  quantity: number
  createdAt: string
  images?: string[]
  status?: ListingStatus
  expiresAt?: string
  province?: string
  model?: string
  maxPrice?: number
  originalPrice?: number
  billing?: BillingCycle
  delivery?: string
  duration?: string
  quantityText?: string
  // Only the owner's local mock records contain this field; never render it publicly.
  contact?: string
}
export interface Quote {
  id: string
  name: string
  code: string
  kind: 'card' | 'machine'
  price: number
  change: number
  percent: number
  high: number
  low: number
  heat: string
  volatility: number
  isIndex?: boolean
}
export interface Article {
  id: string
  icon: string
  category: string
  title: string
  time: string
  source: string
  views: string
  paragraphs: string[]
}
export interface Shop {
  id: string
  name: string
  type: 'enterprise' | 'personal'
  emoji: string
  fans: number
  days: number
  score: number | null
  description: string
}
export interface PublishDraft {
  editId?: string
  type: ListingType
  city: string
  province: string
  name: string
  model: string
  price: string
  maxPrice: string
  originalPrice: string
  billing: BillingCycle
  quantity: string
  duration: string
  expiryDate: string
  delivery: string
  condition: string
  customCondition: string
  category: ProductCategory
  contact: string
  description: string
  images: string[]
}
export interface RecordEntry {
  id: string
  kind: 'goods' | 'article'
  date: string
  snapshot?: { title: string; emoji?: string; price?: number; unit?: string }
}
export interface MerchantApplication {
  name: string
  type: 'enterprise' | 'personal'
  status: 'pending' | 'approved'
}
export interface Feedback {
  id: string
  type: string
  content: string
  contact: string
  images: string[]
  createdAt: string
}

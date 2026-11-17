import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { listingApi } from '../services/api'
import { ApiError } from '../services/http-core'
import { apiTypeLabels, marketPrice, marketUnit, parseMarketKey, type MarketCard, type PublicListing } from '../services/listing-api'
import { useStore } from '../store'
import { usePage } from '../utils/navigation'
import { cachedMarketCard } from './remote-market'
import { BottomActions, Card, ContactSheet, Empty, Page, Tag, useContact } from './ui'
import { useListingFavorite } from './remote-favorites'

export function RemoteGoods({ recordKey }: { recordKey: string }) {
  const identity = parseMarketKey(recordKey)!
  const cached = cachedMarketCard(recordKey)
  const [detail, setDetail] = useState<PublicListing>()
  const [error, setError] = useState('')
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const visit = useStore((state) => state.visit)
  const favorite = useListingFavorite(identity.type, identity.id)
  const contact = useContact()
  const reference = `${identity.type}-${identity.id}`
  usePage(undefined, { title: detail?.title || cached?.title || '算力市供需信息',
    path: `/pages/goods/index?id=${encodeURIComponent(recordKey)}&type=${identity.type}` })
  useEffect(() => {
    let active = true
    setDetail(undefined)
    setError('')
    setMissing(false)
    setLoading(true)
    void listingApi.getPublicDetail(identity.type, identity.id).then((data) => {
      if (!active) return
      setDetail(data)
      visit(recordKey, { title: data.title })
    }).catch((reason: unknown) => {
      if (!active) return
      setMissing(reason instanceof ApiError && reason.status === 404)
      setError(reason instanceof Error ? reason.message : '加载失败，请重试')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [identity.type, identity.id, recordKey, attempt, visit])
  // Keep the card quote as a labelled fallback for older incomplete details.
  const priceCard: MarketCard | undefined = detail && identity.type === 'demand' ? {
    id: identity.id, type: identity.type, title: detail.title, category: detail.category, gpuModel: detail.gpuModel,
    images: detail.images, summary: '', budgetMin: detail.budgetMin, budgetMax: detail.budgetMax,
    currency: detail.currency, priceMin: null, priceMax: null, priceUnit: '', demandMode: detail.demandMode,
  } : detail?.quotation ? {
    id: identity.id, type: identity.type, title: detail.title, category: detail.category, gpuModel: detail.gpuModel,
    images: detail.images, summary: '', budgetMin: null, budgetMax: null, demandMode: '', ...detail.quotation,
  } : cached
  return <Page title='信息详情' isBack>
    {loading ? <View className='loading'>正在加载详细信息…</View>
      : error ? <Empty title={missing ? '信息已下架或不存在' : '详细信息加载失败'} description={missing ? undefined : error}
        action={missing ? '查看市场' : '重试'} onAction={() => missing
          ? void Taro.switchTab({ url: '/pages/mall/index' }) : setAttempt(attempt + 1)} />
        : detail && <>
          {detail.images.length ? <Swiper className='goods-gallery' indicatorDots circular>
            {detail.images.map((src) => <SwiperItem key={src}><Image src={src} mode='aspectFill'
              onClick={() => void Taro.previewImage({ current: src, urls: detail.images })} /></SwiperItem>)}
          </Swiper> : <View className='goods-hero'><Text>{identity.type === 'demand' ? '📢' : '📦'}</Text></View>}
          <Card>
            <View className='row gap'><Tag>{apiTypeLabels[identity.type]}</Tag>{detail.category && <Tag>{detail.category}</Tag>}
              {detail.demandMode && <Tag>{detail.demandMode === 'lease' ? '求租' : detail.demandMode === 'purchase' ? '求购' : detail.demandMode}</Tag>}</View>
            <Text className='goods-title'>{detail.title}</Text>
            {priceCard && <View className='price goods-price'>{identity.type === 'demand' ? '预算 ' : detail.quotation ? '报价 ' : '列表报价 '}{marketPrice(priceCard)}
              <Text className='unit'>{marketUnit(priceCard)}</Text></View>}
            {detail.originalPrice && <Text className='original-price'>原价 {detail.originalPrice}{priceCard ? marketUnit(priceCard) : ''}</Text>}
            {detail.priceNote && <View className='muted'>{detail.priceNote}</View>}
            <Text className='muted'>信息编号 {reference}</Text>
          </Card>
          <Card><Text className='strong'>详细说明</Text>
            <View className='detail-grid'>
              {detail.gpuModel && <Text>型号　{detail.gpuModel}</Text>}
              {detail.deliveryCycle && <Text>交付周期　{detail.deliveryCycle}</Text>}
              {detail.quantity !== undefined && <Text>商品数量　{detail.quantity}</Text>}
              {detail.location && <Text>交易地区　{detail.location}</Text>}
              {detail.expiresAt && <Text>有效期至　{detail.expiresAt.slice(0, 10)}</Text>}
              {detail.warranty && <Text>质保　{detail.warranty}</Text>}
              {detail.support && <Text>支持　{detail.support}</Text>}
              {detail.specifications.map((spec) => <Text key={spec.label}>{spec.label}　{spec.value}</Text>)}
            </View>
            <View className='detail-description'>{detail.description || '暂无补充说明'}</View>
          </Card>
          {detail.supplierName && <Card><Text className='strong'>供应商</Text><View className='detail-description'>{detail.supplierName}</View></Card>}
          <Card><Text className='strong'>交易提示</Text><View className='detail-description'>
            请线下核验货物后自行交易。联系平台时请提供信息类型及编号。
          </View></Card>
          {favorite.error && <View className='notice page-notice'>收藏状态读取失败：{favorite.error}，点击收藏可重试。</View>}
          <BottomActions favorite={favorite.favorite} onFavorite={favorite.toggle}
            favoriteBusy={favorite.checking || favorite.pending} onContact={contact.open} />
          {contact.visible && <ContactSheet reference={reference} onClose={contact.close} />}
        </>}
  </Page>
}

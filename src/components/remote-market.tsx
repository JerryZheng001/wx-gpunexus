import { Button, Image, Picker, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import { useDidShow, useReachBottom, useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { listingApi } from '../services/api'
import { createMarketFeed } from '../services/market-feed'
import { apiConditionLabels, apiTypeLabels, marketKey, marketPrice, marketUnit,
  type ApiCondition, type ApiListingType, type MarketCard } from '../services/listing-api'
import { useStore } from '../store'
import { go, usePage } from '../utils/navigation'
import { Empty, FloatSettle, Page, Search, Tabs, Tag } from './ui'
import { listingShare, marketShare, readMarketShareFilters } from '../utils/market-share'
import { MarketShareButton } from './market-share-button'

// Ephemeral public cards help display the list price when opening a detail page.
// Prices are still strings and the cache is never a substitute for a detail fetch.
const cardCache = new Map<string, MarketCard>()
export const cachedMarketCard = (key: string) => cardCache.get(key)
export function RemoteListingCard({ item, horizontal = false, shareable = false }: { item: MarketCard; horizontal?: boolean; shareable?: boolean }) {
  const key = marketKey(item.type, item.id)
  return <View className={`listing-card ${horizontal ? 'horizontal' : ''}`} onClick={() => {
    if (cardCache.size >= 200) cardCache.delete(cardCache.keys().next().value!)
    cardCache.set(key, item)
    void go('goods', { id: key, type: item.type })
  }}>
    <View className='listing-image'>
      {item.images[0] ? <Image src={item.images[0]} mode='aspectFill' className='listing-photo' />
        : <Text>{item.type === 'demand' ? '📢' : '📦'}</Text>}
    </View>
    <View className='listing-body'>
      <View className='listing-heading'>
        <View className='row gap'>
          <Tag color={item.type === 'sale' ? 'orange' : item.type === 'lease' ? 'blue' : 'green'}>{apiTypeLabels[item.type]}</Tag>
          {item.demandMode && <Tag>{item.demandMode === 'lease' ? '求租' : item.demandMode === 'purchase' ? '求购' : item.demandMode}</Tag>}
        </View>
        {shareable && <MarketShareButton share={listingShare(item.type, item.id, item, item)} compact />}
      </View>
      <Text className='listing-name'>{item.title}</Text>
      <Text className='listing-extra'>{[item.category, item.gpuModel].filter(Boolean).join(' · ')}</Text>
      <View className='listing-meta'>
        <Text className='price'>{item.type === 'demand' ? '预算 ' : ''}{marketPrice(item)}<Text className='unit'>{marketUnit(item)}</Text></Text>
      </View>
    </View>
  </View>
}

export function RemoteMall() {
  const params = useRouter().params
  const initial = useMemo(() => readMarketShareFilters(params.market), [params.market])
  const keyword = useStore((state) => state.searchKeyword)
  const setKeyword = useStore((state) => state.setSearch)
  const [type, setType] = useState<ApiListingType | 'all'>(initial.type || 'all')
  const [condition, setCondition] = useState<ApiCondition | ''>(initial.condition || '')
  const [sort, setSort] = useState<'latest' | 'priceAsc' | 'priceDesc'>(initial.sort === 'price' ? initial.order === 'asc' ? 'priceAsc' : 'priceDesc' : 'latest')
  const share = marketShare({ keyword, type: type === 'all' ? undefined : type, condition: condition || undefined,
    sort: sort === 'latest' ? 'published_at' : 'price', order: sort === 'priceAsc' ? 'asc' : 'desc' })
  usePage(3, share)
  useEffect(() => {
    if (params.market === undefined) return
    setKeyword(initial.keyword || ''); setType(initial.type || 'all'); setCondition(initial.condition || '')
    setSort(initial.sort === 'price' ? initial.order === 'asc' ? 'priceAsc' : 'priceDesc' : 'latest')
  }, [initial, params.market, setKeyword])
  const feed = useMemo(() => createMarketFeed(listingApi.getMarket), [])
  const state = useSyncExternalStore(feed.subscribe, feed.getSnapshot)
  useEffect(() => {
    feed.reset({ type: type === 'all' ? undefined : type, condition: condition || undefined, keyword,
      sort: sort === 'latest' ? 'published_at' : 'price', order: sort === 'priceAsc' ? 'asc' : 'desc' })
    const timer = setTimeout(() => void feed.refresh(), 250)
    return () => { clearTimeout(timer); feed.cancel() }
  }, [feed, keyword, type, condition, sort])
  useReachBottom(() => { if (!state.error) void feed.next() })
  useDidShow(() => { if ((feed.getSnapshot().page > 0 || feed.getSnapshot().error) && !feed.getSnapshot().loading) {
    feed.reset({ type: type === 'all' ? undefined : type, condition: condition || undefined, keyword,
      sort: sort === 'latest' ? 'published_at' : 'price', order: sort === 'priceAsc' ? 'asc' : 'desc' })
    void feed.refresh()
  } })
  const conditions = ['', ...Object.keys(apiConditionLabels)] as Array<ApiCondition | ''>
  return <Page title='供需市场' subtitle='看中联系平台，线下核验成交'>
    <Search value={keyword} onChange={setKeyword} onSearch={() => void feed.refresh()} />
    <View className='page-gutter'><Tabs value={type} onChange={setType} items={[
      { value: 'all', label: '全部' }, { value: 'sale', label: '售卖' },
      { value: 'lease', label: '租赁' }, { value: 'demand', label: '需求' },
    ]} /></View>
    <View className='filter-row'>
      <Text className={`filter-chip ${sort === 'latest' ? 'active' : ''}`} onClick={() => setSort('latest')}>最新 ↓</Text>
      <Text className={`filter-chip ${sort !== 'latest' ? 'active' : ''}`}
        onClick={() => setSort(sort === 'priceAsc' ? 'priceDesc' : 'priceAsc')}>价格 {sort === 'priceAsc' ? '↑' : '↓'}</Text>
      <Picker mode='selector' range={conditions.map((value) => value ? apiConditionLabels[value] : '全部成色')}
        value={conditions.indexOf(condition)} onChange={(event) => setCondition(conditions[Number(event.detail.value)])}>
        <View className={`filter-chip ${condition ? 'active' : ''}`}>{condition ? apiConditionLabels[condition] : '成色'} ⌄</View>
      </Picker>
      <Text className='filter-chip' onClick={() => {
        feed.reset({ type: type === 'all' ? undefined : type, condition: condition || undefined, keyword,
          sort: sort === 'latest' ? 'published_at' : 'price', order: sort === 'priceAsc' ? 'asc' : 'desc' })
        void feed.refresh()
      }}>刷新</Text>
    </View>
    <View className='market-results-row'>
      <View className='results-count'>{state.page > 0 ? <>共 {state.total} 条信息{keyword && <Text> · “{keyword}”</Text>}</> : '供需信息'}</View>
      <MarketShareButton share={share} />
    </View>
    <View className='goods-grid'>{state.items.map((card) => <RemoteListingCard key={marketKey(card.type, card.id)} item={card} shareable />)}</View>
    {state.error ? <Empty title='市场信息加载失败' description={state.error} action='重试' onAction={() => void feed.retry()} />
      : state.loading || state.page === 0 ? <View className='loading'>正在加载…</View>
        : state.items.length === 0 ? <Empty title='没有找到相关信息' description='试试其他型号，或调整筛选条件' action='重置筛选'
          onAction={() => { setKeyword(''); setType('all'); setCondition(''); setSort('latest') }} />
          : state.hasMore ? <View className='page-gutter'><Button className='button ghost full' onClick={() => void feed.next()}>加载更多</Button></View>
            : <View className='results-count'>已显示全部信息</View>}
    <FloatSettle />
  </Page>
}

export function RemoteLatest() {
  const [items, setItems] = useState<MarketCard[]>([])
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void listingApi.getMarket({ page: 1, pageSize: 5 }).then((data) => {
      if (active) setItems(data.items)
    }).catch((reason: unknown) => {
      if (active) { setItems([]); setError(reason instanceof Error ? reason.message : '加载失败') }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt])
  if (loading) return <View className='loading'>正在加载最新信息…</View>
  if (error) return <Empty title='最新信息加载失败' description={error} action='重试' onAction={() => setAttempt(attempt + 1)} />
  if (!items.length) return <Empty title='暂无供需信息' />
  return <Swiper className='latest-swiper' autoplay circular interval={5000} previousMargin='0px' nextMargin='16px'>
    {items.map((item) => <SwiperItem key={marketKey(item.type, item.id)}><RemoteListingCard item={item} horizontal /></SwiperItem>)}
  </Swiper>
}

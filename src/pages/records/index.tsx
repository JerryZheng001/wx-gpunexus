import { Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { Card, Empty, ListingCard, LoadState, NewsRow, Page, QuoteTable, Tabs } from '../../components/ui'
import { useStore } from '../../store'
import type { RecordEntry } from '../../types'
import { money } from '../../utils/domain'
import { go, switchTab, usePage } from '../../utils/navigation'
import { parseMarketKey } from '../../services/listing-api'
import { marketApiEnabled } from '../../services/api'
import { RemoteFavorites } from '../../components/remote-favorites'

type FavoriteFilter = 'all' | 'article' | 'goods' | 'quote'
export default function Records() {
  const isHistory = useRouter().params.mode === 'history'
  return marketApiEnabled && !isHistory ? <RemoteFavorites /> : <LocalRecords />
}
function LocalRecords() {
  usePage()
  const isHistory = useRouter().params.mode === 'history'
  const catalog = useStore((s) => s.catalog), mine = useStore((s) => s.mine),
    articles = useStore((s) => s.articles), quotes = useStore((s) => s.quotes),
    favorites = useStore((s) => s.favorites), history = useStore((s) => s.history),
    followed = useStore((s) => s.followedQuotes),
    removeHistory = useStore((s) => s.removeHistory), toggle = useStore((s) => s.toggleFavorite)
  const [manage, setManage] = useState(false), [filter, setFilter] = useState<FavoriteFilter>('all')
  const entries = isHistory ? history : favorites.filter((entry) => filter === 'all' || entry.kind === filter)
  const goods = entries.filter((entry) => entry.kind === 'goods')
  const news = entries.filter((entry) => entry.kind === 'article')
  const quoteItems = !isHistory && (filter === 'all' || filter === 'quote')
    ? followed.flatMap((id) => quotes.filter((quote) => quote.id === id)) : []
  const count = entries.length + quoteItems.length
  const days = [...new Set(goods.map((entry) => entry.date))].sort().reverse()
  const renderRecord = (entry: RecordEntry) => {
    if (entry.kind === 'goods' && parseMarketKey(entry.id)) return <View className='record-wrap' key={`${entry.kind}-${entry.id}`}>
      <View className='unavailable-record' onClick={() => void go('goods', { id: entry.id })}>
        <Text className='unavailable-icon'>📦</Text>
        <Text className='strong block'>{entry.snapshot?.title || '市场信息'}</Text>
        {entry.snapshot?.priceLabel && <Text className='muted'>{entry.snapshot.priceLabel}</Text>}
        <Text className='field-hint'>查看最新信息 ›</Text>
      </View>
      {manage && <Text className='record-remove' onClick={() => isHistory ? removeHistory(entry.id) : toggle(entry.kind, entry.id)}>×</Text>}
    </View>
    const listing = [...catalog, ...mine].find((item) => item.id === entry.id)
    const article = articles.find((item) => item.id === entry.id)
    const unavailable = entry.kind === 'goods' ? !listing || listing.status === 'off' : !article
    return <View className='record-wrap' key={`${entry.kind}-${entry.id}`}>
      {unavailable ? <View className='unavailable-record' onClick={() => {
        if (entry.kind === 'goods') void go('goods', { id: entry.id })
      }}>
        <Text className='unavailable-icon'>{entry.snapshot?.emoji || '📦'}</Text>
        <Text className='strong block'>{entry.snapshot?.title || '原信息已失效'}</Text>
        {entry.snapshot?.price !== undefined && <Text className='muted'>原价 ¥{money(entry.snapshot.price)}{entry.snapshot.unit}</Text>}
        <Text className='field-hint'>{entry.kind === 'goods' ? '信息已下架或删除' : '资讯已失效'}</Text>
      </View> : entry.kind === 'goods' ? <ListingCard item={listing!} />
        : <Card className='news-list'><NewsRow item={article!} last /></Card>}
      {manage && <Text className='record-remove' onClick={() => {
        if (isHistory) removeHistory(entry.id)
        else toggle(entry.kind, entry.id)
      }}>×</Text>}
    </View>
  }
  return (
    <Page title={isHistory ? '浏览足迹' : '我的收藏'} isBack>
      <LoadState>
        <View className='records-top'>
          <Text>共 {count} 条</Text>
          {entries.length > 0 && <Text className='orange-text' onClick={() => setManage(!manage)}>{manage ? '完成' : '管理'}</Text>}
        </View>
        {!isHistory && <View className='page-gutter'>
          <Tabs value={filter} onChange={(value) => { setFilter(value); setManage(false) }} items={[
            { value: 'all', label: '全部' }, { value: 'article', label: '市场资讯' },
            { value: 'goods', label: '商品' }, { value: 'quote', label: '行情' },
          ]} />
        </View>}
        {count ? <>
          {news.length > 0 && <View className='record-section'><View className='record-day'>市场资讯</View>{news.map(renderRecord)}</View>}
          {days.map((day) => <View key={day}>
            <View className='record-day'>{day}</View>
            <View className='goods-grid'>{goods.filter((entry) => entry.date === day).map(renderRecord)}</View>
          </View>)}
          {quoteItems.length > 0 && <View className='record-section'>
            <View className='record-day'>行情 <Text className='muted'>点击 ♥ 可取消关注</Text></View>
            <QuoteTable items={quoteItems} />
          </View>}
        </> : <Empty title={isHistory ? '还没有浏览足迹' : filter === 'quote' ? '暂无关注的行情' : filter === 'article' ? '暂无收藏的市场资讯' : filter === 'goods' ? '暂无收藏的商品' : '还没有收藏'}
          description='发现并保留你关注的算力信息'
          action={filter === 'quote' ? '查看行情' : filter === 'article' ? '浏览资讯' : '去市场看看'}
          onAction={() => filter === 'quote' ? void go('quotes') : filter === 'article' ? void go('news') : void switchTab(3)} />}
      </LoadState>
    </Page>
  )
}

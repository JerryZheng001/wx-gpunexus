import { Swiper, SwiperItem, Text, View } from '@tarojs/components'
import { useState } from 'react'
import { useRouter } from '@tarojs/taro'
import {
  AssetSheet,
  Card,
  DemoNote,
  Empty,
  FloatSettle,
  ListingCard,
  LoadState,
  NewsRow,
  Page,
  Search,
  Section,
} from '../../components/ui'
import { useStore } from '../../store'
import { go, switchTab, usePage } from '../../utils/navigation'
import { homeQuotePool } from '../../utils/domain'
import { theme } from '../../constants/theme'
import { marketApiEnabled } from '../../services/api'
import { RemoteLatest } from '../../components/remote-market'

export default function Home() {
  usePage(0)
  const catalog = useStore((s) => s.catalog),
    quotes = useStore((s) => s.quotes),
    articles = useStore((s) => s.articles),
    followed = useStore((s) => s.followedQuotes)
  const [keyword, setKeyword] = useState(''),
    [followOnly, setFollowOnly] = useState(false),
    [assetOpen, setAssetOpen] = useState(useRouter().params.asset === '1')
  const visibleQuotes = homeQuotePool(quotes, followed, followOnly)
  const search = () => {
    useStore.getState().setSearch(keyword)
    void switchTab(3)
  }
  return (
    <Page title='算力市' subtitle='GPU 单卡 · 整机供需平台'>
      <Search
        value={keyword}
        onChange={setKeyword}
        placeholder='RTX 4090 / A100 / 8卡整机'
        button
        onSearch={search}
      />
      <View className='asset-banner' onClick={() => setAssetOpen(true)}>
        <View className='asset-banner-icon'>▥</View>
        <View className='grow'>
          <Text className='asset-banner-title'>算力资产评估</Text>
          <Text className='asset-banner-copy'>让算力可核验 · 可评估 · 可定价 · 可交易</Text>
        </View>
        <Text className='asset-banner-link'>PC 端 ›</Text>
      </View>
      <Section title='行情资讯' more='更多' onMore={() => void go('quotes')}>
        <View
          className={`follow-chip ${followOnly ? 'active' : ''}`}
          onClick={() => setFollowOnly(!followOnly)}
        >
          {followOnly ? '✓ 我的关注' : '我的关注'}
        </View>
      </Section>
      <LoadState>
        <Card className='home-quote-card'>
          {visibleQuotes.length ? (
            <Swiper
              key={String(followOnly) + followed.join()}
              className='home-quote-swiper'
              autoplay
              circular
              indicatorDots
              indicatorColor={theme.indicator}
              indicatorActiveColor={theme.primary}
              interval={4000}
            >
              {visibleQuotes.map((quote) => (
                <SwiperItem key={quote.id}>
                  <View
                    className='home-quote-slide'
                    onClick={() => void go('quote', { id: quote.id })}
                  >
                    <Text className='home-quote-icon'>{followOnly ? '🧠' : '📈'}</Text>
                    <View className='grow'>
                      <Text className='home-quote-eyebrow'>{followOnly ? '我关注的' : '最新行情'}</Text>
                      <Text className={`home-quote-name ${quote.percent >= 0 ? 'up' : 'down'}`}>{quote.name}</Text>
                      <Text className='home-quote-description'>{followOnly ? '你关注的品种有新的行情动态，点击查看' : '近 7 日价格波动持续活跃，点击查看走势'}</Text>
                    </View>
                    <Text className={`home-quote-badge ${quote.percent >= 0 ? 'up' : 'down'}`}>
                      {quote.percent >= 0 ? '↑' : '↓'}{Math.abs(quote.percent).toFixed(2)}%
                    </Text>
                  </View>
                </SwiperItem>
              ))}
            </Swiper>
          ) : (
            <Empty
              title='还没有关注的行情'
              description='去行情列表，关注你关心的型号'
              action='查看行情'
              onAction={() => void go('quotes')}
            />
          )}
        </Card>
        <Section title='市场资讯' more='更多' onMore={() => void go('news')} />
        <Card className='news-list'>
          {articles.slice(0, 5).map((article, i) => (
            <NewsRow key={article.id} item={article} last={i === 4} />
          ))}
        </Card>
        <Section title='最新信息' more='更多' onMore={() => void switchTab(3)} />
        {marketApiEnabled ? <RemoteLatest /> : <Swiper
          className='latest-swiper'
          autoplay
          circular
          interval={5000}
          previousMargin='0px'
          nextMargin='16px'
        >
          {catalog.slice(0, 5).map((item) => (
            <SwiperItem key={item.id}>
              <ListingCard item={item} horizontal />
            </SwiperItem>
          ))}
        </Swiper>}
        <DemoNote>{marketApiEnabled ? '行情与资讯为演示数据' : '演示数据 · 不代表实时行情'}</DemoNote>
      </LoadState>
      <FloatSettle />
      {assetOpen && <AssetSheet onClose={() => setAssetOpen(false)} />}
    </Page>
  )
}

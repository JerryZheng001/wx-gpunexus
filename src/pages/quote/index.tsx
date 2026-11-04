import { Button, Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { PriceChart } from '../../components/chart'
import {
  Card,
  ContactSheet,
  DemoNote,
  Empty,
  LoadState,
  NewsRow,
  Page,
  Tabs,
  Tag,
  useContact,
} from '../../components/ui'
import { useStore } from '../../store'
import { money, percent, signed } from '../../utils/domain'
import { usePage } from '../../utils/navigation'
export default function QuoteDetail() {
  const { id } = useRouter().params
  const quotes = useStore((s) => s.quotes),
    articles = useStore((s) => s.articles),
    followed = useStore((s) => s.followedQuotes),
    toggle = useStore((s) => s.toggleQuote)
  const quote = quotes.find((value) => value.id === id)
  const [period, setPeriod] = useState('day'),
    [chartType, setChartType] = useState('line'),
    contact = useContact()
  usePage(undefined, {
    title: quote ? `${quote.name} ${money(quote.price)} ${percent(quote.percent)}` : '算力市行情',
    path: `/pages/quote/index?id=${encodeURIComponent(id || '')}`,
  })
  const on = followed.includes(id || '')
  return (
    <Page title='行情详情' isBack>
      <LoadState>
        {quote ? (
          <>
            <View className='quote-hero'>
              <Text className='quote-hero-name'>{quote.name}</Text>
              <View className='row gap'>
                <Tag>代码：{quote.code}</Tag>
                <View className='follow-chip' onClick={() => toggle(quote.id)}>
                  {on ? '✓ 已关注' : '＋ 关注'}
                </View>
              </View>
            </View>
            <Card>
              <View className='market-stats'>
                {[
                  { label: '当前最新价', value: money(quote.price), color: '' },
                  {
                    label: '今日涨跌',
                    value: signed(quote.change),
                    color: quote.percent >= 0 ? 'up' : 'down',
                  },
                  {
                    label: '涨跌幅',
                    value: percent(quote.percent),
                    color: quote.percent >= 0 ? 'up' : 'down',
                  },
                  { label: '市场热度', value: quote.heat, color: 'orange-text' },
                ].map((item) => (
                  <View className='market-stat' key={item.label}>
                    <Text>{item.label}</Text>
                    <Text className={item.color}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </Card>
            <Card>
              <View className='chart-controls'>
                <Tabs
                  compact
                  items={[
                    { value: 'day', label: '日线' },
                    { value: 'week', label: '周线' },
                    { value: 'month', label: '月线' },
                  ]}
                  value={period}
                  onChange={setPeriod}
                />
                <View
                  className='follow-chip'
                  style={{ marginRight: 0 }}
                  onClick={() => setChartType(chartType === 'line' ? 'candles' : 'line')}
                >
                  {chartType === 'line' ? 'K 线' : '折线'}
                </View>
              </View>
              <PriceChart quote={quote} period={period} candles={chartType === 'candles'} />
              <DemoNote>走势为模拟数据，仅用于页面演示</DemoNote>
            </Card>
            <Card className='news-list'>
              <View className='strong' style={{ paddingTop: '12px' }}>
                📌 相关快讯
              </View>
              {articles.slice(0, 3).map((article) => (
                <NewsRow key={article.id} item={article} />
              ))}
            </Card>
            <View className='bottom-actions'>
              <View
                className={`action-icon ${on ? 'active' : ''}`}
                onClick={() => toggle(quote.id)}
              >
                <Text>{on ? '♥' : '♡'}</Text>
                <Text>{on ? '已关注' : '关注'}</Text>
              </View>
              <Button className='action-icon' openType='share'>
                <Text className='wechat'>↗</Text>
                <Text>分享</Text>
              </Button>
              <Button className='button grow' onClick={contact.open}>
                联系平台询价
              </Button>
            </View>
            {contact.visible && <ContactSheet onClose={contact.close} reference={quote.code} />}
          </>
        ) : (
          <Empty title='未找到该型号行情' />
        )}
      </LoadState>
    </Page>
  )
}

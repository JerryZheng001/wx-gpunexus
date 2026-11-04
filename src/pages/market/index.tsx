import { Text, View } from '@tarojs/components'
import { useState } from 'react'
import {
  Card,
  DemoNote,
  LoadState,
  Page,
  QuoteTable,
  Section,
  Tabs,
  Tag,
} from '../../components/ui'
import { useStore } from '../../store'
import { go, usePage } from '../../utils/navigation'

import { PriceChart } from '../../components/chart'
import { money, percent } from '../../utils/domain'
export default function Market() {
  usePage(1)
  const quotes = useStore((s) => s.quotes)
  const [kind, setKind] = useState<'card' | 'machine'>('card')
  const items = quotes.filter((q) => q.kind === kind),
    index = items.find((q) => q.isIndex)
  return (
    <Page title='行情' subtitle='GPU 价格趋势，一站掌握'>
      <View className='page-gutter'>
        <Tabs
          items={[
            { value: 'card', label: 'GPU 单卡' },
            { value: 'machine', label: 'GPU 整机' },
          ]}
          value={kind}
          onChange={setKind}
        />
      </View>
      <LoadState>
        {index && (
          <Card>
            <View className='row'>
              <View className='grow'>
                <Text className='muted'>{index.name}</Text>
                <View className='index-number up'>
                  {money(index.price)}
                  <Text>{percent(index.percent)}</Text>
                </View>
              </View>
              <Tag>近 30 日</Tag>
            </View>
            <PriceChart quote={index} />
            <View className='chart-detail-link' onClick={() => void go('quote', { id: index.id })}>
              查看完整行情 ›
            </View>
          </Card>
        )}
        <Section title='行情列表' more='更多' onMore={() => void go('quotes', { kind })} />
        <QuoteTable items={items.slice(0, 10)} />
        <DemoNote />
      </LoadState>
    </Page>
  )
}

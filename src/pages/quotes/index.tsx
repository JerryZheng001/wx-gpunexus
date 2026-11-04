import { View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { DemoNote, Empty, LoadState, Page, QuoteTable, Search, Tabs } from '../../components/ui'
import { useStore } from '../../store'
import { normalizeSearch } from '../../utils/domain'
import { usePage } from '../../utils/navigation'
export default function Quotes() {
  usePage()
  const params = useRouter().params
  const quotes = useStore((s) => s.quotes),
    followed = useStore((s) => s.followedQuotes)
  const [kind, setKind] = useState(
      params.kind === 'card' || params.kind === 'machine' ? params.kind : 'all',
    ),
    [keyword, setKeyword] = useState('')
  const items = quotes.filter(
    (item) =>
      (kind === 'all' ||
        (kind === 'followed' && followed.includes(item.id)) ||
        item.kind === kind) &&
      normalizeSearch(item.name + item.code).includes(normalizeSearch(keyword)),
  )
  return (
    <Page title='行情列表' isBack>
      <Search value={keyword} onChange={setKeyword} placeholder='搜索 GPU 型号 / 行情代码' />
      <View className='page-gutter'>
        <Tabs
          items={[
            { value: 'all', label: '全部' },
            { value: 'card', label: '单卡' },
            { value: 'machine', label: '整机' },
            { value: 'followed', label: '我的关注' },
          ]}
          value={kind}
          onChange={setKind}
        />
      </View>
      <LoadState>
        {items.length ? (
          <QuoteTable items={items} />
        ) : (
          <Empty
            title={kind === 'followed' ? '还没有关注的行情' : '没有找到相关行情'}
            description='点击产品代码旁的 + 添加关注'
          />
        )}
        <DemoNote>演示数据 · 非实时行情报价</DemoNote>
      </LoadState>
    </Page>
  )
}

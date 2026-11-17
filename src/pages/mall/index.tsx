import { Text, View } from '@tarojs/components'
import { useState } from 'react'
import {
  DemoNote,
  Empty,
  FloatSettle,
  ListingCard,
  LoadState,
  Page,
  Search,
  Tabs,
} from '../../components/ui'
import { useStore } from '../../store'
import { usePage } from '../../utils/navigation'

import { Picker } from '@tarojs/components'
import type { ListingType } from '../../types'
import { filterListings } from '../../utils/domain'
import { conditions as conditionOptions } from '../../constants/publish'
import { marketApiEnabled } from '../../services/api'
import { RemoteMall } from '../../components/remote-market'
export default function Mall() {
  return marketApiEnabled ? <RemoteMall /> : <DemoMall />
}
function DemoMall() {
  usePage(3)
  const catalog = useStore((s) => s.catalog),
    keyword = useStore((s) => s.searchKeyword),
    setKeyword = useStore((s) => s.setSearch)
  const [type, setType] = useState<ListingType | 'all'>('all'),
    [verified, setVerified] = useState(false),
    [sort, setSort] = useState('latest'),
    [condition, setCondition] = useState('全部成色')
  const conditions = ['全部成色', ...conditionOptions.filter((value) => value !== '自定义'), '拆机']
  const items = filterListings(catalog, { keyword, type, verified, sort, condition })
  return (
    <Page title='供需市场' subtitle='看中联系平台，线下核验成交'>
      <Search value={keyword} onChange={setKeyword} />
      <View className='page-gutter'>
        <Tabs
          items={[
            { value: 'all', label: '全部' },
            { value: 'sell', label: '售卖' },
            { value: 'rent', label: '租赁' },
            { value: 'demand', label: '需求' },
          ]}
          value={type}
          onChange={setType}
        />
      </View>
      <View className='filter-row'>
        <Text
          className={`filter-chip ${sort === 'latest' ? 'active' : ''}`}
          onClick={() => setSort('latest')}
        >
          最新 ↓
        </Text>
        <Text
          className={`filter-chip ${sort !== 'latest' ? 'active' : ''}`}
          onClick={() => setSort(sort === 'priceAsc' ? 'priceDesc' : 'priceAsc')}
        >
          价格 {sort === 'priceAsc' ? '↑' : '↓'}
        </Text>
        <Picker
          mode='selector'
          range={conditions}
          value={conditions.indexOf(condition)}
          onChange={(event) => setCondition(conditions[Number(event.detail.value)])}
        >
          <View className={`filter-chip ${condition !== '全部成色' ? 'active' : ''}`}>
            {condition === '全部成色' ? '成色' : condition} ⌄
          </View>
        </Picker>
        <Text
          className={`filter-chip ${verified ? 'active' : ''}`}
          onClick={() => setVerified(!verified)}
        >
          ✓ 平台核验
        </Text>
      </View>
      <LoadState>
        <View className='results-count'>
          共 {items.length} 条信息{keyword && <Text> · “{keyword}”</Text>}
        </View>
        {items.length ? (
          <View className='goods-grid'>
            {items.map((item) => (
              <ListingCard item={item} key={item.id} />
            ))}
          </View>
        ) : (
          <Empty
            title='没有找到相关信息'
            description='试试其他型号，或调整筛选条件'
            action='重置筛选'
            onAction={() => {
              setKeyword('')
              setType('all')
              setCondition('全部成色')
              setVerified(false)
              setSort('latest')
            }}
          />
        )}
        <DemoNote>供需信息为原型演示数据</DemoNote>
      </LoadState>
      <FloatSettle />
    </Page>
  )
}

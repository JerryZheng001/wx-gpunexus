import { Button, Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import {
  Card,
  ContactSheet,
  DemoNote,
  Empty,
  ListingCard,
  LoadState,
  Page,
  Search,
  Tabs,
  Tag,
  useContact,
} from '../../components/ui'
import { useStore } from '../../store'
import { filterListings } from '../../utils/domain'
import { go, switchTab, usePage } from '../../utils/navigation'
export default function Shop() {
  const { id } = useRouter().params
  const shops = useStore((s) => s.shops),
    catalog = useStore((s) => s.catalog),
    mine = useStore((s) => s.mine),
    merchant = useStore((s) => s.merchant),
    followed = useStore((s) => s.followedShops),
    toggle = useStore((s) => s.toggleShop)
  const isMine = id === 'mine',
    on = followed.includes(id || '')
  const shop = isMine
    ? {
        id: 'mine',
        name: merchant?.name || '我的演示店铺',
        type: merchant?.type || 'personal',
        emoji: '🏪',
        fans: 0,
        days: 1,
        score: null,
        description: '新入驻的演示店铺',
      }
    : shops.find((item) => item.id === id)
  const [keyword, setKeyword] = useState(''),
    [sort, setSort] = useState('latest'),
    contact = useContact()
  usePage(undefined, {
    title: shop?.name || '算力市商家店铺',
    path: `/pages/shop/index?id=${encodeURIComponent(id || '')}`,
  })
  const source = isMine
    ? mine.filter((item) => item.status === 'show')
    : catalog.filter((item) => item.shop === id && item.type !== 'demand')
  const items = filterListings(source, { keyword, sort })
  return (
    <Page title='店铺' isBack>
      <LoadState>
        {shop ? (
          <>
            <Card>
              <View className='shop-top'>
                <View className={`shop-logo ${shop.type === 'personal' ? 'personal' : ''}`}>
                  {shop.emoji}
                </View>
                <View className='grow'>
                  <Text className='shop-name'>{shop.name}</Text>
                  <View className='row gap' style={{ marginTop: '6px' }}>
                    <Tag color={shop.type === 'enterprise' ? 'blue' : 'green'}>
                      {shop.type === 'enterprise' ? '企业入驻' : '个人入驻'}
                    </Tag>
                    <Tag>{isMine ? '本机演示' : '✓ 平台核验'}</Tag>
                  </View>
                </View>
                {!isMine && (
                  <View
                    className={`follow-chip ${on ? 'active' : ''}`}
                    onClick={() => toggle(shop.id)}
                  >
                    {on ? '已关注' : '＋ 关注'}
                  </View>
                )}
              </View>
              <Text className='shop-description'>{shop.description}</Text>
            </Card>
            <View className='stats-row'>
              {[
                { label: '在售商品', value: source.length },
                { label: '粉丝', value: shop.fans + (on ? 1 : 0) },
                { label: '开店天数', value: shop.days },
                { label: '综合评分', value: shop.score === null ? '暂无' : shop.score + '★' },
              ].map((item) => (
                <View key={item.label} className='stat'>
                  <Text className='stat-number'>{item.value}</Text>
                  <Text className='muted'>{item.label}</Text>
                </View>
              ))}
            </View>
            {isMine && (
              <Card className='shop-link' onClick={() => void go('manage')}>
                <Text>📋</Text>
                <View className='grow'>
                  <Text className='strong block'>管理商品</Text>
                  <Text className='muted'>审核中 {mine.filter((item) => item.status === 'audit').length} · 已下架 {mine.filter((item) => item.status === 'off').length} · 编辑 / 下架都在这里</Text>
                </View>
                <Text className='chevron'>›</Text>
              </Card>
            )}
            <Search value={keyword} onChange={setKeyword} placeholder='搜索本店型号 / 关键词' />
            <View className='page-gutter'>
              <Tabs
                value={sort}
                onChange={setSort}
                items={[
                  { value: 'latest', label: '推荐' },
                  { value: 'priceAsc', label: '价格 ↑' },
                  { value: 'priceDesc', label: '价格 ↓' },
                ]}
              />
            </View>
            {items.length ? (
              <View className='goods-grid'>
                {items.map((item) => (
                  <ListingCard item={item} key={item.id} onClick={isMine ? () => void go('manage') : undefined} />
                ))}
              </View>
            ) : (
              <Empty
                title={keyword ? '本店没有匹配的商品' : '店铺还没有在售信息'}
                action={isMine ? '发布第一条信息' : undefined}
                onAction={() => void switchTab(2)}
              />
            )}
            <View className='page-gutter'>
              <Button className='button' onClick={isMine ? () => void switchTab(2) : contact.open}>
                {isMine ? '＋ 发布新信息' : '联系平台对接本店'}
              </Button>
            </View>
            <DemoNote>店铺信息及评分为演示数据</DemoNote>
            {contact.visible && <ContactSheet onClose={contact.close} reference={shop.name} />}
          </>
        ) : (
          <Empty title='没有找到这家店铺' />
        )}
      </LoadState>
    </Page>
  )
}

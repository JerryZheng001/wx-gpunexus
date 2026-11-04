import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { Card, DemoNote, Empty, Page, Search, Tabs, Tag } from '../../components/ui'
import { useStore } from '../../store'
import type { Listing, ListingStatus, ListingType } from '../../types'
import { draftFromListing, filterListings, listingPrice, listingTypes, money, statuses } from '../../utils/domain'
import { go, switchTab, toast, usePage } from '../../utils/navigation'
export default function Manage() {
  usePage()
  const mine = useStore((s) => s.mine),
    setStatus = useStore((s) => s.setListingStatus),
    renew = useStore((s) => s.renewListing),
    remove = useStore((s) => s.deleteListing),
    setDraft = useStore((s) => s.setDraft)
  const merchant = useStore((s) => s.merchant)
  const [type, setType] = useState<ListingType | 'all'>('all'),
    [status, setFilterStatus] = useState<ListingStatus | 'all'>('all'),
    [keyword, setKeyword] = useState('')
  const items = filterListings(mine, { keyword, type }).filter(
    (item) => status === 'all' || item.status === status,
  )
  const edit = async (item: Listing) => {
    const current = useStore.getState().draft
    if (
      current.name || current.model || current.contact ||
      current.city ||
      current.price ||
      current.description ||
      current.images.length
    ) {
      const result = await Taro.showModal({
        title: '替换当前草稿？',
        content: '编辑这条信息会替换发布页面尚未提交的草稿。',
      })
      if (!result.confirm) return
    }
    setDraft(draftFromListing(item))
    void switchTab(2)
  }
  return (
    <Page title='发布管理' isBack>
      {merchant?.status === 'approved' && <View className='manage-shop-preview' onClick={() => void go('shop', { id: 'mine' })}>
        预览我的店铺 ›
      </View>}
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
      <Card>
        <View className='row'>
          <Text className='strong'>信息概览</Text>
          <View className='grow' />
          <Tag>本机演示</Tag>
        </View>
        <View className='manage-summary'>
          {(['show', 'audit', 'off'] as const).map((value) => (
            <View key={value} onClick={() => setFilterStatus(value)}>
              <Text
                className={`stat-number ${value === 'show' ? 'down' : value === 'audit' ? 'up' : ''}`}
              >
                {mine.filter((item) => item.status === value).length}
              </Text>
              <Text className='muted'>{statuses[value]}</Text>
            </View>
          ))}
        </View>
      </Card>
      <Search value={keyword} onChange={setKeyword} placeholder='搜索我的发布型号、城市或描述' />
      <View className='page-gutter'>
        <Tabs
          compact
          value={status}
          onChange={setFilterStatus}
          items={[
            { value: 'all', label: '全部状态' },
            ...(['show', 'audit', 'off'] as const).map((value) => ({
              value,
              label: statuses[value],
            })),
          ]}
        />
      </View>
      {items.length ? (
        items.map((item) => (
          <Card className='manage-card' key={item.id}>
            <View className='manage-card-main'>
              <View className='manage-thumb' onClick={() => void go('goods', { id: item.id })}>
                {item.emoji}
              </View>
              <View className='grow'>
                <View className='row gap'>
                  <Tag color={listingTypes[item.type].color}>{listingTypes[item.type].label}</Tag>
                  <Tag
                    color={item.status === 'show' ? 'green' : item.status === 'audit' ? 'red' : ''}
                  >
                    {statuses[item.status || 'audit']}
                  </Tag>
                </View>
                <Text className='manage-title' onClick={() => void go('goods', { id: item.id })}>
                  {item.name}
                </Text>
                <View className='row'>
                  <Text className='price'>
                    ¥{listingPrice(item)}
                    <Text className='unit'>{item.unit}</Text>
                  </Text>
                  <View className='grow' />
                  <Text className='muted'>{item.views} 浏览</Text>
                </View>
                {item.originalPrice !== undefined && <Text className='original-price'>¥{money(item.originalPrice)}{item.unit}</Text>}
                {item.expiresAt && (
                  <Text className='field-hint'>有效期至 {item.expiresAt.slice(0, 10)}</Text>
                )}
              </View>
            </View>
            <View className='manage-footer'>
              <Text className='grow'>SL-{item.id.length > 15 ? item.id.slice(-12) : item.id}</Text>
              {item.status === 'show' && (
                <>
                  <Text className='manage-action orange-text' onClick={() => void edit(item)}>
                    编辑
                  </Text>
                  <Text
                    className='manage-action'
                    onClick={() => {
                      setStatus(item.id, 'off')
                      void toast('已下架演示信息')
                    }}
                  >
                    下架
                  </Text>
                  <Text
                    className='manage-action'
                    onClick={() => {
                      renew(item.id)
                      void toast('演示有效期已延长至 30 天后')
                    }}
                  >
                    续期
                  </Text>
                </>
              )}
              {item.status === 'audit' && (
                <>
                  <Text
                    className='manage-action'
                    onClick={() => {
                      setStatus(item.id, 'off')
                      void toast('已撤回本机演示审核')
                    }}
                  >
                    撤回
                  </Text>
                  <Text
                    className='manage-action orange-text'
                    onClick={() => {
                      setStatus(item.id, 'show')
                      void toast('已模拟通过审核')
                    }}
                  >
                    模拟通过
                  </Text>
                </>
              )}
              {item.status === 'off' && (
                <>
                  <Text
                    className='manage-action orange-text'
                    onClick={() => {
                      setStatus(item.id, 'audit')
                      void toast('已进入本机演示审核')
                    }}
                  >
                    重新上架
                  </Text>
                  <Text className='manage-action' onClick={() => void edit(item)}>
                    编辑
                  </Text>
                  <Text
                    className='manage-action'
                    onClick={async () => {
                      const result = await Taro.showModal({
                        title: '删除这条演示发布？',
                        content: '删除后无法恢复。',
                      })
                      if (result.confirm) remove(item.id)
                    }}
                  >
                    删除
                  </Text>
                </>
              )}
            </View>
          </Card>
        ))
      ) : (
        <Empty title='当前筛选下没有发布记录' description='调整筛选条件，或发布第一条信息' />
      )}
      <View className='manage-new'>
        <Button className='button' onClick={() => void switchTab(2)}>
          ＋ 新建发布
        </Button>
      </View>
      <DemoNote>审核与上下架仅作用于本机演示记录</DemoNote>
    </Page>
  )
}

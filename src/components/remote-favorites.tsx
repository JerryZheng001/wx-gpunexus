import { Button, Text, View } from '@tarojs/components'
import { useDidShow, useReachBottom } from '@tarojs/taro'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { listingFavorites } from '../services/api'
import { favoriteKey, listingFavoriteTarget, type ListingFavorite } from '../services/favorites-api'
import { apiTypeLabels, type ApiListingType } from '../services/listing-api'
import { switchTab, toast, usePage } from '../utils/navigation'
import { RemoteListingCard } from './remote-market'
import { Card, Empty, Page, Tag } from './ui'

export function useListingFavorite(type: ApiListingType, id: number) {
  const target = useMemo(() => listingFavoriteTarget(type, String(id)), [type, id])
  const state = useSyncExternalStore(listingFavorites.subscribe, listingFavorites.getSnapshot)
  const [checking, setChecking] = useState(true), [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useDidShow(() => setAttempt((value) => value + 1))
  useEffect(() => {
    let active = true
    listingFavorites.syncScope()
    setChecking(true); setError('')
    void listingFavorites.lookup(target).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : '收藏状态加载失败')
    }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [target, attempt])
  const key = favoriteKey(target), pending = state.pending.includes(key)
  return {
    favorite: state.statuses[key], checking, error, pending,
    toggle: () => {
      if (pending || checking) return
      void listingFavorites.setFavorite(target).then((next) => {
        if (next !== undefined) { setError(''); void toast(next ? '已收藏' : '已取消收藏') }
      }).catch((reason: unknown) => void toast(reason instanceof Error ? reason.message : '收藏操作失败，请重试'))
    },
  }
}

export function RemoteFavorites() {
  usePage()
  const state = useSyncExternalStore(listingFavorites.subscribe, listingFavorites.getSnapshot)
  const [manage, setManage] = useState(false)
  useDidShow(() => { void listingFavorites.refresh() })
  useReachBottom(() => { if (!state.error) void listingFavorites.next() })
  const remove = (item: ListingFavorite) => {
    void listingFavorites.setFavorite(item, false).then((next) => {
      if (next === false) void toast('已取消收藏')
    }).catch((reason: unknown) => void toast(reason instanceof Error ? reason.message : '取消收藏失败，请重试'))
  }
  return <Page title='我的收藏' isBack>
    <View className='records-top'>
      <Text>{state.total === undefined ? '市场收藏' : `共 ${state.total} 条`}</Text>
      <View className='row gap'>
        <Text className='muted' onClick={() => void listingFavorites.refresh()}>刷新</Text>
        {state.items.length > 0 && <Text className='orange-text' onClick={() => setManage(!manage)}>{manage ? '完成' : '管理'}</Text>}
      </View>
    </View>
    <View className='goods-grid'>
      {state.items.map((item) => <View className='record-wrap favorite-record' key={favoriteKey(item)}>
        {item.available && item.content ? <RemoteListingCard item={item.content} />
          : <Card className='favorite-unavailable'>
            <Tag>{apiTypeLabels[item.biz]}</Tag>
            <Text className='strong block'>信息已失效</Text>
            <Text className='muted'>原信息已下架、过期或删除</Text>
            <Text className='field-hint'>编号 {item.biz}-{item.targetId}</Text>
          </Card>}
        <View className='favorite-meta'>
          <Text className='muted'>收藏于 {item.createdAt.slice(0, 10)}</Text>
          {(manage || !item.available) && <Button className='favorite-remove'
            disabled={state.pending.includes(favoriteKey(item))} onClick={() => remove(item)}>
            {state.pending.includes(favoriteKey(item)) ? '处理中…' : '取消收藏'}
          </Button>}
        </View>
      </View>)}
    </View>
    {state.error ? <Empty title='收藏加载失败' description={state.error} action='重试' onAction={() => void listingFavorites.retry()} />
      : state.loading ? <View className='loading'>正在加载收藏…</View>
        : state.page > 0 && !state.items.length ? <Empty title='还没有收藏的市场信息'
          description='在商品详情页收藏感兴趣的出售、出租或需求信息' action='去市场看看' onAction={() => void switchTab(3)} />
          : state.hasMore ? <View className='page-gutter'><Button className='button ghost full' onClick={() => void listingFavorites.next()}>加载更多</Button></View>
            : state.items.length > 0 && <View className='results-count'>已显示全部收藏</View>}
  </Page>
}

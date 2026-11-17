import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { providerApi } from '../services/api'
import { ApiError } from '../services/http-core'
import { apiTypeLabels, marketKey, marketPrice, marketUnit, parsePublicListing, type ApiListingType, type MarketCard } from '../services/listing-api'
import { normalizeLeasePayload, providerActions, providerTitle, reviewStatusLabels, type ProviderAction, type ProviderListing, type ReviewStatus } from '../services/provider-api'
import { useStore } from '../store'
import { switchTab, toast, usePage } from '../utils/navigation'
import { Card, Empty, FormText, Page, Sheet, Tabs, Tag } from './ui'

const actionLabels = { edit: '编辑', submit: '提交审核', resubmit: '重新提交审核', withdraw: '撤回审核',
  'off-shelf-request': '申请下架', delete: '删除' } as const
export function RemoteManage() {
  usePage()
  const [type, setType] = useState<ApiListingType>('sale')
  const [status, setStatus] = useState<ReviewStatus | 'all'>('all')
  const [items, setItems] = useState<ProviderListing[]>([])
  const [total, setTotal] = useState(0), [page, setPage] = useState(0), [size, setSize] = useState(20)
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [offShelf, setOffShelf] = useState<ProviderListing | null>(null), [reason, setReason] = useState('')
  const generation = useRef(0), inFlight = useRef(false), actionLock = useRef(false)
  const load = async (next: number, current = generation.current) => {
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true); setError('')
    try {
      const result = await providerApi.list(type, next, 20, status === 'all' ? undefined : status)
      if (generation.current !== current) return
      if (result.page !== next) throw new Error('服务返回的分页信息异常，请刷新')
      setItems((existing) => [...new Map((next === 1 ? result.list : [...existing, ...result.list])
        .map((item) => [marketKey(item.type, item.id), item])).values()])
      setTotal(result.total); setPage(result.page); setSize(result.pageSize)
    } catch (reason) {
      if (generation.current === current) setError(reason instanceof Error ? reason.message : '加载失败')
    } finally {
      if (generation.current === current) { inFlight.current = false; setLoading(false) }
    }
  }
  useEffect(() => {
    const current = ++generation.current
    inFlight.current = false
    setItems([]); setTotal(0); setPage(0)
    void load(1, current)
    return () => { generation.current++; inFlight.current = false }
  // The query values are captured by this generation, so stale requests are ignored.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status, attempt])
  useDidShow(() => setAttempt((value) => value + 1))
  useReachBottom(() => { if (!error && page * size < total) void load(page + 1) })
  const refresh = () => setAttempt((value) => value + 1)
  const act = async (item: ProviderListing, action: keyof typeof actionLabels, offShelfReason?: string) => {
    if (actionLock.current) return
    if (action === 'off-shelf-request' && offShelfReason === undefined) { setOffShelf(item); setReason(''); return }
    actionLock.current = true; setBusy(true)
    try {
      if (action === 'edit') {
        useStore.getState().setRemoteEdit({ type: item.type, id: item.id })
        await switchTab(2)
        return
      }
      const result = action === 'off-shelf-request' ? { confirm: true } : await Taro.showModal({ title: `${actionLabels[action]}？`,
        content: `将对“${providerTitle(item)}”执行${actionLabels[action]}。` })
      if (!result.confirm) return
      if (action === 'delete') await providerApi.remove(item)
      else await providerApi.action(item, action as ProviderAction, offShelfReason)
      setOffShelf(null)
      await toast(action === 'off-shelf-request' ? '下架申请已提交，审批前仍保持上架' : '操作成功')
      refresh()
    } catch (reason) {
      await Taro.showModal({ title: '操作未完成', content: reason instanceof Error ? reason.message : '请稍后重试', showCancel: false })
      if (reason instanceof ApiError && [403, 404, 409].includes(reason.status)) refresh()
    } finally { actionLock.current = false; setBusy(false) }
  }
  return <Page title='发布管理' isBack>
    <View className='page-gutter'><Tabs value={type} onChange={(value) => { setType(value); setStatus('all') }} items={[
      { value: 'sale', label: '售卖' }, { value: 'lease', label: '租赁' }, { value: 'demand', label: '需求' },
    ]} /></View>
    <View className='page-gutter'><Tabs compact value={status} onChange={setStatus} items={[
      { value: 'all', label: '全部' }, { value: 'draft', label: '草稿' }, { value: 'pending_review', label: '审核中' },
      { value: type === 'lease' ? 'on_sale' : 'published', label: '已上架' }, { value: 'off_shelf', label: '已下架' },
      { value: 'rejected', label: '审核未通过' },
    ]} /></View>
    {page > 0 && <View className='results-count'>共 {total} 条信息</View>}
    {items.map((item) => {
      let quote: string | undefined
      try {
        const detail = parsePublicListing(item.type === 'lease' ? normalizeLeasePayload(item.payload) : item.payload, item.type)
        const card: MarketCard = { ...detail, summary: '', id: item.id, type: item.type, priceMin: null, priceMax: null, priceUnit: '', ...detail.quotation }
        quote = `${marketPrice(card)}${marketUnit(card)}`
      } catch { /* An older private payload may not contain public display fields. */ }
      return <Card key={marketKey(item.type, item.id)}>
        <View className='row gap'><Tag>{apiTypeLabels[item.type]}</Tag><Tag>{reviewStatusLabels[item.reviewStatus]}</Tag>
          {item.offShelfRequestStatus === 'pending' && <Tag>下架申请审核中</Tag>}</View>
        <Text className='manage-title'>{providerTitle(item)}</Text>
        {quote && <View className='price'>{quote}</View>}
        <Text className='field-hint'>编号 {item.type}-{item.id}</Text>
        {item.expiresAt && <View className='field-hint'>有效期至 {item.expiresAt.slice(0, 10)}</View>}
        {item.reviewRemark && (item.reviewStatus === 'rejected' || item.reviewStatus === 'off_shelf') && <View className='notice'>{item.reviewRemark}</View>}
        <View className='manage-footer'>{providerActions(item).map((action) => <Button key={action}
          className='button small ghost' disabled={busy} onClick={() => void act(item, action)}>{actionLabels[action]}</Button>)}</View>
      </Card>
    })}
    {error ? <Empty title='发布记录加载失败' description={error} action='重试' onAction={() => page ? void load(page + 1) : refresh()} />
      : loading || !page ? <View className='loading'>正在加载…</View>
        : !items.length ? <Empty title='当前筛选下没有发布记录' />
          : page * size < total && <View className='page-gutter'><Button className='button ghost full' onClick={() => void load(page + 1)}>加载更多</Button></View>}
    <View className='page-gutter'><Button className='button full' disabled={busy} onClick={() => {
      useStore.getState().setRemoteEdit(null); void switchTab(2)
    }}>新建发布</Button></View>
    {offShelf && <Sheet title='申请下架' onClose={() => { if (!busy) setOffShelf(null) }}><Text className='strong'>{providerTitle(offShelf)}</Text>
      <FormText value={reason} onChange={setReason} placeholder='请填写下架原因' maxLength={500} />
      <View className='row gap'><Button className='button small ghost' disabled={busy} onClick={() => setOffShelf(null)}>取消</Button>
        <Button className='button small' disabled={busy || !reason.trim()} onClick={() => void act(offShelf, 'off-shelf-request', reason)}>提交申请</Button></View>
    </Sheet>}
  </Page>
}
